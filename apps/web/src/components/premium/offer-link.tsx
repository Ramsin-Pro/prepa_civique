'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';

export type OfferPlace = 'quiz' | 'resultat-examen' | 'examen-blanc' | 'accueil';

/** Statistique interne (A08), sans cookie ni traceur : l'offre a été vue, ou cliquée, à cet endroit du site. */
function trackOffer(event: 'view' | 'click', place: OfferPlace, path?: string) {
  void fetch('/api/analytics/offer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, place, path }),
    keepalive: true,
  }).catch(() => undefined);
}

/** Lien vers les tarifs qui compte l'affichage de l'offre et le clic, pour savoir quel endroit amène au Premium. */
export function OfferLink({ place, path, className, children }: { place: OfferPlace; path?: string; className?: string; children: ReactNode }) {
  useEffect(() => trackOffer('view', place, path), [place, path]);
  return (
    <Link href="/tarifs" className={className} onClick={() => trackOffer('click', place, path)}>
      {children}
    </Link>
  );
}
