'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Field, FormAlert, PasswordField } from '@/components/form';
import { RequestError, errorMessage, send } from '@/lib/client';

type LoginResult = { ok: true; mfaRequired: boolean; mfaSetupRequired: boolean };

/** Connexion (E05), puis code de double authentification pour les comptes de l'équipe qui l'ont activée (A09). */
export function LoginForm({ next }: { next: string }) {
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
  const [resent, setResent] = useState(false);

  // Rechargement complet : l'en-tête et les pages serveur voient tout de suite la nouvelle session.
  const go = (target: string) => window.location.assign(target);

  async function login(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await send<LoginResult>('POST', '/api/auth/login', { email, password });
      if (result.mfaRequired) {
        setStep('mfa');
        setSubmitting(false);
      } else if (result.mfaSetupRequired) {
        go('/admin/securite');
      } else {
        go(next);
      }
    } catch (caught) {
      setError({ message: errorMessage(caught), code: caught instanceof RequestError ? caught.code : null });
      setSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await send('POST', '/api/auth/mfa', { code });
      go(next);
    } catch (caught) {
      setError({ message: errorMessage(caught), code: null });
      setSubmitting(false);
    }
  }

  async function resend() {
    await send('POST', '/api/auth/resend-verification', { email }).catch(() => undefined);
    setResent(true);
  }

  if (step === 'mfa') {
    return (
      <form onSubmit={verifyCode} noValidate className="grid gap-5">
        <p>Ouvrez votre application d’authentification et saisissez le code à 6 chiffres affiché pour {email}.</p>
        {error && <FormAlert>{error.message}</FormAlert>}
        <Field
          label="Code de vérification"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          autoFocus
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="submit" disabled={submitting} className={buttonClasses('primary', 'w-full')}>
          {submitting ? 'Vérification…' : 'Valider'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={login} noValidate className="grid gap-5">
      {error && (
        <FormAlert>
          <p>{error.message}</p>
          {error.code === 'email_not_verified' && (
            <button type="button" onClick={resend} disabled={resent} className="mt-2 font-bold text-sapin-700 underline underline-offset-4">
              {resent ? 'Lien renvoyé : vérifiez votre boîte mail' : 'Renvoyer le lien de confirmation'}
            </button>
          )}
        </FormAlert>
      )}
      <Field
        label="Adresse email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <PasswordField
        label="Mot de passe"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <p className="-mt-2 text-petit">
        <Link href="/mot-de-passe-oublie" className="text-sapin-700 underline underline-offset-4">
          Mot de passe oublié ?
        </Link>
      </p>
      <button type="submit" disabled={submitting} className={buttonClasses('primary', 'w-full')}>
        {submitting ? 'Connexion…' : 'Se connecter'}
      </button>
      <p className="text-center text-petit">
        Pas encore de compte ?{' '}
        <Link href={`/inscription?suite=${encodeURIComponent(next)}`} className="font-bold text-sapin-700 underline underline-offset-4">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
