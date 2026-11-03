'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Checkbox, Field, FormAlert, PasswordField } from '@/components/form';
import { rememberInvitation } from '@/components/organizations/organization-fields';
import { readChannel } from '@/lib/channel';
import { RequestError, errorMessage, send } from '@/lib/client';

type PathOption = { slug: string; title: string };

/** Inscription (E05) : email, mot de passe, CGU obligatoires, consentement marketing séparé et facultatif. */
export function RegisterForm({ paths, defaultPath, next }: { paths: PathOption[]; defaultPath?: string; next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pathSlug, setPathSlug] = useState(paths.some((path) => path.slug === defaultPath) ? defaultPath! : (paths[0]?.slug ?? ''));
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFields({});
    if (!acceptTerms) {
      setFields({ acceptTerms: 'Vous devez accepter les conditions d’utilisation.' });
      return;
    }
    setSubmitting(true);
    try {
      await send('POST', '/api/auth/register', {
        email,
        password,
        acceptTerms: true,
        marketingConsent,
        pathSlug: pathSlug || undefined,
        channel: readChannel() ?? undefined,
      });
      // Venue d'un lien d'invitation : il est gardé pour l'après-confirmation, même si la page de la structure n'a pas pu le noter.
      const invitation = /^\/rejoindre\/([A-Za-z0-9-]{6,16})$/.exec(next);
      if (invitation) rememberInvitation(invitation[1]!);
      setSentTo(email.trim().toLowerCase());
    } catch (caught) {
      setError(errorMessage(caught));
      if (caught instanceof RequestError) setFields(caught.fields);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) return <CheckYourEmail email={sentTo} next={next} />;

  return (
    <form onSubmit={submit} noValidate className="grid gap-5">
      {error && <FormAlert reveal>{error}</FormAlert>}
      <Field
        label="Adresse email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fields.email}
      />
      <PasswordField
        label="Mot de passe"
        name="password"
        autoComplete="new-password"
        hint="10 caractères au moins. Une petite phrase facile à retenir fonctionne bien."
        required
        minLength={10}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fields.password}
      />
      {paths.length > 1 && (
        <div>
          <label htmlFor="parcours" className="font-bold">
            Votre démarche
          </label>
          <p className="mt-0.5 text-petit text-encre-doux">Vous pourrez la changer plus tard.</p>
          <select
            id="parcours"
            value={pathSlug}
            onChange={(event) => setPathSlug(event.target.value)}
            className="mt-1.5 block min-h-12 w-full rounded-bouton border-2 border-ligne bg-white px-3 text-courant"
          >
            {paths.map((path) => (
              <option key={path.slug} value={path.slug}>
                {path.title}
              </option>
            ))}
          </select>
        </div>
      )}
      <Checkbox checked={acceptTerms} onChange={(event) => setAcceptTerms(event.target.checked)} error={fields.acceptTerms}>
        J’accepte les{' '}
        <Link href="/cgu" target="_blank" className="text-sapin-700 underline underline-offset-4">
          conditions d’utilisation
        </Link>{' '}
        et j’ai lu la{' '}
        <Link href="/confidentialite" target="_blank" className="text-sapin-700 underline underline-offset-4">
          politique de confidentialité
        </Link>
        .
      </Checkbox>
      <Checkbox checked={marketingConsent} onChange={(event) => setMarketingConsent(event.target.checked)}>
        Je veux recevoir par email des conseils de révision et des offres. Facultatif : vous pouvez vous désinscrire à tout moment.
      </Checkbox>
      <p className="text-petit text-encre-doux">Nous ne demandons jamais de document d’identité ni de numéro de dossier.</p>
      <button type="submit" disabled={submitting} className={buttonClasses('primary', 'w-full')}>
        {submitting ? 'Création du compte…' : 'Créer mon compte'}
      </button>
      <p className="text-center text-petit">
        Déjà un compte ?{' '}
        <Link href={`/connexion?suite=${encodeURIComponent(next)}`} className="font-bold text-sapin-700 underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </form>
  );
}

/** Après l'inscription : la même réponse, que l'adresse soit déjà inscrite ou non (aucune information divulguée). */
export function CheckYourEmail({ email, next }: { email: string; next: string }) {
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setError(null);
    try {
      await send('POST', '/api/auth/resend-verification', { email });
      setResent(true);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <div className="grid gap-4">
      <FormAlert tone="success" reveal>
        <p className="font-bold">Vérifiez votre boîte mail.</p>
        <p className="mt-1">
          Si l’adresse est valide, vous allez recevoir un lien pour activer votre compte. Il est valable 48 heures. Pensez à regarder
          dans les courriers indésirables.
        </p>
      </FormAlert>
      {process.env.NODE_ENV !== 'production' && (
        <FormAlert tone="info">
          <p className="text-petit">
            Développement : les emails s’affichent dans la console de l’API, ou dans Mailpit (http://localhost:8026) si le serveur
            d’emails est lancé.
          </p>
        </FormAlert>
      )}
      {error && <FormAlert reveal>{error}</FormAlert>}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={resend} disabled={resent} className={buttonClasses('secondary')}>
          {resent ? 'Lien renvoyé' : 'Renvoyer le lien'}
        </button>
        <Link href={`/connexion?suite=${encodeURIComponent(next)}`} className={buttonClasses('quiet')}>
          J’ai confirmé, me connecter
        </Link>
      </div>
    </div>
  );
}
