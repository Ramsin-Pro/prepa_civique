import type { Metadata } from 'next';
import { OrganizationsAdmin } from '@/components/admin/pages/organizations';

export const metadata: Metadata = { title: 'Associations et structures' };

export default function Page() {
  return <OrganizationsAdmin />;
}
