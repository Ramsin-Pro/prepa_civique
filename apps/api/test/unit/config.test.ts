import { afterEach, describe, expect, it, vi } from 'vitest';
import { isLocalUrl, productionProblems, readConfig } from '../../src/config.js';

// Contrôles au démarrage : aucun réglage de développement ou d'exemple sur le site public (valeurs factices).

const sound = {
  publicUrl: 'https://repere.example.fr',
  appSecret: 'k'.repeat(32),
  databaseUrl: 'postgresql://prepa:un-mot-de-passe-long@db:5432/prepa_civique',
  cookieSecure: true,
  contentPreview: false,
  adminMfaRequired: true,
  smtpHost: 'smtp-relay.brevo.com',
};

/** Variables d'un serveur de production bien configuré. */
const production = {
  NODE_ENV: 'production',
  PUBLIC_URL: 'https://repere.example.fr',
  APP_SECRET: 'k'.repeat(32),
  DATABASE_URL: 'postgresql://prepa:un-mot-de-passe-long@db:5432/prepa_civique',
  SMTP_HOST: 'smtp-relay.brevo.com',
};

/** Variable nommée en tête de chaque problème. */
const variables = (problems: string[]) => problems.map((problem) => problem.split(' ')[0]);

/** Message de l'erreur de démarrage, ou chaîne vide si la configuration est acceptée. */
function startupError(source: Record<string, string>): string {
  try {
    readConfig(source);
    return '';
  } catch (error) {
    return (error as Error).message;
  }
}

describe('productionProblems', () => {
  it('ne signale rien pour une configuration complète', () => {
    expect(productionProblems(sound)).toEqual([]);
  });

  it('nomme chaque réglage de développement', () => {
    expect(variables(productionProblems({ ...sound, adminMfaRequired: false }))).toEqual(['ADMIN_MFA_REQUIRED']);
    expect(variables(productionProblems({ ...sound, contentPreview: true }))).toEqual(['CONTENT_PREVIEW']);
    expect(variables(productionProblems({ ...sound, cookieSecure: false }))).toEqual(['COOKIE_SECURE']);
    expect(variables(productionProblems({ ...sound, publicUrl: 'http://repere.example.fr' }))).toEqual(['PUBLIC_URL']);
    expect(variables(productionProblems({ ...sound, databaseUrl: 'postgresql://prepa:change-moi@db:5432/prepa_civique' }))).toEqual([
      'DATABASE_URL',
    ]);
  });

  it('exige un APP_SECRET d’au moins 32 caractères', () => {
    expect(variables(productionProblems({ ...sound, appSecret: 'k'.repeat(31) }))).toEqual(['APP_SECRET']);
    expect(variables(productionProblems({ ...sound, appSecret: undefined }))).toEqual(['APP_SECRET']);
  });

  it('refuse un serveur d’emails vide ou local (Mailpit)', () => {
    for (const smtpHost of [undefined, '', 'mail', 'MAIL', 'localhost', '127.0.0.1']) {
      expect(variables(productionProblems({ ...sound, smtpHost }))).toEqual(['BREVO_API_KEY']);
    }
  });
});

describe('isLocalUrl', () => {
  it('reconnaît un essai sur la machine, pas un vrai domaine', () => {
    expect(isLocalUrl('http://localhost:3001')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1:3001')).toBe(true);
    expect(isLocalUrl('https://repere.example.fr')).toBe(false);
    expect(isLocalUrl('https://localhost.example.fr')).toBe(false);
  });
});

describe('démarrage en production', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuse un vrai domaine avec des réglages de développement, en listant les variables', () => {
    const message = startupError({ ...production, ADMIN_MFA_REQUIRED: 'false', CONTENT_PREVIEW: 'true', SMTP_HOST: 'mail' });
    expect(message).toMatch(/^Démarrage refusé/);
    expect(message).toMatch(/ADMIN_MFA_REQUIRED[\s\S]*CONTENT_PREVIEW[\s\S]*SMTP_HOST/);
  });

  it('ne recopie aucune valeur secrète dans le message', () => {
    const message = startupError({ ...production, APP_SECRET: 'court-mais-secret', DATABASE_URL: 'postgresql://prepa:change-moi@db:5432/prepa_civique' });
    expect(message).toMatch(/APP_SECRET[\s\S]*DATABASE_URL/);
    expect(message).not.toContain('court-mais-secret');
    expect(message).not.toContain('prepa:change-moi');
  });

  it('se contente d’un avertissement pour un essai sur localhost', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = readConfig({ ...production, PUBLIC_URL: 'http://localhost:3001', ADMIN_MFA_REQUIRED: 'false', SMTP_HOST: 'mail' });
    expect(config).toMatchObject({ cookieSecure: false, adminMfaRequired: false });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/PUBLIC_URL[\s\S]*COOKIE_SECURE[\s\S]*ADMIN_MFA_REQUIRED[\s\S]*SMTP_HOST/);
  });

  it('démarre sans message avec une configuration complète', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(readConfig(production)).toMatchObject({ cookieSecure: true, adminMfaRequired: true, contentPreview: false });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('variables de réglage', () => {
  const development = { DATABASE_URL: 'postgresql://prepa:x@localhost:5433/prepa_civique' };

  it('vides, elles prennent leur valeur par défaut (${X:-} dans docker-compose.yml)', () => {
    const config = readConfig({ ...production, COOKIE_SECURE: '', ADMIN_MFA_REQUIRED: '', CONTENT_PREVIEW: '' });
    expect(config).toMatchObject({ cookieSecure: true, adminMfaRequired: true, contentPreview: false });
  });

  it('cookies Secure par défaut selon PUBLIC_URL, quel que soit NODE_ENV', () => {
    expect(readConfig({ ...development, PUBLIC_URL: 'http://localhost:3001' }).cookieSecure).toBe(false);
    expect(readConfig({ ...development, PUBLIC_URL: 'https://recette.example.fr' }).cookieSecure).toBe(true);
    expect(readConfig({ ...development, PUBLIC_URL: 'https://recette.example.fr', COOKIE_SECURE: 'false' }).cookieSecure).toBe(false);
  });
});
