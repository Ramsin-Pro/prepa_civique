import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { ArrowRightIcon } from '@/components/icons';
import { MasteryBar } from '@/components/mastery-bar';
import { ScoreHistory } from '@/components/score-history';
import { PathSwitcher } from '@/components/path-switcher';
import { ApiError, apiGet, choosePath } from '@/lib/api';
import { SERVICE_UNAVAILABLE } from '@/lib/errors';
import { frenchDateFormat, plural } from '@/lib/labels';
import type { PathSummary, Progress } from '@/lib/types';

export const metadata: Metadata = { title: 'Ma progression' };
export const dynamic = 'force-dynamic';

const dayFormat = frenchDateFormat({ weekday: 'long', day: 'numeric', month: 'long' });
const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long' });

// Progression (E13) : ce qui est acquis, ce qui reste à revoir, et la prochaine étape utile.
// Aucune promesse ni prédiction de réussite.
export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ parcours?: string }> }) {
  const { parcours } = await searchParams;
  let progress: Progress | null = null;
  let open: PathSummary[] = [];
  let error: string | null = null;
  try {
    const chosen = await choosePath(parcours);
    open = chosen.open;
    if (chosen.path) progress = await apiGet<Progress>(`/api/progress?path=${chosen.path.slug}`, { personal: true });
  } catch (caught) {
    error = caught instanceof ApiError ? caught.message : SERVICE_UNAVAILABLE;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Eyebrow>Ma progression</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.75rem]">Où en êtes-vous ?</h1>

      {error || !progress ? (
        <p role="alert" className="mt-8 rounded-carte border border-brique-200 bg-brique-100 p-5">
          {error ?? 'Aucun parcours n’est ouvert pour le moment.'}
        </p>
      ) : (
        <>
          <PathSwitcher paths={open} current={progress.path.slug} hrefFor={(slug) => `/progression?parcours=${slug}`} />
          <Content progress={progress} />
        </>
      )}
    </div>
  );
}

function Content({ progress }: { progress: Progress }) {
  const { totals, recommendation, path } = progress;
  const started = totals.seen > 0;

  return (
    <>
      <p className="mt-3 max-w-2xl text-encre-doux">
        Parcours : {path.title}. Votre progression est enregistrée sur cet appareil. Une question est « acquise » quand vous l’avez
        réussie plusieurs fois, à quelques jours d’écart.
      </p>

      {/* Deux compteurs par ligne sur téléphone : la prochaine étape arrive plus vite à l'écran. */}
      <dl className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat value={`${totals.mastered} / ${totals.questions}`} label={totals.mastered > 1 ? 'questions acquises' : 'question acquise'} />
        <Stat value={String(totals.seen)} label={totals.seen > 1 ? 'questions déjà travaillées' : 'question déjà travaillée'} />
        <Stat
          value={String(totals.toReview)}
          label={totals.toReview > 1 ? 'questions à revoir maintenant' : 'question à revoir maintenant'}
          highlight={totals.toReview > 0}
        />
        <Stat value={String(totals.favorites)} label={totals.favorites > 1 ? 'questions en favoris' : 'question en favori'} />
      </dl>
      {(totals.favorites > 0 || totals.errors > 0) && (
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-petit">
          {totals.errors > 0 && (
            <Link href={`/entrainement/${path.slug}/erreurs`} className="text-sapin-700 underline underline-offset-4">
              {totals.errors > 1 ? `Revoir mes ${totals.errors} erreurs` : 'Revoir mon erreur'}
            </Link>
          )}
          {totals.favorites > 0 && (
            <Link href={`/entrainement/${path.slug}/favoris`} className="text-sapin-700 underline underline-offset-4">
              Retravailler mes favoris
            </Link>
          )}
        </p>
      )}

      <section aria-labelledby="conseil" className="mt-8 flex flex-col items-start gap-4 rounded-carte bg-sapin-50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="conseil" className="text-[1.375rem]">
            Prochaine étape
          </h2>
          <p className="mt-1">
            {!started
              ? 'Commencez par un thème : chaque réponse est corrigée et expliquée.'
              : recommendation.kind === 'review'
                ? `${plural(recommendation.count, 'question')} à revoir : c’est le meilleur moment pour les retenir.`
                : recommendation.kind === 'topic'
                  ? `Continuez avec le thème « ${recommendation.title} », le moins acquis pour l’instant.`
                  : 'Tout est acquis : passez un examen blanc pour vous mettre en conditions réelles.'}
          </p>
          {progress.nextReviewAt && recommendation.kind !== 'review' && (
            <p className="mt-1 text-petit text-encre-doux">Prochaines révisions : {dayFormat.format(new Date(progress.nextReviewAt))}.</p>
          )}
        </div>
        <Link
          href={
            !started
              ? '/entrainement'
              : recommendation.kind === 'review'
                ? `/entrainement/${path.slug}/revisions`
                : recommendation.kind === 'topic'
                  ? `/entrainement/${path.slug}/${recommendation.slug}`
                  : `/examen-blanc?parcours=${path.slug}`
          }
          className={buttonClasses('primary', 'flex-none')}
        >
          {!started ? 'Commencer' : recommendation.kind === 'review' ? 'Faire mes révisions' : recommendation.kind === 'topic' ? 'Continuer' : 'Passer un examen blanc'}
          <ArrowRightIcon />
        </Link>
      </section>

      <section aria-labelledby="themes" className="mt-10">
        <h2 id="themes" className="text-[1.5rem]">
          Par thème
        </h2>
        <ul className="mt-4 grid gap-3">
          {progress.topics.map((topic) => (
            <li key={topic.slug} className="grid gap-2 rounded-xl border border-ligne bg-white px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Link href={`/entrainement/${path.slug}/${topic.slug}`} className="font-bold hover:text-sapin-700 hover:underline">
                  {topic.title}
                </Link>
                <span className="text-petit text-encre-doux">
                  <strong className="text-encre tabular-nums">{topic.mastered}</strong> acquises sur {topic.total}
                  {topic.accuracy !== null && ` · ${Math.round(topic.accuracy * 100)} % de bonnes réponses`}
                </span>
              </div>
              <MasteryBar total={topic.total} seen={topic.seen} mastered={topic.mastered} label={`Maîtrise du thème ${topic.title}`} />
              {topic.toReview > 0 && <p className="text-petit font-bold text-ocre-700">{plural(topic.toReview, 'question')} à revoir</p>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="examens" className="mt-10">
        <h2 id="examens" className="text-[1.5rem]">
          Examens blancs
        </h2>
        {progress.exams.length === 0 ? (
          <p className="mt-3 text-encre-doux">
            Aucun examen blanc pour l’instant.{' '}
            <Link href={`/examen-blanc?parcours=${path.slug}`} className="text-sapin-700 underline underline-offset-4">
              Passer un examen blanc
            </Link>
          </p>
        ) : (
          <>
            {progress.exams.length >= 2 && <ScoreHistory exams={progress.exams} />}
            <ul className="mt-4 grid gap-2">
              {progress.exams.map((exam) => (
                <li key={exam.id}>
                  <Link
                    href={`/examen-blanc/${exam.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ligne bg-white px-4 py-3 hover:border-sapin-700"
                  >
                    <span className="text-encre-doux">{dateFormat.format(new Date(exam.endedAt))}</span>
                    <span className="flex items-center gap-3">
                      <strong className="tabular-nums">
                        {exam.score} / {exam.total}
                      </strong>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${exam.thresholdReached ? 'bg-sapin-50 text-sapin-700' : 'bg-ocre-100 text-ocre-700'}`}
                      >
                        {exam.thresholdReached ? 'Seuil atteint' : 'Seuil pas encore atteint'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

function Stat({ value, label, highlight = false }: { value: string; label: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col-reverse justify-end rounded-carte border bg-white p-4 sm:p-5 ${highlight ? 'border-ocre-500' : 'border-ligne'}`}>
      <dt className="mt-1 text-petit text-encre-doux">{label}</dt>
      <dd className="font-titre text-[1.75rem] font-semibold leading-none tabular-nums sm:text-[2rem]">{value}</dd>
    </div>
  );
}
