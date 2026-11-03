import type { Metadata } from 'next';
import { ReminderUnsubscribe } from '@/components/account/reminder-unsubscribe';
import { AuthCard } from '@/components/form';

export const metadata: Metadata = { title: 'Arrêter les rappels', robots: { index: false }, referrer: 'no-referrer' };

export default async function ReminderUnsubscribePage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  return (
    <AuthCard title="Arrêter les rappels de révision">
      <ReminderUnsubscribe token={jeton} />
    </AuthCard>
  );
}
