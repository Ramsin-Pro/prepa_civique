import { prisma } from '../db.js';
import { HttpError } from '../http/errors.js';
import { randomToken, sha256 } from './crypto.js';

// Liens envoyés par email (confirmation, mot de passe oublié, changement d'adresse) : usage unique et durée limitée.
// Seule l'empreinte du jeton est stockée.

type Purpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'CHANGE_EMAIL';

export async function issueToken(userId: string, purpose: Purpose, ttlMs: number, newEmail?: string) {
  const token = randomToken();
  await prisma.emailToken.create({
    data: { userId, purpose, tokenHash: sha256(token), newEmail, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

export async function consumeToken(token: string, purpose: Purpose) {
  const record = await prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
  const now = new Date();
  // Mise à jour conditionnelle : seule une requête peut utiliser le lien, même si deux arrivent en même temps.
  const claimed = record
    ? await prisma.emailToken.updateMany({ where: { id: record.id, purpose, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } })
    : null;
  if (!record || claimed?.count !== 1) {
    throw new HttpError(400, 'invalid_token', 'Ce lien n’est plus valable. Demandez-en un nouveau.');
  }
  return record;
}

/** Annule les liens encore en attente d'un compte (par exemple un changement d'adresse quand le mot de passe change). */
export async function revokeTokens(userId: string, purposes: Purpose[]) {
  await prisma.emailToken.deleteMany({ where: { userId, purpose: { in: purposes }, usedAt: null } });
}
