import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../audit.js';
import { hashPassword, randomToken } from '../../auth/crypto.js';
import { requireUser, staff } from '../../auth/guards.js';
import { issueToken } from '../../auth/tokens.js';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { HttpError, notFound } from '../../http/errors.js';
import { idParam, uuidParam } from '../../http/params.js';
import { sendMail } from '../../mail/mailer.js';
import { organizationPackMail, resetPasswordMail } from '../../mail/templates.js';
import { ORGANIZATION_KINDS, addLicense, endMembership, newInviteCode, seatSummary } from '../../organizations/service.js';
import { formatPrice } from '../../premium/fulfillment.js';

// Associations et structures dans le back-office : demandes de devis, structures, packs de places réglés par
// virement ou offerts en pilote. Lecture pour le support, écriture pour les super-administrateurs.
export const adminOrganizationsRouter = Router();

const support = staff('SUPPORT', 'SUPER_ADMIN');
const superAdmin = staff('SUPER_ADMIN');
const HOUR_MS = 60 * 60 * 1000;

// ─── Demandes (devis, virement, pilote) ─────────────────────────────────────

const requestsQuery = z.object({ status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']).optional() });

adminOrganizationsRouter.get('/organization-requests', support, async (req, res) => {
  const { status } = requestsQuery.parse(req.query);
  const requests = await prisma.organizationRequest.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json(requests);
});

adminOrganizationsRouter.patch('/organization-requests/:id', support, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const { status } = z.object({ status: z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED']) }).parse(req.body);
  if (!(await prisma.organizationRequest.count({ where: { id } }))) throw notFound('Demande introuvable.');
  await prisma.organizationRequest.update({ where: { id }, data: { status } });
  await audit(actor.userId, `organization_request.${status.toLowerCase()}`, 'organization_request', id);
  res.json({ ok: true });
});

// ─── Structures ──────────────────────────────────────────────────────────────

adminOrganizationsRouter.get('/organizations', support, async (_req, res) => {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      name: true,
      kind: true,
      city: true,
      status: true,
      contactName: true,
      createdAt: true,
      owner: { select: { id: true, email: true } },
      licenses: { where: { revokedAt: null }, select: { priceCents: true } },
    },
  });
  const rows = await Promise.all(
    organizations.map(async ({ licenses, ...organization }) => ({
      ...organization,
      seats: await seatSummary(organization.id),
      revenueCents: licenses.reduce((sum, license) => sum + license.priceCents, 0),
    })),
  );
  res.json(rows);
});

adminOrganizationsRouter.get('/organizations/:id', support, async (req, res) => {
  const id = uuidParam.parse(req.params.id);
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, email: true } },
      licenses: { orderBy: { createdAt: 'desc' }, include: { _count: { select: { members: { where: { removedAt: null } } } } } },
      members: {
        orderBy: { joinedAt: 'desc' },
        select: { id: true, joinedAt: true, removedAt: true, shareProgressAt: true, user: { select: { id: true, email: true } } },
      },
    },
  });
  if (!organization) throw notFound('Structure introuvable.');
  const { licenses, ...rest } = organization;
  res.json({
    ...rest,
    seats: await seatSummary(id),
    licenses: licenses.map(({ _count, ...license }) => ({ ...license, used: _count.members })),
  });
});

const createBody = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(ORGANIZATION_KINDS),
  city: z.string().trim().max(80).optional(),
  registration: z.string().trim().max(30).optional(),
  contactName: z.string().trim().min(2).max(80),
  ownerEmail: z.email().max(254).transform((value) => value.toLowerCase()),
  requestId: z.number().int().positive().optional(),
});

/**
 * Structure créée par l'équipe (paiement par virement, pilote). Si le coordinateur n'a pas encore de compte,
 * il est créé sans mot de passe et reçoit un lien pour en choisir un.
 */
adminOrganizationsRouter.post('/organizations', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const body = createBody.parse(req.body);
  let owner = await prisma.user.findUnique({ where: { email: body.ownerEmail }, select: { id: true, role: true } });
  let invited = false;
  if (!owner) {
    owner = await prisma.user.create({
      data: {
        email: body.ownerEmail,
        passwordHash: await hashPassword(randomToken()),
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        termsVersion: config.termsVersion,
      },
      select: { id: true, role: true },
    });
    await sendMail(resetPasswordMail(body.ownerEmail, await issueToken(owner.id, 'RESET_PASSWORD', 72 * HOUR_MS)));
    invited = true;
  }
  const organization = await prisma.organization.create({
    data: {
      name: body.name,
      kind: body.kind,
      city: body.city || null,
      registration: body.registration || null,
      contactName: body.contactName,
      ownerId: owner.id,
      inviteCode: newInviteCode(),
    },
    select: { id: true },
  });
  if (body.requestId) await prisma.organizationRequest.updateMany({ where: { id: body.requestId }, data: { status: 'CONVERTED' } });
  await audit(actor.userId, 'organization.create', 'organization', organization.id, { name: body.name, ownerEmail: body.ownerEmail, invited });
  res.status(201).json({ id: organization.id, invited });
});

const licenseBody = z.object({
  seats: z.number().int().min(1).max(5000),
  seatDays: z.number().int().min(7).max(730),
  activationDays: z.number().int().min(7).max(730),
  priceCents: z.number().int().min(0).max(10_000_000),
  source: z.enum(['virement', 'pilote']),
  note: z.string().trim().max(300).optional(),
});

/**
 * Pack ajouté à la main : virement reçu ou places d'essai. Une structure en attente devient active et le coordinateur est
 * prévenu. Une structure suspendue est d'abord réactivée, explicitement : un pack ne la rouvre jamais à lui seul.
 */
adminOrganizationsRouter.post('/organizations/:id/licenses', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const body = licenseBody.parse(req.body);
  const organization = await prisma.organization.findUnique({
    where: { id },
    select: { name: true, status: true, inviteCode: true, owner: { select: { email: true } } },
  });
  if (!organization) throw notFound('Structure introuvable.');
  if (organization.status === 'SUSPENDED') {
    throw new HttpError(409, 'organization_suspended', 'Cette structure est suspendue : réactivez-la avant de lui ajouter des places.');
  }
  if (body.source === 'pilote' && body.priceCents > 0) throw new HttpError(400, 'invalid_pilot', 'Un pilote est gratuit : indiquez 0 €.');
  const license = await addLicense(id, { ...body, note: body.note || null });
  await sendMail(
    organizationPackMail(organization.owner.email, {
      organizationName: organization.name,
      seats: license.seats,
      seatDays: license.seatDays,
      validUntil: license.validUntil,
      inviteCode: organization.inviteCode,
      amount: body.priceCents > 0 ? formatPrice(body.priceCents) : null,
    }),
  );
  await audit(actor.userId, 'organization.add_license', 'organization', id, body);
  res.status(201).json({ id: license.id });
});

adminOrganizationsRouter.patch('/organizations/:id', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const { status } = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) }).parse(req.body);
  if (!(await prisma.organization.count({ where: { id } }))) throw notFound('Structure introuvable.');
  await prisma.organization.update({ where: { id }, data: { status } });
  await audit(actor.userId, `organization.${status.toLowerCase()}`, 'organization', id);
  res.json({ ok: true });
});

/** Fin d'un pack (erreur, fraude) : les places ne s'activent plus et les accès offerts avec s'arrêtent. */
adminOrganizationsRouter.delete('/organizations/:id/licenses/:licenseId', superAdmin, async (req, res) => {
  const actor = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const licenseId = idParam.parse(req.params.licenseId);
  const license = await prisma.organizationLicense.findFirst({
    where: { id: licenseId, organizationId: id, revokedAt: null },
    select: { id: true, members: { where: { removedAt: null }, select: { id: true } } },
  });
  if (!license) throw notFound('Pack introuvable.');
  await prisma.organizationLicense.update({ where: { id: license.id }, data: { revokedAt: new Date() } });
  for (const member of license.members) await endMembership(member.id);
  await audit(actor.userId, 'organization.revoke_license', 'organization', id, { licenseId });
  res.status(204).end();
});
