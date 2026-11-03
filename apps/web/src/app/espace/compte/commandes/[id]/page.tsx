import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PrintButton } from '@/components/account/print-button';
import { ApiError, apiGet } from '@/lib/api';
import { formatPrice, withFirstOfMonth } from '@/lib/labels';
import { seller, site } from '@/lib/site';
import type { OrderStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Reçu de commande', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Receipt = {
  id: string;
  status: OrderStatus;
  amountCents: number;
  currency: string;
  provider: string;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  waiverAcceptedAt: string | null;
  salesTermsVersion: string | null;
  salesTermsAcceptedAt: string | null;
  plan: { name: string; durationDays: number; audience: 'INDIVIDUAL' | 'ORGANIZATION' };
  entitlement: { startsAt: string; expiresAt: string } | null;
  license: { seats: number; seatDays: number; validUntil: string } | null;
  organization: { name: string; registration: string | null; city: string | null } | null;
  user: { email: string };
};

const date = (iso: string | null) =>
  iso ? withFirstOfMonth(new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })) : '—';
const dateTime = (iso: string | null) =>
  iso ? withFirstOfMonth(new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })) : '—';

// Reçu d'une commande (E16 : factures). La facture est aussi envoyée par le prestataire de paiement.
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let receipt: Receipt;
  try {
    receipt = await apiGet<Receipt>(`/api/account/orders/${encodeURIComponent(id)}`, { personal: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(`/connexion?suite=/espace/compte/commandes/${id}`);
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const organization = receipt.organization;
  const rows: [string, string][] = [
    ['Numéro de commande', receipt.id],
    ['Date de la commande', dateTime(receipt.createdAt)],
    [
      'Client',
      organization
        ? [organization.name, organization.city, organization.registration ? `RNA / SIRET ${organization.registration}` : null, receipt.user.email]
            .filter(Boolean)
            .join(' · ')
        : receipt.user.email,
    ],
    receipt.license
      ? ['Formule', `${receipt.plan.name} : ${receipt.license.seats} places de ${receipt.license.seatDays} jours d’accès chacune`]
      : ['Formule', `${receipt.plan.name} (${receipt.plan.durationDays} jours, sans renouvellement automatique)`],
    ['Montant payé', `${formatPrice(receipt.amountCents, receipt.currency)} TTC`],
    ['Paiement', receipt.status === 'REFUNDED' ? `Remboursé le ${date(receipt.refundedAt)}` : `Payé le ${dateTime(receipt.paidAt)}`],
    receipt.license
      ? ['Places', `À activer avant le ${date(receipt.license.validUntil)}`]
      : ['Période d’accès', receipt.entitlement ? `Du ${date(receipt.entitlement.startsAt)} au ${date(receipt.entitlement.expiresAt)}` : '—'],
    [
      'Conditions acceptées',
      receipt.salesTermsAcceptedAt
        ? `CGV version ${receipt.salesTermsVersion ?? '—'}, acceptées le ${dateTime(receipt.salesTermsAcceptedAt)}`
        : '—',
    ],
    ...(receipt.waiverAcceptedAt
      ? ([['Accès immédiat', `Demandé le ${dateTime(receipt.waiverAcceptedAt)}, avec renonciation au droit de rétractation`]] as [string, string][])
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-petit print:hidden">
        <Link href="/espace/compte" className="text-sapin-700 underline underline-offset-4">
          ← Mon compte
        </Link>
      </p>
      <article className="mt-4 rounded-carte border border-ligne bg-white p-6 shadow-carte print:border-0 print:shadow-none sm:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[1.875rem] leading-tight">Reçu de commande</h1>
            <p className="mt-1 text-encre-doux">{site.name}</p>
          </div>
          <address className="text-petit not-italic text-encre-doux">
            {seller.name}
            <br />
            {seller.address}
            <br />
            {seller.registration}
            <br />
            {seller.vat}
          </address>
        </header>
        <dl className="mt-6 divide-y divide-ligne border-y border-ligne">
          {rows.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[13rem_1fr]">
              <dt className="text-petit text-encre-doux">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-petit text-encre-doux">
          {receipt.provider === 'stripe'
            ? 'La facture de ce paiement vous a aussi été envoyée par email par notre prestataire de paiement, Stripe.'
            : 'Paiement simulé (environnement de développement) : ce reçu n’a aucune valeur comptable.'}
        </p>
      </article>
      <div className="mt-6">
        <PrintButton />
      </div>
    </div>
  );
}
