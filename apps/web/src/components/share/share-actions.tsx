'use client';

import { useEffect, useState } from 'react';
import { buttonClasses } from '@/components/button';
import { site } from '@/lib/site';

// Partage par les canaux que le public utilise vraiment : WhatsApp d'abord, puis l'email, et le texte à copier
// pour tout le reste (SMS, Messenger, groupe de l'association). Rien ne part sans que la personne l'envoie elle-même.

function useSiteUrl() {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function ShareButtons({ subject, message }: { subject: string; message: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Presse-papiers indisponible : les deux autres boutons restent utilisables.
    }
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses('secondary', 'min-h-11 text-petit')}
      >
        Envoyer par WhatsApp
      </a>
      <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`} className={buttonClasses('secondary', 'min-h-11 text-petit')}>
        Envoyer par email
      </a>
      <button type="button" onClick={copy} className={buttonClasses('quiet', 'min-h-11 text-petit')}>
        {copied ? 'Message copié' : 'Copier le message'}
      </button>
    </div>
  );
}

/**
 * Beaucoup de candidats sont accompagnés par une association, qui peut offrir l'accès à tout son groupe : plutôt que
 * de payer seul, la personne lui transmet un message tout prêt vers l'offre associations.
 */
export function ProposeToAssociation({ className = '' }: { className?: string }) {
  const origin = useSiteUrl();
  const message = `Bonjour, je prépare l'examen civique avec ${site.name}. Le site propose une offre pour les associations et les structures : l'accès complet pour chaque personne du groupe, dès quelques euros, avec un lien d'invitation. Est-ce que vous pourriez regarder ? ${origin}/associations`;
  return (
    <div className={`rounded-xl border border-ocre-100 bg-white p-4 ${className}`}>
      <p className="font-bold">Une association vous accompagne ?</p>
      <p className="mt-1 text-petit text-encre-doux">
        Elle peut offrir l’accès complet à tout son groupe, à prix réduit. Envoyez-lui ce message tout prêt : vous n’avez rien à payer.
      </p>
      <ShareButtons subject={`${site.name} : une offre pour notre groupe`} message={message} />
    </div>
  );
}

/** Après un bon score : le bouche-à-oreille de la communauté est ce qui convainc le plus. */
export function ShareWithFriend({ className = '' }: { className?: string }) {
  const origin = useSiteUrl();
  const message = `Je m'entraîne à l'examen civique sur ${site.name} : les questions de la liste officielle avec les réponses expliquées, et un examen blanc gratuit. Ça peut t'aider : ${origin}`;
  return (
    <div className={`rounded-xl border border-sapin-100 bg-sapin-50 p-4 ${className}`}>
      <p className="font-bold">Quelqu’un autour de vous prépare aussi l’examen ?</p>
      <p className="mt-1 text-petit text-encre-doux">Envoyez-lui le site : l’entraînement et un examen blanc sont gratuits.</p>
      <ShareButtons subject={`${site.name} : pour préparer l’examen civique`} message={message} />
    </div>
  );
}
