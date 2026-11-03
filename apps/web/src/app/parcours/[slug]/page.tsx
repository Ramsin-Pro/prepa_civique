import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { ArrowRightIcon, SourceIcon } from '@/components/icons';
import { ApiError, apiGet } from '@/lib/api';
import { withFirstOfMonth } from '@/lib/labels';
import { breadcrumb, jsonLd, organization, pageMetadata } from '@/lib/seo';
import type { ExamTemplateSummary, PathSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

async function loadPath(slug: string): Promise<PathSummary | null> {
  try {
    return await apiGet<PathSummary>(`/api/paths/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const path = await loadPath(slug).catch(() => null);
  return path
    ? pageMetadata({
        title: `Parcours ${path.title}`,
        description: `${path.description} Questions officielles avec leurs réponses expliquées, examens blancs et fiches de révision.`,
        path: `/parcours/${slug}`,
        image: `/parcours/${slug}/opengraph-image`,
      })
    : { title: 'Parcours' };
}

// Page d'un parcours (E03) : à qui il s'adresse, le format de l'examen, les thèmes, et par où commencer.
export default async function PathPage({ params }: { params: Params }) {
  const { slug } = await params;
  const path = await loadPath(slug);
  if (!path) notFound();
  const template = path.active
    ? await apiGet<ExamTemplateSummary>(`/api/exams/template?path=${path.slug}`).catch(() => null)
    : null;
  const totalQuestions = path.topics.reduce((sum, topic) => sum + topic.questionCount, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {path.active && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            '@type': 'Course',
            name: `Préparation à l’examen civique : ${path.title}`,
            description: path.description,
            inLanguage: 'fr-FR',
            provider: organization,
            isAccessibleForFree: true,
          })}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumb([{ name: 'Parcours', path: '/parcours' }, { name: path.title, path: `/parcours/${path.slug}` }]))}
      />
      <Eyebrow>Parcours</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.75rem]">{path.title}</h1>
      <p className="mt-3 max-w-2xl text-encre-doux">{path.description}</p>

      {!path.active ? (
        <p className="mt-8 rounded-carte bg-ocre-100/50 p-5">
          Ce parcours est en préparation. Les thèmes de l’examen sont les mêmes pour toutes les démarches : vous pouvez déjà{' '}
          <Link href="/entrainement" className="font-bold text-sapin-700 underline underline-offset-4">
            vous entraîner par thème
          </Link>
          .
        </p>
      ) : (
        <>
          {template && (
            <section aria-labelledby="format" className="mt-8 rounded-carte border border-ligne bg-white p-6 shadow-carte">
              <h2 id="format" className="text-[1.375rem]">
                L’examen en bref
              </h2>
              <ul className="mt-3 grid gap-2">
                <li>
                  {template.questionCount} questions : {template.knowledgeCount} de connaissance et {template.situationCount} mises en situation.
                </li>
                <li>{Math.round(template.durationSeconds / 60)} minutes au maximum, une seule bonne réponse sur 4 propositions.</li>
                <li>
                  {template.passThreshold} bonnes réponses sur {template.questionCount} pour réussir.
                </li>
              </ul>
              {template.regulatoryRef && <p className="mt-3 text-petit text-encre-doux">Référence : {template.regulatoryRef}</p>}
            </section>
          )}

          <section aria-labelledby="themes" className="mt-8">
            <h2 id="themes" className="text-[1.375rem]">
              Les 5 thèmes ({totalQuestions} questions pour s’entraîner)
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {path.topics.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    href={`/entrainement/${path.slug}/${topic.slug}`}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-carte border border-ligne bg-white px-4 py-3 hover:border-sapin-500"
                  >
                    <span>
                      <span className="block font-bold">{topic.title}</span>
                      <span className="text-petit text-encre-doux">{topic.questionCount} questions</span>
                    </span>
                    <ArrowRightIcon className="size-5 flex-none text-sapin-700" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/entrainement/${path.slug}/melange`} className={buttonClasses('primary')}>
              Commencer l’entraînement
            </Link>
            <Link href={`/examen-blanc?parcours=${path.slug}`} className={buttonClasses('secondary')}>
              Passer un examen blanc
            </Link>
          </div>
          <p className="mt-4 text-petit text-encre-doux">
            Gratuit pour commencer, sans inscription. Toutes les questions et des examens blancs illimités avec le{' '}
            <Link href="/tarifs" className="font-bold text-sapin-700 underline underline-offset-4">
              Premium
            </Link>
            .
          </p>
        </>
      )}

      {path.sources.length > 0 && (
        <section aria-labelledby="sources-parcours" className="mt-10">
          <h2 id="sources-parcours" className="text-[1.375rem]">
            Sources officielles
          </h2>
          <ul className="mt-3 grid gap-2 text-petit">
            {path.sources.map((source) => (
              <li key={source.url} className="flex items-start gap-2">
                <SourceIcon className="mt-1 size-3.5 flex-none text-encre-doux" />
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
          {path.verifiedAt && (
            <p className="mt-3 text-petit text-encre-doux">
              Règles vérifiées sur ces sources le{' '}
              {withFirstOfMonth(new Date(path.verifiedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }))}. Elles
              peuvent changer : en cas de doute, les sites officiels font foi.
            </p>
          )}
        </section>
      )}

      <p className="mt-10 text-petit text-encre-doux">
        Vous ne savez pas si cette démarche vous concerne ?{' '}
        <Link href="/orientation" className="text-sapin-700 underline underline-offset-4">
          Faites le point en une question
        </Link>
        .
      </p>
    </div>
  );
}
