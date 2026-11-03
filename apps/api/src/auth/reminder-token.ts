import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

// Lien de désinscription des rappels de révision : signé avec APP_SECRET, utilisable sans se connecter,
// il ne permet que d'arrêter les rappels du compte concerné.

const signature = (userId: string) => createHmac('sha256', config.appSecret).update(`rappels:${userId}`).digest('base64url').slice(0, 32);

export const reminderToken = (userId: string) => `${Buffer.from(userId).toString('base64url')}.${signature(userId)}`;

/** Compte visé par un lien de désinscription, ou null si le lien n'est pas valable. */
export function readReminderToken(token: string): string | null {
  const [encoded, signed] = token.split('.');
  if (!encoded || !signed) return null;
  const userId = Buffer.from(encoded, 'base64url').toString('utf8');
  // Longueurs comparées en octets : une signature trafiquée avec des lettres accentuées ferait échouer timingSafeEqual.
  const given = Buffer.from(signed);
  const expected = Buffer.from(signature(userId));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return userId;
}
