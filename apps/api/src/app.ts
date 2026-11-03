import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp, type StdSerializedResults } from 'pino-http';
import { ZodError, z } from 'zod';
import { loadSession } from './auth/sessions.js';
import { config } from './config.js';
import { clientIpFromTrustedProxy } from './http/client-ip.js';
import { HttpError, notFound } from './http/errors.js';
import { sameOrigin } from './http/origin.js';
import { accountRouter } from './routes/account.js';
import { adminRouter } from './routes/admin/index.js';
import { authRouter } from './routes/auth.js';
import { checkoutRouter, stripeWebhookRouter } from './routes/checkout.js';
import { contentRouter } from './routes/content.js';
import { examsRouter } from './routes/exams.js';
import { favoritesRouter } from './routes/favorites.js';
import { glossaryRouter } from './routes/glossary.js';
import { healthRouter } from './routes/health.js';
import { organizationsRouter } from './routes/organizations.js';
import { pathsRouter } from './routes/paths.js';
import { progressRouter } from './routes/progress.js';
import { reportsRouter } from './routes/reports.js';
import { speechRouter } from './routes/speech.js';
import { trainingRouter } from './routes/training.js';

// Messages par défaut du validateur en français : une règle sans message dédié n'affiche jamais d'anglais à l'écran.
z.config(z.locales.fr());

const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'invalid_request',
        message: 'La requête est invalide.',
        details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
      },
    });
    return;
  }
  // Erreurs du lecteur JSON d'Express (corps illisible, trop gros…)
  const status: unknown = error?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: { code: 'invalid_request', message: 'La requête est invalide.' } });
    return;
  }

  req.log.error({ err: error }, 'Erreur non gérée');
  res.status(500).json({ error: { code: 'internal_error', message: 'Une erreur est survenue. Réessayez dans un instant.' } });
};

/**
 * Requête telle qu'elle apparaît dans les journaux : sans ses paramètres (recherche par email `?q=`, jetons…),
 * ni le code d'invitation d'une structure, qui suffit à occuper ses places. Exportée pour les tests.
 */
export const serializeRequest = ({ query: _query, ...req }: StdSerializedResults['req']) => ({
  ...req,
  url: req.url.replace(/\?.*/s, '').replace(/(\/organizations\/join\/)[^/]+/i, '$1***'),
});

export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.use(clientIpFromTrustedProxy);
  app.use(helmet());
  app.use(
    pinoHttp({
      enabled: config.env !== 'test',
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      serializers: { req: serializeRequest },
      // Jamais de jeton de session, de cookie ou de signature dans les journaux. Le Referer d'une page ouverte depuis
      // un email (/reinitialiser-mot-de-passe?jeton=…, /confirmer-email?jeton=…) porte le jeton du lien.
      redact: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["stripe-signature"]',
        'req.headers.referer',
        'req.headers["x-repere-proxy"]',
        'res.headers["set-cookie"]',
      ],
    }),
  );
  // Notifications de Stripe : corps brut conservé pour vérifier la signature, hors limite de débit et hors session.
  app.use(
    '/api/payments/stripe/webhook',
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf;
      },
    }),
    stripeWebhookRouter,
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  // Limite globale contre les abus. Elle reste large : toute une salle d'association passe souvent par une seule
  // connexion (une seule adresse IP), et chaque page appelle l'API plusieurs fois. Les routes sensibles (connexion,
  // double authentification, formulaires, voix) ont leurs propres limites, bien plus strictes.
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 3000, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use('/api', loadSession, sameOrigin);

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/paths', pathsRouter);
  app.use('/api/training', trainingRouter);
  app.use('/api/exams', examsRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/glossary', glossaryRouter);
  app.use('/api/favorites', favoritesRouter);
  app.use('/api/speech', speechRouter);
  app.use('/api/organizations', organizationsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', reportsRouter);
  app.use('/api', checkoutRouter);
  app.use('/api', contentRouter);
  app.use('/api', () => {
    throw notFound('Cette adresse ne correspond à aucun service.');
  });

  app.use(errorHandler);
  return app;
}
