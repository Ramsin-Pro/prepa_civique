import { ogContentType, ogImage, ogSize } from '@/lib/og';
import { site } from '@/lib/site';

export const alt = `${site.name} · ${site.tagline}`;
export const size = ogSize;
export const contentType = ogContentType;

export default function Image() {
  return ogImage({
    eyebrow: site.tagline,
    title: 'Préparez l’examen civique, étape par étape.',
    subtitle: 'Questions des listes officielles expliquées · Examens blancs · Gratuit pour commencer',
  });
}
