import type { Metadata } from 'next';
import { GlossaryAdmin } from '@/components/admin/pages/editorial';

export const metadata: Metadata = { title: 'Lexique' };

export default function Page() {
  return <GlossaryAdmin />;
}
