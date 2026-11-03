import type { Metadata } from 'next';
import { Eyebrow } from '@/components/eyebrow';
import { SpeakButton } from '@/components/speak-button';
import { ApiError, apiGet } from '@/lib/api';
import { SERVICE_UNAVAILABLE } from '@/lib/errors';
import { jsonLd, pageMetadata, publicUrl } from '@/lib/seo';
import { site } from '@/lib/site';
import type { GlossaryEntry } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Lexique',
  description:
    'Les mots de l’examen civique expliqués simplement : laïcité, préfecture, citoyenneté, naturalisation… Chaque définition peut être écoutée à voix haute.',
  path: '/lexique',
});
export const dynamic = 'force-dynamic';

const initial = (term: string) => term.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();

// Les mots difficiles des questions, expliqués simplement (charte éditoriale §6).
export default async function GlossaryPage() {
  let entries: GlossaryEntry[] = [];
  let error: string | null = null;
  try {
    entries = await apiGet<GlossaryEntry[]>('/api/glossary');
  } catch (caught) {
    error = caught instanceof ApiError ? caught.message : SERVICE_UNAVAILABLE;
  }

  const groups = new Map<string, GlossaryEntry[]>();
  for (const entry of entries) groups.set(initial(entry.term), [...(groups.get(initial(entry.term)) ?? []), entry]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {entries.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            '@type': 'DefinedTermSet',
            name: `Lexique de l’examen civique · ${site.name}`,
            url: `${publicUrl}/lexique`,
            inLanguage: 'fr-FR',
            hasDefinedTerm: entries.map((entry) => ({ '@type': 'DefinedTerm', name: entry.term, description: entry.definition })),
          })}
        />
      )}
      <Eyebrow>Lexique</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.75rem]">Les mots à connaître</h1>
      <p className="mt-3 text-encre-doux">
        Les mots administratifs et civiques des questions, expliqués avec des mots simples. Ils s’affichent aussi à côté des
        questions qui les utilisent.
      </p>

      {error && (
        <p role="alert" className="mt-8 rounded-carte border border-brique-200 bg-brique-100 p-5">
          {error}
        </p>
      )}
      {!error && entries.length === 0 && <p className="mt-8 text-encre-doux">Le lexique est en préparation.</p>}

      {groups.size > 1 && (
        <nav aria-label="Aller à une lettre" className="sticky top-0 z-10 -mx-4 mt-6 border-b border-ligne bg-papier/95 px-4 py-2 backdrop-blur">
          <ul className="flex gap-1 overflow-x-auto">
            {[...groups.keys()].map((letter) => (
              <li key={letter}>
                <a
                  href={`#lettre-${letter}`}
                  className="grid size-10 place-items-center rounded-bouton font-titre text-[1.125rem] font-semibold text-sapin-700 hover:bg-sapin-50"
                >
                  {letter}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-8 grid gap-8">
        {[...groups.entries()].map(([letter, group]) => (
          <section key={letter} aria-labelledby={`lettre-${letter}`}>
            <h2 id={`lettre-${letter}`} className="scroll-mt-20 border-b border-ligne pb-1 text-[1.5rem] text-sapin-700">
              {letter}
            </h2>
            <dl className="mt-3 grid gap-4">
              {group.map((entry) => (
                <div key={entry.term} className="grid gap-1">
                  <dt className="flex flex-wrap items-center gap-3 font-bold first-letter:uppercase">
                    {entry.term}
                    <SpeakButton
                      text={`${entry.term}. ${entry.definition}`}
                      src={`/api/speech/glossary?term=${encodeURIComponent(entry.term)}`}
                      label="Écouter"
                    />
                  </dt>
                  <dd className="text-encre-doux">{entry.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}
