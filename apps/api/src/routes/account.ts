import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../audit.js';
import { hashPassword, randomToken, verifyPassword } from '../auth/crypto.js';
import { currentPasswordLimiter, requireSensitiveSession, requireUser } from '../auth/guards.js';
import { readReminderToken } from '../auth/reminder-token.js';
import { endOtherSessions, endSession } from '../auth/sessions.js';
import { revokeTokens } from '../auth/tokens.js';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../http/errors.js';
import { uuidParam } from '../http/params.js';
import { userLearnerKey } from '../http/learner.js';
import { removeAccount } from '../maintenance/retention.js';
import { config } from '../config.js';
import { endMembership } from '../organizations/service.js';
import { premiumUntil } from '../premium/access.js';

// Profil et abonnement (E16) : parcours, consentement marketing, mot de passe, achats,
// export et suppression des données (droits RGPD, §9).
export const accountRouter = Router();

// Données personnelles (profil, commandes, export) : jamais gardées en cache par le navigateur ou un proxy.
accountRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

accountRouter.get('/', async (req, res) => {
  const auth = requireUser(req);
  const [user, until, orders, memberships, ownedOrganization, extensible] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: {
        email: true,
        createdAt: true,
        marketingConsentAt: true,
        reminderOptInAt: true,
        examDate: true,
        path: { select: { slug: true, title: true } },
      },
    }),
    premiumUntil(auth.userId),
    prisma.order.findMany({
      where: { userId: auth.userId, status: { in: ['PAID', 'REFUNDED'] } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        amountCents: true,
        currency: true,
        paidAt: true,
        refundedAt: true,
        plan: { select: { name: true } },
        entitlement: { select: { startsAt: true, expiresAt: true } },
        organization: { select: { name: true } },
      },
    }),
    prisma.organizationMember.findMany({
      where: { userId: auth.userId, removedAt: null },
      orderBy: { joinedAt: 'desc' },
      select: { id: true, joinedAt: true, shareProgressAt: true, organization: { select: { name: true } }, entitlement: { select: { expiresAt: true } } },
    }),
    prisma.organization.findFirst({ where: { ownerId: auth.userId, status: { not: 'PENDING' } }, select: { name: true } }),
    extensibleEntitlement(auth.userId),
  ]);
  res.json({
    ...user,
    premium: { active: until !== null, until },
    orders,
    memberships: memberships.map((member) => ({
      id: member.id,
      organizationName: member.organization.name,
      joinedAt: member.joinedAt,
      accessUntil: member.entitlement.expiresAt,
      shareProgress: member.shareProgressAt !== null,
    })),
    ownedOrganization: ownedOrganization?.name ?? null,
    extension: { days: config.premiumExtensionDays, available: extensible !== null },
  });
});

const profileBody = z.object({
  pathSlug: z.string().min(1).optional(),
  marketingConsent: z.boolean().optional(),
  // Rappels de révision par email : accord distinct du consentement marketing.
  reminders: z.boolean().optional(),
  examDate: z.iso.date().nullable().optional(),
});

accountRouter.patch('/', async (req, res) => {
  const auth = requireUser(req);
  const body = profileBody.parse(req.body);
  const path = body.pathSlug ? await prisma.path.findUnique({ where: { slug: body.pathSlug }, select: { id: true } }) : undefined;
  if (body.pathSlug && !path) throw new HttpError(400, 'invalid_path', 'Parcours inconnu.');
  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(path ? { pathId: path.id } : {}),
      ...(body.marketingConsent !== undefined ? { marketingConsentAt: body.marketingConsent ? new Date() : null } : {}),
      ...(body.reminders !== undefined ? { reminderOptInAt: body.reminders ? new Date() : null } : {}),
      ...(body.examDate !== undefined ? { examDate: body.examDate ? new Date(body.examDate) : null } : {}),
    },
  });
  res.status(204).end();
});

const passwordBody = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10, 'Le mot de passe doit contenir au moins 10 caractères.').max(128),
});

// Les routes qui vérifient le mot de passe actuel sont limitées par compte (currentPasswordLimiter), et refusées
// à une session qui n'a pas encore saisi son code de double authentification (requireSensitiveSession).
accountRouter.post('/password', currentPasswordLimiter, async (req, res) => {
  const auth = requireSensitiveSession(req);
  const { currentPassword, newPassword } = passwordBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new HttpError(401, 'invalid_credentials', 'Mot de passe actuel incorrect.');
  await prisma.user.update({ where: { id: auth.userId }, data: { passwordHash: await hashPassword(newPassword) } });
  // Les autres appareils sont déconnectés et les liens en attente (changement d'adresse, réinitialisation) annulés ;
  // cette session reste ouverte.
  await endOtherSessions(auth.userId, auth.sessionId);
  await revokeTokens(auth.userId, ['CHANGE_EMAIL', 'RESET_PASSWORD']);
  res.status(204).end();
});

/** Droit d'accès et de portabilité : toutes les données du compte, dans un fichier JSON. */
accountRouter.get('/export', async (req, res) => {
  const auth = requireSensitiveSession(req);
  const learnerKey = userLearnerKey(auth.userId);
  const [user, states, favorites, sheetFavorites, exams, orders, messages, memberships, organizations] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: {
        email: true,
        role: true,
        createdAt: true,
        emailVerifiedAt: true,
        termsAcceptedAt: true,
        termsVersion: true,
        marketingConsentAt: true,
        reminderOptInAt: true,
        examDate: true,
        lastLoginAt: true,
        path: { select: { title: true } },
        testimonial: { select: { displayName: true, text: true, status: true, consentAt: true } },
      },
    }),
    prisma.visitorQuestionState.findMany({
      where: { learnerKey },
      select: { box: true, attempts: true, correctCount: true, lastAnsweredAt: true, dueAt: true, question: { select: { reference: true } } },
    }),
    prisma.visitorFavorite.findMany({ where: { learnerKey }, select: { createdAt: true, question: { select: { reference: true } } } }),
    prisma.sheetFavorite.findMany({ where: { learnerKey }, select: { createdAt: true, sheet: { select: { slug: true, title: true } } } }),
    prisma.examAttempt.findMany({ where: { learnerKey }, select: { startedAt: true, endedAt: true, score: true } }),
    prisma.order.findMany({ where: { userId: auth.userId }, select: { id: true, status: true, amountCents: true, currency: true, createdAt: true, paidAt: true, plan: { select: { name: true } } } }),
    prisma.contactMessage.findMany({ where: { userId: auth.userId }, select: { subject: true, message: true, createdAt: true } }),
    prisma.organizationMember.findMany({
      where: { userId: auth.userId },
      select: { joinedAt: true, removedAt: true, shareProgressAt: true, organization: { select: { name: true } } },
    }),
    prisma.organization.findMany({
      where: { ownerId: auth.userId },
      select: { name: true, kind: true, city: true, registration: true, contactName: true, createdAt: true },
    }),
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="mes-donnees.json"');
  res.json({
    exportedAt: new Date(),
    user,
    progress: states,
    favorites,
    sheetFavorites,
    exams,
    orders,
    contactMessages: messages,
    organizationMemberships: memberships,
    organizationsManaged: organizations,
  });
});

/** Reçu d'une commande (E16), imprimable. La facture fiscale est émise par le prestataire de paiement. */
accountRouter.get('/orders/:id', async (req, res) => {
  const auth = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const order = await prisma.order.findFirst({
    where: { id, userId: auth.userId, status: { in: ['PAID', 'REFUNDED'] } },
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      provider: true,
      createdAt: true,
      paidAt: true,
      refundedAt: true,
      waiverAcceptedAt: true,
      salesTermsVersion: true,
      salesTermsAcceptedAt: true,
      plan: { select: { name: true, durationDays: true, audience: true } },
      entitlement: { select: { startsAt: true, expiresAt: true } },
      license: { select: { seats: true, seatDays: true, validUntil: true } },
      organization: { select: { name: true, registration: true, city: true } },
      user: { select: { email: true } },
    },
  });
  if (!order) throw notFound('Commande introuvable.');
  res.json(order);
});

const deleteBody = z.object({ password: z.string().min(1).max(128) });

/**
 * Suppression du compte (E16, RGPD). La progression, les favoris et les examens sont effacés. Si des achats
 * existent, la commande doit être gardée pour la comptabilité : le compte est alors anonymisé au lieu d'être effacé.
 */
accountRouter.delete('/', currentPasswordLimiter, async (req, res) => {
  const auth = requireSensitiveSession(req);
  const { password } = deleteBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(password, user.passwordHash))) throw new HttpError(401, 'invalid_credentials', 'Mot de passe incorrect.');
  // Le back-office ne doit jamais se retrouver sans super-administrateur actif.
  if (auth.role === 'SUPER_ADMIN' && (await prisma.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: auth.userId } } })) === 0) {
    throw new HttpError(
      409,
      'last_super_admin',
      'Vous êtes le dernier super-administrateur : donnez d’abord ce rôle à une autre personne de l’équipe, puis supprimez votre compte.',
    );
  }
  if (await prisma.organization.count({ where: { ownerId: auth.userId, status: { not: 'PENDING' } } })) {
    throw new HttpError(
      409,
      'organization_owner',
      'Vous gérez l’espace d’une structure. Écrivez-nous depuis la page Contact pour confier cet espace à une autre personne, puis supprimez votre compte.',
    );
  }

  const outcome = await removeAccount(auth.userId);
  await audit(null, outcome === 'anonymized' ? 'user.anonymized' : 'user.deleted', 'user', auth.userId);
  await endSession(req, res);
  res.status(204).end();
});

// ─── Témoignage (E01) : authentique, avec l'accord de son auteur, publié après modération ───

const MIN_ANSWERS_FOR_TESTIMONIAL = 20;

/** Seule une personne qui a vraiment utilisé le site peut témoigner : un examen blanc terminé ou 20 réponses. */
async function testimonialEligibility(userId: string) {
  const learner = userLearnerKey(userId);
  const [exams, answers] = await Promise.all([
    prisma.examAttempt.count({ where: { learnerKey: learner, endedAt: { not: null } } }),
    prisma.visitorQuestionState.aggregate({ where: { learnerKey: learner }, _sum: { attempts: true } }),
  ]);
  return exams > 0 || (answers._sum.attempts ?? 0) >= MIN_ANSWERS_FOR_TESTIMONIAL;
}

accountRouter.get('/testimonial', async (req, res) => {
  const auth = requireUser(req);
  const [testimonial, eligible] = await Promise.all([
    prisma.testimonial.findUnique({ where: { userId: auth.userId }, select: { displayName: true, text: true, status: true, updatedAt: true } }),
    testimonialEligibility(auth.userId),
  ]);
  res.json({ testimonial, eligible, minAnswers: MIN_ANSWERS_FOR_TESTIMONIAL });
});

const testimonialBody = z.object({
  displayName: z.string().trim().min(2, 'Indiquez un nom à afficher.').max(40),
  text: z.string().trim().min(30, 'Votre témoignage est trop court (30 caractères au moins).').max(600, 'Votre témoignage est trop long (600 caractères au plus).'),
  consent: z.literal(true, { message: 'Votre accord est nécessaire pour publier votre témoignage.' }),
});

accountRouter.put('/testimonial', async (req, res) => {
  const auth = requireUser(req);
  const body = testimonialBody.parse(req.body);
  if (!auth.emailVerified || !(await testimonialEligibility(auth.userId))) {
    throw new HttpError(403, 'not_eligible', `Pour témoigner, terminez d’abord un examen blanc ou répondez à ${MIN_ANSWERS_FOR_TESTIMONIAL} questions.`);
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { path: { select: { code: true } } } });
  // Toute modification repasse par la modération.
  const data = { displayName: body.displayName, text: body.text, status: 'PENDING' as const, consentAt: new Date(), reviewedAt: null, pathCode: user.path?.code ?? null };
  await prisma.testimonial.upsert({ where: { userId: auth.userId }, create: { userId: auth.userId, ...data }, update: data });
  res.json({ ok: true, status: 'PENDING' });
});

accountRouter.delete('/testimonial', async (req, res) => {
  const auth = requireUser(req);
  await prisma.testimonial.deleteMany({ where: { userId: auth.userId } });
  res.status(204).end();
});

// Désinscription des rappels depuis le lien de l'email, sans se connecter.
accountRouter.post('/reminders/unsubscribe', async (req, res) => {
  const invalid = 'Ce lien n’est pas valable.';
  const { token } = z.object({ token: z.string().min(10, invalid).max(300, invalid) }).parse(req.body);
  const userId = readReminderToken(token);
  if (!userId) throw new HttpError(400, 'invalid_token', invalid);
  await prisma.user.updateMany({ where: { id: userId }, data: { reminderOptInAt: null } });
  res.json({ ok: true });
});


// ─── Place offerte par une structure ─────────────────────────────────────────

const membershipBody = z.object({ shareProgress: z.boolean() });

/** La personne choisit, et peut changer à tout moment, ce qu'elle partage avec sa structure. */
accountRouter.patch('/memberships/:id', async (req, res) => {
  const auth = requireUser(req);
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const { shareProgress } = membershipBody.parse(req.body);
  const updated = await prisma.organizationMember.updateMany({
    where: { id, userId: auth.userId, removedAt: null },
    data: { shareProgressAt: shareProgress ? new Date() : null },
  });
  if (updated.count === 0) throw notFound('Place introuvable.');
  res.status(204).end();
});

/** Quitter la structure : l'accès offert s'arrête et la place est rendue à la structure. */
accountRouter.delete('/memberships/:id', async (req, res) => {
  const auth = requireUser(req);
  const id = z.coerce.number().int().positive().parse(req.params.id);
  const member = await prisma.organizationMember.findFirst({ where: { id, userId: auth.userId, removedAt: null }, select: { id: true, organizationId: true } });
  if (!member) throw notFound('Place introuvable.');
  await endMembership(member.id);
  await audit(auth.userId, 'organization.leave', 'organization', member.organizationId);
  res.status(204).end();
});

// ─── Prolongation gratuite (examen repoussé) ─────────────────────────────────

/** Pass acheté, encore actif, jamais prolongé : il peut l'être une fois. */
async function extensibleEntitlement(userId: string) {
  if (config.premiumExtensionDays === 0) return null;
  return prisma.entitlement.findFirst({
    where: { userId, orderId: { not: null }, revokedAt: null, extendedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: 'desc' },
    select: { id: true, expiresAt: true },
  });
}

accountRouter.post('/premium/extension', async (req, res) => {
  const auth = requireUser(req);
  const unavailable = () =>
    new HttpError(409, 'extension_unavailable', 'La prolongation gratuite n’est possible qu’une fois, pendant un pass en cours.');
  const entitlement = await extensibleEntitlement(auth.userId);
  if (!entitlement) throw unavailable();
  const shift = config.premiumExtensionDays * 24 * 60 * 60 * 1000;
  const now = new Date();
  const expiresAt = new Date(entitlement.expiresAt.getTime() + shift);
  await prisma.$transaction(async (tx) => {
    // Une seule prolongation, même si la demande part deux fois : la mise à jour ne passe que si le pass ne l'est pas déjà.
    const claimed = await tx.entitlement.updateMany({
      where: { id: entitlement.id, revokedAt: null, extendedAt: null },
      data: { expiresAt, extendedAt: now },
    });
    if (claimed.count !== 1) throw unavailable();
    // Les accès qui suivent ce pass (un deuxième pass, une place de structure) sont décalés d'autant. Ils commencent
    // à leur achat ou à leur activation et finissent après lui : on les reconnaît à leur création plus récente et à leur
    // fin plus tardive, pas à leur date de début. Un début déjà passé ne bouge pas.
    const later = await tx.entitlement.findMany({
      where: { userId: auth.userId, revokedAt: null, id: { gt: entitlement.id }, expiresAt: { gt: entitlement.expiresAt } },
      select: { id: true, startsAt: true, expiresAt: true },
    });
    for (const next of later) {
      await tx.entitlement.update({
        where: { id: next.id },
        data: {
          startsAt: next.startsAt > now ? new Date(next.startsAt.getTime() + shift) : next.startsAt,
          expiresAt: new Date(next.expiresAt.getTime() + shift),
        },
      });
    }
  });
  await audit(auth.userId, 'premium.extend', 'entitlement', entitlement.id, { days: config.premiumExtensionDays });
  res.json({ expiresAt });
});
