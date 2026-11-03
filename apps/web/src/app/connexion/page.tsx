import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { AuthCard } from '@/components/form';
import { getMe } from '@/lib/api';
import { safeNext } from '@/lib/navigation';

export const metadata: Metadata = { title: 'Se connecter', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const next = safeNext(suite);
  const me = await getMe();
  // Une session sans le code de double authentification peut encore le saisir.
  if (me && !(me.mfa.enabled && !me.mfa.verified)) redirect(next);

  return (
    <AuthCard title="Se connecter" intro={<p>Retrouvez votre progression et votre accès Premium.</p>}>
      <LoginForm next={next} />
    </AuthCard>
  );
}
