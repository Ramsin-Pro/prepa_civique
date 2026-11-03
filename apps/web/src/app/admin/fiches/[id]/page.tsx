import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SheetEditor } from '@/components/admin/pages/editorial';

export const metadata: Metadata = { title: 'Fiche de révision' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <SheetEditor id={id} />;
}
