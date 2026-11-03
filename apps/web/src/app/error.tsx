'use client';

import { buttonClasses } from '@/components/button';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-[2.125rem] leading-tight">Le service ne répond pas</h1>
      <p className="mt-3 text-encre-doux">Un problème temporaire empêche d’afficher cette page. Réessayez dans un instant.</p>
      <button type="button" onClick={reset} className={buttonClasses('primary', 'mt-8')}>
        Réessayer
      </button>
    </div>
  );
}
