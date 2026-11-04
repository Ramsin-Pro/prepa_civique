import { existsSync } from 'node:fs';
import { z } from 'zod';

// En local, les variables viennent du .env à la racine du dépôt ; en Docker, de l'environnement.
const envFile = new URL('../../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Une variable vide (« X= » dans .env, ${X:-} dans docker-compose.yml) compte comme absente : sa valeur par défaut s'applique.
const blankAsUndefined = (value: unknown) => (value === '' ? undefined : value);
const optional = z.preprocess(blankAsUndefined, z.string().optional());
const flag = z.preprocess(blankAsUndefined, z.enum(['true', 'false']).optional());

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Port d'écoute. Railway et la plupart des hébergeurs le fournissent dans PORT.
  API_PORT: z.preprocess(blankAsUndefined, z.coerce.number().int().positive().optional()),
  PORT: z.preprocess(blankAsUndefined, z.coerce.number().int().positive().optional()),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
  // Adresse publique du site : liens des emails, retour du paiement, contrôle d'origine des requêtes.
  PUBLIC_URL: z.url().default('http://localhost:3001'),
  // Clé de chiffrement (secrets de double authentification). Obligatoire en production.
  APP_SECRET: optional,
  // Nombre de proxys de confiance devant l'API (Next.js relaie les appels du navigateur).
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  // Secret partagé avec le site (Vercel) : seules les requêtes qui le portent peuvent indiquer l'adresse du visiteur.
  PROXY_SECRET: z.preprocess(blankAsUndefined, z.string().min(32, 'PROXY_SECRET : au moins 32 caractères').optional()),
  // Cookies réservés à HTTPS. Vide : oui dès que PUBLIC_URL commence par https://.
  COOKIE_SECURE: flag,
  // Développement seulement : affiche aussi les questions « à relire ». Jamais en production (cahier §7).
  CONTENT_PREVIEW: flag,
  // Version des CGU acceptée à l'inscription (E05).
  TERMS_VERSION: z.string().default('2026-10-31'),
  // Version des CGV acceptée à chaque commande (E15).
  SALES_TERMS_VERSION: z.string().default('2026-10-31'),

  // Emails transactionnels (Brevo en production, Mailpit en développement)
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optional,
  SMTP_PASSWORD: optional,
  // Emails par API HTTP (hébergeurs qui ferment les ports SMTP, comme Railway), prioritaires sur SMTP_HOST :
  // Resend si RESEND_API_KEY est renseignée, sinon Brevo si BREVO_API_KEY l'est.
  RESEND_API_KEY: optional,
  BREVO_API_KEY: optional,
  MAIL_FROM: z.string().default('Repère <no-reply@repere.test>'),

  // Paiement (E15). Sans clé Stripe, le développement utilise un paiement simulé.
  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,

  // Synthèse vocale Microsoft Azure Speech, voix Rémy
  AZURE_SPEECH_KEY: optional,
  AZURE_SPEECH_REGION: optional,
  SPEECH_VOICE: z.string().default('fr-FR-RemyMultilingualNeural'),

  // Offre gratuite (décision n° 3 de docs/direction-artistique.md)
  FREE_QUESTIONS_PER_TOPIC: z.coerce.number().int().min(0).default(10),
  FREE_EXAMS: z.coerce.number().int().min(0).default(1),
  // Prolongation gratuite d'un pass, une fois, si l'examen est repoussé (décision n° 24). 0 : pas de prolongation.
  PREMIUM_EXTENSION_DAYS: z.coerce.number().int().min(0).max(180).default(30),
  // Page publique où laisser un avis (Google, Trustpilot…). Sans adresse, le site ne propose pas d'avis externe.
  REVIEW_URL: z.preprocess((value) => (value === '' ? undefined : value), z.url().optional()),

  // Double authentification des comptes du back-office (A09) : obligatoire en production.
  ADMIN_MFA_REQUIRED: flag,
  // Durées de conservation et emails de service (fin de Premium, rappels), peu après le démarrage puis toutes les N heures
  // (0 : jamais). Par défaut chaque jour en production.
  MAINTENANCE_HOURS: z.coerce.number().min(0).max(168).optional(),
});

const isHttps = (url: string) => new URL(url).protocol === 'https:';

/** Adresse servie par la machine elle-même : essai local des conteneurs, pas un site public. */
export const isLocalUrl = (url: string) => ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);

// Mailpit (service « mail » de docker-compose.yml) garde les emails sur la machine : personne ne les reçoit.
const LOCAL_SMTP_HOSTS = ['mail', 'localhost', '127.0.0.1'];

/**
 * Réglages de développement ou d'exemple restés dans une configuration de production, une ligne par variable.
 * Liste vide : rien à corriger.
 */
export function productionProblems(settings: {
  publicUrl: string;
  /** Valeur lue dans l'environnement, sans la valeur de secours du développement. */
  appSecret: string | undefined;
  databaseUrl: string;
  cookieSecure: boolean;
  contentPreview: boolean;
  adminMfaRequired: boolean;
  smtpHost: string | undefined;
  brevoApiKey?: string | undefined;
  resendApiKey?: string | undefined;
}): string[] {
  const problems: string[] = [];
  if (!isHttps(settings.publicUrl)) problems.push('PUBLIC_URL : doit commencer par https://');
  if (!settings.cookieSecure) {
    problems.push('COOKIE_SECURE : les cookies de connexion doivent être réservés à HTTPS (laissez la variable vide, avec PUBLIC_URL en https://)');
  }
  if (!settings.adminMfaRequired) {
    problems.push('ADMIN_MFA_REQUIRED : la double authentification du back-office ne se désactive pas (laissez la variable vide)');
  }
  if (settings.contentPreview) problems.push('CONTENT_PREVIEW : doit valoir false, sinon les questions « à relire » sont publiques');
  if ((settings.appSecret ?? '').length < 32) problems.push('APP_SECRET : au moins 32 caractères aléatoires');
  if (settings.databaseUrl.includes('change-moi')) {
    problems.push('DATABASE_URL : contient le mot de passe d’exemple « change-moi » (changez POSTGRES_PASSWORD)');
  }
  const smtpHost = settings.smtpHost?.trim().toLowerCase();
  if (!settings.resendApiKey && !settings.brevoApiKey && (!smtpHost || LOCAL_SMTP_HOSTS.includes(smtpHost))) {
    problems.push('RESEND_API_KEY (ou BREVO_API_KEY, SMTP_HOST) : il faut un vrai service d’emails, pas Mailpit (dans Docker : DOCKER_SMTP_HOST)');
  }
  return problems;
}

/** Configuration lue dans `source`. Exportée pour les tests : l'application utilise `config`. */
export function readConfig(source: Record<string, string | undefined>) {
  const env = schema.parse(source);
  const production = env.NODE_ENV === 'production';

  if (production && !env.APP_SECRET) {
    throw new Error('APP_SECRET est obligatoire en production (chiffrement des secrets de double authentification).');
  }

  const publicUrl = env.PUBLIC_URL.replace(/\/$/, '');
  const settings = {
    env: env.NODE_ENV,
    production,
    port: env.API_PORT ?? env.PORT ?? 4001,
    databaseUrl: env.DATABASE_URL,
    publicUrl,
    appSecret: env.APP_SECRET ?? 'developpement-uniquement-ne-pas-utiliser-en-production',
    trustProxy: env.TRUST_PROXY,
    proxySecret: env.PROXY_SECRET,
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isHttps(publicUrl),
    contentPreview: env.CONTENT_PREVIEW === 'true',
    termsVersion: env.TERMS_VERSION,
    salesTermsVersion: env.SALES_TERMS_VERSION,
    mail: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      brevoApiKey: env.BREVO_API_KEY,
      resendApiKey: env.RESEND_API_KEY,
      from: env.MAIL_FROM,
    },
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    },
    // Paiement simulé : uniquement hors production et sans clé Stripe.
    paymentProvider: env.STRIPE_SECRET_KEY ? ('stripe' as const) : production ? ('none' as const) : ('simulation' as const),
    speech: {
      key: env.AZURE_SPEECH_KEY,
      region: env.AZURE_SPEECH_REGION,
      voice: env.SPEECH_VOICE,
    },
    free: {
      questionsPerTopic: env.FREE_QUESTIONS_PER_TOPIC,
      exams: env.FREE_EXAMS,
    },
    premiumExtensionDays: env.PREMIUM_EXTENSION_DAYS,
    reviewUrl: env.REVIEW_URL,
    adminMfaRequired: env.ADMIN_MFA_REQUIRED ? env.ADMIN_MFA_REQUIRED === 'true' : production,
    maintenanceHours: env.MAINTENANCE_HOURS ?? (production ? 24 : 0),
  };

  // En production, un réglage de développement bloque le démarrage. Seule exception : l'essai des conteneurs
  // sur cette machine (PUBLIC_URL en localhost), où un avertissement suffit.
  if (production) {
    const problems = productionProblems({
      publicUrl,
      appSecret: env.APP_SECRET,
      databaseUrl: settings.databaseUrl,
      cookieSecure: settings.cookieSecure,
      contentPreview: settings.contentPreview,
      adminMfaRequired: settings.adminMfaRequired,
      smtpHost: settings.mail.host,
      brevoApiKey: settings.mail.brevoApiKey,
      resendApiKey: settings.mail.resendApiKey,
    });
    const list = problems.map((problem) => `\n  - ${problem}`).join('');
    if (problems.length > 0 && !isLocalUrl(publicUrl)) {
      throw new Error(`Démarrage refusé : réglages de développement en production. Corrigez les variables d’environnement (.env en local, onglet Variables sur Railway ; voir docs/deploiement-railway-vercel.md), puis redéployez.${list}`);
    }
    if (problems.length > 0) console.warn(`Essai local en production (${publicUrl}) : réglages à corriger avant toute mise en ligne.${list}`);
  }

  return settings;
}

export const config = readConfig(process.env);
