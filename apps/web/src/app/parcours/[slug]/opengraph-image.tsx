import { apiGet } from '@/lib/api';
import { ogContentType, ogImage, ogSize } from '@/lib/og';
import type { PathSummary } from '@/lib/types';

export const alt = 'Parcours de préparation à l’examen civique';
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const path = await apiGet<PathSummary>(`/api/paths/${encodeURIComponent(slug)}`).catch(() => null);
  return ogImage({
    eyebrow: 'Préparer l’examen civique',
    title: path?.title ?? 'Choisissez votre parcours',
    subtitle: '40 questions, 45 minutes, 32 bonnes réponses pour réussir : entraînez-vous dans les conditions réelles',
  });
}
