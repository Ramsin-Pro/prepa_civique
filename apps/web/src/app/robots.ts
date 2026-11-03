import type { MetadataRoute } from 'next';
import { publicUrl } from '@/lib/seo';

// Les pages personnelles, le paiement et le back-office ne sont pas à indexer (§10).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/espace', '/paiement', '/api/', '/confirmer-email', '/reinitialiser-mot-de-passe', '/examen-blanc/', '/rejoindre', '/associations/commande'],
    },
    sitemap: `${publicUrl}/sitemap.xml`,
  };
}
