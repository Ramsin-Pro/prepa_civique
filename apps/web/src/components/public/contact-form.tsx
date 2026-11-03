'use client';

import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Field, FormAlert } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';

const TOPICS = [
  { value: 'contenu', label: 'Une question ou une fiche' },
  { value: 'compte', label: 'Mon compte' },
  { value: 'paiement', label: 'Paiement et accès Premium' },
  { value: 'donnees', label: 'Mes données personnelles' },
  { value: 'autre', label: 'Autre demande' },
];

const MAX_LENGTH = 3000;

/** Contact (E17) : collecte minimale, accusé de réception par email. */
export function ContactForm() {
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]!.value);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setFields({});
    try {
      await send('POST', '/api/contact', { email, topic, message, website: website || undefined });
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
        <p className="font-bold">Message envoyé. Merci !</p>
        <p className="mt-1">Vous allez recevoir un accusé de réception par email. Nous répondons en général sous 3 jours ouvrés.</p>
      </FormAlert>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error && <FormAlert reveal>{error}</FormAlert>}
      <Field
        label="Votre adresse email"
        hint="Pour vous répondre. Rien d’autre."
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fields.email}
      />
      <div>
        <label htmlFor="sujet" className="font-bold">
          Sujet
        </label>
        <select
          id="sujet"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          className="mt-1.5 block min-h-12 w-full rounded-bouton border-2 border-ligne bg-white px-3 text-courant"
        >
          {TOPICS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="message" className="font-bold">
          Votre message
        </label>
        <p id="message-aide" className="mt-0.5 text-petit text-encre-doux">
          N’écrivez pas de numéro de dossier ni d’informations sur votre titre de séjour : nous n’en avons pas besoin.
        </p>
        <textarea
          id="message"
          required
          rows={7}
          maxLength={MAX_LENGTH}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          aria-describedby="message-aide message-compteur"
          aria-invalid={fields.message ? true : undefined}
          className="mt-1.5 block w-full rounded-bouton border-2 border-ligne bg-white px-3.5 py-3 text-courant outline-none focus:border-sapin-500 aria-[invalid=true]:border-brique-700"
        />
        <p id="message-compteur" className="mt-1 text-right text-petit text-encre-doux">
          {message.length} / {MAX_LENGTH}
        </p>
        {fields.message && <p className="text-petit font-bold text-brique-700">{fields.message}</p>}
      </div>
      {/* Champ piège : invisible pour les personnes, rempli seulement par les robots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="site-web">Site web</label>
        <input id="site-web" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>
      <div>
        <button type="submit" disabled={sending} className={buttonClasses('primary')}>
          {sending ? 'Envoi…' : 'Envoyer mon message'}
        </button>
      </div>
    </form>
  );
}
