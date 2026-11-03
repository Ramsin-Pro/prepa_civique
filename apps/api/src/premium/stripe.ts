import Stripe from 'stripe';
import { config } from '../config.js';

// Client Stripe, seulement si une clé est configurée. La vérification de signature des notifications
// n'a besoin que du secret du webhook.
export const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

const verifier = stripe ?? new Stripe('sk_test_verification_seule');

export type StripeEvent = ReturnType<typeof verifier.webhooks.constructEvent>;

export function verifyStripeSignature(rawBody: Buffer, signature: string, secret: string): StripeEvent {
  return verifier.webhooks.constructEvent(rawBody, signature, secret);
}

/** Pour les tests : en-tête de signature valide pour un corps donné. */
export function testSignature(payload: string, secret: string): string {
  return verifier.webhooks.generateTestHeaderString({ payload, secret });
}
