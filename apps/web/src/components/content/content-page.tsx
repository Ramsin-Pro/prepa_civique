import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Eyebrow } from '@/components/eyebrow';
import { ApiError, apiGet } from '@/lib/api';
import type { ContentPage } from '@/lib/content';
import { frenchDateFormat } from '@/lib/labels';
import { renderMarkdown } from '@/lib/markdown';
import { faqEntries, jsonLd, pageMetadata } from '@/lib/seo';
import { site } from '@/lib/site';

const dateFormat = frenchDateFormat({ day: 'numeric', month: 'long', year: 'numeric' });

async function loadPage(slug: string): Promise<ContentPage | null> {
  try {
    return await apiGet<ContentPage>(`/api/pages/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

// Description de chaque page éditoriale dans les résultats de recherche.
const DESCRIPTIONS: Record<string, string> = {
  faq: `Les réponses aux questions fréquentes sur l’examen civique et sur ${site.name} : parcours, examen blanc, Premium, associations, compte et données.`,
  'mentions-legales': `Éditeur, hébergeur et contact du site ${site.name}.`,
  cgu: `Les conditions d’utilisation du site ${site.name}.`,
  cgv: 'Les conditions générales de vente du pass Premium et des packs de places pour les structures.',
  confidentialite: `Les données que ${site.name} utilise, pourquoi, combien de temps, et comment exercer vos droits.`,
  cookies: `Les cookies utilisés sur ${site.name}, et comment les gérer.`,
};

export async function contentPageMetadata(slug: string, fallbackTitle: string): Promise<Metadata> {
  const page = await loadPage(slug).catch(() => null);
  return {
    ...pageMetadata({ title: page?.title ?? fallbackTitle, description: DESCRIPTIONS[slug] ?? site.description, path: `/${slug}` }),
    robots: page?.inReview ? { index: false } : undefined,
  };
}

/**
 * Page éditoriale gérée dans le back-office (A05) : FAQ et pages légales. En production, seule une page
 * publiée après relecture s'affiche ; sinon, la page n'existe pas encore (404).
 */
export async function ContentPageView({ slug, eyebrow }: { slug: string; eyebrow: string }) {
  const page = await loadPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.5rem]">{page.title}</h1>
      <p className="mt-2 text-petit text-encre-doux">Mise à jour le {dateFormat.format(new Date(page.updatedAt))}</p>
      {page.inReview && (
        <p className="mt-4 rounded-carte border border-ocre-100 bg-ocre-100/50 p-4 text-petit">
          <strong>Brouillon à relire.</strong> Cette page n’est visible qu’en aperçu de développement : elle sera publiée après validation.
        </p>
      )}
      <div className="texte-editorial mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body) }} />
      {slug === 'faq' && !page.inReview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            '@type': 'FAQPage',
            inLanguage: 'fr-FR',
            mainEntity: faqEntries(page.body).map((entry) => ({
              '@type': 'Question',
              name: entry.question,
              acceptedAnswer: { '@type': 'Answer', text: entry.answer },
            })),
          })}
        />
      )}
    </div>
  );
}
