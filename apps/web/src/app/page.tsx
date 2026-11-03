import Link from 'next/link';
import { buttonClasses } from '@/components/button';
import { Eyebrow } from '@/components/eyebrow';
import { ArrowRightIcon, CheckIcon, GroupIcon, SourceIcon } from '@/components/icons';
import { ExampleCorrection } from '@/components/premium/example-correction';
import { OfferComparison } from '@/components/premium/offer-comparison';
import { OfferLink } from '@/components/premium/offer-link';
import { RouteIllustration } from '@/components/route-illustration';
import { apiGet } from '@/lib/api';
import { defaultPathStyle, formatDate, formatPrice, pathStyle } from '@/lib/labels';
import { jsonLd, organization, pageMetadata, publicUrl } from '@/lib/seo';
import { site } from '@/lib/site';
import type { OrganizationOffer, PathSummary, Plan } from '@/lib/types';

const trustPoints = [
  'Sans inscription pour commencer',
  'Chaque question indique sa source',
  'Plateforme indépendante, sans lien avec l’administration',
];

const steps = [
  { title: 'Choisissez votre parcours', text: 'Carte de séjour, carte de résident ou naturalisation.' },
  { title: 'Entraînez-vous par thème', text: 'Chaque réponse est corrigée et expliquée avec des mots simples.' },
  { title: 'Passez un examen blanc', text: '40 questions en 45 minutes, comme le jour de l’examen.' },
];

// Ce qui distingue la plateforme : elle aide à retenir, pas seulement à répéter des questions.
const methods = [
  {
    title: 'Des révisions qui s’adaptent à vous',
    text: 'Une question manquée revient vite. Une question réussie revient plus tard, puis encore plus tard : c’est la méthode la plus efficace pour retenir durablement.',
  },
  {
    title: 'Les énoncés officiels, avec leurs réponses',
    text: 'La liste du ministère donne les questions, pas les réponses. Ici, chaque énoncé de la liste officielle a sa bonne réponse, expliquée simplement, avec sa source.',
  },
  {
    title: 'Écouter et comprendre',
    text: 'Chaque question peut être lue à voix haute. Les mots administratifs sont expliqués à côté de la question, avec des mots simples.',
  },
  {
    title: 'Un examen blanc fidèle',
    text: 'Le même nombre de questions par thème que le jour de l’examen. Vos erreurs rejoignent ensuite vos révisions.',
  },
];

// Présentation des parcours si l'API ne répond pas : la page d'accueil reste lisible.
const fallbackPaths: Pick<PathSummary, 'code' | 'slug' | 'title' | 'description' | 'active'>[] = [
  {
    code: 'CSP',
    slug: 'carte-de-sejour-pluriannuelle',
    title: 'Carte de séjour pluriannuelle',
    description: 'Pour une première demande de carte de séjour pluriannuelle (CSP).',
    active: true,
  },
  { code: 'CR', slug: 'carte-de-resident', title: 'Carte de résident', description: 'Pour une première demande de carte de résident (CR).', active: true },
  { code: 'NAT', slug: 'naturalisation', title: 'Naturalisation', description: 'Pour une demande de nationalité française par naturalisation.', active: true },
];

// Format officiel, affiché avec sa source et sa date de vérification (E03).
const examFacts = [
  { value: '40', label: 'questions à choix multiples' },
  { value: '45 min', label: 'au maximum pour répondre' },
  { value: '1 sur 4', label: 'une seule bonne réponse parmi 4 propositions' },
  { value: '32 / 40', label: 'bonnes réponses pour réussir' },
];

const reasons = [
  {
    title: 'Des sources visibles',
    text: 'Chaque question indique d’où elle vient. Les questions officielles et nos propres questions sont toujours clairement séparées.',
  },
  {
    title: 'Indépendant et honnête',
    text: `${site.name} n’a aucun lien avec l’administration. Nous ne promettons pas la réussite : nous vous aidons à vous entraîner sérieusement.`,
  },
  {
    title: 'Facile à lire',
    text: 'Phrases courtes, mots simples, grands caractères. Le site fonctionne sur votre téléphone.',
  },
];

const sectionTitle = 'mt-2 text-[1.625rem] leading-tight sm:text-[2.125rem]';

export const metadata = pageMetadata({ description: site.description, path: '/' });
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [paths, catalog, testimonials, organizationOffer] = await Promise.all([
    apiGet<PathSummary[]>('/api/paths').catch(() => fallbackPaths),
    apiGet<{ plans: Plan[]; free: { questionsPerTopic: number; exams: number } }>('/api/plans').catch(() => ({
      plans: [] as Plan[],
      free: { questionsPerTopic: 10, exams: 1 },
    })),
    apiGet<{ id: number; displayName: string; text: string; pathTitle: string | null; publishedAt: string | null }[]>('/api/testimonials').catch(
      () => [],
    ),
    apiGet<OrganizationOffer>('/api/organizations/offer').catch(() => null),
  ]);
  const firstOpen = paths.find((path) => path.active);
  const pass = catalog.plans[0];
  const seatPrices = (organizationOffer?.plans ?? []).map((pack) => Math.round(pack.priceCents / pack.seats));
  const cheapestSeat = seatPrices.length > 0 ? Math.min(...seatPrices) : null;
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({ '@type': 'WebSite', name: site.name, url: publicUrl, inLanguage: 'fr-FR', publisher: organization })}
      />
      <section className="py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Eyebrow>Examen civique · Carte de séjour · Carte de résident · Naturalisation</Eyebrow>
            <h1 className="mt-4 text-[2.125rem] leading-[1.1] sm:text-[3.25rem]">
              Préparez l’examen civique,{' '}
              <span className="bg-[linear-gradient(transparent_68%,var(--color-ocre-100)_68%)] text-sapin-700">
                étape par étape.
              </span>
            </h1>
            <p className="mt-5 max-w-[34em] text-[1.1875rem]">
              Des questions au format de l’examen, des corrections expliquées simplement, et vos progrès sur votre
              téléphone.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={firstOpen ? `/entrainement/${firstOpen.slug}/melange` : '/entrainement'} className={buttonClasses('primary')}>
                Tester mes connaissances
                <ArrowRightIcon />
              </Link>
              <Link href="/parcours" className={buttonClasses('secondary')}>
                Choisir mon parcours
              </Link>
            </div>
            <Link
              href="/associations"
              className="group mt-6 flex max-w-[34em] items-center gap-3 rounded-carte border border-ocre-100 bg-white px-4 py-3 text-petit shadow-carte hover:border-ocre-500"
            >
              <span className="grid size-9 flex-none place-items-center rounded-full bg-ocre-100 text-ocre-700">
                <GroupIcon />
              </span>
              <span>
                <strong className="block">Association, centre social, organisme de formation ?</strong>
                Offrez l’accès complet à votre groupe{cheapestSeat !== null ? `, dès ${formatPrice(cheapestSeat)} par personne` : ''}.
              </span>
              <ArrowRightIcon className="ml-auto size-5 flex-none text-sapin-700 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <ul className="mt-6 grid gap-2 text-petit">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <CheckIcon className="mt-0.5 size-[18px] flex-none text-sapin-500" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <RouteIllustration />
        </div>
      </section>

      <section id="comment" className="scroll-mt-6 border-y border-ligne bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Eyebrow>Comment ça marche</Eyebrow>
          <h2 className={sectionTitle}>Trois étapes, à votre rythme</h2>
          <ol className="relative mt-10 grid gap-8 before:absolute before:bottom-5 before:left-[21px] before:top-5 before:border-l-[3px] before:border-dotted before:border-sapin-500 sm:grid-cols-3 sm:gap-6 sm:before:bottom-auto sm:before:left-[16%] sm:before:right-[16%] sm:before:top-[21px] sm:before:border-l-0 sm:before:border-t-[3px]">
            {steps.map((step, index) => (
              <li key={step.title} className="relative grid grid-cols-[44px_1fr] gap-x-4 sm:block sm:text-center">
                <span
                  className={`grid size-11 place-items-center rounded-full border-[3px] bg-white font-titre text-lg font-semibold sm:mx-auto ${
                    index === steps.length - 1 ? 'border-ocre-500 text-ocre-700' : 'border-sapin-500 text-sapin-700'
                  }`}
                >
                  {index + 1}
                </span>
                <div className="sm:mt-4">
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="text-petit text-encre-doux">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="ministere" className="border-b border-ligne bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Eyebrow>Gratuit, Premium ou en groupe</Eyebrow>
          <h2 id="ministere" className={sectionTitle}>
            La liste du ministère donne les questions, pas les réponses
          </h2>
          <p className="mt-3 max-w-2xl text-encre-doux">
            Commencez gratuitement, sans inscription. Le pass Premium, payé une seule fois et sans abonnement, ouvre toutes les
            questions de votre parcours et des examens blancs illimités.
          </p>
          <div className="mt-8 grid gap-6 xl:grid-cols-2 xl:items-start">
            <OfferComparison free={catalog.free} />
            <ExampleCorrection />
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <article className="flex flex-col rounded-carte border-2 border-sapin-700 bg-white p-6 shadow-carte">
              <h3 className="text-[1.3125rem] font-bold">Pour vous : le pass Premium</h3>
              {pass && (
                <p className="mt-2">
                  <span className="font-titre text-[2rem] font-semibold leading-none">{formatPrice(pass.priceCents, pass.currency)}</span>{' '}
                  <span className="text-petit text-encre-doux">TTC, une seule fois, pour {Math.round(pass.durationDays / 30)} mois</span>
                </p>
              )}
              <p className="mt-2 text-petit text-encre-doux">
                Toutes les questions de votre parcours et des examens blancs illimités. Sans abonnement.
              </p>
              <div className="mt-auto pt-5">
                <OfferLink place="accueil" className={buttonClasses('primary')}>
                  Voir les tarifs
                </OfferLink>
              </div>
            </article>
            <article aria-labelledby="structures" className="flex flex-col rounded-carte border-2 border-ocre-500 bg-white p-6 shadow-carte">
              <h3 id="structures" className="text-[1.3125rem] font-bold">
                <GroupIcon className="mr-2 inline size-6 align-[-0.2em] text-ocre-700" />
                Pour votre groupe : l’offre associations
              </h3>
              {cheapestSeat !== null && (
                <p className="mt-2">
                  <span className="text-petit text-encre-doux">dès</span>{' '}
                  <span className="font-titre text-[2rem] font-semibold leading-none">{formatPrice(cheapestSeat)}</span>{' '}
                  <span className="text-petit text-encre-doux">par personne, pour 6 mois</span>
                </p>
              )}
              <p className="mt-2 text-petit text-encre-doux">
                Associations, centres sociaux, organismes de formation : un lien à partager, une affiche à imprimer et le suivi du
                groupe, dans le respect des données de chacun.
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
                <Link href="/associations" className={buttonClasses('secondary')}>
                  Découvrir l’offre associations
                </Link>
                <Link href="/rejoindre" className={buttonClasses('quiet')}>
                  J’ai un code de ma structure
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Eyebrow>La méthode</Eyebrow>
          <h2 className={sectionTitle}>S’entraîner pour retenir, pas seulement pour répéter</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {methods.map((method, index) => (
              <article key={method.title} className="flex gap-4 rounded-carte border border-ligne bg-white p-6 shadow-carte">
                <span
                  aria-hidden="true"
                  className={`mt-1 size-3 flex-none rounded-full ${index % 2 === 0 ? 'bg-sapin-500' : 'bg-ocre-500'}`}
                />
                <div>
                  <h3 className="text-[1.1875rem] font-bold">{method.title}</h3>
                  <p className="mt-1.5 text-petit text-encre-doux">{method.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-ligne py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Eyebrow>Les parcours</Eyebrow>
          <h2 className={sectionTitle}>Choisissez votre démarche</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {paths.map((path) => {
              const style = pathStyle[path.code] ?? defaultPathStyle;
              return (
                <article
                  key={path.code}
                  className={`flex flex-col gap-3 rounded-carte border border-t-[6px] border-ligne bg-white p-6 shadow-carte ${style.stripe}`}
                >
                  <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                    {path.active ? 'Disponible' : 'Bientôt'}
                  </span>
                  <h3 className="text-[1.3125rem] font-bold leading-snug">{path.title}</h3>
                  <p className="text-petit text-encre-doux">{path.description}</p>
                  <div className="mt-auto pt-2">
                    <Link href={`/parcours/${path.slug}`} className={buttonClasses(path.active ? 'primary' : 'secondary')}>
                      {path.active ? 'Découvrir ce parcours' : 'En savoir plus'}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {testimonials.length > 0 && (
        <section aria-labelledby="temoignages" className="border-t border-ligne py-14">
          <div className="mx-auto max-w-6xl px-4">
            <Eyebrow>Témoignages</Eyebrow>
            <h2 id="temoignages" className={sectionTitle}>
              Ils se préparent avec {site.name}
            </h2>
            <ul className="mt-8 grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <li key={testimonial.id}>
                  <figure className="flex h-full flex-col gap-3 rounded-carte border border-ligne bg-white p-6 shadow-carte">
                    <blockquote className="flex-1">«&nbsp;{testimonial.text}&nbsp;»</blockquote>
                    <figcaption className="text-petit text-encre-doux">
                      <strong className="text-encre">{testimonial.displayName}</strong>
                      {testimonial.pathTitle && ` · ${testimonial.pathTitle}`}
                      {testimonial.publishedAt && (
                        <>
                          <br />
                          Publié le <time dateTime={testimonial.publishedAt}>{formatDate(testimonial.publishedAt)}</time>
                        </>
                      )}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-petit text-encre-doux">
              Comment ces avis sont vérifiés : seules les personnes inscrites qui ont terminé un examen blanc ou répondu à 20 questions
              peuvent témoigner. Chaque avis est publié avec leur accord, après relecture, sans modification ni contrepartie, du plus
              récent au plus ancien. Ces témoignages ne garantissent pas la réussite à l’examen.
            </p>
          </div>
        </section>
      )}

      <section id="examen" className="scroll-mt-6 border-y border-ligne bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Eyebrow>L’examen civique en bref</Eyebrow>
          <h2 className={sectionTitle}>Ce qui vous attend le jour de l’examen</h2>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {examFacts.map((fact) => (
              <div key={fact.label} className="flex flex-col-reverse justify-end rounded-carte border border-ligne bg-papier p-5">
                <dt className="mt-1 text-petit text-encre-doux">{fact.label}</dt>
                <dd className="font-titre text-[2rem] font-semibold leading-none tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-3xl">
            Depuis le 1<sup>er</sup> janvier 2026, l’examen est obligatoire pour une première demande de carte de séjour
            pluriannuelle, de carte de résident ou de naturalisation. Le renouvellement d’une carte n’est pas concerné.
          </p>
          <p className="mt-3 flex items-start gap-2 text-petit text-encre-doux">
            <SourceIcon className="mt-1 size-3.5 flex-none" />
            <span>
              Source :{' '}
              <a
                href="https://www.service-public.gouv.fr/particuliers/actualites/A18713"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-sapin-700"
              >
                service-public.gouv.fr
              </a>
              , informations vérifiées le 31 octobre 2026. Les règles peuvent changer : vérifiez toujours sur le site
              officiel.
            </span>
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto max-w-6xl px-4">
          <Eyebrow>Pourquoi nous faire confiance</Eyebrow>
          <h2 className={sectionTitle}>Sérieux, transparent, accessible</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {reasons.map((reason) => (
              <article key={reason.title} className="rounded-carte border border-ligne bg-white p-6 shadow-carte">
                <h3 className="text-[1.1875rem] font-bold">{reason.title}</h3>
                <p className="mt-2 text-petit text-encre-doux">{reason.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start gap-5 rounded-carte bg-sapin-50 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 className="text-[1.5rem] leading-tight">Prêt à commencer ?</h2>
              <p className="mt-1 text-encre-doux">Le premier entraînement est gratuit et sans inscription.</p>
            </div>
            <Link href="/entrainement" className={buttonClasses('primary', 'flex-none')}>
              Commencer gratuitement
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
