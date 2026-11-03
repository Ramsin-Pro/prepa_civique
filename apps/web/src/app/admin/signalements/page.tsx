import type { Metadata } from 'next';
import { ReportsAdmin } from '@/components/admin/pages/editorial';

export const metadata: Metadata = { title: 'Signalements' };

export default function Page() {
  return <ReportsAdmin />;
}
