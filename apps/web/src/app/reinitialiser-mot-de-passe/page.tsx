import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/password-forms';
import { AuthCard } from '@/components/form';

export const metadata: Metadata = { title: 'Nouveau mot de passe', robots: { index: false }, referrer: 'no-referrer' };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  return (
    <AuthCard title="Choisir un nouveau mot de passe">
      <ResetPasswordForm token={jeton} />
    </AuthCard>
  );
}
