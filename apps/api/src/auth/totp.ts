import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Mots de passe à usage unique basés sur le temps (TOTP, RFC 6238), compatibles avec les applications
// d'authentification courantes (Google Authenticator, Microsoft Authenticator…). Logique pure, testable.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function totp(secret: string, time = Date.now(), step = 30, digits = 6): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, '0');
}

/**
 * Pas de temps (numéro de la période de 30 secondes) du code saisi, ou null s'il est faux. Accepte le code courant
 * et ceux des 30 secondes avant et après (décalage d'horloge). Le pas sert à refuser un code déjà utilisé (rejeu).
 */
export function totpStep(secret: string, code: string, time = Date.now(), window = 1): number | null {
  const clean = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const current = Math.floor(time / 1000 / 30);
  for (let shift = -window; shift <= window; shift++) {
    const expected = totp(secret, (current + shift) * 30_000);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return current + shift;
  }
  return null;
}

export function verifyTotp(secret: string, code: string, time = Date.now(), window = 1): boolean {
  return totpStep(secret, code, time, window) !== null;
}

export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
