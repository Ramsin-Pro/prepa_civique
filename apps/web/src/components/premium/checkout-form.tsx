'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Checkbox, FormAlert } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';
import { formatPrice, frenchDateFormat } from '@/lib/labels';
import type { Me, PaymentProvider, Plan } from '@/lib/types';

const price = (plan: Plan) => formatPrice(plan.priceCents, plan.currency);
const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric' });

/** Fin de l'accès si la personne paie maintenant : un pass en cours est prolongé, pas remplacé. */
function endDate(plan: Plan, me: Me) {
  const now = Date.now();
  const until = me.premium.until ? new Date(me.premium.until).getTime() : 0;
  return new Date(Math.max(now, until) + plan.durationDays * 24 * 60 * 60 * 1000);
}

/**
 * Achat du pass (E15) : récapitulatif, acceptation des CGV et accord pour l'accès immédiat recueillis avant
 * le paiement, puis paiement chez le prestataire. L'accès n'est ouvert qu'après la confirmation du paiement.
 */
export function CheckoutForm({ plan, me, provider }: { plan: Plan; me: Me | null; provider: PaymentProvider }) {
  const [salesTerms, setSalesTerms] = useState(false);
  const [waiver, setWaiver] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  if (provider === 'none') {
    return <FormAlert tone="info">Le paiement n’est pas encore ouvert. Revenez bientôt.</FormAlert>;
  }

  if (!me) {
    return (
      <div className="grid gap-3">
        <p className="text-petit text-encre-doux">Un compte est nécessaire pour retrouver votre accès sur tous vos appareils.</p>
        <Link href="/inscription?suite=/tarifs" className={buttonClasses('primary', 'w-full')}>
          Créer mon compte pour continuer
        </Link>
        <Link href="/connexion?suite=/tarifs" className={buttonClasses('quiet', 'justify-center')}>
          J’ai déjà un compte
        </Link>
        {provider === 'stripe' && (
          <p className="text-center text-petit text-encre-doux">
            Paiement sécurisé par Stripe, par carte bancaire, Apple Pay ou Google Pay : nous ne voyons jamais votre numéro de carte.
          </p>
        )}
      </div>
    );
  }

  if (!me.emailVerified) {
    return <FormAlert tone="info">Confirmez d’abord votre adresse email avec le lien reçu, puis revenez sur cette page.</FormAlert>;
  }

  async function pay(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});
    const missing: Record<string, string> = {};
    if (!salesTerms) missing.salesTermsAccepted = 'Acceptez les conditions générales de vente pour continuer.';
    if (!waiver) missing.waiverAccepted = 'Cochez cette case pour accéder tout de suite au Premium.';
    if (Object.keys(missing).length > 0) {
      setFields(missing);
      return;
    }
    setSending(true);
    try {
      const { url } = await send<{ orderId: string; url: string }>('POST', '/api/checkout', {
        planCode: plan.code,
        salesTermsAccepted: true,
        waiverAccepted: true,
      });
      window.location.assign(url);
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof RequestError) setFields(caught.fields);
      setSending(false);
    }
  }

  return (
    <form onSubmit={pay} noValidate className="grid gap-4">
      {me.premium.active && me.premium.until && (
        <FormAlert tone="success">
          Votre accès Premium est actif jusqu’au {dateFormat.format(new Date(me.premium.until))}. Un nouveau pass s’ajoute à la suite de
          cette date.
        </FormAlert>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      <Checkbox checked={salesTerms} onChange={(event) => setSalesTerms(event.target.checked)} error={fields.salesTermsAccepted}>
        J’accepte les{' '}
        <Link href="/cgv" target="_blank" className="text-sapin-700 underline underline-offset-4">
          conditions générales de vente
        </Link>
        .
      </Checkbox>
      <Checkbox checked={waiver} onChange={(event) => setWaiver(event.target.checked)} error={fields.waiverAccepted}>
        Je demande l’accès immédiat au Premium. Je reconnais perdre mon droit de rétractation de 14 jours dès cet accès.
      </Checkbox>
      <p className="text-petit">
        Si vous payez aujourd’hui, votre accès Premium ira jusqu’au <strong>{dateFormat.format(endDate(plan, me))}</strong>, sans
        renouvellement automatique.
      </p>
      <button type="submit" disabled={sending} className={buttonClasses('primary', 'w-full')}>
        {sending ? 'Redirection vers le paiement…' : `Payer ${price(plan)} TTC`}
      </button>
      <p className="text-center text-petit text-encre-doux">
        {provider === 'stripe'
          ? 'Paiement sécurisé par Stripe : carte bancaire, Apple Pay ou Google Pay. Nous ne voyons jamais votre numéro de carte.'
          : 'Développement : paiement simulé, aucun argent n’est échangé.'}
      </p>
    </form>
  );
}
