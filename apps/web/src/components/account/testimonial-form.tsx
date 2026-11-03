'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Checkbox, Field, FormAlert } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';

type Testimonial = { displayName: string; text: string; status: 'PENDING' | 'APPROVED' | 'REJECTED' };
type State = { testimonial: Testimonial | null; eligible: boolean; minAnswers: number };

const STATUS: Record<Testimonial['status'], string> = {
  PENDING: 'En attente de relecture par l’équipe.',
  APPROVED: 'Publié sur la page d’accueil.',
  REJECTED: 'Non publié. Vous pouvez le modifier et le proposer à nouveau.',
};

const MAX_LENGTH = 600;

/** Témoignage (E01) : rédigé par la personne, publié seulement avec son accord et après relecture. */
export function TestimonialForm() {
  const [state, setState] = useState<State | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    send<State>('GET', '/api/account/testimonial')
      .then((loaded) => {
        setState(loaded);
        setDisplayName(loaded.testimonial?.displayName ?? '');
        setText(loaded.testimonial?.text ?? '');
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFields({});
    try {
      await send('PUT', '/api/account/testimonial', { displayName, text, consent });
      setState((current) => current && { ...current, testimonial: { displayName, text, status: 'PENDING' } });
      setDone('Merci ! Votre témoignage sera publié après relecture par l’équipe.');
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof RequestError) setFields(caught.fields);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!window.confirm('Supprimer votre témoignage ? Il ne sera plus affiché.')) return;
    setError(null);
    setDone(null);
    try {
      await send('DELETE', '/api/account/testimonial');
      setState((current) => current && { ...current, testimonial: null });
      setText('');
      setDone('Votre témoignage est supprimé.');
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (!state) return error ? <FormAlert>{error}</FormAlert> : <p aria-live="polite">Chargement…</p>;

  if (!state.eligible && !state.testimonial) {
    return (
      <FormAlert tone="info">
        Pour que les témoignages restent authentiques, il faut d’abord avoir utilisé le site : terminez un examen blanc ou répondez à{' '}
        {state.minAnswers} questions, puis revenez ici.
      </FormAlert>
    );
  }

  return (
    <form onSubmit={save} noValidate className="grid gap-5">
      {state.testimonial && (
        <FormAlert tone={state.testimonial.status === 'REJECTED' ? 'error' : 'info'}>Votre témoignage : {STATUS[state.testimonial.status]}</FormAlert>
      )}
      {done && <FormAlert tone="success">{done}</FormAlert>}
      {error && <FormAlert>{error}</FormAlert>}
      <Field
        label="Nom affiché"
        hint="Par exemple votre prénom et l’initiale de votre nom. N’indiquez pas votre nom complet."
        value={displayName}
        maxLength={40}
        onChange={(event) => setDisplayName(event.target.value)}
        error={fields.displayName}
      />
      <div>
        <label htmlFor="temoignage" className="font-bold">
          Votre témoignage
        </label>
        <p id="temoignage-aide" className="mt-0.5 text-petit text-encre-doux">
          Ce qui vous a aidé, ce qui pourrait être mieux. Ne parlez pas de votre dossier ni de votre titre de séjour.
        </p>
        <textarea
          id="temoignage"
          rows={6}
          maxLength={MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby="temoignage-aide temoignage-compteur"
          aria-invalid={fields.text ? true : undefined}
          className="mt-1.5 block w-full rounded-bouton border-2 border-ligne bg-white px-3.5 py-3 text-courant outline-none focus:border-sapin-500 aria-[invalid=true]:border-brique-700"
        />
        <p id="temoignage-compteur" className="mt-1 text-right text-petit text-encre-doux">
          {text.length} / {MAX_LENGTH}
        </p>
        {fields.text && <p className="text-petit font-bold text-brique-700">{fields.text}</p>}
      </div>
      <Checkbox checked={consent} onChange={(event) => setConsent(event.target.checked)} error={fields.consent}>
        J’accepte que ce texte et le nom affiché soient publiés sur le site. Je peux retirer mon témoignage à tout moment.
      </Checkbox>
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={buttonClasses('primary')}>
          {pending ? 'Envoi…' : state.testimonial ? 'Mettre à jour mon témoignage' : 'Envoyer mon témoignage'}
        </button>
        {state.testimonial && (
          <button type="button" onClick={remove} className={buttonClasses('secondary')}>
            Supprimer mon témoignage
          </button>
        )}
      </div>
    </form>
  );
}
