import type { Metadata } from 'next';
import { AuthCard } from '@/components/form';
import { InvitationCodeForm } from '@/components/organizations/code-form';

export const metadata: Metadata = { title: 'J’ai un code de ma structure', robots: { index: false } };

export default function JoinWithCodePage() {
  return (
    <AuthCard
      title="J’ai un code de ma structure"
      intro={<p>Votre association ou votre centre de formation vous a donné un code ? Entrez-le pour activer l’accès qu’elle vous offre.</p>}
    >
      <InvitationCodeForm />
    </AuthCard>
  );
}
