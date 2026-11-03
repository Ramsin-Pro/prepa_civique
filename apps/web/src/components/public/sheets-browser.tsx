'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowRightIcon } from '@/components/icons';
import { DraftTag } from '@/components/question-ui';
import type { SheetTopic } from '@/lib/content';

/** Mot cherché sans tenir compte des accents ni des majuscules. */
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Liste des fiches (E12) avec recherche et filtre « mes favoris ». */
export function SheetsBrowser({ topics }: { topics: SheetTopic[] }) {
  const [query, setQuery] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const hasFavorites = topics.some((topic) => topic.sheets.some((sheet) => sheet.favorite));

  const shown = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean);
    return topics
      .map((topic) => ({
        ...topic,
        sheets: topic.sheets.filter((sheet) => {
          if (onlyFavorites && !sheet.favorite) return false;
          const haystack = fold(`${sheet.title} ${sheet.summary} ${topic.title}`);
          return words.every((word) => haystack.includes(word));
        }),
      }))
      .filter((topic) => topic.sheets.length > 0);
  }, [topics, query, onlyFavorites]);

  const count = shown.reduce((sum, topic) => sum + topic.sheets.length, 0);

  return (
    <>
      <div role="search" className="mt-8 flex flex-wrap items-end gap-4">
        <label className="grid flex-1 gap-1.5 font-bold sm:max-w-md">
          Chercher une fiche
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Par exemple : laïcité, vote, impôts"
            className="min-h-12 rounded-bouton border-2 border-ligne bg-white px-3.5 font-normal outline-none focus:border-sapin-500"
          />
        </label>
        {hasFavorites && (
          <label className="flex min-h-12 items-center gap-2 text-petit font-bold">
            <input type="checkbox" checked={onlyFavorites} onChange={(event) => setOnlyFavorites(event.target.checked)} className="size-5 accent-sapin-700" />
            Seulement mes favoris
          </label>
        )}
      </div>
      <p aria-live="polite" className="mt-3 text-petit text-encre-doux">
        {count === 0 ? 'Aucune fiche ne correspond.' : `${count} fiche${count > 1 ? 's' : ''}`}
      </p>

      <div className="mt-6 grid gap-10">
        {shown.map((topic) => (
          <section key={topic.slug} aria-labelledby={`theme-${topic.slug}`}>
            <h2 id={`theme-${topic.slug}`} className="text-[1.5rem]">
              {topic.title}
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {topic.sheets.map((sheet) => (
                <li key={sheet.slug}>
                  <Link
                    href={`/fiches/${sheet.slug}`}
                    className="group flex h-full flex-col gap-2 rounded-carte border border-ligne bg-white p-5 shadow-carte hover:border-sapin-500"
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-[1.125rem] font-bold group-hover:text-sapin-700">{sheet.title}</span>
                      <ArrowRightIcon className="mt-1 size-5 flex-none text-sapin-700" />
                    </span>
                    <span className="line-clamp-2 text-petit text-encre-doux">{sheet.summary}</span>
                    {(sheet.inReview || sheet.favorite) && (
                      <span className="flex flex-wrap gap-2">
                        {sheet.favorite && <span className="rounded-md bg-ocre-100 px-2 py-0.5 text-xs font-bold text-ocre-700">Dans mes favoris</span>}
                        {sheet.inReview && <DraftTag />}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
