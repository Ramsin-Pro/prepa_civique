import type { Metadata } from 'next';
import { SheetsAdmin } from '@/components/admin/pages/editorial';

export const metadata: Metadata = { title: 'Fiches de révision' };

export default function Page() {
  return <SheetsAdmin />;
}
