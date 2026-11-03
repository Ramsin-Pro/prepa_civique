// Formes des réponses de l'API Express (apps/api).

export type QuestionType = 'OFFICIAL_KNOWLEDGE' | 'ORIGINAL_KNOWLEDGE' | 'ORIGINAL_SITUATION';

export type SourceRef = { label: string; url: string | null };
export type AnswerSource = SourceRef & { licence: string | null };

export type GlossaryEntry = { term: string; definition: string };

export type TopicSummary = { slug: string; title: string; questionCount: number };

export type PathSummary = {
  code: string;
  slug: string;
  title: string;
  description: string;
  active: boolean;
  /** Sources officielles du parcours et date de leur dernière vérification (E03). */
  sources: { label: string; url: string }[];
  verifiedAt: string | null;
  topics: TopicSummary[];
};

/** topic : un thème ; mixed : tous les thèmes ; review : questions à revoir ; favorites : questions mises de côté ;
 * errors : questions manquées à la dernière réponse. */
export type TrainingMode = 'topic' | 'mixed' | 'review' | 'favorites' | 'errors';

/**
 * Identifiant opaque d'une proposition (jamais son numéro en base, qui pourrait trahir la bonne réponse).
 * Il se renvoie tel quel à l'API pour répondre ou pour lire les propositions dans l'ordre affiché.
 */
export type AnswerId = string;

export type PublicAnswer = { id: AnswerId; text: string };

export type PublicQuestion = {
  id: number;
  reference: string;
  type: QuestionType;
  inReview: boolean;
  favorite: boolean;
  statement: string;
  topic: { slug: string; title: string };
  statementSource: SourceRef | null;
  answers: PublicAnswer[];
  glossary: GlossaryEntry[];
};

export type CheckResult = {
  correct: boolean;
  correctAnswerId: AnswerId;
  explanation: string;
  answerSource: AnswerSource | null;
  verifiedAt: string | null;
  glossary: GlossaryEntry[];
  nextReviewAt: string;
  /** Fiche de révision de la notion (E09), si elle existe. */
  sheet: { slug: string; title: string } | null;
};

export type TopicProgress = {
  slug: string;
  title: string;
  total: number;
  seen: number;
  mastered: number;
  toReview: number;
  accuracy: number | null;
};

export type Recommendation =
  | { kind: 'review'; count: number }
  | { kind: 'topic'; slug: string; title: string }
  | { kind: 'exam' };

export type ExamSummary = {
  id: string;
  endedAt: string;
  score: number | null;
  total: number;
  passThreshold: number;
  thresholdReached: boolean;
};

export type Progress = {
  path: { slug: string; title: string };
  totals: { questions: number; seen: number; mastered: number; toReview: number; errors: number; favorites: number };
  nextReviewAt: string | null;
  topics: TopicProgress[];
  recommendation: Recommendation;
  exams: ExamSummary[];
};

export type ExamTemplateSummary = {
  path: { slug: string; title: string };
  version: number;
  questionCount: number;
  knowledgeCount: number;
  situationCount: number;
  durationSeconds: number;
  passThreshold: number;
  regulatoryRef: string | null;
  composition: { topic: { slug: string; title: string }; knowledge: number; situation: number }[];
  available: boolean;
  /** Examens blancs encore possibles : illimités en Premium (null), limités dans l'offre gratuite. */
  access: { premium: boolean; freeExamsLeft: number | null };
};

export type ExamHistory = {
  active: { id: string; startedAt: string; expiresAt: string } | null;
  finished: ExamSummary[];
};

export type ExamQuestion = {
  position: number;
  id: number;
  type: QuestionType;
  inReview: boolean;
  statement: string;
  topic: { slug: string; title: string };
  statementSource: SourceRef | null;
  answers: PublicAnswer[];
  answerId: AnswerId | null;
};

export type ExamCorrection = {
  position: number;
  questionId: number;
  chosenAnswerId: AnswerId | null;
  correctAnswerId: AnswerId;
  correct: boolean;
  explanation: string;
  answerSource: AnswerSource | null;
  sheet: { slug: string; title: string } | null;
};

export type ExamResult = {
  score: number;
  total: number;
  passThreshold: number;
  thresholdReached: boolean;
  byTopic: { slug: string; title: string; correct: number; total: number }[];
  corrections: ExamCorrection[];
};

export type ExamView = {
  id: string;
  path: { slug: string; title: string };
  templateVersion: number;
  durationSeconds: number;
  passThreshold: number;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  questions: ExamQuestion[];
  result: ExamResult | null;
};

// ─── Comptes, Premium et paiement ────────────────────────────────────────────

export type Role = 'LEARNER' | 'READONLY' | 'SUPPORT' | 'EDITOR' | 'SUPER_ADMIN';

export type Me = {
  id: string;
  email: string;
  role: Role;
  staff: boolean;
  emailVerified: boolean;
  marketingConsent: boolean;
  reminders: boolean;
  examDate: string | null;
  path: { slug: string; title: string } | null;
  premium: { active: boolean; until: string | null };
  organization: { owned: string | null; memberOf: string | null };
  mfa: { enabled: boolean; verified: boolean; required: boolean };
};

export type Plan = {
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  durationDays: number;
};

export type PaymentProvider = 'stripe' | 'simulation' | 'none';

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'REFUNDED';

export type CheckoutOrder = {
  id: string;
  status: OrderStatus;
  amountCents: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  plan: { name: string; durationDays: number; audience?: 'INDIVIDUAL' | 'ORGANIZATION'; seats?: number | null };
  entitlement: { expiresAt: string } | null;
  /** Pack de places d'une structure, une fois le paiement confirmé. */
  license?: { seats: number; validUntil: string } | null;
  organization?: { name: string } | null;
};

export type Account = {
  email: string;
  createdAt: string;
  marketingConsentAt: string | null;
  reminderOptInAt: string | null;
  examDate: string | null;
  path: { slug: string; title: string } | null;
  premium: { active: boolean; until: string | null };
  orders: {
    id: string;
    status: OrderStatus;
    amountCents: number;
    currency: string;
    paidAt: string | null;
    refundedAt: string | null;
    plan: { name: string };
    entitlement: { startsAt: string; expiresAt: string } | null;
    organization: { name: string } | null;
  }[];
  /** Places offertes par une structure. */
  memberships: { id: number; organizationName: string; joinedAt: string; accessUntil: string; shareProgress: boolean }[];
  /** Nom de la structure dont la personne gère l'espace, s'il y en a une. */
  ownedOrganization: string | null;
  /** Prolongation gratuite d'un pass en cours (examen repoussé), une fois. */
  extension: { days: number; available: boolean };
};

/** Accès de l'offre gratuite renvoyé avec les questions d'entraînement. */
export type TrainingAccess = { premium: boolean; freeQuestionsPerTopic: number; locked: number };

// ─── Associations et structures ──────────────────────────────────────────────

export type OrganizationKind = 'association' | 'centre-social' | 'formation' | 'collectivite' | 'autre';

/** Pack de places proposé aux structures. */
export type OrganizationPlan = {
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  /** Durée de l'accès offert à chaque personne, en jours. */
  durationDays: number;
  seats: number;
  activationDays: number | null;
};

export type OrganizationOffer = { plans: OrganizationPlan[]; paymentProvider: PaymentProvider; kinds: OrganizationKind[] };

/** Ce que voit une personne qui ouvre un lien d'invitation. */
export type JoinInfo = {
  name: string;
  kind: OrganizationKind;
  city: string | null;
  seatsAvailable: boolean;
  seatDays: number | null;
  alreadyMember: boolean;
};

export type MemberProgress = { answered: number; mastered: number; bestExam: number | null; lastActivityAt: string | null; weakTopics: string[] };

/** Affiche d'invitation à imprimer (le QR code est un SVG produit par l'API). */
export type InvitationPoster = { name: string; inviteCode: string; inviteUrl: string; qrSvg: string };

/** Espace de la structure, vu par son coordinateur. */
export type OrganizationSpace = {
  id: string;
  name: string;
  kind: OrganizationKind;
  city: string | null;
  registration: string | null;
  contactName: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  inviteCode: string;
  inviteUrl: string;
  seats: { total: number; used: number; free: number };
  licenses: {
    id: number;
    seats: number;
    seatDays: number;
    validUntil: string;
    priceCents: number;
    source: 'commande' | 'virement' | 'pilote';
    revokedAt: string | null;
    createdAt: string;
    used: number;
    open: boolean;
  }[];
  /**
   * Chiffres du groupe (à partir de minGroupForAverages personnes). Un indicateur vaut null quand il est masqué : il mêlerait
   * de 1 à 4 personnes qui ne partagent pas leur progression. averageBestExam vaut aussi null si personne n'a d'examen.
   */
  group: {
    activeLast7Days: number | null;
    withExam: number | null;
    averageBestExam: number | null;
    weakTopics: { title: string; count: number }[] | null;
  } | null;
  minGroupForAverages: number;
  members: {
    id: number;
    joinedAt: string;
    /** Seulement si la personne partage sa progression : la date dirait qu'elle avait déjà un pass. */
    accessUntil: string | null;
    shared: boolean;
    email: string;
    progress: MemberProgress | null;
  }[];
};
