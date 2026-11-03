import Link from 'next/link';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { FormAlert } from '@/components/form';
import { CheckIcon, GroupIcon } from '@/components/icons';
import { CheckoutForm } from '@/components/premium/checkout-form';
import { ExampleCorrection } from '@/components/premium/example-correction';
import { OfferComparison } from '@/components/premium/offer-comparison';
import { ProposeToAssociation } from '@/components/share/share-actions';
import { apiGet, getMe } from '@/lib/api';
import { formatPrice } from '@/lib/labels';
import { jsonLd, pageMetadata, publicUrl } from '@/lib/seo';
import { site } from '@/lib/site';
import type { OrganizationOffer, PaymentProvider, Plan } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Tarifs',
  description:
    'Gratuit sans inscription, pass Premium de 3 mois payé une seule fois, ou offre de groupe pour les associations dès 6 € par personne. Sans abonnement.',
  path: '/tarifs',
  image: '/tarifs/opengraph-image',
});
export const dynamic = 'force-dynamic';

type FreeTier = { questionsPerTopic: number; exams: number };

const features = (free: FreeTier): { label: string; free: string | boolean; premium: string | boolean }[] => [
  { label: 'Questions d’entraînement', free: `${free.questionsPerTopic} questions par thème, réparties entre les notions`, premium: 'Toutes les questions' },
  { label: 'Examens blancs au format officiel', free: `${free.exams} examen${free.exams > 1 ? 's' : ''} blanc${free.exams > 1 ? 's' : ''}`, premium: 'Illimités' },
  { label: 'Corrections expliquées simplement, avec leurs sources', free: true, premium: true },
  { label: 'Révisions espacées et suivi de progression', free: true, premium: true },
  { label: 'Fiches de révision, lexique et lecture audio (voix Rémy)', free: true, premium: true },
];

const groupPoints = [
  'Le Premium complet pour chaque personne',
  'Un lien et une affiche avec QR code pour inviter',
  'Le suivi du groupe, avec l’accord de chacun',
  'Paiement par carte, ou sur facture par virement',
];

/** « 25, 50 ou 100 » */
const sizes = (seats: number[]) => (seats.length > 1 ? `${seats.slice(0, -1).join(', ')} ou ${seats.at(-1)}` : `${seats[0] ?? ''}`);

// Offres (E14) : ce qui est gratuit, ce que le Premium ajoute, l'offre des structures, le prix TTC et la durée,
// sans engagement caché. Les trois offres sont au même niveau : personne n'a à chercher l'offre de groupe.
export default async function PricingPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const { paiement } = await searchParams;
  const [me, catalog, organizationOffer] = await Promise.all([
    getMe(),
    apiGet<{ plans: Plan[]; paymentProvider: PaymentProvider; free: FreeTier }>('/api/plans').catch(() => ({
      plans: [] as Plan[],
      paymentProvider: 'none' as const,
      free: { questionsPerTopic: 10, exams: 1 },
    })),
    apiGet<OrganizationOffer>('/api/organizations/offer').catch(() => null),
  ]);
  const packs = organizationOffer?.plans ?? [];
  const perPerson = packs.map((pack) => Math.round(pack.priceCents / pack.seats));
  const cheapestSeat = perPerson.length > 0 ? Math.min(...perPerson) : null;
  const plan = catalog.plans[0];
  const freeItems = features(catalog.free).map((feature) => (feature.free === true ? feature.label : `${feature.label} : ${feature.free}`));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {plan && catalog.paymentProvider !== 'none' && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLd({
            '@type': 'Product',
            name: `${plan.name} · ${site.name}`,
            description: plan.description,
            brand: { '@type': 'Brand', name: site.name },
            offers: {
              '@type': 'Offer',
              price: (plan.priceCents / 100).toFixed(2),
              priceCurrency: plan.currency,
              availability: 'https://schema.org/InStock',
              url: `${publicUrl}/tarifs`,
            },
          })}
        />
      )}
      <Eyebrow>Tarifs</Eyebrow>
      <h1 className="mt-2 max-w-3xl text-[2.125rem] leading-tight sm:text-[2.75rem]">Commencez gratuitement. Passez au Premium si vous en avez besoin.</h1>
      <p className="mt-3 max-w-2xl text-encre-doux">
        Pas d’abonnement : le pass se paie une seule fois et s’arrête seul. Les associations et les structures ont un tarif de groupe.
        Aucun entraînement ne garantit la réussite à l’examen officiel, mais il vous aide à arriver prêt.
      </p>

      {paiement === 'annule' && (
        <div className="mt-6">
          <FormAlert tone="info">Paiement annulé : vous n’avez pas été débité.</FormAlert>
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="gratuit" className="flex flex-col rounded-carte border border-ligne bg-white p-6 shadow-carte">
          <h2 id="gratuit" className="text-[1.5rem]">
            Gratuit
          </h2>
          <p className="mt-3 font-titre text-[2.75rem] font-semibold leading-none">0 €</p>
          <p className="mt-2 text-petit text-encre-doux">Sans inscription · sans limite de durée</p>
          <ul className="mt-5 grid gap-2.5 text-petit">
            {freeItems.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckIcon className="mt-0.5 size-[18px] flex-none text-sapin-500" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-6">
            <Link href="/entrainement" className={buttonClasses('secondary', 'w-full')}>
              Commencer gratuitement
            </Link>
          </div>
        </section>

        <section aria-labelledby="pass" className="flex flex-col rounded-carte border-2 border-sapin-700 bg-white p-6 shadow-carte">
          {plan ? (
            <>
              <p className="self-start rounded-full bg-sapin-50 px-2.5 py-0.5 text-xs font-bold text-sapin-700">Pour vous préparer</p>
              <h2 id="pass" className="mt-3 text-[1.5rem]">
                {plan.name}
              </h2>
              <p className="mt-3 font-titre text-[2.75rem] font-semibold leading-none">
                {formatPrice(plan.priceCents, plan.currency)}
                <span className="ml-1 font-texte text-courant font-normal text-encre-doux">TTC</span>
              </p>
              <p className="mt-2 text-petit text-encre-doux">
                Paiement unique · accès {Math.round(plan.durationDays / 30)} mois · sans renouvellement automatique
              </p>
              <p className="mt-4">{plan.description}</p>
              <div className="mt-6">
                <CheckoutForm plan={plan} me={me} provider={catalog.paymentProvider} />
              </div>
            </>
          ) : (
            <p id="pass">Le Premium n’est pas encore disponible.</p>
          )}
        </section>

        {cheapestSeat !== null && (
          <section aria-labelledby="groupe" className="flex flex-col rounded-carte border-2 border-ocre-500 bg-white p-6 shadow-carte">
            <p className="self-start rounded-full bg-ocre-100 px-2.5 py-0.5 text-xs font-bold text-ocre-700">Pour votre groupe</p>
            <h2 id="groupe" className="mt-3 text-[1.5rem]">
              <GroupIcon className="mr-2 inline size-6 align-[-0.2em] text-ocre-700" />
              Associations et structures
            </h2>
            <p className="mt-3">
              <span className="text-petit text-encre-doux">dès </span>
              <span className="font-titre text-[2.75rem] font-semibold leading-none">{formatPrice(cheapestSeat)}</span>
              <span className="text-petit text-encre-doux"> par personne</span>
            </p>
            <p className="mt-2 text-petit text-encre-doux">
              Packs de {sizes(packs.map((pack) => pack.seats))} places · 6 mois d’accès par personne · paiement unique
            </p>
            <ul className="mt-5 grid gap-2.5 text-petit">
              {groupPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <CheckIcon className="mt-0.5 size-[18px] flex-none text-sapin-500" />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-auto grid gap-2 pt-6">
              <Link href="/associations" className={buttonClasses('secondary', 'w-full')}>
                Voir l’offre associations
              </Link>
              <Link href="/associations#demande" className={buttonClasses('quiet', 'justify-center')}>
                Demander un devis ou un essai
              </Link>
            </div>
          </section>
        )}
      </div>

      <section aria-labelledby="comparatif" className="mt-12">
        <h2 id="comparatif" className="text-[1.5rem]">
          Gratuit ou Premium : le détail
        </h2>
        <div className="relative mt-4 overflow-x-auto rounded-carte border border-ligne bg-white shadow-carte">
          <table className="w-full text-left">
            <thead className="bg-papier text-petit">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">
                  Inclus
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  Gratuit
                </th>
                <th scope="col" className="px-4 py-3 font-bold text-sapin-700">
                  Premium
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ligne">
              {features(catalog.free).map((feature) => (
                <tr key={feature.label} className="align-top">
                  <th scope="row" className="px-4 py-3 font-normal">
                    {feature.label}
                  </th>
                  {[feature.free, feature.premium].map((value, column) => (
                    <td key={column} className="px-4 py-3 text-petit">
                      {value === true ? (
                        <>
                          <CheckIcon className="size-5 text-sapin-700" />
                          <span className="sr-only">Inclus</span>
                        </>
                      ) : (
                        value
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-ligne px-4 py-3 text-petit text-encre-doux">
            L’offre gratuite fonctionne sans inscription : votre progression est gardée sur cet appareil. Avec l’offre associations,
            chaque personne a le même accès que le Premium, pendant 6 mois.
          </p>
        </div>
      </section>

      <section aria-labelledby="ministere" className="mt-12">
        <h2 id="ministere" className="text-[1.5rem]">
          La liste du ministère donne les questions, pas les réponses
        </h2>
        <p className="mt-2 max-w-2xl text-encre-doux">
          Le ministère publie les énoncés des questions de connaissance. Ici, chaque question a sa bonne réponse, expliquée avec des
          mots simples, et la source qui permet de la vérifier.
        </p>
        <div className="mt-6 grid gap-6 xl:grid-cols-2 xl:items-start">
          <OfferComparison free={catalog.free} />
          <ExampleCorrection />
        </div>
      </section>

      <section aria-labelledby="questions-tarifs" className="mt-12 max-w-3xl">
        <h2 id="questions-tarifs" className="text-[1.5rem]">
          Vos questions
        </h2>
        <dl className="mt-4 grid gap-5">
          <div>
            <dt className="font-bold">Est-ce un abonnement ?</dt>
            <dd className="mt-1 text-encre-doux">Non. Vous payez une fois, l’accès dure 3 mois puis s’arrête seul. Rien n’est prélevé ensuite.</dd>
          </div>
          <div>
            <dt className="font-bold">Et si mon examen est repoussé ?</dt>
            <dd className="mt-1 text-encre-doux">
              Depuis votre compte, vous pouvez prolonger gratuitement votre pass de 30 jours, une fois. Rien n’est prélevé.
            </dd>
          </div>
          <div>
            <dt className="font-bold">Mon association peut-elle payer pour moi ?</dt>
            <dd className="mt-1 text-encre-doux">
              Oui. Une association, un centre social ou un organisme de formation peut vous offrir une place : il vous donne un lien ou un
              code, et vous activez votre accès depuis la page{' '}
              <Link href="/rejoindre" className="text-sapin-700 underline underline-offset-4">
                J’ai un code de ma structure
              </Link>
              .
              <ProposeToAssociation className="mt-3" />
            </dd>
          </div>
          <div>
            <dt className="font-bold">Qui est derrière ce site ?</dt>
            <dd className="mt-1 text-encre-doux">
              Le nom de l’entreprise qui édite le site, son adresse et son immatriculation figurent dans les{' '}
              <Link href="/mentions-legales" className="text-sapin-700 underline underline-offset-4">
                mentions légales
              </Link>
              . Vous pouvez nous écrire à tout moment depuis la page contact.
            </dd>
          </div>
          <div>
            <dt className="font-bold">Le site est-il officiel ?</dt>
            <dd className="mt-1 text-encre-doux">
              Non. C’est une plateforme indépendante, sans lien avec l’administration. Personne ne peut vous vendre l’attestation : il faut
              réussir l’examen officiel.
            </dd>
          </div>
          <div>
            <dt className="font-bold">Et si j’ai un problème ?</dt>
            <dd className="mt-1 text-encre-doux">
              Écrivez-nous depuis la{' '}
              <Link href="/contact" className="text-sapin-700 underline underline-offset-4">
                page contact
              </Link>
              . Les conditions de remboursement sont dans les{' '}
              <Link href="/cgv" className="text-sapin-700 underline underline-offset-4">
                conditions générales de vente
              </Link>
              .
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
