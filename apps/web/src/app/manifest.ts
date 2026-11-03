import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

// Installation sur l'écran d'accueil du téléphone (PWA, §13 : pas d'application native).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} · ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    lang: 'fr',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f0',
    theme_color: '#1f5e4b',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
