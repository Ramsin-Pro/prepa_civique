import { Router } from 'express';
import { z } from 'zod';
import { audit, track } from '../audit.js';
import { requireUser } from '../auth/guards.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../http/errors.js';
import { uuidParam } from '../http/params.js';
import { closeOrder, fulfillOrder, markRefunded } from '../premium/fulfillment.js';
import { stripe, verifyStripeSignature } from '../premium/stripe.js';

// Offres Premium (E14) et paiement (E15) : récapitulatif, accord pour l'accès immédiat, paiement chez
// le prestataire, activation uniquement après confirmation du paiement par le serveur.
export const checkoutRouter = Router();

checkoutRouter.get('/plans', async (_req, res) => {
  // Pass individuels seulement : les packs des structures sont présentés sur la page Associations.
  const plans = await prisma.plan.findMany({
    where: { active: true, audience: 'INDIVIDUAL' },
    orderBy: { position: 'asc' },
    select: { code: true, name: true, description: true, priceCents: true, currency: true, durationDays: true },
  });
  res.json({ plans, paymentProvider: config.paymentProvider, free: config.free, reviewUrl: config.reviewUrl ?? null });
});

const checkoutBody = z.object({
  planCode: z.string().min(1),
  salesTermsAccepted: z.literal(true, { message: 'Vous devez accepter les conditions générales de vente pour continuer.' }),
  // Accès immédiat au contenu numérique et renonciation au droit de rétractation, recueillis avant le paiement.
  waiverAccepted: z.literal(true, { message: 'Vous devez accepter l’accès immédiat pour continuer.' }),
});

checkoutRouter.post('/checkout', async (req, res) => {
  const auth = requireUser(req);
  const { planCode } = checkoutBody.parse(req.body);
  if (!auth.emailVerified) throw new HttpError(403, 'email_not_verified', 'Confirmez votre adresse email avant de payer.');
  if (config.paymentProvider === 'none') throw new HttpError(503, 'payment_unavailable', 'Le paiement n’est pas encore disponible.');

  const plan = await prisma.plan.findFirst({ where: { code: planCode, active: true, audience: 'INDIVIDUAL' } });
  if (!plan) throw notFound('Formule introuvable.');

  const order = await prisma.order.create({
    data: {
      userId: auth.userId,
      planId: plan.id,
      amountCents: plan.priceCents,
      currency: plan.currency,
      provider: config.paymentProvider,
      waiverAcceptedAt: new Date(),
      salesTermsVersion: config.salesTermsVersion,
      salesTermsAcceptedAt: new Date(),
    },
  });
  await track('checkout_start', { learnerKey: `user:${auth.userId}` });

  if (config.paymentProvider === 'simulation' || !stripe) {
    res.status(201).json({ orderId: order.id, url: `/paiement/simulation?commande=${order.id}` });
    return;
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'fr',
    customer_email: auth.email,
    client_reference_id: order.id,
    metadata: { orderId: order.id },
    payment_intent_data: { metadata: { orderId: order.id } },
    invoice_creation: { enabled: true },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: plan.currency.toLowerCase(),
          unit_amount: plan.priceCents,
          product_data: { name: plan.name, description: plan.description },
        },
      },
    ],
    success_url: `${config.publicUrl}/paiement/confirmation?commande=${order.id}`,
    cancel_url: `${config.publicUrl}/tarifs?paiement=annule`,
  });
  await prisma.order.update({ where: { id: order.id }, data: { providerSessionId: session.id } });
  res.status(201).json({ orderId: order.id, url: session.url });
});

/** État d'une commande, pour la page de retour du paiement (E15 : réussi, échoué, en attente). */
checkoutRouter.get('/checkout/orders/:id', async (req, res) => {
  const auth = requireUser(req);
  const id = uuidParam.parse(req.params.id);
  const order = await prisma.order.findFirst({
    where: { id, userId: auth.userId },
    select: {
      id: true,
      status: true,
      amountCents: true,
      currency: true,
      createdAt: true,
      paidAt: true,
      plan: { select: { name: true, durationDays: true, audience: true, seats: true } },
      entitlement: { select: { expiresAt: true } },
      license: { select: { seats: true, validUntil: true } },
      organization: { select: { name: true } },
    },
  });
  if (!order) throw notFound('Commande introuvable.');
  res.json(order);
});

const simulateBody = z.object({ orderId: z.uuid(), outcome: z.enum(['paid', 'failed']) });

/** Paiement simulé, pour développer sans compte Stripe. Refusé dès qu'une clé Stripe existe et en production. */
checkoutRouter.post('/checkout/simulate', async (req, res) => {
  if (config.paymentProvider !== 'simulation') throw notFound();
  const auth = requireUser(req);
  const { orderId, outcome } = simulateBody.parse(req.body);
  const order = await prisma.order.findFirst({ where: { id: orderId, userId: auth.userId, provider: 'simulation' } });
  if (!order) throw notFound('Commande introuvable.');

  if (outcome === 'paid') await fulfillOrder(order.id, `simulation_${order.id}`);
  else await closeOrder(order.id, 'FAILED');
  res.json({ ok: true });
});

// Notifications de Stripe : signature vérifiée, traitement idempotent (§9).
export const stripeWebhookRouter = Router();

type StripeObject = {
  id?: string;
  refunded?: boolean;
  amount_refunded?: number;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  payment_status?: string;
  payment_intent?: string | { id: string } | null;
  reason?: string | null;
};

const paymentIntentId = (value: StripeObject['payment_intent']) => (typeof value === 'string' ? value : (value?.id ?? null));

/**
 * Commande d'une session de paiement, retrouvée par l'identifiant de session enregistré à sa création. L'identifiant de
 * commande porté par la session ne suffit pas : un autre paiement du même compte Stripe (lien de paiement, autre produit)
 * peut le reprendre.
 */
async function sessionOrder(session: StripeObject) {
  if (!session.id) return null;
  return prisma.order.findUnique({ where: { providerSessionId: session.id }, select: { id: true, status: true, amountCents: true, currency: true } });
}

/** Paiement confirmé : seulement pour la session de la commande, au montant et dans la devise de la commande. */
async function sessionPaid(session: StripeObject) {
  const order = await sessionOrder(session);
  if (!order) {
    // Une session étrangère qui se réclame d'une de nos commandes est notée au journal ; les autres sont ignorées.
    const claimed = session.client_reference_id ?? session.metadata?.orderId;
    if (claimed && z.uuid().safeParse(claimed).success && (await prisma.order.count({ where: { id: claimed } })) > 0) {
      await audit(null, 'order.payment_mismatch', 'order', claimed, { sessionId: session.id ?? null });
    }
    return;
  }
  if (session.amount_total !== order.amountCents || session.currency?.toUpperCase() !== order.currency.toUpperCase()) {
    await audit(null, 'order.payment_mismatch', 'order', order.id, {
      sessionId: session.id ?? null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
    });
    return;
  }
  if (await fulfillOrder(order.id, paymentIntentId(session.payment_intent))) return;
  // Paiement confirmé pour une commande déjà close (échouée, expirée, remboursée) : rien n'est ouvert, l'équipe rembourse.
  const current = await prisma.order.findUnique({ where: { id: order.id }, select: { status: true } });
  if (current && current.status !== 'PAID') {
    await audit(null, 'order.payment_for_closed_order', 'order', order.id, { status: current.status, sessionId: session.id ?? null });
  }
}

/** Commande payée correspondant au paiement d'un remboursement ou d'un litige. */
async function paidOrder(object: StripeObject) {
  const intent = paymentIntentId(object.payment_intent);
  return intent ? prisma.order.findFirst({ where: { providerPaymentId: intent, status: 'PAID' }, select: { id: true } }) : null;
}

stripeWebhookRouter.post('/', async (req, res) => {
  const signature = req.get('stripe-signature');
  if (!config.stripe.webhookSecret || !signature || !req.rawBody) throw new HttpError(400, 'invalid_webhook', 'Notification invalide.');

  let event;
  try {
    event = verifyStripeSignature(req.rawBody, signature, config.stripe.webhookSecret);
  } catch {
    throw new HttpError(400, 'invalid_signature', 'Signature invalide.');
  }

  if (await prisma.paymentEvent.findUnique({ where: { id: event.id } })) {
    res.json({ received: true });
    return;
  }

  const object = event.data.object as StripeObject;

  switch (event.type) {
    case 'checkout.session.completed':
      // Un paiement différé (virement…) n'est confirmé qu'à l'événement async_payment_succeeded.
      if (object.payment_status === 'paid') await sessionPaid(object);
      break;
    case 'checkout.session.async_payment_succeeded':
      await sessionPaid(object);
      break;
    case 'checkout.session.async_payment_failed':
    case 'checkout.session.expired': {
      const order = await sessionOrder(object);
      if (order) await closeOrder(order.id, event.type === 'checkout.session.expired' ? 'EXPIRED' : 'FAILED');
      break;
    }
    case 'charge.refunded': {
      const order = await paidOrder(object);
      // Un remboursement partiel (geste commercial) laisse l'accès ouvert ; il est seulement noté au journal.
      if (order && object.refunded) await markRefunded(order.id, null);
      else if (order) await audit(null, 'order.partial_refund', 'order', order.id, { amountRefunded: object.amount_refunded ?? null });
      break;
    }
    case 'charge.dispute.created': {
      // Paiement contesté auprès de la banque : l'argent est repris, l'accès est retiré comme pour un remboursement total.
      // markRefunded ne change qu'une commande encore payée : une notification répétée ne révoque ni ne note deux fois.
      const order = await paidOrder(object);
      if (order) await markRefunded(order.id, null, { action: 'order.dispute', details: { disputeId: object.id ?? null, reason: object.reason ?? null } });
      break;
    }
    default:
      break;
  }

  // Deux envois simultanés de la même notification : le second ne doit pas échouer (Stripe la renverrait sans fin).
  await prisma.paymentEvent.createMany({ data: [{ id: event.id, type: event.type }], skipDuplicates: true });
  res.json({ received: true });
});
