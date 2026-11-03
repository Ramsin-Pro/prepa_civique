import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminNav } from '@/components/admin/admin-nav';
import { MfaSetup } from '@/components/admin/mfa-setup';
import { AdminRoleProvider } from '@/components/admin/ui';
import { getMe } from '@/lib/api';

export const metadata: Metadata = { title: { default: 'Back-office', template: '%s · Back-office' }, robots: { index: false } };
export const dynamic = 'force-dynamic';

// Back-office (A01 à A09) : réservé aux comptes de l'équipe, avec double authentification.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/connexion?suite=/admin');
  if (!me.staff) notFound();
  if (me.mfa.enabled && !me.mfa.verified) redirect('/connexion?suite=/admin');
  const setupRequired = me.mfa.required && !me.mfa.enabled;

  return (
    <AdminRoleProvider role={me.role}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 lg:flex-row">
        <AdminNav role={me.role} email={me.email} />
        <div className="min-w-0 flex-1">
          {setupRequired ? (
            <>
              <h1 className="text-[1.875rem] leading-tight">Double authentification</h1>
              <div className="mt-6">
                <MfaSetup enabled={false} required />
              </div>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </AdminRoleProvider>
  );
}
