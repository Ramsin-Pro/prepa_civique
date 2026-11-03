import type { Metadata } from 'next';
import { StatsAdmin } from '@/components/admin/pages/stats';

export const metadata: Metadata = { title: 'Statistiques' };

export default function Page() {
  return <StatsAdmin />;
}
