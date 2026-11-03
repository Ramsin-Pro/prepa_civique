import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OrganizationAdmin } from '@/components/admin/pages/organizations';

export const metadata: Metadata = { title: 'Structure' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invite?: string }> }) {
  const [{ id }, { invite }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  return <OrganizationAdmin id={id} invited={invite === '1'} />;
}
