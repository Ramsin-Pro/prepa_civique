import type { Metadata } from 'next';
import { PathsAdmin } from '@/components/admin/pages/editorial';

export const metadata: Metadata = { title: 'Parcours et thèmes' };

export default function Page() {
  return <PathsAdmin />;
}
