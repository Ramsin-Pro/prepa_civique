import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { audit, normalizeChannel, track } from '../audit.js';
import { decrypt, encrypt, hashPassword, randomToken, sha256, verifyPassword } from '../auth/crypto.js';
import { STAFF_ROLES, currentPasswordLimiter, mfaLimiter, requireSensitiveSession, requireUser, tooManyAttempts } from '../auth/guards.js';
import { endOtherSessions, endSession, renewVerifiedSession, startSession } from '../auth/sessions.js';
import { consumeToken, issueToken, revokeTokens } from '../auth/tokens.js';
import { generateTotpSecret, otpauthUri, totpStep } from '../auth/totp.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import type { Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../http/errors.js';
import { mergeVisitorProgress } from '../http/learner.js';
import { sendMailInBackground } from '../mail/mailer.js';
import { alreadyRegisteredMail, changeEmailMail, emailChangedMail, resetPasswordMail, verifyEmailMail } from '../mail/templates.js';
import { premiumUntil } from '../premium/access.js';

// Comptes (E05) : inscription, confirmation de l'email, connexion, mot de passe oublié.
// Pour ce public, savoir qu'une adresse a un compte est une information sensible : les réponses
// ne révèlent jamais si un email est inscrit.
export const authRouter = Router();

const HOUR_MS = 60 * 60 * 1000;
const email = z.email('Adresse email invalide.').max(254).transform((value) => value.trim().toLowerCase());
const password = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères.')
  .max(128, 'Le mot de passe est trop long.');

const accepted = { status: 'accepted', message: 'Si l’adresse est valide, vous allez recevoir un email.' };

// Réponses propres à la personne (compte, secret de double authentification) : jamais gardées en cache.
authRouter.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Protection contre les tentatives répétées (E05) : par adresse IP, et par couple IP + email.
// Le code de double authentification et le mot de passe actuel sont en plus limités par compte (auth/guards.ts).
const skipInTests = () => config.env === 'test';
// La lecture du compte (/me), appelée à chaque page, n'est pas limitée ici : seulement les actions.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: (req) => skipInTests() || req.method === 'GET',
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: skipInTests,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.email ?? '').toLowerCase()}`,
  message: tooManyAttempts,
});
authRouter.use(authLimiter);

const registerBody = z.object({
  email,
  password,
  acceptTerms: z.literal(true, { message: 'Vous devez accepter les conditions d’utilisation.' }),
  marketingConsent: z.boolean().default(false),
  pathSlug: z.string().optional(),
  channel: z.string().max(50).optional(),
});

authRouter.post('/register', async (req, res) => {
  const body = registerBody.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } });
  if (existing) {
    // Même travail qu'une inscription (empreinte du mot de passe) et email envoyé sans l'attendre :
    // la durée de la réponse ne révèle pas que l'adresse a déjà un compte.
    await hashPassword(body.password);
    sendMailInBackground(alreadyRegisteredMail(body.email));
    res.status(202).json(accepted);
    return;
  }

  const path = body.pathSlug ? await prisma.path.findUnique({ where: { slug: body.pathSlug }, select: { id: true } }) : null;
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: await hashPassword(body.password),
      termsAcceptedAt: now,
      termsVersion: config.termsVersion,
      marketingConsentAt: body.marketingConsent ? now : null,
      pathId: path?.id ?? null,
      acquisitionChannel: normalizeChannel(body.channel),
    },
  });
  sendMailInBackground(verifyEmailMail(user.email, await issueToken(user.id, 'VERIFY_EMAIL', 48 * HOUR_MS)));
  await track('signup', { learnerKey: `user:${user.id}`, channel: body.channel });
  res.status(202).json(accepted);
});

authRouter.post('/resend-verification', async (req, res) => {
  const { email: address } = z.object({ email }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: address }, select: { id: true, email: true, emailVerifiedAt: true } });
  if (user && !user.emailVerifiedAt) sendMailInBackground(verifyEmailMail(user.email, await issueToken(user.id, 'VERIFY_EMAIL', 48 * HOUR_MS)));
  res.status(202).json(accepted);
});

// Un lien tronqué par la messagerie reçoit le même message qu'un lien expiré, pas l'erreur technique du validateur.
const linkToken = z.string().min(20, 'Ce lien n’est plus valable. Demandez-en un nouveau.');
const tokenBody = z.object({ token: linkToken });

/**
 * Confirmation de l'email (inscription ou changement d'adresse). Elle n'ouvre jamais de session : quelqu'un a pu
 * s'inscrire avec l'adresse d'une autre personne et un mot de passe qu'il connaît. La personne se connecte ensuite.
 */
authRouter.post('/verify-email', async (req, res) => {
  const { token } = tokenBody.parse(req.body);
  const record = await prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) }, select: { purpose: true } });
  const purpose = record?.purpose === 'CHANGE_EMAIL' ? 'CHANGE_EMAIL' : 'VERIFY_EMAIL';
  const used = await consumeToken(token, purpose);

  if (purpose === 'CHANGE_EMAIL') {
    const newEmail = used.newEmail!;
    const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (taken) throw new HttpError(409, 'email_taken', 'Cette adresse ne peut pas être utilisée.');
    const { email: previous } = await prisma.user.findUniqueOrThrow({ where: { id: used.userId }, select: { email: true } });
    await prisma.user.update({ where: { id: used.userId }, data: { email: newEmail, emailVerifiedAt: new Date() } });
    // Les autres appareils sont déconnectés (ce navigateur reste connecté s'il s'agit de la même personne) et les liens
    // encore envoyés à l'ancienne adresse ne servent plus. L'ancienne adresse est prévenue, au cas où ce ne serait pas elle.
    await endOtherSessions(used.userId, req.auth?.userId === used.userId ? req.auth.sessionId : undefined);
    await revokeTokens(used.userId, ['CHANGE_EMAIL', 'RESET_PASSWORD']);
    sendMailInBackground(emailChangedMail(previous));
  } else {
    await prisma.user.update({ where: { id: used.userId }, data: { emailVerifiedAt: new Date() } });
  }
  res.json({ ok: true });
});

const loginBody = z.object({ email, password: z.string().min(1).max(128) });

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email: address, password: given } = loginBody.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: address } });
  // Même réponse, même coût, que l'adresse existe ou non.
  const valid = user ? await verifyPassword(given, user.passwordHash) : await verifyPassword(given, DUMMY_HASH).then(() => false);
  if (!user || !valid) throw new HttpError(401, 'invalid_credentials', 'Email ou mot de passe incorrect.');
  if (user.status !== 'ACTIVE') throw new HttpError(403, 'account_disabled', 'Ce compte est désactivé. Contactez le support.');
  if (!user.emailVerifiedAt) throw new HttpError(403, 'email_not_verified', 'Confirmez d’abord votre adresse email : nous vous avons envoyé un lien.');

  if (req.auth) await endSession(req, res);
  await startSession(res, user.id, false);
  await mergeVisitorProgress(req, user.id);

  const isStaff = STAFF_ROLES.includes(user.role);
  res.json({
    ok: true,
    mfaRequired: user.mfaEnabledAt !== null,
    mfaSetupRequired: isStaff && config.adminMfaRequired && user.mfaEnabledAt === null,
  });
});

// Empreinte factice, pour que la vérification d'un email inconnu prenne autant de temps.
const DUMMY_HASH = await hashPassword(randomToken());

const codeBody = z.object({ code: z.string().regex(/^\s*\d{3}\s*\d{3}\s*$/, 'Le code contient 6 chiffres.') });

/**
 * Vérifie le code et le note comme utilisé : un code déjà accepté, ou plus ancien, est refusé même s'il est encore
 * dans sa fenêtre de validité (rejeu). La mise à jour conditionnelle empêche deux requêtes simultanées de l'utiliser.
 */
async function acceptTotp(
  userId: string,
  secret: string,
  code: string,
  where: Prisma.UserWhereInput = {},
  data: Prisma.UserUpdateManyMutationInput = {},
) {
  const step = totpStep(secret, code);
  if (step === null) throw new HttpError(401, 'invalid_code', 'Code incorrect.');
  const claimed = await prisma.user.updateMany({
    where: { ...where, id: userId, OR: [{ mfaLastStep: null }, { mfaLastStep: { lt: step } }] },
    data: { ...data, mfaLastStep: step },
  });
  if (claimed.count !== 1) throw new HttpError(401, 'invalid_code', 'Ce code a déjà été utilisé. Attendez le code suivant.');
}

/** Second facteur à la connexion (A09). Limité par compte : changer l'email envoyé ne donne pas d'essais en plus. */
authRouter.post('/mfa', mfaLimiter, async (req, res) => {
  const auth = requireUser(req);
  const { code } = codeBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { mfaSecret: true, mfaEnabledAt: true } });
  if (!user.mfaSecret || !user.mfaEnabledAt) throw new HttpError(400, 'mfa_not_enabled', 'La double authentification n’est pas activée.');
  await acceptTotp(auth.userId, decrypt(user.mfaSecret), code);
  await renewVerifiedSession(req, res);
  res.json({ ok: true });
});

/** Début de l'activation de la double authentification : secret et QR code à scanner. */
authRouter.post('/mfa/setup', async (req, res) => {
  const auth = requireUser(req);
  if (!STAFF_ROLES.includes(auth.role)) throw new HttpError(403, 'forbidden', 'Réservé à l’équipe.');
  if (auth.mfaEnabled) throw new HttpError(409, 'mfa_already_enabled', 'La double authentification est déjà activée.');
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: auth.userId }, data: { mfaSecret: encrypt(secret) } });
  const uri = otpauthUri(secret, auth.email, 'Repère back-office');
  res.json({ secret, otpauthUrl: uri, qrCode: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) });
});

authRouter.post('/mfa/enable', mfaLimiter, async (req, res) => {
  const auth = requireUser(req);
  const { code } = codeBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { mfaSecret: true, mfaEnabledAt: true } });
  if (!user.mfaSecret || user.mfaEnabledAt) throw new HttpError(400, 'mfa_setup_missing', 'Recommencez l’activation.');
  // Activée une seule fois, et seulement pour le secret qui vient d'être affiché.
  await acceptTotp(auth.userId, decrypt(user.mfaSecret), code, { mfaSecret: user.mfaSecret, mfaEnabledAt: null }, { mfaEnabledAt: new Date() });
  await renewVerifiedSession(req, res);
  await audit(auth.userId, 'user.mfa_enabled', 'user', auth.userId);
  res.json({ ok: true });
});

authRouter.post('/logout', async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

authRouter.get('/me', async (req, res) => {
  if (!req.auth) {
    res.json({ user: null });
    return;
  }
  const [user, until, owned, membership] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: req.auth.userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        marketingConsentAt: true,
        reminderOptInAt: true,
        examDate: true,
        path: { select: { slug: true, title: true } },
      },
    }),
    premiumUntil(req.auth.userId),
    prisma.organization.findFirst({ where: { ownerId: req.auth.userId, status: { not: 'PENDING' } }, select: { name: true } }),
    prisma.organizationMember.findFirst({
      where: { userId: req.auth.userId, removedAt: null, entitlement: { revokedAt: null, expiresAt: { gt: new Date() } } },
      orderBy: { joinedAt: 'desc' },
      select: { organization: { select: { name: true } } },
    }),
  ]);
  const isStaff = STAFF_ROLES.includes(user.role);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      staff: isStaff,
      emailVerified: user.emailVerifiedAt !== null,
      marketingConsent: user.marketingConsentAt !== null,
      reminders: user.reminderOptInAt !== null,
      examDate: user.examDate,
      path: user.path,
      premium: { active: until !== null, until },
      // Structure gérée par la personne, et structure qui lui offre son accès.
      organization: { owned: owned?.name ?? null, memberOf: membership?.organization.name ?? null },
      mfa: { enabled: req.auth.mfaEnabled, verified: req.auth.mfaVerified, required: isStaff && config.adminMfaRequired },
    },
  });
});

authRouter.post('/forgot-password', async (req, res) => {
  const { email: address } = z.object({ email }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: address }, select: { id: true, email: true, status: true } });
  if (user && user.status === 'ACTIVE') sendMailInBackground(resetPasswordMail(user.email, await issueToken(user.id, 'RESET_PASSWORD', HOUR_MS)));
  res.status(202).json(accepted);
});

authRouter.post('/reset-password', async (req, res) => {
  const { token, password: next } = z.object({ token: linkToken, password }).parse(req.body);
  const used = await consumeToken(token, 'RESET_PASSWORD');
  await prisma.user.update({ where: { id: used.userId }, data: { passwordHash: await hashPassword(next) } });
  // Toutes les sessions sont fermées et les liens en attente (changement d'adresse, autre réinitialisation) annulés.
  await endOtherSessions(used.userId);
  await revokeTokens(used.userId, ['CHANGE_EMAIL', 'RESET_PASSWORD']);
  res.json({ ok: true });
});

const changeEmailBody = z.object({ newEmail: email, password: z.string().min(1).max(128) });

/** Changement d'adresse (E16) : l'ancienne reste active tant que la nouvelle n'est pas confirmée. */
authRouter.post('/change-email', currentPasswordLimiter, async (req, res) => {
  const auth = requireSensitiveSession(req);
  const { newEmail, password: given } = changeEmailBody.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.userId }, select: { passwordHash: true } });
  if (!(await verifyPassword(given, user.passwordHash))) throw new HttpError(401, 'invalid_credentials', 'Mot de passe incorrect.');
  // Une seule demande à la fois : le lien d'une demande précédente ne fonctionne plus.
  await revokeTokens(auth.userId, ['CHANGE_EMAIL']);
  const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  // Email envoyé sans l'attendre : la durée de la réponse ne révèle pas si l'adresse a déjà un compte.
  if (!taken) sendMailInBackground(changeEmailMail(newEmail, await issueToken(auth.userId, 'CHANGE_EMAIL', 48 * HOUR_MS, newEmail)));
  res.status(202).json(accepted);
});
