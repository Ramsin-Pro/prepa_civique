import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from '../config.js';
import type { Role } from '../generated/prisma/client.js';
import { HttpError } from '../http/errors.js';

export type Auth = NonNullable<Request['auth']>;

export function requireUser(req: Request): Auth {
  if (!req.auth) throw new HttpError(401, 'unauthenticated', 'Connectez-vous pour continuer.');
  return req.auth;
}

/**
 * Actions sensibles du compte (mot de passe, adresse email, export, suppression) : quand la double authentification
 * est activée, une session ouverte avec le seul mot de passe ne suffit pas.
 */
export function requireSensitiveSession(req: Request): Auth {
  const auth = requireUser(req);
  if (auth.mfaEnabled && !auth.mfaVerified) {
    throw new HttpError(403, 'mfa_required', 'Saisissez le code de votre application d’authentification.');
  }
  return auth;
}

export const STAFF_ROLES: Role[] = ['READONLY', 'SUPPORT', 'EDITOR', 'SUPER_ADMIN'];

/**
 * Accès au back-office (A09). Les comptes du back-office passent par la double authentification :
 * obligatoire en production (ADMIN_MFA_REQUIRED), et toujours exigée dès qu'elle est activée sur le compte.
 */
export function staff(...roles: Role[]): RequestHandler {
  const allowed = roles.length > 0 ? roles : STAFF_ROLES;
  return (req, _res, next) => {
    const auth = requireUser(req);
    if (!STAFF_ROLES.includes(auth.role)) throw new HttpError(403, 'forbidden', 'Accès réservé à l’équipe.');
    if (config.adminMfaRequired && !auth.mfaEnabled) {
      throw new HttpError(403, 'mfa_setup_required', 'Activez la double authentification pour accéder au back-office.');
    }
    if (auth.mfaEnabled && !auth.mfaVerified) {
      throw new HttpError(403, 'mfa_required', 'Saisissez le code de votre application d’authentification.');
    }
    if (!allowed.includes(auth.role)) throw new HttpError(403, 'forbidden', 'Votre rôle ne permet pas cette action.');
    next();
  };
}

export const canWrite = (role: Role, ...roles: Role[]) => roles.includes(role);

// ─── Limites par compte, en plus des limites par adresse IP ─────────────────

export const tooManyAttempts = { error: { code: 'too_many_attempts', message: 'Trop de tentatives. Réessayez dans quelques minutes.' } };

/**
 * Clé de limitation : le compte de la session, jamais un champ du corps de la requête (qu'il suffirait de changer
 * à chaque essai pour repartir de zéro). Sans session, l'adresse IP.
 */
export const accountKey = (req: Request) => (req.auth ? `user:${req.auth.userId}` : `ip:${ipKeyGenerator(req.ip ?? '')}`);

/** 5 erreurs par compte et par quart d'heure ; les essais réussis ne comptent pas. Désactivée pendant les tests. */
const accountLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.env === 'test',
    skipSuccessfulRequests: true,
    keyGenerator: accountKey,
    message: tooManyAttempts,
  });

/** Code de double authentification (connexion et activation) : 3 codes valables sur un million, il ne faut pas pouvoir tous les essayer. */
export const mfaLimiter = accountLimiter();

/** Routes qui vérifient le mot de passe actuel : une session volée ne doit pas permettre de le deviner. */
export const currentPasswordLimiter = accountLimiter();
