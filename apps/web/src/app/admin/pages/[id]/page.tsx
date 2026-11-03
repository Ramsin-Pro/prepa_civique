import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageEditor } from '@/components/admin/pages/editorial';

export const metadata: Metadata = { title: 'Page' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <PageEditor id={id} />;
}
