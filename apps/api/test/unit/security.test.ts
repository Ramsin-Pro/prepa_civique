import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { accountKey } from '../../src/auth/guards.js';
import { base32Encode, totp, totpStep, verifyTotp } from '../../src/auth/totp.js';
import { config } from '../../src/config.js';
import { sameOrigin } from '../../src/http/origin.js';

// Briques de sécurité sans base de données : codes de double authentification, clé des limites par compte,
// contrôle de l'origine des requêtes.

describe('codes de double authentification', () => {
  // Secret et valeurs de test de la RFC 6238 (SHA-1), réduits à 6 chiffres.
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  const at = (seconds: number) => seconds * 1000;

  it('calcule les codes de référence de la RFC 6238', () => {
    expect(totp(secret, at(59))).toBe('287082');
    expect(totp(secret, at(1111111109))).toBe('081804');
    expect(totp(secret, at(1111111111))).toBe('050471');
    expect(totp(secret, at(2000000000))).toBe('279037');
  });

  it('donne le pas de temps du code accepté, avec 30 secondes de tolérance de chaque côté', () => {
    const now = at(1111111111);
    const step = Math.floor(1111111111 / 30);
    expect(totpStep(secret, '050471', now)).toBe(step);
    // Code de la période précédente, encore accepté : son propre pas est rendu, pour refuser ensuite un rejeu.
    expect(totpStep(secret, '081804', now)).toBe(step - 1);
    expect(totpStep(secret, totp(secret, now + 30_000), now)).toBe(step + 1);
    expect(totpStep(secret, totp(secret, now - 60_000), now)).toBeNull();
    expect(totpStep(secret, '050 471', now)).toBe(step);
    expect(totpStep(secret, '12345', now)).toBeNull();
    expect(verifyTotp(secret, '050471', now)).toBe(true);
  });
});

describe('limites par compte', () => {
  it('comptent les essais du compte de la session, quels que soient l’email envoyé et l’adresse IP', () => {
    const attempt = (ip: string, email: string) => accountKey({ auth: { userId: 'compte-1' }, ip, body: { email } } as unknown as Request);
    expect(attempt('203.0.113.1', 'a@exemple.test')).toBe(attempt('203.0.113.2', 'b@exemple.test'));
    expect(accountKey({ ip: '203.0.113.1', body: {} } as unknown as Request)).toBe('ip:203.0.113.1');
  });
});

describe('origine des requêtes', () => {
  const site = new URL(config.publicUrl).origin;
  const run = (method: string, headers: Record<string, string> = {}) => {
    const req = { method, get: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
    let passed = false;
    sameOrigin(req, {} as never, () => {
      passed = true;
    });
    return passed;
  };

  it('accepte le site lui-même, et les clients qui ne sont pas des navigateurs', () => {
    expect(run('POST', { origin: site })).toBe(true);
    expect(run('POST')).toBe(true);
    expect(run('POST', { 'sec-fetch-site': 'same-origin' })).toBe(true);
    expect(run('POST', { 'sec-fetch-site': 'none' })).toBe(true);
    expect(run('GET', { origin: 'https://autre-site.example', 'sec-fetch-site': 'cross-site' })).toBe(true);
  });

  it('refuse un autre site, annoncé par Origin ou, sans Origin, par Sec-Fetch-Site', () => {
    expect(() => run('POST', { origin: 'https://autre-site.example' })).toThrow('Requête refusée.');
    expect(() => run('POST', { 'sec-fetch-site': 'cross-site' })).toThrow('Requête refusée.');
    expect(() => run('DELETE', { 'sec-fetch-site': 'same-site' })).toThrow('Requête refusée.');
  });
});
