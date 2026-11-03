import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { apiGet, getMe } from '@/lib/api';
import { defaultPathStyle, pathStyle } from '@/lib/labels';
import { pageMetadata } from '@/lib/seo';
import type { PathSummary } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Choisir mon parcours',
  description:
    'Carte de séjour pluriannuelle, carte de résident ou naturalisation : choisissez la démarche que vous préparez et entraînez-vous à son examen civique.',
  path: '/parcours',
});
export const dynamic = 'force-dynamic';

// Choix du parcours (E02) : trois démarches, une page détaillée pour chacune, un choix modifiable à tout moment.
export default async function PathsPage() {
  const [paths, me] = await Promise.all([apiGet<PathSummary[]>('/api/paths').catch(() => [] as PathSummary[]), getMe()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Eyebrow>Les parcours</Eyebrow>
      <h1 className="mt-2 text-[2.125rem] leading-tight sm:text-[2.75rem]">Quelle démarche préparez-vous ?</h1>
      <p className="mt-3 max-w-2xl text-encre-doux">
        Chaque parcours prépare à une mention de l’examen civique. Vous pourrez en changer à tout moment
        {me ? ' dans votre compte' : ''}. Nous ne pouvons pas vous dire quelle démarche vous concerne :{' '}
        <Link href="/orientation" className="text-sapin-700 underline underline-offset-4">
          faites le point en une question
        </Link>{' '}
        ou consultez service-public.gouv.fr.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {paths.map((path) => {
          const style = pathStyle[path.code] ?? defaultPathStyle;
          const chosen = me?.path?.slug === path.slug;
          return (
            <article key={path.code} className={`flex flex-col gap-3 rounded-carte border border-t-[6px] border-ligne bg-white p-6 shadow-carte ${style.stripe}`}>
              <span className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>{path.active ? 'Disponible' : 'Bientôt'}</span>
                {chosen && <span className="rounded-full bg-sapin-50 px-2.5 py-0.5 text-xs font-bold text-sapin-700">Votre parcours</span>}
              </span>
              <h2 className="text-[1.375rem] leading-snug">{path.title}</h2>
              <p className="text-petit text-encre-doux">{path.description}</p>
              <div className="mt-auto pt-2">
                <Link href={`/parcours/${path.slug}`} className={buttonClasses(path.active ? 'primary' : 'secondary')}>
                  {path.active ? 'Voir ce parcours' : 'En savoir plus'}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
