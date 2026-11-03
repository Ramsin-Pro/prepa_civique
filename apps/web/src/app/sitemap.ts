import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api';
import type { ContentPage, SheetTopic } from '@/lib/content';
import { publicUrl } from '@/lib/seo';
import type { PathSummary } from '@/lib/types';

// Plan du site (§10) : pages publiques, parcours, fiches et pages éditoriales publiées. Jamais l'espace
// personnel, le paiement ni le back-office.
export const dynamic = 'force-dynamic';

const STATIC_PAGES = ['/', '/parcours', '/entrainement', '/examen-blanc', '/fiches', '/lexique', '/orientation', '/tarifs', '/associations', '/contact'];
const EDITORIAL_PAGES = ['faq', 'mentions-legales', 'cgu', 'cgv', 'confidentialite', 'cookies'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [paths, topics, pages] = await Promise.all([
    apiGet<PathSummary[]>('/api/paths').catch(() => [] as PathSummary[]),
    apiGet<SheetTopic[]>('/api/sheets').catch(() => [] as SheetTopic[]),
    Promise.all(EDITORIAL_PAGES.map((slug) => apiGet<ContentPage>(`/api/pages/${slug}`).catch(() => null))),
  ]);

  return [
    ...STATIC_PAGES.map((page) => ({ url: `${publicUrl}${page}`, changeFrequency: 'weekly' as const, priority: page === '/' ? 1 : 0.7 })),
    ...paths.map((path) => ({ url: `${publicUrl}/parcours/${path.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...topics.flatMap((topic) =>
      topic.sheets.filter((sheet) => !sheet.inReview).map((sheet) => ({ url: `${publicUrl}/fiches/${sheet.slug}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ),
    ...pages
      .filter((page): page is ContentPage => page !== null && !page.inReview)
      .map((page) => ({ url: `${publicUrl}/${page.slug}`, lastModified: page.updatedAt, changeFrequency: 'monthly' as const, priority: 0.3 })),
  ];
}
