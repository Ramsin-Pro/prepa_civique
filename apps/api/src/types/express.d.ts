import type { Role } from '../generated/prisma/client.js';

declare global {
  namespace Express {
    interface Request {
      /** Personne connectée, renseignée par le middleware de session. */
      auth?: {
        userId: string;
        email: string;
        role: Role;
        sessionId: string;
        emailVerified: boolean;
        mfaEnabled: boolean;
        mfaVerified: boolean;
      };
      /** Corps brut, conservé pour vérifier la signature des notifications Stripe. */
      rawBody?: Buffer;
    }
  }
}

export {};
