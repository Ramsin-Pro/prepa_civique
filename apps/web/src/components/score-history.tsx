'use client';

import { useState } from 'react';
import type { ExamSummary } from '@/lib/types';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/**
 * Évolution des examens blancs (E13) : une colonne par examen, du plus ancien au plus récent, et le seuil de réussite.
 * Une seule série, une seule couleur ; la liste des examens juste en dessous sert de tableau équivalent.
 * Aucune prédiction : le graphique montre seulement les résultats passés.
 */
export function ScoreHistory({ exams }: { exams: ExamSummary[] }) {
  const [active, setActive] = useState<number | null>(null);
  const ordered = [...exams].reverse();
  const total = ordered[0]?.total ?? 40;
  const threshold = ordered[0]?.passThreshold ?? 32;
  const last = ordered.length - 1;

  return (
    <figure className="mt-4 rounded-carte border border-ligne bg-white p-5">
      <figcaption className="text-petit text-encre-doux">
        Vos {ordered.length} derniers examens blancs, du plus ancien au plus récent. La ligne indique le seuil de {threshold} bonnes
        réponses sur {total}.
      </figcaption>
      <div className="relative mt-6 h-40">
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-ligne" />
        <span aria-hidden="true" className="absolute inset-x-0 h-px bg-ocre-500" style={{ bottom: `${(threshold / total) * 100}%` }}>
          <span className="absolute -top-5 right-0 text-xs font-bold text-ocre-700">Seuil {threshold}</span>
        </span>
        <ol className="absolute inset-0 flex items-end justify-around gap-[2px]" aria-label="Scores des examens blancs">
          {ordered.map((exam, index) => (
            <li
              key={exam.id}
              tabIndex={0}
              aria-label={`${shortDate(exam.endedAt)} : ${exam.score ?? 0} sur ${exam.total}`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive((current) => (current === index ? null : current))}
              onFocus={() => setActive(index)}
              onBlur={() => setActive((current) => (current === index ? null : current))}
              className="relative flex h-full max-w-16 flex-1 items-end justify-center outline-none focus-visible:bg-sapin-50"
            >
              <span
                aria-hidden="true"
                className={`w-full max-w-6 rounded-t-[4px] bg-[var(--color-graphe)] ${active !== null && active !== index ? 'opacity-60' : ''}`}
                style={{ height: `${((exam.score ?? 0) / exam.total) * 100}%` }}
              />
              {(index === last || active === index) && (
                <span
                  role={active === index ? 'tooltip' : undefined}
                  className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border border-ligne bg-white px-2 py-1 text-xs shadow-carte"
                  style={{ bottom: `calc(${((exam.score ?? 0) / exam.total) * 100}% + 6px)` }}
                >
                  <strong className="text-encre">
                    {exam.score ?? 0}/{exam.total}
                  </strong>
                  {active === index && <span className="text-encre-doux"> · {shortDate(exam.endedAt)}</span>}
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-around gap-[2px] text-xs text-encre-doux">
        {ordered.map((exam) => (
          <span key={exam.id} className="max-w-16 flex-1 text-center">
            {shortDate(exam.endedAt)}
          </span>
        ))}
      </div>
    </figure>
  );
}
