import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { productionProblems } from '../../src/config.js';
import { parseSender } from '../../src/mail/mailer.js';

describe('expéditeur des emails pour l’API de Brevo', () => {
  it('sépare le nom et l’adresse', () => {
    expect(parseSender('Repère <no-reply@repere.fr>')).toEqual({ name: 'Repère', email: 'no-reply@repere.fr' });
    expect(parseSender('no-reply@repere.fr')).toEqual({ email: 'no-reply@repere.fr' });
  });
});

describe('service d’emails en production', () => {
  const base = {
    publicUrl: 'https://repere.fr',
    appSecret: 'x'.repeat(40),
    databaseUrl: 'postgresql://u:secret@db/x',
    cookieSecure: true,
    contentPreview: false,
    adminMfaRequired: true,
  };
  it('accepte une clé Resend sans serveur SMTP', () => {
    expect(productionProblems({ ...base, smtpHost: undefined, resendApiKey: 're_test' })).toEqual([]);
  });
  it('accepte une clé Brevo sans serveur SMTP', () => {
    expect(productionProblems({ ...base, smtpHost: undefined, brevoApiKey: 'xkeysib-test' })).toEqual([]);
  });
  it('refuse l’absence de tout service d’emails', () => {
    expect(productionProblems({ ...base, smtpHost: undefined })).toHaveLength(1);
  });
});

describe('adresse du visiteur relayée par le site', () => {
  async function ipFor(headers: Record<string, string>, secret: string | undefined) {
    vi.resetModules();
    vi.doMock('../../src/config.js', () => ({ config: { proxySecret: secret } }));
    const { clientIpFromTrustedProxy } = await import('../../src/http/client-ip.js');
    const req = { ip: '10.0.0.1', get: (name: string) => headers[name.toLowerCase()] } as unknown as Request;
    clientIpFromTrustedProxy(req, {} as Response, () => undefined);
    vi.doUnmock('../../src/config.js');
    return req.ip;
  }
  const secret = 's'.repeat(40);

  it('prend l’adresse transmise avec le bon secret', async () => {
    expect(await ipFor({ 'x-repere-proxy': secret, 'x-repere-client-ip': '203.0.113.7' }, secret)).toBe('203.0.113.7');
  });
  it('ignore l’adresse sans le bon secret', async () => {
    expect(await ipFor({ 'x-repere-proxy': 'faux', 'x-repere-client-ip': '203.0.113.7' }, secret)).toBe('10.0.0.1');
    expect(await ipFor({ 'x-repere-client-ip': '203.0.113.7' }, secret)).toBe('10.0.0.1');
  });
  it('ignore tout quand aucun secret n’est configuré', async () => {
    expect(await ipFor({ 'x-repere-proxy': secret, 'x-repere-client-ip': '203.0.113.7' }, undefined)).toBe('10.0.0.1');
  });
});
