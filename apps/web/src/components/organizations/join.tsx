'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonClasses } from '@/components/button';
import { Checkbox, FormAlert } from '@/components/form';
import { errorMessage, send } from '@/lib/client';
import { frenchDateFormat } from '@/lib/labels';
import type { JoinInfo } from '@/lib/types';
import { pendingInvitation, rememberInvitation } from './organization-fields';

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Activation d'une place offerte par une structure. La personne choisit ce qu'elle partage : par défaut, la structure
 * ne voit qu'un email masqué et la date d'activation, de quoi gérer ses places.
 */
export function JoinOrganization({
  code,
  info,
  account,
}: {
  code: string;
  info: JoinInfo;
  account: 'anonymous' | 'unverified' | 'verified';
}) {
  const [share, setShare] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const next = encodeURIComponent(`/rejoindre/${code}`);

  // Le lien est gardé le temps de créer son compte et de confirmer son adresse.
  useEffect(() => {
    if (!info.alreadyMember && info.seatsAvailable) rememberInvitation(code);
  }, [code, info.alreadyMember, info.seatsAvailable]);

  async function join() {
    setSending(true);
    setError(null);
    try {
      const result = await send<{ expiresAt: string }>('POST', '/api/organizations/join', { code, shareProgress: share });
      rememberInvitation(null);
      setJoined(result.expiresAt);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSending(false);
    }
  }

  if (joined || info.alreadyMember) {
    return (
      <div className="grid gap-4">
        <FormAlert tone="success">
          <p className="font-bold">Votre place est activée.</p>
          {joined && <p className="mt-1">Votre accès Premium est ouvert jusqu’au {dateFormat.format(new Date(joined))}. Il s’arrête seul : rien à payer.</p>}
        </FormAlert>
        <Link href="/entrainement" className={buttonClasses('primary')}>
          Commencer à m’entraîner
        </Link>
      </div>
    );
  }

  if (!info.seatsAvailable) {
    return (
      <FormAlert>
        Il n’y a plus de place disponible chez {info.name}. Prévenez la personne qui vous a donné ce lien : la structure peut ajouter des places.
      </FormAlert>
    );
  }

  if (account === 'anonymous') {
    return (
      <div className="grid gap-4">
        <p>Pour activer votre place, il faut un compte gratuit : il garde votre progression et votre accès sur tous vos appareils.</p>
        <Link href={`/inscription?suite=${next}`} className={buttonClasses('primary')}>
          Créer mon compte gratuit
        </Link>
        <Link href={`/connexion?suite=${next}`} className={buttonClasses('secondary')}>
          J’ai déjà un compte
        </Link>
      </div>
    );
  }

  if (account === 'unverified') {
    return (
      <FormAlert tone="info">
        Confirmez d’abord votre adresse email avec le lien reçu par email, puis revenez sur cette page pour activer votre place.
      </FormAlert>
    );
  }

  return (
    <div className="grid gap-5">
      {error && <FormAlert>{error}</FormAlert>}
      <div className="rounded-carte bg-papier p-4 text-petit">
        <p className="font-bold">Ce que verra {info.name}</p>
        <ul className="mt-2 grid list-disc gap-1 pl-5">
          <li>votre email masqué (par exemple « am••••@gmail.com ») et la date d’activation, pour gérer ses places ;</li>
          <li>si vous cochez la case ci-dessous : votre email complet et votre progression (questions travaillées, meilleur examen blanc).</li>
        </ul>
        <p className="mt-2">Vous pourrez changer d’avis à tout moment dans votre compte.</p>
      </div>
      <Checkbox checked={share} onChange={(event) => setShare(event.target.checked)}>
        J’accepte de partager mon email et ma progression avec {info.name}, pour que la personne qui m’accompagne puisse m’aider.
      </Checkbox>
      <div>
        <button type="button" onClick={join} disabled={sending} className={buttonClasses('primary', 'w-full sm:w-auto')}>
          {sending ? 'Activation…' : 'Activer ma place'}
        </button>
      </div>
    </div>
  );
}

/** Rappel d'une invitation commencée avant la création du compte, affiché une fois le compte prêt. */
export function PendingInvitation() {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => setCode(pendingInvitation()), []);
  if (!code) return null;
  return (
    <FormAlert tone="info">
      <p className="font-bold">Une structure vous a offert une place.</p>
      <p className="mt-1">Votre compte est prêt : il ne reste plus qu’à activer votre accès Premium.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <a href={`/rejoindre/${code}`} className={buttonClasses('primary', 'min-h-11 text-petit')}>
          Activer ma place
        </a>
        <button
          type="button"
          onClick={() => {
            rememberInvitation(null);
            setCode(null);
          }}
          className={buttonClasses('quiet', 'min-h-11 text-petit')}
        >
          Ignorer
        </button>
      </div>
    </FormAlert>
  );
}
