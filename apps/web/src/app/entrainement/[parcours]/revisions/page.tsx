import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Quiz } from '@/components/quiz';
import { TrainingHeader } from '@/components/training-header';
import { ApiError, apiGet } from '@/lib/api';
import type { PathSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mes révisions', robots: { index: false } };

// Révision des erreurs (E07) : les questions manquées, puis celles dont la révision espacée arrive à échéance.
export default async function ReviewPage({ params }: { params: Promise<{ parcours: string }> }) {
  const { parcours } = await params;
  const path = await apiGet<PathSummary>(`/api/paths/${encodeURIComponent(parcours)}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!path?.active) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TrainingHeader pathTitle={path.title} title="Mes révisions">
        Les questions que vous avez manquées, et celles qu’il est temps de revoir pour ne pas les oublier.
      </TrainingHeader>
      <div className="mt-6">
        <Quiz pathSlug={path.slug} mode="review" />
      </div>
    </div>
  );
}
