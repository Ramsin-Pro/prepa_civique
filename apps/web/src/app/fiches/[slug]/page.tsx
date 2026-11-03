import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FavoriteButton } from '@/components/favorite-button';
import { ArrowRightIcon, SourceIcon } from '@/components/icons';
import { DraftTag } from '@/components/question-ui';
import { Quiz } from '@/components/quiz';
import { SpeakButton } from '@/components/speak-button';
import { ApiError, apiGet, getMe, resolvePath } from '@/lib/api';
import type { Sheet } from '@/lib/content';
import { frenchDateFormat } from '@/lib/labels';
import { breadcrumb, jsonLd, organization, pageMetadata, publicUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric' });

async function loadSheet(slug: string): Promise<Sheet | null> {
  try {
    return await apiGet<Sheet>(`/api/sheets/${encodeURIComponent(slug)}`, { personal: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const sheet = await loadSheet(slug).catch(() => null);
  if (!sheet) return { title: 'Fiche de révision' };
  return {
    ...pageMetadata({
      title: `${sheet.title} · Fiche de révision`,
      description: sheet.summary,
      path: `/fiches/${sheet.slug}`,
      image: `/fiches/${sheet.slug}/opengraph-image`,
    }),
    ...(sheet.inReview ? { robots: { index: false } } : {}),
  };
}

// Fiche de révision (E12) : résumé, points clés, exemples, vocabulaire, sources, date de mise à jour
// et responsable de la validation, puis un mini-quiz sur la même notion.
export default async function SheetPage({ params }: { params: Params }) {
  const { slug } = await params;
  const sheet = await loadSheet(slug);
  if (!sheet) notFound();

  const me = await getMe();
  const path = await resolvePath(me?.path?.slug).catch(() => null);
  const spoken = [sheet.title, sheet.summary, 'Points clés.', ...sheet.keyPoints].join(' ');

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      {!sheet.inReview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            '@type': 'LearningResource',
            name: sheet.title,
            url: `${publicUrl}/fiches/${sheet.slug}`,
            description: sheet.summary,
            inLanguage: 'fr-FR',
            learningResourceType: 'Fiche de révision',
            educationalLevel: 'Examen civique',
            dateModified: sheet.updatedAt,
            isAccessibleForFree: true,
            publisher: organization,
            citation: sheet.sources.map((source) => source.url),
          })}
        />
      )}
      {!sheet.inReview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd(
            breadcrumb([
              { name: 'Fiches de révision', path: '/fiches' },
              { name: sheet.title, path: `/fiches/${sheet.slug}` },
            ]),
          )}
        />
      )}
      <nav aria-label="Fil d’Ariane" className="text-petit">
        <Link href="/fiches" className="text-sapin-700 underline underline-offset-4">
          Fiches de révision
        </Link>
        <span aria-hidden="true"> › </span>
        <span className="text-encre-doux">{sheet.topic.title}</span>
      </nav>

      {/* Le thème est déjà dans le fil d'Ariane : pas de sur-titre en double. */}
      {sheet.inReview && (
        <div className="mt-4">
          <DraftTag />
        </div>
      )}
      <h1 className="mt-4 text-[2.125rem] leading-tight sm:text-[2.5rem]">{sheet.title}</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <SpeakButton text={spoken} src={`/api/speech/sheet/${sheet.slug}`} label="Écouter la fiche" />
        <FavoriteButton endpoint={`/api/sheets/${sheet.slug}/favorite`} initial={sheet.favorite} compact />
      </div>

      <p className="mt-6 text-[1.1875rem] leading-relaxed">{sheet.summary}</p>

      <section aria-labelledby="points-cles" className="mt-8 rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <h2 id="points-cles" className="text-[1.375rem]">
          Les points clés
        </h2>
        <ul className="mt-4 grid gap-3">
          {sheet.keyPoints.map((point) => (
            <li key={point} className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 size-2 flex-none rounded-full bg-sapin-500" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      {sheet.examples.length > 0 && (
        <section aria-labelledby="exemples" className="mt-8">
          <h2 id="exemples" className="text-[1.375rem]">
            Dans la vie de tous les jours
          </h2>
          <ul className="mt-4 grid gap-3">
            {sheet.examples.map((example) => (
              <li key={example} className="rounded-carte bg-sapin-50 p-4">
                {example}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet.vocabulary.length > 0 && (
        <section aria-labelledby="vocabulaire" className="mt-8">
          <h2 id="vocabulaire" className="text-[1.375rem]">
            Les mots à connaître
          </h2>
          <dl className="mt-4 grid gap-3">
            {sheet.vocabulary.map((entry) => (
              <div key={entry.term} className="rounded-carte border border-ligne bg-white p-4">
                <dt className="font-bold first-letter:uppercase">{entry.term}</dt>
                <dd className="mt-1 text-encre-doux">{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="sources" className="mt-8">
        <h2 id="sources" className="text-[1.375rem]">
          Sources
        </h2>
        <ul className="mt-3 grid gap-2 text-petit">
          {sheet.sources.map((source) => (
            <li key={source.url} className="flex items-start gap-2">
              <SourceIcon className="mt-1 size-3.5 flex-none text-encre-doux" />
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
                {source.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-petit text-encre-doux">
          Mise à jour le {dateFormat.format(new Date(sheet.updatedAt))}
          {sheet.reviewedAt && sheet.reviewedByName && ` · validée le ${dateFormat.format(new Date(sheet.reviewedAt))} par ${sheet.reviewedByName}`}
        </p>
      </section>

      {path && sheet.notion && sheet.questionCount > 0 && (
        <section aria-labelledby="mini-quiz" className="mt-12">
          <h2 id="mini-quiz" className="text-[1.5rem]">
            Avez-vous retenu l’essentiel ?
          </h2>
          <p className="mt-1 text-encre-doux">Quelques questions sur cette notion, corrigées et expliquées une par une.</p>
          <div className="mt-5">
            <Quiz pathSlug={path.slug} mode="topic" topicSlug={sheet.topic.slug} notion={sheet.notion} />
          </div>
        </section>
      )}

      <nav aria-label="Autres fiches du thème" className="mt-12 grid gap-3 sm:grid-cols-2">
        {sheet.previous ? (
          <Link href={`/fiches/${sheet.previous.slug}`} className="rounded-carte border border-ligne bg-white p-4 hover:border-sapin-500">
            <span className="text-petit text-encre-doux">Fiche précédente</span>
            <span className="mt-1 block font-bold">{sheet.previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {sheet.next && (
          <Link href={`/fiches/${sheet.next.slug}`} className="rounded-carte border border-ligne bg-white p-4 text-right hover:border-sapin-500">
            <span className="text-petit text-encre-doux">Fiche suivante</span>
            <span className="mt-1 flex items-center justify-end gap-2 font-bold">
              {sheet.next.title}
              <ArrowRightIcon className="size-5" />
            </span>
          </Link>
        )}
      </nav>
    </article>
  );
}
