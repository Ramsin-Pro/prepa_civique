import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { FormAlert } from '@/components/form';
import { ArrowRightIcon, CheckIcon } from '@/components/icons';
import { GroupIllustration } from '@/components/organizations/group-illustration';
import { OrganizationRequestForm } from '@/components/organizations/request-form';
import { apiGet } from '@/lib/api';
import { formatPrice } from '@/lib/labels';
import { jsonLd, pageMetadata, publicUrl } from '@/lib/seo';
import { site } from '@/lib/site';
import type { OrganizationOffer, Plan } from '@/lib/types';

export const metadata = pageMetadata({
  title: 'Associations et structures',
  description: `Offrez à votre groupe l’accès Premium de ${site.name} à prix réduit : dès 6 € par personne pour 6 mois, payé une seule fois. Lien d’invitation, suivi du groupe, données respectées.`,
  path: '/associations',
  image: '/associations/opengraph-image',
});
export const dynamic = 'force-dynamic';

// Au-delà des packs en ligne : tarif sur devis (décision n° 23 de docs/direction-artistique.md).
const LARGE_ORDER = { seats: 250, perPersonCents: 500 };

const steps = [
  { title: 'Choisissez un pack', text: 'En ligne par carte, ou sur facture par virement. Les places sont à activer dans l’année.' },
  { title: 'Partagez votre lien', text: 'Par WhatsApp, SMS ou sur une affiche en salle. Chaque personne crée un compte gratuit et active sa place.' },
  { title: 'Suivez votre groupe', text: 'Places utilisées, activité du groupe, thèmes à retravailler ensemble. Le détail, seulement avec l’accord de chacun.' },
];

const forLearners = [
  'Tous les énoncés officiels de leur démarche, avec la bonne réponse expliquée en français simple et sa source',
  'Des examens blancs illimités au format de l’examen : 40 questions, 45 minutes',
  'Les questions manquées qui reviennent au bon moment, jusqu’à ce qu’elles soient retenues',
  'La lecture à voix haute et un lexique des mots difficiles, pour les personnes qui lisent encore difficilement',
  'Carte de séjour pluriannuelle, carte de résident et naturalisation : les trois parcours sont inclus',
];

const forYou = [
  'Un lien d’invitation et une affiche à imprimer, avec un code facile à dicter',
  'Le nombre de places activées et disponibles, en temps réel',
  'Les chiffres du groupe : activité de la semaine, examens blancs, thèmes les plus difficiles',
  'Le détail par personne (questions travaillées, meilleur examen blanc) pour celles qui l’acceptent',
  'Des places ajoutées en quelques minutes quand un nouveau groupe arrive',
];

const faq = [
  {
    question: 'Peut-on payer par virement, sur facture ?',
    answer:
      'Oui. Demandez une facture avec le formulaire ci-dessous : nous ouvrons les places dès réception du virement, ou dès le bon de commande pour les collectivités.',
  },
  {
    question: 'Que voit la structure sur les personnes qu’elle accompagne ?',
    answer:
      'Par défaut, un email masqué et la date d’activation, pour gérer les places. Le détail de la progression et l’email complet seulement si la personne l’accepte, et elle peut changer d’avis à tout moment.',
  },
  {
    question: 'Et si une personne arrête la formation ?',
    answer:
      'Vous pouvez la retirer de votre espace : son accès offert s’arrête et la place redevient disponible pour quelqu’un d’autre.',
  },
  {
    question: 'Combien de temps dure une place ?',
    answer:
      'Six mois d’accès à partir du jour où la personne l’active : de quoi tenir même si le rendez-vous en préfecture est repoussé. Les places non activées restent utilisables pendant un an.',
  },
  {
    question: 'Le site est-il officiel ?',
    answer: `Non. ${site.name} est une plateforme indépendante, sans lien avec l’administration. Nous ne promettons pas la réussite : nous aidons à s’entraîner sérieusement, avec des sources vérifiables.`,
  },
];

const sectionTitle = 'mt-2 text-[1.625rem] leading-tight sm:text-[2.125rem]';

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const { paiement } = await searchParams;
  const [offer, individual] = await Promise.all([
    apiGet<OrganizationOffer>('/api/organizations/offer').catch(() => null),
    apiGet<{ plans: Plan[] }>('/api/plans').catch(() => null),
  ]);
  const plans = offer?.plans ?? [];
  const pass = individual?.plans[0];
  const cheapest = plans.reduce<number | null>((min, plan) => {
    const perPerson = Math.round(plan.priceCents / plan.seats);
    return min === null || perPerson < min ? perPerson : min;
  }, null);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          '@type': 'Service',
          name: `${site.name} pour les associations et structures`,
          url: `${publicUrl}/associations`,
          provider: { '@type': 'Organization', name: site.name },
          areaServed: 'FR',
          offers: plans.map((plan) => ({ '@type': 'Offer', name: plan.name, price: (plan.priceCents / 100).toFixed(2), priceCurrency: plan.currency })),
        })}
      />
      <section className="py-14 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <Eyebrow>Associations et structures</Eyebrow>
            <h1 className="mt-4 max-w-4xl text-[2.125rem] leading-[1.1] sm:text-[3.25rem]">Préparez tout votre groupe à l’examen civique</h1>
            <p className="mt-5 max-w-[40em] text-[1.1875rem]">
              Vous accompagnez des personnes étrangères dans leurs démarches ? Offrez-leur l’accès Premium à prix réduit
              {cheapest !== null && <>&nbsp;: dès {formatPrice(cheapest)} par personne</>}, payé une seule fois, sans abonnement.
            </p>
            {paiement === 'annule' && (
              <div className="mt-6 max-w-xl">
                <FormAlert tone="info">Paiement annulé : vous n’avez pas été débité.</FormAlert>
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/associations/commande" className={buttonClasses('primary')}>
                Commander des places
                <ArrowRightIcon />
              </Link>
              <a href="#demande" className={buttonClasses('secondary')}>
                Demander un devis ou un essai
              </a>
            </div>
          </div>
          <GroupIllustration />
        </div>
      </section>

      <section aria-labelledby="packs" className="border-y border-ligne bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Eyebrow>Tarifs</Eyebrow>
          <h2 id="packs" className={sectionTitle}>
            Des packs de places, payés une seule fois
          </h2>
          <p className="mt-3 max-w-2xl text-encre-doux">
            Chaque place ouvre {plans[0] ? Math.round(plans[0].durationDays / 30) : 6} mois d’accès Premium à la personne qui l’active. Prix toutes
            taxes comprises.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {plans.map((plan) => (
              <li key={plan.code} className="flex flex-col rounded-carte border border-ligne bg-papier p-6">
                <p className="font-bold">{plan.seats} places</p>
                <p className="mt-2 font-titre text-[2.25rem] font-semibold leading-none">{formatPrice(plan.priceCents, plan.currency)}</p>
                <p className="mt-2 text-sapin-700">
                  <strong>{formatPrice(Math.round(plan.priceCents / plan.seats), plan.currency)}</strong> par personne
                </p>
                <div className="mt-auto pt-5">
                  <Link href={`/associations/commande?pack=${plan.code}`} className={buttonClasses('secondary', 'min-h-11 w-full text-petit')}>
                    Choisir ce pack
                  </Link>
                </div>
              </li>
            ))}
            <li className="flex flex-col rounded-carte border-2 border-dashed border-ligne p-6">
              <p className="font-bold">{LARGE_ORDER.seats} places et plus</p>
              <p className="mt-2 font-titre text-[2.25rem] font-semibold leading-none">Sur devis</p>
              <p className="mt-2 text-sapin-700">
                <strong>{formatPrice(LARGE_ORDER.perPersonCents)}</strong> par personne
              </p>
              <div className="mt-auto pt-5">
                <a href="#demande" className={buttonClasses('secondary', 'min-h-11 w-full text-petit')}>
                  Demander un devis
                </a>
              </div>
            </li>
          </ul>
          {pass && (
            <p className="mt-6 text-petit text-encre-doux">
              Pour comparer : le pass individuel coûte {formatPrice(pass.priceCents, pass.currency)} pour {Math.round(pass.durationDays / 30)} mois.
              Vous voulez d’abord essayer ?{' '}
              <a href="#demande" className="font-bold text-sapin-700 underline underline-offset-4">
                Demandez des places d’essai
              </a>
              .
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="fonctionnement" className="py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Eyebrow>Comment ça marche</Eyebrow>
          <h2 id="fonctionnement" className={sectionTitle}>
            En place en dix minutes
          </h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
                <span className="grid size-10 place-items-center rounded-full border-[3px] border-sapin-500 font-titre font-semibold text-sapin-700">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-[1.1875rem] font-bold">{step.title}</h3>
                <p className="mt-1.5 text-petit text-encre-doux">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <BenefitList title="Pour les personnes que vous accompagnez" items={forLearners} />
            <BenefitList title="Pour vous" items={forYou} />
          </div>
        </div>
      </section>

      <section aria-labelledby="questions-structures" className="border-t border-ligne bg-white py-14">
        <div className="mx-auto max-w-3xl px-4">
          <h2 id="questions-structures" className="text-[1.625rem]">
            Vos questions
          </h2>
          <dl className="mt-6 grid gap-5">
            {faq.map((entry) => (
              <div key={entry.question}>
                <dt className="font-bold">{entry.question}</dt>
                <dd className="mt-1 text-encre-doux">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="demande" aria-labelledby="demande-titre" className="scroll-mt-6 py-14">
        <div className="mx-auto max-w-3xl px-4">
          <Eyebrow>Devis, facture ou essai</Eyebrow>
          <h2 id="demande-titre" className={sectionTitle}>
            Parlons de votre groupe
          </h2>
          <p className="mt-3 text-encre-doux">Nous répondons sous 3 jours ouvrés, par email.</p>
          <div className="mt-8 rounded-carte border border-ligne bg-white p-6 shadow-carte">
            <OrganizationRequestForm kinds={offer?.kinds ?? ['association', 'centre-social', 'formation', 'collectivite', 'autre']} />
          </div>
        </div>
      </section>
    </>
  );
}

function BenefitList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-carte bg-sapin-50 p-6">
      <h3 className="text-[1.25rem] font-bold">{title}</h3>
      <ul className="mt-4 grid gap-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 size-5 flex-none text-sapin-700" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
