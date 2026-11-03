import type { Metadata } from 'next';
import { QuestionsList } from '@/components/admin/pages/questions-list';

export const metadata: Metadata = { title: 'Questions' };

export default async function AdminQuestionsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const { statut } = await searchParams;
  return <QuestionsList initialStatus={statut} />;
}
