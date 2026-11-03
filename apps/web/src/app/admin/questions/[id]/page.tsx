import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QuestionEditor } from '@/components/admin/pages/question-editor';

export const metadata: Metadata = { title: 'Question' };

export default async function AdminQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <QuestionEditor id={id} />;
}
