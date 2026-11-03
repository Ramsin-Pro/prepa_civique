'use client';

import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Field, FormAlert } from '@/components/form';
import { errorMessage, send } from '@/lib/client';

type Setup = { secret: string; otpauthUrl: string; qrCode: string };

/**
 * Double authentification (A09) : un code à 6 chiffres d'une application (Aegis, Google Authenticator,
 * Microsoft Authenticator…) en plus du mot de passe pour les comptes de l'équipe.
 */
export function MfaSetup({ enabled, required }: { enabled: boolean; required: boolean }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(enabled);

  async function start() {
    setPending(true);
    setError(null);
    try {
      setSetup(await send<Setup>('POST', '/api/auth/mfa/setup'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function enable(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await send('POST', '/api/auth/mfa/enable', { code });
      setDone(true);
      window.location.assign('/admin');
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(false);
    }
  }

  if (done) {
    return <FormAlert tone="success">La double authentification est active sur votre compte. Un code vous sera demandé à chaque connexion.</FormAlert>;
  }

  return (
    <div className="grid max-w-xl gap-5">
      {required && (
        <FormAlert tone="info">
          Pour protéger les données des candidats, la double authentification est obligatoire avant d’accéder au back-office.
        </FormAlert>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      {!setup ? (
        <div>
          <p>Installez une application d’authentification sur votre téléphone, puis lancez la configuration.</p>
          <button type="button" onClick={start} disabled={pending} className={buttonClasses('primary', 'mt-4')}>
            Configurer la double authentification
          </button>
        </div>
      ) : (
        <form onSubmit={enable} className="grid gap-4">
          <ol className="grid list-decimal gap-2 pl-5">
            <li>Scannez ce code avec votre application.</li>
            <li>Saisissez le code à 6 chiffres qu’elle affiche.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrCode} alt="Code QR à scanner avec l’application d’authentification" width={220} height={220} className="rounded-carte border border-ligne bg-white p-2" />
          <p className="text-petit text-encre-doux">
            Impossible de scanner ? Saisissez cette clé dans l’application : <code className="break-all font-bold text-encre">{setup.secret}</code>
          </p>
          <Field
            label="Code à 6 chiffres"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <div>
            <button type="submit" disabled={pending} className={buttonClasses('primary')}>
              Activer
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
