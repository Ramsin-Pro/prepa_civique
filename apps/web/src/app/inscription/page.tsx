import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth/register-form';
import { AuthCard } from '@/components/form';
import { apiGet, getMe } from '@/lib/api';
import { safeNext } from '@/lib/navigation';
import { pageMetadata } from '@/lib/seo';
import type { PathSummary } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Créer un compte',
  description: 'Créez votre compte gratuit : votre progression et vos révisions vous suivent sur tous vos appareils.',
  path: '/inscription',
});
export const dynamic = 'force-dynamic';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ parcours?: string; suite?: string }> }) {
  const { parcours, suite } = await searchParams;
  const next = safeNext(suite);
  if (await getMe()) redirect(next);

  let paths: PathSummary[] = [];
  try {
    paths = (await apiGet<PathSummary[]>('/api/paths')).filter((path) => path.active);
  } catch {
    // Le formulaire reste utilisable sans la liste des parcours.
  }

  return (
    <AuthCard
      title="Créer un compte"
      intro={<p>Votre compte garde votre progression sur tous vos appareils. Vous pouvez aussi vous entraîner sans compte.</p>}
    >
      <RegisterForm paths={paths.map(({ slug, title }) => ({ slug, title }))} defaultPath={parcours} next={next} />
    </AuthCard>
  );
}
