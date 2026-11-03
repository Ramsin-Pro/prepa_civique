'use client';

import { useState } from 'react';

/**
 * Met une question (E09) ou une fiche (E12) de côté pour la retravailler plus tard.
 * `endpoint` reçoit PUT pour ajouter, DELETE pour retirer. `compact` : l'étoile seule sur téléphone.
 */
export function FavoriteButton({ endpoint, initial, compact = false }: { endpoint: string; initial: boolean; compact?: boolean }) {
  const [favorite, setFavorite] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !favorite;
    setFavorite(next);
    setBusy(true);
    try {
      const res = await fetch(endpoint, { method: next ? 'PUT' : 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setFavorite(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={favorite}
      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-bold transition-colors ${
        favorite ? 'border-ocre-500 bg-ocre-100 text-ocre-700' : 'border-ligne bg-white text-encre-doux hover:border-ocre-500 hover:text-ocre-700'
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
      <span className={compact ? 'max-sm:sr-only' : undefined}>{favorite ? 'Dans mes favoris' : 'Ajouter aux favoris'}</span>
    </button>
  );
}
