import type { Metadata } from 'next';
import { ConfirmEmail } from '@/components/auth/password-forms';
import { AuthCard } from '@/components/form';

// Le jeton est dans l'adresse de la page : il n'est jamais transmis en Referer (appel à l'API, liens suivis).
export const metadata: Metadata = { title: 'Confirmer mon adresse', robots: { index: false }, referrer: 'no-referrer' };

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ jeton?: string; changement?: string }> }) {
  const { jeton, changement } = await searchParams;
  const change = changement === '1';
  return (
    <AuthCard
      title={change ? 'Confirmer ma nouvelle adresse' : 'Confirmer mon adresse'}
      intro={<p>{change ? 'Un clic suffit pour utiliser cette adresse avec votre compte.' : 'Un clic suffit pour activer votre compte.'}</p>}
    >
      <ConfirmEmail token={jeton} change={change} />
    </AuthCard>
  );
}
