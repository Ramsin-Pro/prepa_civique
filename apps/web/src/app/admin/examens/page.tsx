import type { Metadata } from 'next';
import { ExamTemplatesAdmin } from '@/components/admin/pages/exams';

export const metadata: Metadata = { title: 'Examens blancs' };

export default function Page() {
  return <ExamTemplatesAdmin />;
}
