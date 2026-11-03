'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Field, FormAlert, PasswordField } from '@/components/form';
import { pendingInvitation } from '@/components/organizations/organization-fields';
import { RequestError, errorMessage, send } from '@/lib/client';

/** Mot de passe oublié : la réponse est la même que l'adresse ait un compte ou non. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await send('POST', '/api/auth/forgot-password', { email });
      setSent(true);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <FormAlert tone="success" reveal>
        <p className="font-bold">Vérifiez votre boîte mail.</p>
        <p className="mt-1">Si un compte existe avec cette adresse, vous allez recevoir un lien pour choisir un nouveau mot de passe. Il est valable 1 heure.</p>
      </FormAlert>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error && <FormAlert>{error}</FormAlert>}
      <Field label="Adresse email" type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      <button type="submit" disabled={submitting} className={buttonClasses('primary', 'w-full')}>
        {submitting ? 'Envoi…' : 'Recevoir un lien'}
      </button>
      <p className="text-center text-petit">
        <Link href="/connexion" className="text-sapin-700 underline underline-offset-4">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}

/** Nouveau mot de passe, depuis le lien reçu par email. Toutes les sessions ouvertes sont fermées. */
export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  if (!token) return <FormAlert>Ce lien est incomplet. Demandez un nouveau lien depuis la page « Mot de passe oublié ».</FormAlert>;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});
    if (password !== confirmation) {
      setFields({ confirmation: 'Les deux mots de passe sont différents.' });
      return;
    }
    setSubmitting(true);
    try {
      await send('POST', '/api/auth/reset-password', { token, password });
      setDone(true);
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof RequestError) setFields(caught.fields);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">Votre mot de passe est changé. Par sécurité, vous êtes déconnecté de tous vos appareils.</FormAlert>
        <Link href="/connexion" className={buttonClasses('primary')}>
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error && (
        <FormAlert>
          <p>{error}</p>
          <p className="mt-1">
            <Link href="/mot-de-passe-oublie" className="font-bold text-sapin-700 underline underline-offset-4">
              Demander un nouveau lien
            </Link>
          </p>
        </FormAlert>
      )}
      <PasswordField
        label="Nouveau mot de passe"
        autoComplete="new-password"
        hint="10 caractères au moins."
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fields.password}
      />
      <PasswordField
        label="Confirmez le mot de passe"
        autoComplete="new-password"
        required
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        error={fields.confirmation}
      />
      <button type="submit" disabled={submitting} className={buttonClasses('primary', 'w-full')}>
        {submitting ? 'Enregistrement…' : 'Changer mon mot de passe'}
      </button>
    </form>
  );
}

/**
 * Confirmation de l'adresse email. Elle se fait par un clic, pas à l'ouverture de la page :
 * les logiciels qui analysent les liens des emails ne la déclenchent pas à la place de la personne.
 * Elle ne connecte pas (quelqu'un a pu s'inscrire avec l'adresse d'une autre personne) : la personne se connecte
 * ensuite avec son mot de passe, puis revient sur l'invitation d'une structure si elle en avait ouvert une.
 */
export function ConfirmEmail({ token, change }: { token: string | undefined; change: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<string | null>(null);

  if (!token) return <FormAlert>Ce lien est incomplet. Copiez le lien complet reçu par email.</FormAlert>;

  async function confirm() {
    setState('sending');
    setError(null);
    try {
      await send('POST', '/api/auth/verify-email', { token });
      setInvitation(change ? null : pendingInvitation());
      setState('done');
    } catch (caught) {
      setError(errorMessage(caught));
      setState('idle');
    }
  }

  if (state === 'done') {
    // Déjà connecté sur ce navigateur (changement d'adresse) : la page de connexion renvoie directement à la suite.
    const next = change ? '/espace/compte' : invitation ? `/rejoindre/${encodeURIComponent(invitation)}` : '/espace';
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">
          {change ? (
            <>
              <p className="font-bold">Votre nouvelle adresse est enregistrée.</p>
              <p className="mt-1">Utilisez-la désormais pour vous connecter. Par sécurité, vos autres appareils sont déconnectés.</p>
            </>
          ) : (
            <>
              <p className="font-bold">Votre adresse est confirmée : votre compte est actif.</p>
              <p className="mt-1">Connectez-vous avec votre adresse email et votre mot de passe.</p>
            </>
          )}
        </FormAlert>
        {invitation && (
          <FormAlert tone="info">Une structure vous a offert une place : vous pourrez l’activer juste après la connexion.</FormAlert>
        )}
        <a href={`/connexion?suite=${encodeURIComponent(next)}`} className={buttonClasses('primary')}>
          {change ? 'Continuer' : 'Me connecter'}
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {error && (
        <FormAlert>
          <p>{error}</p>
          <p className="mt-1">
            <Link href="/connexion" className="font-bold text-sapin-700 underline underline-offset-4">
              Se connecter pour recevoir un nouveau lien
            </Link>
          </p>
        </FormAlert>
      )}
      <button type="button" onClick={confirm} disabled={state === 'sending'} className={buttonClasses('primary', 'w-full')}>
        {state === 'sending' ? 'Confirmation…' : change ? 'Confirmer ma nouvelle adresse' : 'Confirmer mon adresse'}
      </button>
    </div>
  );
}
