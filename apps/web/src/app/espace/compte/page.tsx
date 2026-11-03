import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountSettings } from '@/components/account/account-settings';
import { LogoutButton } from '@/components/account/logout-button';
import { Eyebrow } from '@/components/eyebrow';
import { ApiError, apiGet } from '@/lib/api';
import { withFirstOfMonth } from '@/lib/labels';
import type { Account, PathSummary } from '@/lib/types';

export const metadata: Metadata = { title: 'Mon compte', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Profil et abonnement (E16).
export default async function AccountPage() {
  let account: Account;
  try {
    account = await apiGet<Account>('/api/account', { personal: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/connexion?suite=/espace/compte');
    throw error;
  }
  const paths = await apiGet<PathSummary[]>('/api/paths').catch(() => [] as PathSummary[]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-petit">
        <Link href="/espace" className="text-sapin-700 underline underline-offset-4">
          ← Mon espace
        </Link>
      </p>
      <div className="mt-4">
        <Eyebrow>Mon compte</Eyebrow>
      </div>
      <h1 className="mt-2 text-[2.125rem] leading-tight">Mon compte et mes données</h1>
      <p className="mt-2 text-encre-doux">
        Compte créé le {withFirstOfMonth(new Date(account.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }))}. Vos données
        restent les vôtres : vous pouvez les télécharger ou les supprimer à tout moment.
      </p>
      <AccountSettings account={account} paths={paths.filter((path) => path.active).map(({ slug, title }) => ({ slug, title }))} />
      <div className="mt-8">
        <LogoutButton />
      </div>
    </div>
  );
}
