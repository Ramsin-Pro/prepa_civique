import type { Metadata } from 'next';
import { AuthCard } from '@/components/form';
import { PaymentConfirmation } from '@/components/premium/payment-status';

export const metadata: Metadata = { title: 'Confirmation du paiement', robots: { index: false } };

export default async function PaymentConfirmationPage({ searchParams }: { searchParams: Promise<{ commande?: string }> }) {
  const { commande } = await searchParams;
  return (
    <AuthCard title="Votre paiement">
      <PaymentConfirmation orderId={commande} />
    </AuthCard>
  );
}
