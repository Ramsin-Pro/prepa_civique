'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SERVICE_UNAVAILABLE, readErrorMessage } from '@/lib/errors';
import { buttonClasses } from './button';

/** Démarrage explicite de l'examen blanc (E10) : le chronomètre ne part qu'au clic. */
export function StartExamButton({ pathSlug }: { pathSlug: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathSlug }),
      });
      if (!res.ok) {
        setPremiumRequired(res.status === 403);
        throw new Error(await readErrorMessage(res));
      }
      const exam = (await res.json()) as { id: string };
      router.push(`/examen-blanc/${exam.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : SERVICE_UNAVAILABLE);
      setStarting(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-3">
      <button type="button" onClick={start} disabled={starting} className={buttonClasses('primary')}>
        {starting ? 'Préparation de l’examen…' : 'Commencer l’examen blanc'}
      </button>
      {error && (
        <p role="alert" className="text-petit text-brique-700">
          {error}{' '}
          {premiumRequired && (
            <Link href="/tarifs" className="font-bold underline underline-offset-4">
              Voir l’offre Premium
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
