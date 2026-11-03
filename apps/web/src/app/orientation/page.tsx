import type { Metadata } from 'next';
import { Eyebrow } from '@/components/eyebrow';
import { Orientation } from '@/components/public/orientation';
import { apiGet } from '@/lib/api';
import { pageMetadata } from '@/lib/seo';
import type { PathSummary } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Quel examen pour moi ?',
  description: 'Une indication rapide pour savoir si votre démarche demande l’examen civique, avec les liens officiels.',
  path: '/orientation',
});
export const dynamic = 'force-dynamic';

// Simulateur d'orientation (E04).
export default async function OrientationPage() {
  const paths = await apiGet<PathSummary[]>('/api/paths').catch(() => [] as PathSummary[]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Eyebrow>Orientation</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.5rem]">L’examen civique me concerne-t-il ?</h1>
      <p className="mt-3 text-encre-doux">Une seule question, une réponse claire et les liens officiels. Vos réponses ne sont pas enregistrées.</p>
      <div className="mt-8">
        <Orientation paths={paths.map(({ slug, title, code, active }) => ({ slug, title, code, active }))} />
      </div>
    </div>
  );
}
