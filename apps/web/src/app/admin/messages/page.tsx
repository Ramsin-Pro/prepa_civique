import type { Metadata } from 'next';
import { MessagesAdmin } from '@/components/admin/pages/people';

export const metadata: Metadata = { title: 'Messages' };

export default function Page() {
  return <MessagesAdmin />;
}
