import type { Metadata } from 'next';
import { ExamSession } from '@/components/exam-session';

export const metadata: Metadata = { title: 'Examen blanc', robots: { index: false } };

export default async function ExamSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <ExamSession id={id} />
    </div>
  );
}
