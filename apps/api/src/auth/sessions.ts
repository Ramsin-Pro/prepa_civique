import type { Request, RequestHandler, Response } from 'express';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { randomToken, sha256 } from './crypto.js';
import { STAFF_ROLES } from './guards.js';

// Session de connexion : jeton aléatoire dans un cookie httpOnly, seule son empreinte est stockée.
const COOKIE_NAME = 'session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Comptes de l'équipe : la session se ferme aussi après 8 heures sans activité (poste resté ouvert).
// Les candidats gardent leur session 30 jours.
export const STAFF_IDLE_MS = 8 * 60 * 60 * 1000;
// La date de dernière activité n'est réécrite qu'au plus toutes les 10 minutes.
const TOUCH_EVERY_MS = 10 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.cookieSecure,
  path: '/',
});

export async function startSession(res: Response, userId: string, mfaVerified = false) {
  const token = randomToken();
  await prisma.session.create({
    data: { id: sha256(token), userId, mfaVerified, expiresAt: new Date(Date.now() + MAX_AGE_MS) },
  });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(), maxAge: MAX_AGE_MS });
}

export async function endSession(req: Request, res: Response) {
  if (req.auth) await prisma.session.deleteMany({ where: { id: req.auth.sessionId } });
  res.clearCookie(COOKIE_NAME, cookieOptions());
}

/** Déconnecte toutes les autres sessions (changement de mot de passe, réinitialisation). */
export async function endOtherSessions(userId: string, keepSessionId?: string) {
  await prisma.session.deleteMany({ where: { userId, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) } });
}

/**
 * Après le code de double authentification : la session ouverte avec le mot de passe est fermée et une nouvelle,
 * avec un nouveau jeton, la remplace. Un jeton connu avant le code (fixation de session) n'ouvre donc jamais le back-office.
 */
export async function renewVerifiedSession(req: Request, res: Response) {
  if (!req.auth) return;
  await prisma.session.deleteMany({ where: { id: req.auth.sessionId } });
  await startSession(res, req.auth.userId, true);
}

/** Renseigne req.auth si le cookie de session est valide, la session non expirée et le compte actif. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[COOKIE_NAME];
  if (typeof token !== 'string' || token.length < 32) return next();

  const session = await prisma.session.findUnique({
    where: { id: sha256(token) },
    select: {
      id: true,
      mfaVerified: true,
      expiresAt: true,
      lastSeenAt: true,
      user: { select: { id: true, email: true, role: true, status: true, emailVerifiedAt: true, mfaEnabledAt: true } },
    },
  });
  const now = Date.now();
  if (!session || session.expiresAt.getTime() <= now || session.user.status !== 'ACTIVE') return next();
  if (STAFF_ROLES.includes(session.user.role) && now - session.lastSeenAt.getTime() > STAFF_IDLE_MS) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return next();
  }

  req.auth = {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
    sessionId: session.id,
    emailVerified: session.user.emailVerifiedAt !== null,
    mfaEnabled: session.user.mfaEnabledAt !== null,
    mfaVerified: session.mfaVerified,
  };
  if (now - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    // updateMany : une session fermée entre-temps (déconnexion simultanée) ne fait pas échouer la requête.
    await prisma.session.updateMany({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } });
  }
  next();
};
