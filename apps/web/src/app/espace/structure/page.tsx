import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { OrganizationDashboard } from '@/components/organizations/dashboard';
import { ApiError, apiGet } from '@/lib/api';
import type { OrganizationSpace } from '@/lib/types';

export const metadata: Metadata = { title: 'Ma structure', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Espace de la structure : places, invitation, suivi du groupe.
export default async function OrganizationSpacePage() {
  let space: OrganizationSpace | null = null;
  try {
    space = await apiGet<OrganizationSpace>('/api/organizations/mine', { personal: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/connexion?suite=/espace/structure');
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-petit">
        <Link href="/espace" className="text-sapin-700 underline underline-offset-4">
          ← Mon espace
        </Link>
      </p>
      <div className="mt-4">
        <Eyebrow>Ma structure</Eyebrow>
      </div>
      {space ? (
        <>
          <h1 className="mt-2 text-[2.125rem] leading-tight">{space.name}</h1>
          <p className="mt-2 text-encre-doux">Gérez vos places et suivez la préparation de votre groupe.</p>
          <div className="mt-8">
            <OrganizationDashboard initial={space} />
          </div>
        </>
      ) : (
        <>
          <h1 className="mt-2 text-[2.125rem] leading-tight">Aucune structure rattachée</h1>
          <p className="mt-3 max-w-2xl">
            Vous accompagnez un groupe ? Achetez un pack de places : votre espace de structure s’ouvre dès le paiement confirmé.
          </p>
          <Link href="/associations" className={buttonClasses('primary', 'mt-6')}>
            Découvrir l’offre associations
          </Link>
        </>
      )}
    </div>
  );
}
