'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Checkbox, Field, FormAlert } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';
import { formatPrice } from '@/lib/labels';
import type { OrganizationKind, OrganizationPlan, PaymentProvider } from '@/lib/types';
import { KindField } from './organization-fields';

/** Commande en ligne d'un pack de places, par le coordinateur ou la coordinatrice de la structure. */
export function OrganizationCheckoutForm({
  plans,
  kinds,
  provider,
  defaultPlan,
}: {
  plans: OrganizationPlan[];
  kinds: OrganizationKind[];
  provider: PaymentProvider;
  defaultPlan?: string;
}) {
  const [planCode, setPlanCode] = useState(plans.some((plan) => plan.code === defaultPlan) ? defaultPlan! : (plans[plans.length - 1]?.code ?? ''));
  const [organization, setOrganization] = useState({ name: '', kind: kinds[0] ?? 'association', city: '', registration: '', contactName: '' });
  const [salesTerms, setSalesTerms] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const plan = plans.find((candidate) => candidate.code === planCode);
  const set = (key: keyof typeof organization) => (value: string) => setOrganization((current) => ({ ...current, [key]: value }));

  if (provider === 'none') {
    return (
      <FormAlert tone="info">
        Le paiement en ligne n’est pas encore ouvert.{' '}
        <Link href="/associations#demande" className="font-bold text-sapin-700 underline underline-offset-4">
          Demandez un devis ou une facture
        </Link>
        .
      </FormAlert>
    );
  }

  async function pay(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});
    if (!salesTerms) {
      setFields({ salesTermsAccepted: 'Acceptez les conditions générales de vente pour continuer.' });
      return;
    }
    setSending(true);
    try {
      const { url } = await send<{ url: string }>('POST', '/api/organizations/checkout', { planCode, organization, salesTermsAccepted: true });
      window.location.assign(url);
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof RequestError) setFields(caught.fields);
      setSending(false);
    }
  }

  return (
    <form onSubmit={pay} noValidate className="grid gap-6">
      {error && <FormAlert>{error}</FormAlert>}
      <fieldset>
        <legend className="text-[1.25rem] font-bold">1. Votre pack</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {plans.map((candidate) => (
            <label
              key={candidate.code}
              className={`flex cursor-pointer flex-col gap-1 rounded-carte border-2 p-4 ${
                candidate.code === planCode ? 'border-sapin-700 bg-sapin-50' : 'border-ligne bg-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="pack"
                  value={candidate.code}
                  checked={candidate.code === planCode}
                  onChange={() => setPlanCode(candidate.code)}
                  className="accent-sapin-700"
                />
                <strong>{candidate.seats} places</strong>
              </span>
              <span className="font-titre text-[1.5rem] font-semibold">{formatPrice(candidate.priceCents, candidate.currency)} TTC</span>
              <span className="text-petit text-encre-doux">
                soit {formatPrice(Math.round(candidate.priceCents / candidate.seats), candidate.currency)} par personne
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-5">
        <legend className="text-[1.25rem] font-bold">2. Votre structure</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nom de la structure" value={organization.name} onChange={(event) => set('name')(event.target.value)} error={fields['organization.name']} required />
          <KindField kinds={kinds} value={organization.kind} onChange={set('kind')} error={fields['organization.kind']} />
          <Field label="Ville" value={organization.city} onChange={(event) => set('city')(event.target.value)} error={fields['organization.city']} />
          <Field
            label="Numéro RNA ou SIRET (facultatif)"
            hint="Il apparaît sur la facture."
            value={organization.registration}
            onChange={(event) => set('registration')(event.target.value)}
            error={fields['organization.registration']}
          />
          <Field
            label="Votre nom"
            autoComplete="name"
            value={organization.contactName}
            onChange={(event) => set('contactName')(event.target.value)}
            error={fields['organization.contactName']}
            required
          />
        </div>
      </fieldset>
      <fieldset className="grid gap-4">
        <legend className="text-[1.25rem] font-bold">3. Paiement</legend>
        {plan && (
          <p className="rounded-carte bg-papier p-4">
            <strong>
              {plan.name} : {formatPrice(plan.priceCents, plan.currency)} TTC
            </strong>
            , payé une seule fois. Chaque place ouvre {Math.round(plan.durationDays / 30)} mois d’accès Premium à la personne qui l’active. Les places
            sont à activer dans les {Math.round((plan.activationDays ?? 365) / 30)} mois. Une facture est envoyée par email après le paiement.
          </p>
        )}
        <Checkbox checked={salesTerms} onChange={(event) => setSalesTerms(event.target.checked)} error={fields.salesTermsAccepted}>
          J’accepte les{' '}
          <a href="/cgv#17-packs-de-places-pour-les-structures" target="_blank" rel="noreferrer" className="font-bold text-sapin-700 underline underline-offset-4">
            conditions générales de vente
          </a>{' '}
          pour la structure que je représente.
        </Checkbox>
        <div>
          <button type="submit" disabled={sending || !plan} className={buttonClasses('primary')}>
            {sending ? 'Redirection vers le paiement…' : plan ? `Payer ${formatPrice(plan.priceCents, plan.currency)} TTC` : 'Payer'}
          </button>
        </div>
        <p className="text-petit text-encre-doux">
          {provider === 'stripe'
            ? 'Paiement par carte, sécurisé par Stripe : nous ne voyons jamais le numéro de carte. Vous préférez un virement ? '
            : 'Développement : paiement simulé, aucun argent n’est échangé. Vous préférez un virement ? '}
          <Link href="/associations#demande" className="text-sapin-700 underline underline-offset-4">
            Demandez une facture
          </Link>
          .
        </p>
      </fieldset>
    </form>
  );
}
