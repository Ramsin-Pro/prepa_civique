'use client';

import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Field, FormAlert } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';
import type { OrganizationKind } from '@/lib/types';
import { KindField } from './organization-fields';

const WISHES = [
  { value: 'devis', label: 'Un devis', hint: 'Pour faire valider la dépense avant de commander.' },
  { value: 'virement', label: 'Une facture à payer par virement', hint: 'Sans carte bancaire, à 30 jours.' },
  { value: 'pilote', label: 'Des places d’essai', hint: 'Pour tester avec quelques personnes avant de vous engager.' },
] as const;

/** Demande de devis, de facture ou de places d'essai : l'équipe répond par email. */
export function OrganizationRequestForm({ kinds }: { kinds: OrganizationKind[] }) {
  const [form, setForm] = useState({
    organizationName: '',
    kind: kinds[0] ?? 'association',
    city: '',
    contactName: '',
    email: '',
    phone: '',
    seats: '50',
    wish: 'devis' as (typeof WISHES)[number]['value'],
    message: '',
    website: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setFields({});
    try {
      await send('POST', '/api/organizations/requests', { ...form, seats: Number(form.seats) });
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof RequestError) setFields(caught.fields);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <FormAlert tone="success" reveal>
        <p className="font-bold">Merci, votre demande est envoyée.</p>
        <p className="mt-1">Nous vous répondons par email sous 3 jours ouvrés. Un accusé de réception vient de partir à {form.email}.</p>
      </FormAlert>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error && <FormAlert reveal>{error}</FormAlert>}
      <fieldset>
        <legend className="font-bold">Vous souhaitez</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {WISHES.map((wish) => (
            <label
              key={wish.value}
              className={`flex cursor-pointer gap-3 rounded-bouton border-2 p-3 text-petit ${
                form.wish === wish.value ? 'border-sapin-700 bg-sapin-50' : 'border-ligne bg-white'
              }`}
            >
              <input
                type="radio"
                name="souhait"
                value={wish.value}
                checked={form.wish === wish.value}
                onChange={() => set('wish')(wish.value)}
                className="mt-1 accent-sapin-700"
              />
              <span>
                <strong className="block">{wish.label}</strong>
                <span className="text-encre-doux">{wish.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom de la structure" value={form.organizationName} onChange={(event) => set('organizationName')(event.target.value)} error={fields.organizationName} required />
        <KindField kinds={kinds} value={form.kind} onChange={set('kind')} error={fields.kind} />
        <Field label="Ville" value={form.city} onChange={(event) => set('city')(event.target.value)} error={fields.city} />
        <Field
          label="Nombre de personnes à préparer"
          type="number"
          inputMode="numeric"
          min={1}
          value={form.seats}
          onChange={(event) => set('seats')(event.target.value)}
          error={fields.seats}
          required
        />
        <Field label="Votre nom" autoComplete="name" value={form.contactName} onChange={(event) => set('contactName')(event.target.value)} error={fields.contactName} required />
        <Field
          label="Email professionnel"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(event) => set('email')(event.target.value)}
          error={fields.email}
          required
        />
        <Field
          label="Téléphone (facultatif)"
          type="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(event) => set('phone')(event.target.value)}
          error={fields.phone}
        />
      </div>
      <div>
        <label htmlFor="demande-message" className="font-bold">
          Message (facultatif)
        </label>
        <textarea
          id="demande-message"
          rows={4}
          value={form.message}
          onChange={(event) => set('message')(event.target.value)}
          maxLength={2000}
          placeholder="Calendrier de vos sessions, parcours concernés (carte de séjour, carte de résident, naturalisation)…"
          className="mt-1.5 block w-full rounded-bouton border-2 border-ligne bg-white px-3.5 py-3 text-courant outline-none focus:border-sapin-500"
        />
      </div>
      {/* Champ piège pour les robots, invisible pour les personnes. */}
      <div aria-hidden="true" className="hidden">
        <label>
          Site web
          <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set('website')(event.target.value)} />
        </label>
      </div>
      <p className="text-petit text-encre-doux">
        Ces informations servent seulement à vous répondre. Voir la{' '}
        <a href="/confidentialite" className="text-sapin-700 underline underline-offset-4">
          politique de confidentialité
        </a>
        .
      </p>
      <div>
        <button type="submit" disabled={sending} className={buttonClasses('primary')}>
          {sending ? 'Envoi…' : 'Envoyer ma demande'}
        </button>
      </div>
    </form>
  );
}
