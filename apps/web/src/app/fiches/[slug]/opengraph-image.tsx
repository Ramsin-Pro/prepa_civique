import { apiGet } from '@/lib/api';
import type { Sheet } from '@/lib/content';
import { ogContentType, ogImage, ogSize } from '@/lib/og';

export const alt = 'Fiche de révision';
export const size = ogSize;
export const contentType = ogContentType;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sheet = await apiGet<Sheet>(`/api/sheets/${encodeURIComponent(slug)}`).catch(() => null);
  return ogImage({
    eyebrow: sheet ? `Fiche de révision · ${sheet.topic.title}` : 'Fiche de révision',
    title: sheet?.title ?? 'L’essentiel de chaque notion de l’examen civique',
    subtitle: 'Points clés, exemples, vocabulaire et sources officielles',
  });
}
