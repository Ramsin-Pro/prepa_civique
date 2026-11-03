import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { FormAlert } from '@/components/form';
import { OrganizationCheckoutForm } from '@/components/organizations/checkout-form';
import { apiGet, getMe } from '@/lib/api';
import type { OrganizationOffer } from '@/lib/types';

export const metadata: Metadata = { title: 'Commander des places', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Commande en ligne d'un pack de places : réservée au compte de la personne qui coordonne la structure.
export default async function OrganizationOrderPage({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  const [me, offer] = await Promise.all([getMe(), apiGet<OrganizationOffer>('/api/organizations/offer').catch(() => null)]);
  const next = encodeURIComponent(`/associations/commande${pack ? `?pack=${pack}` : ''}`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-petit">
        <Link href="/associations" className="text-sapin-700 underline underline-offset-4">
          ← L’offre associations
        </Link>
      </p>
      <div className="mt-4">
        <Eyebrow>Associations et structures</Eyebrow>
      </div>
      <h1 className="mt-2 text-[2.125rem] leading-tight">Commander des places</h1>
      <div className="mt-8 rounded-carte border border-ligne bg-white p-6 shadow-carte">
        {!offer || offer.plans.length === 0 ? (
          <FormAlert tone="info">
            Les packs ne sont pas disponibles pour le moment.{' '}
            <Link href="/associations#demande" className="font-bold text-sapin-700 underline underline-offset-4">
              Demandez un devis
            </Link>
            .
          </FormAlert>
        ) : !me ? (
          <div className="grid gap-4">
            <p>
              Les places sont gérées depuis le compte de la personne qui coordonne la structure : c’est là que vous trouverez le lien d’invitation
              et le suivi du groupe. Créez ce compte, ou connectez-vous.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={`/inscription?suite=${next}`} className={buttonClasses('primary')}>
                Créer le compte de ma structure
              </Link>
              <Link href={`/connexion?suite=${next}`} className={buttonClasses('secondary')}>
                Me connecter
              </Link>
            </div>
          </div>
        ) : !me.emailVerified ? (
          <FormAlert tone="info">Confirmez d’abord votre adresse email avec le lien reçu, puis revenez sur cette page.</FormAlert>
        ) : (
          <OrganizationCheckoutForm plans={offer.plans} kinds={offer.kinds} provider={offer.paymentProvider} defaultPlan={pack} />
        )}
      </div>
    </div>
  );
}
