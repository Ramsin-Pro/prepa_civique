import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard, FormAlert } from '@/components/form';
import { JoinOrganization } from '@/components/organizations/join';
import { ApiError, apiGet, getMe } from '@/lib/api';
import { organizationKindLabel } from '@/lib/labels';
import type { JoinInfo } from '@/lib/types';

export const metadata: Metadata = { title: 'Rejoindre ma structure', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Lien d'invitation d'une structure : la personne active la place qui lui est offerte.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let info: JoinInfo | null = null;
  try {
    info = await apiGet<JoinInfo>(`/api/organizations/join/${encodeURIComponent(code)}`, { personal: true });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }

  if (!info) {
    return (
      <AuthCard title="Lien d’invitation">
        <FormAlert>
          Ce lien n’est pas valable, ou il a été remplacé par un nouveau. Demandez le lien à jour à la structure qui vous accompagne.
        </FormAlert>
        <p className="mt-4 text-petit">
          Vous pouvez aussi{' '}
          <Link href="/entrainement" className="text-sapin-700 underline underline-offset-4">
            vous entraîner gratuitement
          </Link>
          .
        </p>
      </AuthCard>
    );
  }

  const me = await getMe();
  const months = info.seatDays ? Math.round(info.seatDays / 30) : null;
  return (
    <AuthCard
      title={`Rejoindre ${info.name}`}
      intro={
        <p>
          {organizationKindLabel[info.kind] ?? 'Structure'}
          {info.city ? ` · ${info.city}` : ''}. {info.name} vous offre un accès Premium
          {months ? ` de ${months} mois` : ''} pour préparer l’examen civique : toutes les questions, les examens blancs illimités, la lecture à
          voix haute. C’est gratuit pour vous.
        </p>
      }
    >
      <JoinOrganization code={code} info={info} account={!me ? 'anonymous' : me.emailVerified ? 'verified' : 'unverified'} />
    </AuthCard>
  );
}
