import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { config } from '../config.js';

// Avant la création des comptes, un visiteur anonyme est reconnu par un cookie aléatoire.
// C'est un cookie fonctionnel (il rattache un examen blanc à son auteur) : il ne demande pas de consentement.
const COOKIE_NAME = 'visiteur';
const MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

const fingerprint = (token: string) => createHash('sha256').update(token).digest('hex');

/** Empreinte du visiteur, ou null s'il n'a pas encore de cookie. */
export function visitorHash(req: Request): string | null {
  const token: unknown = req.cookies?.[COOKIE_NAME];
  return typeof token === 'string' && token.length >= 32 ? fingerprint(token) : null;
}

/** Comme visitorHash, mais crée le cookie s'il n'existe pas encore. */
export function ensureVisitor(req: Request, res: Response): string {
  const existing = visitorHash(req);
  if (existing) return existing;

  const token = randomBytes(32).toString('base64url');
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    maxAge: MAX_AGE_MS,
    path: '/',
  });
  return fingerprint(token);
}
