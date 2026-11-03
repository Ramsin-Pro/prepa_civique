import type { Metadata } from 'next';
import { AuditAdmin } from '@/components/admin/pages/people';

export const metadata: Metadata = { title: 'Journal d’audit' };

export default function Page() {
  return <AuditAdmin />;
}
