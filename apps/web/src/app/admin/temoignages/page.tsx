import type { Metadata } from 'next';
import { TestimonialsAdmin } from '@/components/admin/pages/editorial';

export const metadata: Metadata = { title: 'Témoignages' };

export default function Page() {
  return <TestimonialsAdmin />;
}
