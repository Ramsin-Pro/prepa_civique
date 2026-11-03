'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonClasses } from '@/components/button';
import { FormAlert } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';
import { formatPrice, frenchDateFormat } from '@/lib/labels';
import type { CheckoutOrder } from '@/lib/types';

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric' });
const price = (order: CheckoutOrder) => formatPrice(order.amountCents, order.currency);

const POLL_MS = 2000;
const MAX_POLLS = 30;

/** Numéro de commande lu dans l'adresse : un UUID, sinon rien (il sert à construire un chemin de l'API). */
const validOrderId = (value: string | undefined) =>
  value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : undefined;

/**
 * Retour du paiement (E15) : réussi, échoué ou en attente. L'accès n'est annoncé qu'une fois le paiement
 * confirmé par le serveur ; la page interroge l'API le temps que la confirmation arrive.
 */
export function PaymentConfirmation({ orderId: rawOrderId }: { orderId: string | undefined }) {
  const orderId = validOrderId(rawOrderId);
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    send<CheckoutOrder>('GET', `/api/checkout/orders/${encodeURIComponent(orderId)}`)
      .then((result) => {
        if (cancelled) return;
        setOrder(result);
        if (result.status === 'PENDING' && polls < MAX_POLLS) setTimeout(() => !cancelled && setPolls((n) => n + 1), POLL_MS);
      })
      .catch((caught) => !cancelled && setError(caught instanceof RequestError && caught.status === 401 ? 'Connectez-vous pour voir votre commande.' : errorMessage(caught)));
    return () => {
      cancelled = true;
    };
  }, [orderId, polls]);

  if (!orderId) return <FormAlert>Commande introuvable.</FormAlert>;
  if (error) return <FormAlert>{error}</FormAlert>;
  if (!order) return <p aria-live="polite">Vérification de votre paiement…</p>;

  if (order.status === 'PAID' && order.organization) {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">
          <p className="font-bold">Paiement confirmé. Merci !</p>
          <p className="mt-1">
            {order.plan.name} · {price(order)} TTC.{' '}
            {order.license &&
              `${order.license.seats} places sont ouvertes pour ${order.organization.name}, à activer avant le ${dateFormat.format(new Date(order.license.validUntil))}.`}
          </p>
          <p className="mt-1 text-petit">Un email avec le lien d’invitation vous a été envoyé. La facture arrive séparément.</p>
        </FormAlert>
        <a href="/espace/structure" className={buttonClasses('primary')}>
          Inviter les personnes que j’accompagne
        </a>
      </div>
    );
  }

  if (order.status === 'PAID') {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">
          <p className="font-bold">Paiement confirmé. Merci !</p>
          <p className="mt-1">
            {order.plan.name} · {price(order)} TTC.{' '}
            {order.entitlement && `Votre accès Premium est ouvert jusqu’au ${dateFormat.format(new Date(order.entitlement.expiresAt))}.`}
          </p>
          <p className="mt-1 text-petit">Un email de confirmation vous a été envoyé.</p>
        </FormAlert>
        <div className="flex flex-wrap gap-3">
          <a href="/entrainement" className={buttonClasses('primary')}>
            Commencer à m’entraîner
          </a>
          <a href="/espace" className={buttonClasses('secondary')}>
            Mon espace
          </a>
        </div>
      </div>
    );
  }

  if (order.status === 'PENDING') {
    return (
      <FormAlert tone="info">
        <p className="font-bold" aria-live="polite">
          Nous attendons la confirmation de votre paiement.
        </p>
        <p className="mt-1">
          {polls < MAX_POLLS
            ? 'Cela prend en général quelques secondes. Ne fermez pas cette page.'
            : 'La confirmation prend plus de temps que prévu. Vous recevrez un email dès qu’elle arrive ; votre accès s’ouvrira alors automatiquement.'}
        </p>
      </FormAlert>
    );
  }

  return (
    <div className="grid gap-4">
      <FormAlert>
        <p className="font-bold">{order.status === 'REFUNDED' ? 'Cette commande a été remboursée.' : 'Le paiement n’a pas abouti.'}</p>
        {order.status !== 'REFUNDED' && <p className="mt-1">Vous n’avez pas été débité. Vous pouvez réessayer.</p>}
      </FormAlert>
      <Link href={order.organization ? '/associations' : '/tarifs'} className={buttonClasses('primary')}>
        {order.organization ? 'Revenir à l’offre associations' : 'Revenir aux tarifs'}
      </Link>
    </div>
  );
}

/** Paiement simulé : uniquement en développement, sans clé Stripe. */
export function PaymentSimulation({ orderId: rawOrderId }: { orderId: string | undefined }) {
  const orderId = validOrderId(rawOrderId);
  const [order, setOrder] = useState<CheckoutOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    send<CheckoutOrder>('GET', `/api/checkout/orders/${encodeURIComponent(orderId)}`)
      .then(setOrder)
      .catch((caught) => setError(errorMessage(caught)));
  }, [orderId]);

  async function simulate(outcome: 'paid' | 'failed') {
    setSending(true);
    try {
      await send('POST', '/api/checkout/simulate', { orderId, outcome });
      window.location.assign(`/paiement/confirmation?commande=${encodeURIComponent(orderId ?? '')}`);
    } catch (caught) {
      setError(errorMessage(caught));
      setSending(false);
    }
  }

  if (!orderId) return <FormAlert>Commande introuvable.</FormAlert>;
  return (
    <div className="grid gap-5">
      <FormAlert tone="info">Paiement simulé pour le développement : aucun argent n’est échangé, aucune carte n’est demandée.</FormAlert>
      {error && <FormAlert>{error}</FormAlert>}
      {order && (
        <p>
          Commande : <strong>{order.plan.name}</strong>, {price(order)} TTC.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={sending || !order} onClick={() => simulate('paid')} className={buttonClasses('primary')}>
          Simuler un paiement réussi
        </button>
        <button type="button" disabled={sending || !order} onClick={() => simulate('failed')} className={buttonClasses('secondary')}>
          Simuler un échec
        </button>
      </div>
    </div>
  );
}
