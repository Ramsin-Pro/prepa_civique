import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { audit, track } from '../audit.js';
import { requireUser } from '../auth/guards.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../http/errors.js';
import { idParam } from '../http/params.js';
import { userLearnerKey } from '../http/learner.js';
import { sendMail } from '../mail/mailer.js';
import { organizationMemberRemovedMail, organizationRequestAckMail } from '../mail/templates.js';
import {
  MIN_GROUP_FOR_AVERAGES,
  ORGANIZATION_KINDS,
  endMembership,
  groupStatistics,
  joinOrganization,
  maskEmail,
  newInviteCode,
  normalizeCode,
  rotateInviteCode,
  seatSummary,
} from '../organizations/service.js';
import { MASTERED_BOX } from '../questions/learning.js';
import { stripe } from '../premium/stripe.js';

// Offre associations et structures : packs de places à tarif réduit, invitation des apprenants par un code,
// espace de suivi pour la structure. La personne qui active une place décide de ce qu'elle partage.
export const organizationsRouter = Router();

const planSelect = {
  code: true,
  name: true,
  description: true,
  priceCents: true,
  currency: true,
  durationDays: true,
  seats: true,
  activationDays: true,
} as const;

/** Packs proposés aux structures (page Associations). */
organizationsRouter.get('/offer', async (_req, res) => {
  const plans = await prisma.plan.findMany({ where: { active: true, audience: 'ORGANIZATION' }, orderBy: { position: 'asc' }, select: planSelect });
  res.json({ plans, paymentProvider: config.paymentProvider, kinds: ORGANIZATION_KINDS });
});

// ─── Demande de devis, de virement ou de pilote ─────────────────────────────

const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.env === 'test',
});

const requestBody = z.object({
  organizationName: z.string().trim().min(2, 'Indiquez le nom de la structure.').max(120),
  kind: z.enum(ORGANIZATION_KINDS),
  city: z.string().trim().max(80).optional(),
  contactName: z.string().trim().min(2, 'Indiquez votre nom.').max(80),
  email: z.email('Adresse email invalide.').max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  seats: z.coerce.number().int().min(1, 'Indiquez un nombre de personnes.').max(5000),
  wish: z.enum(['devis', 'virement', 'pilote']),
  message: z.string().trim().max(2000).optional(),
  // Champ invisible : rempli seulement par les robots.
  website: z.string().max(200).optional(),
});

organizationsRouter.post('/requests', requestLimiter, async (req, res) => {
  const { website, ...data } = requestBody.parse(req.body);
  // Robot : même réponse qu'une vraie demande, pour qu'il ne sache pas qu'il est repéré, mais rien n'est gardé ni envoyé.
  if (website) {
    res.status(201).json({ ok: true });
    return;
  }
  await prisma.organizationRequest.create({
    data: { ...data, city: data.city || null, phone: data.phone || null, message: data.message || null },
  });
  await sendMail(organizationRequestAckMail(data.email));
  res.status(201).json({ ok: true });
});

// ─── Achat en ligne d'un pack ────────────────────────────────────────────────

const checkoutBody = z.object({
  planCode: z.string().min(1),
  organization: z.object({
    name: z.string().trim().min(2, 'Indiquez le nom de la structure.').max(120),
    kind: z.enum(ORGANIZATION_KINDS),
    city: z.string().trim().max(80).optional(),
    registration: z.string().trim().max(30).optional(),
    contactName: z.string().trim().min(2, 'Indiquez votre nom.').max(80),
  }),
  salesTermsAccepted: z.literal(true, { message: 'Vous devez accepter les conditions générales de vente pour continuer.' }),
});

organizationsRouter.post('/checkout', async (req, res) => {
  const auth = requireUser(req);
  const body = checkoutBody.parse(req.body);
  if (!auth.emailVerified) throw new HttpError(403, 'email_not_verified', 'Confirmez votre adresse email avant de commander.');
  if (config.paymentProvider === 'none') {
    throw new HttpError(503, 'payment_unavailable', 'Le paiement en ligne n’est pas encore ouvert : demandez un devis ou une facture.');
  }
  const plan = await prisma.plan.findFirst({ where: { code: body.planCode, active: true, audience: 'ORGANIZATION' } });
  if (!plan || !plan.seats) throw notFound('Pack introuvable.');

  // Une structure par coordinateur : une deuxième commande ajoute des places à la même structure.
  const details = {
    name: body.organization.name,
    kind: body.organization.kind,
    city: body.organization.city || null,
    registration: body.organization.registration || null,
    contactName: body.organization.contactName,
  };
  const existing = await prisma.organization.findFirst({ where: { ownerId: auth.userId }, orderBy: { createdAt: 'asc' }, select: { id: true, status: true } });
  // Une structure suspendue ne commande plus de places : son espace reste fermé tant que l'équipe ne l'a pas réactivée.
  if (existing?.status === 'SUSPENDED') {
    throw new HttpError(403, 'organization_suspended', 'L’espace de votre structure est suspendu : écrivez-nous depuis la page Contact.');
  }
  const organization = existing
    ? await prisma.organization.update({ where: { id: existing.id }, data: details, select: { id: true } })
    : await prisma.organization.create({ data: { ...details, ownerId: auth.userId, inviteCode: newInviteCode() }, select: { id: true } });

  const order = await prisma.order.create({
    data: {
      userId: auth.userId,
      planId: plan.id,
      organizationId: organization.id,
      amountCents: plan.priceCents,
      currency: plan.currency,
      provider: config.paymentProvider,
      salesTermsVersion: config.salesTermsVersion,
      salesTermsAcceptedAt: new Date(),
    },
  });
  await track('checkout_start', { learnerKey: userLearnerKey(auth.userId) });

  if (config.paymentProvider === 'simulation' || !stripe) {
    res.status(201).json({ orderId: order.id, url: `/paiement/simulation?commande=${order.id}` });
    return;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'fr',
    customer_email: auth.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id, organizationId: organization.id },
    payment_intent_data: { metadata: { orderId: order.id } },
    invoice_creation: { enabled: true, invoice_data: { description: `${plan.name} pour ${details.name}`, custom_fields: details.registration ? [{ name: 'RNA / SIRET', value: details.registration }] : undefined } },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency.toLowerCase(),
          unit_amount: plan.priceCents,
          product_data: { name: `${plan.name} (${plan.seats} places)`, description: plan.description },
        },
      },
    ],
    success_url: `${config.publicUrl}/paiement/confirmation?commande=${order.id}`,
    cancel_url: `${config.publicUrl}/associations?paiement=annule`,
  });
  await prisma.order.update({ where: { id: order.id }, data: { providerSessionId: session.id } });
  res.status(201).json({ orderId: order.id, url: session.url });
});

// ─── Rejoindre une structure avec son code ──────────────────────────────────

/** Ce que voit la personne qui ouvre un lien d'invitation, avant d'activer sa place. */
organizationsRouter.get('/join/:code', async (req, res) => {
  const code = normalizeCode(z.string().min(4).max(20).parse(req.params.code));
  const organization = await prisma.organization.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true, kind: true, city: true, status: true },
  });
  if (!organization || organization.status !== 'ACTIVE') throw notFound('Ce lien d’invitation n’est pas valable.');
  const [seats, license, membership] = await Promise.all([
    seatSummary(organization.id),
    prisma.organizationLicense.findFirst({
      where: { organizationId: organization.id, revokedAt: null, validUntil: { gt: new Date() } },
      orderBy: { validUntil: 'asc' },
      select: { seatDays: true },
    }),
    req.auth
      ? prisma.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId: organization.id, userId: req.auth.userId } },
          select: { removedAt: true },
        })
      : null,
  ]);
  res.json({
    name: organization.name,
    kind: organization.kind,
    city: organization.city,
    seatsAvailable: seats.free > 0,
    seatDays: license?.seatDays ?? null,
    alreadyMember: membership ? membership.removedAt === null : false,
  });
});

const joinBody = z.object({ code: z.string().min(4).max(20), shareProgress: z.boolean().default(false) });

organizationsRouter.post('/join', async (req, res) => {
  const auth = requireUser(req);
  const { code, shareProgress } = joinBody.parse(req.body);
  if (!auth.emailVerified) throw new HttpError(403, 'email_not_verified', 'Confirmez d’abord votre adresse email, puis revenez sur ce lien.');
  const result = await joinOrganization(auth.userId, code, shareProgress);
  await audit(auth.userId, 'organization.join', 'organization', result.organizationId, { shareProgress });
  res.status(201).json(result);
});

// ─── Espace de la structure (coordinateur) ──────────────────────────────────

async function ownedOrganization(userId: string) {
  const organization = await prisma.organization.findFirst({
    where: { ownerId: userId, status: { not: 'PENDING' } },
    orderBy: { createdAt: 'asc' },
  });
  if (!organization) throw notFound('Aucune structure n’est rattachée à votre compte.');
  return organization;
}

type MemberProgress = { answered: number; mastered: number; bestExam: number | null; lastActivityAt: Date | null; weakTopics: string[] };

/**
 * Progression des membres : questions travaillées, maîtrisées, meilleur examen blanc, dernière activité, thèmes à revoir.
 * Les comptes et les dates sont calculés par la base ; seules les réponses manquées sont lues, une fois, pour les thèmes.
 */
async function memberProgress(userIds: string[]): Promise<Map<string, MemberProgress>> {
  const keys = userIds.map(userLearnerKey);
  const [answered, mastered, exams, missed] = await Promise.all([
    prisma.visitorQuestionState.groupBy({
      by: ['learnerKey'],
      where: { learnerKey: { in: keys } },
      _count: { _all: true },
      _max: { lastAnsweredAt: true },
    }),
    prisma.visitorQuestionState.groupBy({
      by: ['learnerKey'],
      where: { learnerKey: { in: keys }, box: { gte: MASTERED_BOX } },
      _count: { _all: true },
    }),
    prisma.examAttempt.groupBy({
      by: ['learnerKey'],
      where: { learnerKey: { in: keys }, endedAt: { not: null } },
      _max: { score: true, endedAt: true },
    }),
    prisma.visitorQuestionState.findMany({
      where: { learnerKey: { in: keys }, lastCorrect: false },
      select: { learnerKey: true, question: { select: { topic: { select: { title: true } } } } },
    }),
  ]);
  const answeredBy = new Map(answered.map((row) => [row.learnerKey, row]));
  const masteredBy = new Map(mastered.map((row) => [row.learnerKey, row._count._all]));
  const examsBy = new Map(exams.map((row) => [row.learnerKey, row._max]));
  const missedBy = new Map<string, Map<string, number>>();
  for (const state of missed) {
    const topics = missedBy.get(state.learnerKey) ?? new Map<string, number>();
    topics.set(state.question.topic.title, (topics.get(state.question.topic.title) ?? 0) + 1);
    missedBy.set(state.learnerKey, topics);
  }

  const progress = new Map<string, MemberProgress>();
  for (const userId of userIds) {
    const key = userLearnerKey(userId);
    const states = answeredBy.get(key);
    const exam = examsBy.get(key);
    const dates = [states?._max.lastAnsweredAt, exam?.endedAt].filter((date): date is Date => date instanceof Date);
    progress.set(userId, {
      answered: states?._count._all ?? 0,
      mastered: masteredBy.get(key) ?? 0,
      bestExam: exam ? (exam.score ?? 0) : null,
      lastActivityAt: dates.length > 0 ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null,
      weakTopics: [...(missedBy.get(key)?.entries() ?? [])]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([title]) => title),
    });
  }
  return progress;
}

organizationsRouter.get('/mine', async (req, res) => {
  const auth = requireUser(req);
  const organization = await ownedOrganization(auth.userId);
  const now = new Date();
  const [licenses, members] = await Promise.all([
    prisma.organizationLicense.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        seats: true,
        seatDays: true,
        validUntil: true,
        priceCents: true,
        source: true,
        revokedAt: true,
        createdAt: true,
        _count: { select: { members: { where: { removedAt: null } } } },
      },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId: organization.id, removedAt: null },
      orderBy: { joinedAt: 'desc' },
      select: {
        id: true,
        joinedAt: true,
        shareProgressAt: true,
        user: { select: { id: true, email: true } },
        entitlement: { select: { expiresAt: true } },
      },
    }),
  ]);
  const progress = await memberProgress(members.map((member) => member.user.id));

  // Chiffres du groupe : à partir de 5 membres, et chaque indicateur masqué s'il permettait de reconnaître une personne discrète.
  const group = groupStatistics(
    members.map((member) => ({ shared: member.shareProgressAt !== null, ...progress.get(member.user.id)! })),
    now,
  );

  res.json({
    id: organization.id,
    name: organization.name,
    kind: organization.kind,
    city: organization.city,
    registration: organization.registration,
    contactName: organization.contactName,
    status: organization.status,
    inviteCode: organization.inviteCode,
    inviteUrl: `${config.publicUrl}/rejoindre/${organization.inviteCode}`,
    seats: await seatSummary(organization.id),
    licenses: licenses.map(({ _count, ...license }) => ({
      ...license,
      used: _count.members,
      open: license.revokedAt === null && license.validUntil > now,
    })),
    group,
    minGroupForAverages: MIN_GROUP_FOR_AVERAGES,
    members: members.map((member) => {
      const shared = member.shareProgressAt !== null;
      return {
        id: member.id,
        joinedAt: member.joinedAt,
        // La fin d'accès dit si la personne avait déjà un pass (la place s'ajoute à sa fin) : seulement avec son accord.
        accessUntil: shared ? member.entitlement.expiresAt : null,
        shared,
        email: shared ? member.user.email : maskEmail(member.user.email),
        progress: shared ? progress.get(member.user.id) : null,
      };
    }),
  });
});

const organizationEditBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  city: z.string().trim().max(80).nullable().optional(),
  registration: z.string().trim().max(30).nullable().optional(),
  contactName: z.string().trim().min(2).max(80).optional(),
});

organizationsRouter.patch('/mine', async (req, res) => {
  const auth = requireUser(req);
  const organization = await ownedOrganization(auth.userId);
  const body = organizationEditBody.parse(req.body);
  await prisma.organization.update({ where: { id: organization.id }, data: body });
  res.status(204).end();
});

/** Affiche à imprimer : le lien d'invitation, le code et un QR code que l'on scanne avec l'appareil photo du téléphone. */
organizationsRouter.get('/mine/poster', async (req, res) => {
  const auth = requireUser(req);
  const organization = await ownedOrganization(auth.userId);
  const inviteUrl = `${config.publicUrl}/rejoindre/${organization.inviteCode}`;
  const qrSvg = await QRCode.toString(inviteUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
  res.json({ name: organization.name, inviteCode: organization.inviteCode, inviteUrl, qrSvg });
});

/** Nouveau lien d'invitation, si l'ancien a circulé au-delà du groupe. Les places déjà activées ne changent pas. */
organizationsRouter.post('/mine/invite-code', async (req, res) => {
  const auth = requireUser(req);
  const organization = await ownedOrganization(auth.userId);
  const inviteCode = await rotateInviteCode(organization.id);
  await audit(auth.userId, 'organization.rotate_code', 'organization', organization.id);
  res.json({ inviteCode, inviteUrl: `${config.publicUrl}/rejoindre/${inviteCode}` });
});

/** Retirer une personne : son accès offert s'arrête et la place redevient disponible. */
organizationsRouter.delete('/mine/members/:id', async (req, res) => {
  const auth = requireUser(req);
  const organization = await ownedOrganization(auth.userId);
  const id = idParam.parse(req.params.id);
  const member = await prisma.organizationMember.findFirst({
    where: { id, organizationId: organization.id, removedAt: null },
    select: { id: true, user: { select: { email: true } } },
  });
  if (!member) throw notFound('Personne introuvable.');
  await endMembership(member.id);
  await sendMail(organizationMemberRemovedMail(member.user.email, organization.name));
  await audit(auth.userId, 'organization.remove_member', 'organization', organization.id, { memberId: member.id });
  res.status(204).end();
});
