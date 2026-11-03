import { Router } from 'express';
import { z } from 'zod';
import { toCsv } from '../../admin/csv.js';
import { audit } from '../../audit.js';
import { STAFF_ROLES, requireUser, staff } from '../../auth/guards.js';
import { endOtherSessions } from '../../auth/sessions.js';
import { issueToken } from '../../auth/tokens.js';
import { prisma } from '../../db.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError, notFound } from '../../http/errors.js';
import { idParam, uuidParam } from '../../http/params.js';
import { userLearnerKey } from '../../http/learner.js';
import { sendMail } from '../../mail/mailer.js';
import { verifyEmailMail } from '../../mail/templates.js';
import { premiumUntil } from '../../premium/access.js';
import { formatPrice, markRefunded } from '../../premium/fulfillment.js';
import { stripe } from '../../premium/stripe.js';

// Utilisateurs (A06), commandes (A07), messages du support et journal d'audit (A09).
// Données personnelles : réservées au support et aux super-administrateurs.
export const adminPeopleRouter = Router();

const support = staff('SUPPORT', 'SUPER_ADMIN');
const superAdmin = staff('SUPER_ADMIN');
const DAY_MS = 24 * 60 * 60 * 1000;
const pageFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

// ─── Utilisateurs (A06) ─────────────────────────────────────────────────────

const usersQuery = z.object({
  q: z.string().trim().max(254).optional(),
  role: z.enum(['LEARNER', 'READONLY', 'SUPPORT', 'EDITOR', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  ...pageFields,
});

adminPeopleRouter.get('/users', support, async (req, res) => {
  const query = usersQuery.parse(req.query);
  const where: Prisma.UserWhereInput = {
    ...(query.q ? { email: { contains: query.q.toLowerCase() } } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  const now = new Date();
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        lastLoginAt: true,
        path: { select: { title: true } },
        entitlements: { where: { revokedAt: null, expiresAt: { gt: now } }, orderBy: { expiresAt: 'desc' }, take: 1, select: { expiresAt: true } },
      },
    }),
  ]);
  res.json({
    total,
    page: query.page,
    pageSize: query.pageSize,
    items: users.map(({ entitlements, ...user }) => ({ ...user, premiumUntil: entitlements[0]?.expiresAt ?? null })),
  });
});

adminPeopleRouter.get('/users/:id', support, async (req, res) => {
  const id = uuidParam.parse(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      termsAcceptedAt: true,
      termsVersion: true,
      marketingConsentAt: true,
      mfaEnabledAt: true,
      acquisitionChannel: true,
      createdAt: true,
      lastLoginAt: true,
      path: { select: { slug: true, title: true } },
      orders: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, amountCents: true, currency: true, provider: true, createdAt: true, paidAt: true, refundedAt: true, plan: { select: { name: true } } },
      },
      entitlements: { orderBy: { expiresAt: 'desc' }, select: { id: true, startsAt: true, expiresAt: true, revokedAt: true, orderId: true } },
      contactMessages: { orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, subject: true, status: true, createdAt: true } },
      _count: { select: { sessions: true } },
    },
  });
  if (!user) throw notFound('Utilisateur introuvable.');
  const learner = userLearnerKey(id);
  const [questionsSeen, examsDone, until] = await Promise.all([
    prisma.visitorQuestionState.count({ where: { learnerKey: learner } }),
    prisma.examAttempt.count({ where: { learnerKey: learner, endedAt: { not: null } } }),
    premiumUntil(id),
  ]);
  const { _count, ...rest } = user;
  res.json({ ...rest, activeSessions: _count.sessions, premiumUntil: until, progress: { questionsSeen, examsDone } });
});

const statusBody = z.object({ status: z.enum(['ACTIVE', 'DISABLED']) });

adminPeopleRouter.patch('/users/:id/status', support, async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const { status } = statusBody.parse(req.body);
  if (id === actor.userId) throw new HttpError(400, 'self_action', 'Vous ne pouvez pas modifier votre propre compte ici.');
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, status: true } });
  if (!user) throw notFound('Utilisateur introuvable.');
  // Le support gère les comptes des candidats ; les comptes de l'équipe relèvent d'un super-administrateur.
  if (STAFF_ROLES.includes(user.role) && actor.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'forbidden', 'Seul un super-administrateur peut modifier un compte de l’équipe.');
  }
  await prisma.user.update({ where: { id }, data: { status } });
  if (status === 'DISABLED') await endOtherSessions(id);
  await audit(actor.userId, status === 'DISABLED' ? 'user.disable' : 'user.enable', 'user', id);
  res.json({ ok: true });
});

const roleBody = z.object({ role: z.enum(['LEARNER', 'READONLY', 'SUPPORT', 'EDITOR', 'SUPER_ADMIN']) });

adminPeopleRouter.patch('/users/:id/role', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const { role } = roleBody.parse(req.body);
  if (id === actor.userId) throw new HttpError(400, 'self_action', 'Vous ne pouvez pas changer votre propre rôle.');
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true, emailVerifiedAt: true } });
  if (!user) throw notFound('Utilisateur introuvable.');
  if (role !== 'LEARNER' && !user.emailVerifiedAt) {
    throw new HttpError(400, 'email_not_verified', 'L’adresse email de ce compte doit être confirmée avant de lui donner un rôle dans l’équipe.');
  }
  await prisma.user.update({ where: { id }, data: { role } });
  // Un changement de droits déconnecte la personne : ses nouveaux droits s'appliquent à la prochaine connexion.
  await endOtherSessions(id);
  await audit(actor.userId, 'user.role', 'user', id, { from: user.role, to: role });
  res.json({ ok: true });
});

adminPeopleRouter.post('/users/:id/resend-verification', support, async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: { email: true, emailVerifiedAt: true } });
  if (!user) throw notFound('Utilisateur introuvable.');
  if (user.emailVerifiedAt) throw new HttpError(400, 'already_verified', 'Cette adresse est déjà confirmée.');
  const token = await issueToken(id, 'VERIFY_EMAIL', 48 * 60 * 60 * 1000);
  await sendMail(verifyEmailMail(user.email, token));
  await audit(actor.userId, 'user.resend_verification', 'user', id);
  res.json({ ok: true });
});

// Geste commercial (A07) : accès Premium offert, sans paiement, motif obligatoire et noté au journal.
const grantBody = z.object({ days: z.number().int().min(1).max(365), reason: z.string().trim().min(5).max(300) });

adminPeopleRouter.post('/users/:id/grant', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const { days, reason } = grantBody.parse(req.body);
  if (!(await prisma.user.count({ where: { id } }))) throw notFound('Utilisateur introuvable.');
  const now = new Date();
  const from = (await premiumUntil(id)) ?? now;
  const entitlement = await prisma.entitlement.create({
    data: { userId: id, startsAt: now, expiresAt: new Date(from.getTime() + days * DAY_MS) },
    select: { id: true, expiresAt: true },
  });
  await audit(actor.userId, 'user.grant_premium', 'user', id, { days, reason, entitlementId: entitlement.id });
  res.status(201).json(entitlement);
});

// ─── Commandes (A07) ────────────────────────────────────────────────────────

const ordersQuery = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED']).optional(),
  q: z.string().trim().max(254).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  ...pageFields,
});

const ordersWhere = (query: z.infer<typeof ordersQuery>): Prisma.OrderWhereInput => ({
  ...(query.status ? { status: query.status } : {}),
  ...(query.q ? { OR: [{ user: { email: { contains: query.q.toLowerCase() } } }, ...(z.uuid().safeParse(query.q).success ? [{ id: query.q }] : [])] } : {}),
  ...(query.from || query.to
    ? { createdAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lt: new Date(new Date(query.to).getTime() + DAY_MS) } : {}) } }
    : {}),
});

const orderSelect = {
  id: true,
  status: true,
  amountCents: true,
  currency: true,
  provider: true,
  providerPaymentId: true,
  waiverAcceptedAt: true,
  createdAt: true,
  paidAt: true,
  refundedAt: true,
  plan: { select: { name: true, code: true } },
  user: { select: { id: true, email: true } },
} satisfies Prisma.OrderSelect;

adminPeopleRouter.get('/orders', support, async (req, res) => {
  const query = ordersQuery.parse(req.query);
  const where = ordersWhere(query);
  const [total, items, paid] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select: orderSelect }),
    prisma.order.aggregate({ where: { ...where, status: 'PAID' }, _sum: { amountCents: true }, _count: { _all: true } }),
  ]);
  res.json({ total, page: query.page, pageSize: query.pageSize, items, paid: { count: paid._count._all, amountCents: paid._sum.amountCents ?? 0 } });
});

adminPeopleRouter.get('/orders/export.csv', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const query = ordersQuery.parse(req.query);
  const orders = await prisma.order.findMany({ where: ordersWhere(query), orderBy: { createdAt: 'asc' }, take: 10_000, select: orderSelect });
  await audit(actor.userId, 'orders.export', 'order', 'export', { count: orders.length, from: query.from, to: query.to });
  res.set('Content-Disposition', `attachment; filename="commandes-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.type('text/csv; charset=utf-8').send(
    toCsv(
      ['Commande', 'Date', 'Email', 'Formule', 'Montant TTC', 'Devise', 'Statut', 'Prestataire', 'Paiement', 'Payée le', 'Remboursée le', 'Accord accès immédiat'],
      orders.map((order) => [
        order.id,
        order.createdAt,
        order.user.email,
        order.plan.name,
        (order.amountCents / 100).toFixed(2).replace('.', ','),
        order.currency,
        order.status,
        order.provider,
        order.providerPaymentId,
        order.paidAt,
        order.refundedAt,
        order.waiverAcceptedAt,
      ]),
    ),
  );
});

/** Remboursement (A07) : auprès de Stripe pour un vrai paiement, puis révocation de l'accès Premium. */
adminPeopleRouter.post('/orders/:id/refund', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const order = await prisma.order.findUnique({ where: { id }, select: { status: true, provider: true, providerPaymentId: true, amountCents: true, currency: true } });
  if (!order) throw notFound('Commande introuvable.');
  if (order.status !== 'PAID') throw new HttpError(409, 'not_refundable', 'Seule une commande payée peut être remboursée.');
  if (order.provider === 'stripe') {
    if (!stripe || !order.providerPaymentId) throw new HttpError(503, 'payment_unavailable', 'Le remboursement doit être fait depuis le tableau de bord Stripe.');
    await stripe.refunds.create({ payment_intent: order.providerPaymentId }, { idempotencyKey: `refund-${id}` });
  }
  await markRefunded(id, actor.userId);
  res.json({ ok: true, amount: formatPrice(order.amountCents, order.currency) });
});

// ─── Formules et accès Premium (A07) ─────────────────────────────────────────

adminPeopleRouter.get('/plans', support, async (_req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { orders: { where: { status: 'PAID' } } } } },
  });
  res.json(plans.map(({ _count, ...plan }) => ({ ...plan, paidOrders: _count.orders })));
});

const planBody = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(500),
  // Prix TTC en centimes. Un changement ne s'applique qu'aux commandes suivantes.
  priceCents: z.number().int().min(100).max(100_000),
  durationDays: z.number().int().min(1).max(730),
  active: z.boolean(),
  // Pas de valeur par défaut ici : avec .partial(), elle écraserait la valeur existante à chaque modification.
  position: z.number().int().min(0).max(100).optional(),
  // Pack pour les structures : nombre de places et délai pour les activer.
  audience: z.enum(['INDIVIDUAL', 'ORGANIZATION']).optional(),
  seats: z.number().int().min(2).max(5000).nullable().optional(),
  activationDays: z.number().int().min(7).max(730).nullable().optional(),
});

/** Un pack de structure a forcément un nombre de places ; un pass individuel n'en a pas. */
function checkPlanShape(audience: string | undefined, seats: number | null | undefined) {
  if (audience === 'ORGANIZATION' && !seats) throw new HttpError(400, 'seats_required', 'Indiquez le nombre de places du pack.');
  if (audience === 'INDIVIDUAL' && seats) throw new HttpError(400, 'seats_forbidden', 'Un pass individuel n’a pas de places.');
}

adminPeopleRouter.post('/plans', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const body = planBody.extend({ code: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(40) }).parse(req.body);
  checkPlanShape(body.audience ?? 'INDIVIDUAL', body.seats);
  if (await prisma.plan.count({ where: { code: body.code } })) throw new HttpError(409, 'duplicate_plan', 'Ce code de formule existe déjà.');
  const plan = await prisma.plan.create({ data: body, select: { id: true, code: true } });
  await audit(actor.userId, 'plan.create', 'plan', plan.id, body);
  res.status(201).json(plan);
});

adminPeopleRouter.patch('/plans/:id', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const body = planBody.partial().parse(req.body);
  const plan = await prisma.plan.findUnique({ where: { id }, select: { priceCents: true, durationDays: true, active: true, audience: true, seats: true } });
  if (!plan) throw notFound('Formule introuvable.');
  checkPlanShape(body.audience ?? plan.audience, body.seats === undefined ? plan.seats : body.seats);
  await prisma.plan.update({ where: { id }, data: body });
  await audit(actor.userId, 'plan.edit', 'plan', id, { before: plan, after: body });
  res.json({ ok: true });
});

const expiringQuery = z.object({ within: z.coerce.number().int().min(1).max(365).default(30) });

/** Accès Premium qui se terminent bientôt (A07 : expirations). */
adminPeopleRouter.get('/entitlements', support, async (req, res) => {
  const { within } = expiringQuery.parse(req.query);
  const now = new Date();
  const entitlements = await prisma.entitlement.findMany({
    where: { revokedAt: null, expiresAt: { gt: now, lte: new Date(now.getTime() + within * DAY_MS) } },
    orderBy: { expiresAt: 'asc' },
    take: 200,
    select: { id: true, startsAt: true, expiresAt: true, orderId: true, user: { select: { id: true, email: true } } },
  });
  res.json(entitlements);
});

// ─── Messages du support (E17) ───────────────────────────────────────────────

const messagesQuery = z.object({ status: z.enum(['NEW', 'ANSWERED', 'CLOSED']).optional(), ...pageFields });

adminPeopleRouter.get('/messages', support, async (req, res) => {
  const query = messagesQuery.parse(req.query);
  const where = query.status ? { status: query.status } : {};
  const [total, items] = await Promise.all([
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, email: true, subject: true, message: true, status: true, createdAt: true, userId: true },
    }),
  ]);
  res.json({ total, page: query.page, pageSize: query.pageSize, items });
});

adminPeopleRouter.patch('/messages/:id', support, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const { status } = z.object({ status: z.enum(['NEW', 'ANSWERED', 'CLOSED']) }).parse(req.body);
  if (!(await prisma.contactMessage.count({ where: { id } }))) throw notFound('Message introuvable.');
  await prisma.contactMessage.update({ where: { id }, data: { status } });
  await audit(actor.userId, `message.${status.toLowerCase()}`, 'message', id);
  res.json({ ok: true });
});

// ─── Journal d'audit (A09) ───────────────────────────────────────────────────

const auditQuery = z.object({
  entity: z.string().max(40).optional(),
  action: z.string().max(60).optional(),
  ...pageFields,
});

adminPeopleRouter.get('/audit', superAdmin, async (req, res) => {
  const query = auditQuery.parse(req.query);
  const where: Prisma.AuditLogWhereInput = {
    ...(query.entity ? { entity: query.entity } : {}),
    ...(query.action ? { action: { startsWith: query.action } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, action: true, entity: true, entityId: true, details: true, createdAt: true, actor: { select: { email: true } } },
    }),
  ]);
  res.json({ total, page: query.page, pageSize: query.pageSize, items });
});
