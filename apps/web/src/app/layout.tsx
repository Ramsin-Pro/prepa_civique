import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Fraunces } from 'next/font/google';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { VisitBeacon } from '@/components/visit-beacon';
import { publicUrl } from '@/lib/seo';
import { site } from '@/lib/site';
import './globals.css';

// Titres : Fraunces, serif chaleureuse et sérieuse. Texte : Atkinson Hyperlegible, conçue pour la lisibilité.
const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], variable: '--font-fraunces', display: 'swap' });
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-atkinson',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(publicUrl),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { type: 'website', locale: 'fr_FR', siteName: site.name, title: `${site.name} · ${site.tagline}`, description: site.description },
  twitter: { card: 'summary_large_image', title: `${site.name} · ${site.tagline}`, description: site.description },
};

export const viewport: Viewport = { themeColor: '#1f5e4b' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${atkinson.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenu"
          className="sr-only rounded-bouton bg-encre px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Aller au contenu
        </a>
        <SiteHeader />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <VisitBeacon />
      </body>
    </html>
  );
}
