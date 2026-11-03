import type { Metadata } from 'next';
import { Eyebrow } from '@/components/eyebrow';
import { SheetsBrowser } from '@/components/public/sheets-browser';
import { ApiError, apiGet } from '@/lib/api';
import type { SheetTopic } from '@/lib/content';
import { SERVICE_UNAVAILABLE } from '@/lib/errors';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Fiches de révision',
  description: 'Une fiche par notion du programme officiel de l’examen civique : l’essentiel, des exemples, le vocabulaire et les sources.',
  path: '/fiches',
});
export const dynamic = 'force-dynamic';

// Fiches de révision (E12) : une par notion de l'arrêté, rangées par thème.
export default async function SheetsPage() {
  let topics: SheetTopic[] = [];
  let error: string | null = null;
  try {
    topics = (await apiGet<SheetTopic[]>('/api/sheets', { personal: true })).filter((topic) => topic.sheets.length > 0);
  } catch (caught) {
    error = caught instanceof ApiError ? caught.message : SERVICE_UNAVAILABLE;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Eyebrow>Fiches de révision</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.75rem]">L’essentiel de chaque notion, en quelques minutes</h1>
      <p className="mt-3 max-w-2xl text-encre-doux">
        Une fiche par notion du programme officiel : les points clés, des exemples de la vie quotidienne, le vocabulaire et les sources.
        Chaque fiche peut être écoutée, et se termine par quelques questions pour vérifier ce que vous avez retenu.
      </p>

      {error && (
        <p role="alert" className="mt-8 rounded-carte border border-brique-200 bg-brique-100 p-5">
          {error}
        </p>
      )}
      {!error && topics.length === 0 && <p className="mt-8">Les fiches sont en cours de relecture. Revenez bientôt.</p>}

      {topics.length > 0 && <SheetsBrowser topics={topics} />}
    </div>
  );
}
