import type { Metadata } from 'next';
import { site } from './site';

// Référencement (§10) : adresse publique du site, et données structurées schema.org lisibles par les moteurs.

/** Adresse publique du site, sans barre finale (PUBLIC_URL, la même que pour l'API). */
export const publicUrl = (process.env.PUBLIC_URL ?? 'http://localhost:3001').replace(/\/$/, '');

export const organization = {
  '@type': 'Organization',
  name: site.name,
  url: publicUrl,
  logo: `${publicUrl}/icon.svg`,
  description: `${site.name} est une plateforme indépendante de préparation à l'examen civique, sans lien avec l'administration française.`,
};

/**
 * Métadonnées d'une page publique : titre, description, adresse canonique (une seule adresse indexée, même avec
 * des paramètres dans l'URL) et aperçu de partage. Sans titre, ce sont celles de l'accueil. `image` : l'image de
 * partage de la page quand elle a la sienne (fichier opengraph-image dans son dossier), sinon celle du site.
 */
export function pageMetadata({
  title,
  description,
  path,
  image = '/opengraph-image',
}: {
  title?: string;
  description: string;
  path: string;
  image?: string;
}): Metadata {
  const shareTitle = title ? `${title} · ${site.name}` : `${site.name} · ${site.tagline}`;
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    // Une page qui définit son aperçu n'hérite plus de l'image du site : on la redonne ici. X reprend l'image Open Graph.
    openGraph: { type: 'website', locale: 'fr_FR', siteName: site.name, url: path, title: shareTitle, description, images: [image] },
    twitter: { card: 'summary_large_image', title: shareTitle, description },
  };
}

/** Fil d'Ariane lisible par les moteurs : de l'accueil à la page. */
export function breadcrumb(items: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Accueil', path: '/' }, ...items].map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${publicUrl}${item.path}`,
    })),
  };
}

/** Balise <script> de données structurées. Le contenu est échappé pour ne jamais fermer la balise. */
export function jsonLd(data: Record<string, unknown>) {
  return { __html: JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c') };
}

/** Questions et réponses d'une page FAQ en Markdown : chaque « ### question » suivie de ses paragraphes. */
export function faqEntries(markdown: string): { question: string; answer: string }[] {
  const entries: { question: string; answer: string }[] = [];
  let current: { question: string; lines: string[] } | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      if (current && current.lines.join(' ').trim()) entries.push({ question: current.question, answer: current.lines.join(' ').trim() });
      current = heading[1] === '###' ? { question: heading[2]!.trim(), lines: [] } : null;
      continue;
    }
    // Texte brut : liens Markdown réduits à leur libellé, marques de liste et d'emphase retirées.
    if (current && !line.startsWith('>')) {
      current.lines.push(line.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^[-*]\s+/, '').replace(/[*_`]/g, '').trim());
    }
  }
  if (current && current.lines.join(' ').trim()) entries.push({ question: current.question, answer: current.lines.join(' ').trim() });
  return entries.map((entry) => ({ ...entry, answer: entry.answer.replace(/\s+/g, ' ') }));
}
