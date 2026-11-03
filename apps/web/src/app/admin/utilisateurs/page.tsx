import type { Metadata } from 'next';
import { UsersAdmin } from '@/components/admin/pages/people';

export const metadata: Metadata = { title: 'Utilisateurs' };

export default function Page() {
  return <UsersAdmin />;
}
