// Données de référence : parcours, thèmes, notions, modèles d'examen.
// Les questions viennent des fichiers de apps/api/content (voir content.ts et docs/charte-editoriale.md).

/** Textes officiels communs aux trois parcours (E03 : sources officielles et date de vérification). */
const commonSources = [
  {
    label: 'Arrêté du 10 octobre 2025 relatif à l’examen civique (Légifrance)',
    url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000052381620',
  },
  {
    label: 'Service-public.gouv.fr : l’examen civique pour une carte de séjour ou la naturalisation',
    url: 'https://www.service-public.gouv.fr/particuliers/actualites/A18713',
  },
  { label: 'Formation civique (ministère de l’Intérieur)', url: 'https://formation-civique.interieur.gouv.fr' },
];

export const paths = [
  {
    code: 'CSP',
    slug: 'carte-de-sejour-pluriannuelle',
    title: 'Carte de séjour pluriannuelle',
    description: 'Pour une première demande de carte de séjour pluriannuelle (CSP).',
    active: true,
    position: 1,
    sources: [
      {
        label: 'Liste officielle des questions de connaissance, mention CSP (ministère de l’Intérieur)',
        url: 'https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-csp/',
      },
      ...commonSources,
    ],
    verifiedAt: new Date('2026-10-31'),
  },
  {
    code: 'CR',
    slug: 'carte-de-resident',
    title: 'Carte de résident',
    description: 'Pour une première demande de carte de résident (CR).',
    active: true,
    sources: [
      {
        label: 'Liste officielle des questions de connaissance, mention CR (ministère de l’Intérieur)',
        url: 'https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-cr/',
      },
      ...commonSources,
    ],
    verifiedAt: new Date('2026-10-31'),
    position: 2,
  },
  {
    code: 'NAT',
    slug: 'naturalisation',
    title: 'Naturalisation',
    description: 'Pour une demande de nationalité française par naturalisation.',
    active: true,
    sources: [
      {
        label: 'Questions de connaissance pour l’examen civique, nationalité française (ministère de l’Intérieur)',
        url: 'https://www.immigration.interieur.gouv.fr/documentation/guides-textes-et-brochures/questions-de-connaissance-pour-lexamen-civique-nationalite-francaise.html',
      },
      ...commonSources,
    ],
    verifiedAt: new Date('2026-10-31'),
    position: 3,
  },
] as const;

// Les cinq thématiques de la liste officielle, avec les notions de l'arrêté (charte éditoriale §8).
export const topics = [
  {
    slug: 'principes-et-valeurs',
    title: 'Principes et valeurs de la République',
    position: 1,
    notions: ['devise-et-symboles', 'laicite'],
  },
  {
    slug: 'institutions',
    title: 'Système institutionnel et politique',
    position: 2,
    notions: ['democratie-et-droit-de-vote', 'organisation-de-la-republique', 'institutions-europeennes'],
  },
  {
    slug: 'droits-et-devoirs',
    title: 'Droits et devoirs',
    position: 3,
    notions: ['droits-fondamentaux', 'obligations-et-devoirs'],
  },
  {
    slug: 'histoire-geographie-culture',
    title: 'Histoire, géographie et culture',
    position: 4,
    notions: ['periodes-et-personnages-historiques', 'territoires-et-geographie', 'patrimoine-francais'],
  },
  {
    slug: 'vivre-en-france',
    title: 'Vivre dans la société française',
    position: 5,
    notions: ['installation-et-sejour', 'acces-aux-soins', 'travail-en-france', 'autorite-parentale-et-education'],
  },
] as const;

/** Contenus de chaque parcours (apps/api/content/<dossier>) et liste officielle d'où viennent ses énoncés. */
export const pathContents = [
  {
    path: 'CSP',
    dir: 'csp',
    source: {
      key: 'liste-officielle-csp',
      label: 'Liste officielle des questions de connaissance, carte de séjour pluriannuelle (ministère de l’Intérieur)',
      url: 'https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-csp/',
      licence: 'Licence Ouverte Etalab 2.0',
    },
  },
  {
    path: 'CR',
    dir: 'cr',
    source: {
      key: 'liste-officielle-cr',
      label: 'Liste officielle des questions de connaissance, carte de résident (ministère de l’Intérieur)',
      url: 'https://formation-civique.interieur.gouv.fr/examen-civique/liste-officielle-des-questions-de-connaissance-cr/',
      licence: 'Licence Ouverte Etalab 2.0',
    },
  },
  {
    path: 'NAT',
    dir: 'nat',
    source: {
      key: 'liste-officielle-nat',
      label: 'Questions de connaissance pour l’examen civique, nationalité française (ministère de l’Intérieur)',
      url: 'https://www.immigration.interieur.gouv.fr/documentation/guides-textes-et-brochures/questions-de-connaissance-pour-lexamen-civique-nationalite-francaise.html',
      licence: 'Licence Ouverte Etalab 2.0 (mention générale du site)',
    },
  },
] as const;

const REGULATORY_REF =
  'Arrêté du 10 octobre 2025 relatif à l’examen civique (NOR INTV2527907A), articles 2 à 4 : 40 questions, 45 minutes au plus, seuil de 80 %, répartition par thème et par notion. Vérifié sur Légifrance le 31/10/2026.';

type Quota = { topic: (typeof topics)[number]['slug']; kind: 'KNOWLEDGE' | 'SITUATION'; notion: string | null; count: number };

const officialComposition: Quota[] = [
  { topic: 'principes-et-valeurs', kind: 'KNOWLEDGE', notion: 'devise-et-symboles', count: 3 },
  { topic: 'principes-et-valeurs', kind: 'KNOWLEDGE', notion: 'laicite', count: 2 },
  { topic: 'principes-et-valeurs', kind: 'SITUATION', notion: null, count: 6 },
  { topic: 'institutions', kind: 'KNOWLEDGE', notion: 'democratie-et-droit-de-vote', count: 3 },
  { topic: 'institutions', kind: 'KNOWLEDGE', notion: 'organisation-de-la-republique', count: 2 },
  { topic: 'institutions', kind: 'KNOWLEDGE', notion: 'institutions-europeennes', count: 1 },
  { topic: 'droits-et-devoirs', kind: 'KNOWLEDGE', notion: 'droits-fondamentaux', count: 2 },
  { topic: 'droits-et-devoirs', kind: 'KNOWLEDGE', notion: 'obligations-et-devoirs', count: 3 },
  { topic: 'droits-et-devoirs', kind: 'SITUATION', notion: null, count: 6 },
  { topic: 'histoire-geographie-culture', kind: 'KNOWLEDGE', notion: 'periodes-et-personnages-historiques', count: 3 },
  { topic: 'histoire-geographie-culture', kind: 'KNOWLEDGE', notion: 'territoires-et-geographie', count: 3 },
  { topic: 'histoire-geographie-culture', kind: 'KNOWLEDGE', notion: 'patrimoine-francais', count: 2 },
  { topic: 'vivre-en-france', kind: 'KNOWLEDGE', notion: 'installation-et-sejour', count: 1 },
  { topic: 'vivre-en-france', kind: 'KNOWLEDGE', notion: 'acces-aux-soins', count: 1 },
  { topic: 'vivre-en-france', kind: 'KNOWLEDGE', notion: 'travail-en-france', count: 1 },
  { topic: 'vivre-en-france', kind: 'KNOWLEDGE', notion: 'autorite-parentale-et-education', count: 1 },
];

/** Modèles d'examen blanc. La version 2 suit la répartition officielle par thème et par notion. */
export const examTemplates = [
  {
    path: 'CSP',
    version: 1,
    knowledgeCount: 28,
    situationCount: 12,
    durationSeconds: 45 * 60,
    passThreshold: 32,
    regulatoryRef: REGULATORY_REF,
    active: false,
    quotas: [] as Quota[],
  },
  {
    path: 'CSP',
    version: 2,
    knowledgeCount: 28,
    situationCount: 12,
    durationSeconds: 45 * 60,
    passThreshold: 32,
    regulatoryRef: REGULATORY_REF,
    active: true,
    quotas: officialComposition,
  },
  // Même format et même répartition pour les autres mentions (arrêté du 10 octobre 2025, article 3) : à revérifier.
  ...(['CR', 'NAT'] as const).map((path) => ({
    path,
    version: 1,
    knowledgeCount: 28,
    situationCount: 12,
    durationSeconds: 45 * 60,
    passThreshold: 32,
    regulatoryRef: REGULATORY_REF,
    active: true,
    quotas: officialComposition,
  })),
];

/**
 * Offre Premium (décision n° 2 de docs/direction-artistique.md, provisoire) : un pass payé une fois,
 * de durée déterminée, sans renouvellement automatique.
 */
export const plans = [
  {
    code: 'pass-3-mois',
    name: 'Pass 3 mois',
    description:
      'Toutes les questions, examens blancs illimités, révisions espacées et suivi de progression pendant 3 mois. Paiement unique, sans renouvellement automatique.',
    priceCents: 1900,
    currency: 'EUR',
    durationDays: 90,
    active: true,
    position: 1,
  },
  // Packs pour les associations et structures (décision n° 23) : chaque place ouvre 6 mois de Premium à la personne
  // qui l'active, places à activer dans les 12 mois. Prix par personne dégressif.
  {
    code: 'structure-25-places',
    name: 'Pack 25 places',
    description: '25 accès Premium de 6 mois pour les personnes que vous accompagnez, soit 8 € par personne. Paiement unique.',
    priceCents: 20000,
    currency: 'EUR',
    durationDays: 180,
    active: true,
    position: 10,
    audience: 'ORGANIZATION' as const,
    seats: 25,
    activationDays: 365,
  },
  {
    code: 'structure-50-places',
    name: 'Pack 50 places',
    description: '50 accès Premium de 6 mois pour les personnes que vous accompagnez, soit 7 € par personne. Paiement unique.',
    priceCents: 35000,
    currency: 'EUR',
    durationDays: 180,
    active: true,
    position: 11,
    audience: 'ORGANIZATION' as const,
    seats: 50,
    activationDays: 365,
  },
  {
    code: 'structure-100-places',
    name: 'Pack 100 places',
    description: '100 accès Premium de 6 mois pour les personnes que vous accompagnez, soit 6 € par personne. Paiement unique.',
    priceCents: 60000,
    currency: 'EUR',
    durationDays: 180,
    active: true,
    position: 12,
    audience: 'ORGANIZATION' as const,
    seats: 100,
    activationDays: 365,
  },
];
