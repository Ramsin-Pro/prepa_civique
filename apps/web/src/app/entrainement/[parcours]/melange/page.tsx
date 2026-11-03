import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Quiz } from '@/components/quiz';
import { TrainingHeader } from '@/components/training-header';
import { ApiError, apiGet } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import type { PathSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ parcours: string }> }) {
  const { parcours } = await params;
  return pageMetadata({
    title: 'Série mélangée',
    description: 'Des questions de tous les thèmes de l’examen civique, corrigées et expliquées une par une, en commençant par celles à apprendre.',
    path: `/entrainement/${parcours}/melange`,
  });
}

type Filters = { theme?: string; difficulte?: string; questions?: string; nombre?: string };

const DIFFICULTY_LABELS: Record<string, string> = { '1': 'faciles', '2': 'de difficulté moyenne', '3': 'difficiles' };

// Questions de tous les thèmes (E07, « questions aléatoires »), en commençant par celles qui restent à apprendre.
// Avec des filtres, c'est une série personnalisée : un thème, une difficulté, des questions jamais vues ou déjà vues.
export default async function MixedSeriesPage({ params, searchParams }: { params: Promise<{ parcours: string }>; searchParams: Promise<Filters> }) {
  const [{ parcours }, filters] = await Promise.all([params, searchParams]);
  const path = await apiGet<PathSummary>(`/api/paths/${encodeURIComponent(parcours)}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!path?.active) notFound();

  const topic = path.topics.find((candidate) => candidate.slug === filters.theme);
  const difficulty = filters.difficulte && DIFFICULTY_LABELS[filters.difficulte] ? Number(filters.difficulte) : undefined;
  const seen = filters.questions === 'nouvelles' ? 'new' : filters.questions === 'vues' ? 'seen' : undefined;
  const size = filters.nombre === '20' ? 20 : 10;
  const custom = Boolean(topic || difficulty || seen || size !== 10);

  const description = [
    `Jusqu’à ${size} questions`,
    topic ? `du thème « ${topic.title} »` : 'de tous les thèmes',
    difficulty ? DIFFICULTY_LABELS[String(difficulty)] : null,
    seen === 'new' ? 'que vous n’avez jamais vues' : seen === 'seen' ? 'que vous avez déjà travaillées' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TrainingHeader pathTitle={path.title} title={custom ? 'Série personnalisée' : 'Série mélangée'}>
        {custom ? `${description}.` : 'Dix questions de tous les thèmes, en commençant par celles que vous n’avez pas encore apprises.'}{' '}
        {custom && (
          <Link href={`/entrainement#serie-personnalisee-${path.slug}`} className="text-sapin-700 underline underline-offset-4">
            Changer les filtres
          </Link>
        )}
      </TrainingHeader>
      <div className="mt-6">
        <Quiz pathSlug={path.slug} mode="mixed" topicSlug={topic?.slug} difficulty={difficulty} seen={seen} size={size} />
      </div>
    </div>
  );
}
