import { audit, track } from '../audit.js';
import { prisma } from '../db.js';
import type { Prisma } from '../generated/prisma/client.js';
import { sendMail } from '../mail/mailer.js';
import { organizationPackMail, purchaseMail } from '../mail/templates.js';
import { addLicense, revokeEntitlements } from '../organizations/service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
// Délai par défaut pour activer les places d'un pack, si la formule ne le précise pas.
const DEFAULT_ACTIVATION_DAYS = 365;

export const formatPrice = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);

/**
 * Active ce qu'une commande payée ouvre : un accès Premium pour un particulier, ou un pack de places pour une structure.
 * Uniquement après confirmation du paiement par le serveur (E15).
 * Atomique et idempotent : seule une commande encore en attente passe en payée. Une commande déjà payée, échouée,
 * expirée ou remboursée n'active rien (pas de double activation, §9).
 * Un accès encore actif est prolongé plutôt que remplacé.
 */
export async function fulfillOrder(orderId: string, providerPaymentId?: string | null) {
  const result = await prisma.$transaction(async (tx) => {
    const now = new Date();
    // Le passage « en attente » → « payée » verrouille la commande : deux confirmations simultanées n'activent qu'une fois.
    const paid = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status: 'PAID', paidAt: now, providerPaymentId: providerPaymentId ?? null },
    });
    if (paid.count === 0) return null;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { plan: true, user: { select: { email: true } }, organization: { select: { id: true, name: true, inviteCode: true, status: true } } },
    });
    const base = { email: order.user.email, planName: order.plan.name, amount: formatPrice(order.amountCents, order.currency), userId: order.userId };

    if (order.plan.audience === 'ORGANIZATION' && order.organization && order.plan.seats) {
      const license = await addLicense(
        order.organization.id,
        {
          seats: order.plan.seats,
          seatDays: order.plan.durationDays,
          activationDays: order.plan.activationDays ?? DEFAULT_ACTIVATION_DAYS,
          priceCents: order.amountCents,
          source: 'commande',
          orderId: order.id,
        },
        tx,
      );
      return { ...base, kind: 'organization' as const, organization: order.organization, license };
    }

    const current = await tx.entitlement.findFirst({
      where: { userId: order.userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: 'desc' },
    });
    const expiresAt = new Date((current?.expiresAt ?? now).getTime() + order.plan.durationDays * DAY_MS);
    await tx.entitlement.create({ data: { userId: order.userId, orderId: order.id, startsAt: now, expiresAt } });
    return { ...base, kind: 'individual' as const, expiresAt };
  });

  if (result?.kind === 'organization' && result.organization.status === 'SUSPENDED') {
    // Paiement reçu pendant une suspension (session ouverte avant) : le pack est gardé mais l'espace reste fermé.
    // Pas d'email « places ouvertes » : l'équipe décide de réactiver la structure ou de rembourser.
    await audit(null, 'order.paid_while_suspended', 'order', orderId, { organizationId: result.organization.id });
  } else if (result?.kind === 'organization') {
    await sendMail(
      organizationPackMail(result.email, {
        organizationName: result.organization.name,
        seats: result.license.seats,
        seatDays: result.license.seatDays,
        validUntil: result.license.validUntil,
        inviteCode: result.organization.inviteCode,
        amount: result.amount,
      }),
    );
  } else if (result) {
    await sendMail(purchaseMail(result.email, { planName: result.planName, amount: result.amount, expiresAt: result.expiresAt, orderId }));
  }
  if (result) await track('purchase', { learnerKey: `user:${result.userId}` });
  return result !== null;
}

/** Paiement échoué ou abandonné : la commande en attente est close, aucun droit n'est activé. */
export async function closeOrder(orderId: string, status: 'FAILED' | 'EXPIRED') {
  await prisma.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status } });
}

/**
 * Remboursement (A07) ou paiement contesté : la commande passe en remboursée et ce qu'elle ouvrait est révoqué (l'accès
 * Premium, ou le pack de places et les accès offerts avec). Les accès pris ensuite sont avancés de la durée retirée.
 * Atomique et idempotent : seule une commande payée change, une seule fois, et le journal n'est écrit qu'à ce moment-là
 * (un remboursement et un litige sur le même paiement ne révoquent pas deux fois).
 */
export async function markRefunded(
  orderId: string,
  actorId: string | null,
  log: { action: string; details?: Prisma.InputJsonValue } = { action: 'order.refund' },
) {
  const now = new Date();
  const refunded = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({ where: { id: orderId, status: 'PAID' }, data: { status: 'REFUNDED', refundedAt: now } });
    if (updated.count === 0) return false;
    const entitlement = await tx.entitlement.findUnique({ where: { orderId }, select: { id: true } });
    const license = await tx.organizationLicense.findUnique({
      where: { orderId },
      select: { id: true, members: { where: { removedAt: null }, select: { entitlementId: true } } },
    });
    if (license) {
      await tx.organizationLicense.update({ where: { id: license.id }, data: { revokedAt: now } });
      await tx.organizationMember.updateMany({ where: { licenseId: license.id, removedAt: null }, data: { removedAt: now } });
    }
    await revokeEntitlements(tx, [...(entitlement ? [entitlement.id] : []), ...(license?.members.map((member) => member.entitlementId) ?? [])], now);
    return true;
  });
  if (refunded) await audit(actorId, log.action, 'order', orderId, log.details);
  return refunded;
}
