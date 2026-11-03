import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Quiz } from '@/components/quiz';
import { TrainingHeader } from '@/components/training-header';
import { ApiError, apiGet } from '@/lib/api';
import type { PathSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mes erreurs', robots: { index: false } };

// Mode « erreurs » (E07) : uniquement les questions manquées à leur dernière réponse.
// Une question réussie ici sort de la liste.
export default async function ErrorsPage({ params }: { params: Promise<{ parcours: string }> }) {
  const { parcours } = await params;
  const path = await apiGet<PathSummary>(`/api/paths/${encodeURIComponent(parcours)}`).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  if (!path?.active) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TrainingHeader pathTitle={path.title} title="Mes erreurs">
        Les questions que vous avez manquées la dernière fois. Une question réussie ici sort de la liste.
      </TrainingHeader>
      <div className="mt-6">
        <Quiz pathSlug={path.slug} mode="errors" />
      </div>
    </div>
  );
}
