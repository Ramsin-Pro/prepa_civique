import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Quiz } from '@/components/quiz';
import { TrainingHeader } from '@/components/training-header';
import { ApiError, apiGet } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import type { PathSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Params = Promise<{ parcours: string; theme: string }>;

async function loadTopic(parcours: string, theme: string) {
  try {
    const path = await apiGet<PathSummary>(`/api/paths/${encodeURIComponent(parcours)}`);
    const topic = path.topics.find((candidate) => candidate.slug === theme);
    return path.active && topic ? { path, topic } : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { parcours, theme } = await params;
  const found = await loadTopic(parcours, theme).catch(() => null);
  return found
    ? pageMetadata({
        title: `${found.topic.title} · Entraînement`,
        description: `Questions d’entraînement à l’examen civique sur le thème « ${found.topic.title} » : réponses expliquées simplement, avec leur source.`,
        path: `/entrainement/${parcours}/${theme}`,
      })
    : { title: 'Entraînement' };
}

export default async function TopicTrainingPage({ params }: { params: Params }) {
  const { parcours, theme } = await params;
  const found = await loadTopic(parcours, theme);
  if (!found) notFound();
  const { path, topic } = found;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TrainingHeader pathTitle={path.title} title={topic.title} />
      <div className="mt-6">
        <Quiz pathSlug={path.slug} mode="topic" topicSlug={topic.slug} />
      </div>
    </div>
  );
}
