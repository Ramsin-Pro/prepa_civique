import type { Metadata } from 'next';
import { OrdersAdmin } from '@/components/admin/pages/people';

export const metadata: Metadata = { title: 'Commandes' };

export default function Page() {
  return <OrdersAdmin />;
}
