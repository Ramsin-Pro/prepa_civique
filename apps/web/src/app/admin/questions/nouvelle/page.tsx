import type { Metadata } from 'next';
import { QuestionCreate } from '@/components/admin/pages/question-editor';

export const metadata: Metadata = { title: 'Nouvelle question' };

export default function NewQuestionPage() {
  return <QuestionCreate />;
}
