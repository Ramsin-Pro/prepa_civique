import type { Metadata } from 'next';
import Link from 'next/link';
import { Eyebrow } from '@/components/eyebrow';
import { ArrowRightIcon } from '@/components/icons';
import { MasteryBar } from '@/components/mastery-bar';
import { buttonClasses } from '@/components/button';
import { ApiError, apiGet, getMe } from '@/lib/api';
import { SERVICE_UNAVAILABLE } from '@/lib/errors';
import { defaultPathStyle, pathStyle, plural } from '@/lib/labels';
import { pageMetadata } from '@/lib/seo';
import type { PathSummary, Progress, TopicProgress } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Entraînement',
  description:
    'Entraînez-vous gratuitement à l’examen civique, thème par thème : questions au format officiel, réponses expliquées simplement avec leur source, révisions au bon moment.',
  path: '/entrainement',
});

// Le contenu et la progression changent à chaque réponse : la page est rendue à chaque visite.
export const dynamic = 'force-dynamic';

const SERIES_SIZE = 10;
const SECONDS_PER_QUESTION = 30;

const estimate = (questions: number) => `environ ${Math.max(1, Math.round((questions * SECONDS_PER_QUESTION) / 60))} min`;

type FreeTier = { questionsPerTopic: number; exams: number };

export default async function TrainingPage() {
  let paths: PathSummary[] = [];
  let progresses: Progress[] = [];
  let error: string | null = null;
  const [me, free] = await Promise.all([
    getMe(),
    apiGet<{ free: FreeTier }>('/api/plans')
      .then((catalog) => catalog.free)
      .catch(() => null),
  ]);
  // Offre gratuite (E07) : ce qui est gratuit et ce qui est Premium est dit avant de commencer.
  const freeLimit = me?.premium.active ? null : (free?.questionsPerTopic ?? null);
  try {
    paths = await apiGet<PathSummary[]>('/api/paths');
    // La démarche choisie dans le compte passe en premier ; chaque parcours ouvert montre sa progression.
    paths.sort((a, b) => Number(b.slug === me?.path?.slug) - Number(a.slug === me?.path?.slug));
    progresses = await Promise.all(
      paths.filter((path) => path.active).map((path) => apiGet<Progress>(`/api/progress?path=${path.slug}`, { personal: true })),
    );
  } catch (caught) {
    error = caught instanceof ApiError ? caught.message : SERVICE_UNAVAILABLE;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Eyebrow>Entraînement</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.75rem]">Entraînez-vous à votre rythme</h1>
      <p className="mt-3 max-w-2xl text-encre-doux">
        Après chaque réponse, vous voyez la correction et son explication. Les questions manquées reviennent dans vos révisions,
        celles que vous réussissez reviennent plus tard pour vérifier que vous les retenez.
      </p>

      {error ? (
        <p role="alert" className="mt-8 rounded-carte border border-brique-200 bg-brique-100 p-5">
          {error}
        </p>
      ) : (
        <div className="mt-10 grid gap-10">
          {paths.map((path) =>
            path.active ? (
              <ActivePath
                key={path.code}
                path={path}
                progress={progresses.find((progress) => progress.path.slug === path.slug) ?? null}
                freeLimit={freeLimit}
                freeExams={free?.exams ?? null}
              />
            ) : (
              <InactivePath key={path.code} path={path} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ActivePath({
  path,
  progress,
  freeLimit,
  freeExams,
}: {
  path: PathSummary;
  progress: Progress | null;
  freeLimit: number | null;
  freeExams: number | null;
}) {
  const style = pathStyle[path.code] ?? defaultPathStyle;
  const toReview = progress?.totals.toReview ?? 0;
  const errors = progress?.totals.errors ?? 0;
  const favorites = progress?.totals.favorites ?? 0;
  const topicProgress = new Map<string, TopicProgress>(progress?.topics.map((topic) => [topic.slug, topic]) ?? []);

  return (
    <section aria-labelledby={`parcours-${path.slug}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`parcours-${path.slug}`} className="text-[1.625rem] leading-tight">
          {path.title}
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>Disponible</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModeCard
          href={`/entrainement/${path.slug}/revisions`}
          title="Mes révisions"
          detail={toReview > 0 ? `${plural(toReview, 'question')} à revoir` : 'Rien à revoir pour l’instant'}
          highlight={toReview > 0}
        />
        <ModeCard
          href={`/entrainement/${path.slug}/melange`}
          title="Série mélangée"
          detail={`${SERIES_SIZE} questions de tous les thèmes · ${estimate(SERIES_SIZE)}`}
        />
        <ModeCard
          href={`/entrainement/${path.slug}/erreurs`}
          title="Mes erreurs"
          detail={errors > 0 ? `${plural(errors, 'question manquée', 'questions manquées')} la dernière fois` : 'Les questions manquées arrivent ici'}
        />
        <ModeCard
          href={`/entrainement/${path.slug}/favoris`}
          title="Mes favoris"
          detail={favorites > 0 ? `${plural(favorites, 'question')} mise${favorites > 1 ? 's' : ''} de côté` : 'Les questions que vous gardez sous la main'}
        />
        <ModeCard
          href={`/examen-blanc?parcours=${path.slug}`}
          title="Examen blanc"
          detail="40 questions en 45 minutes, comme le jour de l’examen"
        />
      </div>

      {freeLimit !== null && (
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-carte bg-ocre-100/50 px-4 py-3 text-petit">
          <span>
            <strong>Offre gratuite :</strong> {freeLimit} questions par thème
            {freeExams ? ` et ${freeExams} examen${freeExams > 1 ? 's' : ''} blanc${freeExams > 1 ? 's' : ''}` : ''}, sans inscription. Le
            Premium ouvre toutes les questions.
          </span>
          <Link href="/tarifs" className="font-bold text-sapin-700 underline underline-offset-4">
            Voir le Premium
          </Link>
        </p>
      )}

      <h3 className="mt-8 text-[1.1875rem] font-bold">Par thème</h3>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {path.topics.map((topic) => {
          const own = topicProgress.get(topic.slug);
          if (topic.questionCount === 0) {
            return (
              <li key={topic.slug} className="flex min-h-24 flex-col justify-center rounded-xl border-2 border-dashed border-ligne px-4 py-3 text-encre-doux">
                <span className="font-bold leading-snug">{topic.title}</span>
                <span className="text-petit">Questions en préparation</span>
              </li>
            );
          }
          return (
            <li key={topic.slug}>
              <Link
                href={`/entrainement/${path.slug}/${topic.slug}`}
                className="group grid gap-2.5 rounded-xl border-2 border-ligne bg-white px-4 py-3.5 transition-colors hover:border-sapin-700 hover:bg-sapin-50"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-bold leading-snug">{topic.title}</span>
                  <ArrowRightIcon className="mt-0.5 size-5 flex-none text-sapin-700 transition-transform group-hover:translate-x-0.5" />
                </span>
                <MasteryBar
                  total={topic.questionCount}
                  seen={own?.seen ?? 0}
                  mastered={own?.mastered ?? 0}
                  label={`Maîtrise du thème ${topic.title}`}
                />
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-petit text-encre-doux">
                  <span>
                    <strong className="text-encre tabular-nums">{own?.mastered ?? 0}</strong> acquises sur {topic.questionCount}
                  </span>
                  {own && own.toReview > 0 && (
                    <span className="rounded-full bg-ocre-100 px-2 py-0.5 text-xs font-bold text-ocre-700">{own.toReview} à revoir</span>
                  )}
                  {freeLimit !== null && (
                    <span>
                      {Math.min(freeLimit, topic.questionCount)} gratuites
                      {topic.questionCount > freeLimit && ` · ${topic.questionCount - freeLimit} Premium`}
                    </span>
                  )}
                  <span className="ml-auto">Séries de {Math.min(SERIES_SIZE, topic.questionCount)} · {estimate(Math.min(SERIES_SIZE, topic.questionCount))}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <CustomSeries path={path} />
    </section>
  );
}

/** Série personnalisée (E07) : un simple formulaire, qui fonctionne aussi sans JavaScript. */
function CustomSeries({ path }: { path: PathSummary }) {
  const select = 'mt-1 block min-h-11 w-full rounded-bouton border-2 border-ligne bg-white px-2 text-petit';
  return (
    <section id={`serie-personnalisee-${path.slug}`} aria-labelledby={`personnalisee-${path.slug}`} className="mt-8 rounded-carte border border-ligne bg-white p-5 shadow-carte">
      <h3 id={`personnalisee-${path.slug}`} className="text-[1.1875rem] font-bold">
        Série personnalisée
      </h3>
      <form action={`/entrainement/${path.slug}/melange`} method="get" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <label className="text-petit font-bold">
          Thème
          <select name="theme" className={select} defaultValue="">
            <option value="">Tous les thèmes</option>
            {path.topics
              .filter((topic) => topic.questionCount > 0)
              .map((topic) => (
                <option key={topic.slug} value={topic.slug}>
                  {topic.title}
                </option>
              ))}
          </select>
        </label>
        <label className="text-petit font-bold">
          Difficulté
          <select name="difficulte" className={select} defaultValue="">
            <option value="">Toutes</option>
            <option value="1">Facile</option>
            <option value="2">Moyenne</option>
            <option value="3">Difficile</option>
          </select>
        </label>
        <label className="text-petit font-bold">
          Questions
          <select name="questions" className={select} defaultValue="">
            <option value="">Toutes</option>
            <option value="nouvelles">Jamais vues</option>
            <option value="vues">Déjà travaillées</option>
          </select>
        </label>
        <label className="text-petit font-bold">
          Nombre
          <select name="nombre" className={select} defaultValue="10">
            <option value="10">10 questions · {estimate(10)}</option>
            <option value="20">20 questions · {estimate(20)}</option>
          </select>
        </label>
        <button type="submit" className={buttonClasses('primary', 'min-h-11')}>
          Commencer
        </button>
      </form>
    </section>
  );
}

function ModeCard({ href, title, detail, highlight = false }: { href: string; title: string; detail: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex min-h-28 flex-col justify-between gap-3 rounded-carte border-2 bg-white p-5 shadow-carte transition-colors hover:border-sapin-700 ${
        highlight ? 'border-ocre-500' : 'border-ligne'
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-titre text-[1.375rem] font-semibold leading-tight">{title}</span>
        <ArrowRightIcon className="size-5 flex-none text-sapin-700 transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className={`text-petit ${highlight ? 'font-bold text-ocre-700' : 'text-encre-doux'}`}>{detail}</span>
    </Link>
  );
}

function InactivePath({ path }: { path: PathSummary }) {
  const style = pathStyle[path.code] ?? defaultPathStyle;
  return (
    <section aria-labelledby={`parcours-${path.slug}`} className={`rounded-carte border border-t-[6px] border-ligne bg-white p-6 shadow-carte ${style.stripe}`}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`parcours-${path.slug}`} className="text-[1.375rem] leading-tight">
          {path.title}
        </h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>Bientôt</span>
      </div>
      <p className="mt-1 text-petit text-encre-doux">{path.description} Les questions seront publiées après relecture.</p>
    </section>
  );
}
