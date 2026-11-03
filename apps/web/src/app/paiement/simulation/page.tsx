import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AuthCard } from '@/components/form';
import { PaymentSimulation } from '@/components/premium/payment-status';
import { apiGet } from '@/lib/api';
import type { PaymentProvider } from '@/lib/types';

export const metadata: Metadata = { title: 'Paiement simulé', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PaymentSimulationPage({ searchParams }: { searchParams: Promise<{ commande?: string }> }) {
  const { commande } = await searchParams;
  const { paymentProvider } = await apiGet<{ paymentProvider: PaymentProvider }>('/api/plans');
  // N'existe que tant qu'aucune clé Stripe n'est configurée, et jamais en production.
  if (paymentProvider !== 'simulation') notFound();
  return (
    <AuthCard title="Paiement simulé">
      <PaymentSimulation orderId={commande} />
    </AuthCard>
  );
}
