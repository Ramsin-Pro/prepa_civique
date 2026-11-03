import type { Metadata } from 'next';
import { PlansAdmin } from '@/components/admin/pages/catalog';

export const metadata: Metadata = { title: 'Formules et accès' };

export default function Page() {
  return <PlansAdmin />;
}
