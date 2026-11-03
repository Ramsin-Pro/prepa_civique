import type { Metadata } from 'next';
import { PagesAdmin } from '@/components/admin/pages/editorial';

export const metadata: Metadata = { title: 'Pages' };

export default function Page() {
  return <PagesAdmin />;
}
