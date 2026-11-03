import type { Metadata } from 'next';
import { QuestionImport } from '@/components/admin/pages/catalog';

export const metadata: Metadata = { title: 'Importer des questions' };

export default function Page() {
  return <QuestionImport />;
}
