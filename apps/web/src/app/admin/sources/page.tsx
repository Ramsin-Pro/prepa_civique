import type { Metadata } from 'next';
import { SourcesAdmin } from '@/components/admin/pages/catalog';

export const metadata: Metadata = { title: 'Sources' };

export default function Page() {
  return <SourcesAdmin />;
}
