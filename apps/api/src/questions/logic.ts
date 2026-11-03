import { randomInt } from 'node:crypto';

// Logique pure du moteur QCM : sans base de données, donc testable unitairement.

/** Renvoie un entier aléatoire dans [0, maxExclusive). Injecté pour rendre les tests déterministes. */
export type Rng = (maxExclusive: number) => number;

const secureRng: Rng = (maxExclusive) => randomInt(maxExclusive);

/** Mélange de Fisher-Yates. L'aléa cryptographique évite qu'on devine l'ordre des réponses. */
export function shuffle<T>(items: readonly T[], rng: Rng = secureRng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng(i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export type QuestionKind = 'knowledge' | 'situation';

export function kindOf(type: 'OFFICIAL_KNOWLEDGE' | 'ORIGINAL_KNOWLEDGE' | 'ORIGINAL_SITUATION'): QuestionKind {
  return type === 'ORIGINAL_SITUATION' ? 'situation' : 'knowledge';
}

/** Une question publiée doit avoir exactement une bonne réponse (format officiel : 4 propositions, 1 bonne réponse). */
export function correctAnswerOf(answers: readonly { id: number; isCorrect: boolean }[]): number {
  const correct = answers.filter((answer) => answer.isCorrect);
  if (correct.length !== 1) {
    throw new Error(`Une question doit avoir exactement une bonne réponse (trouvé : ${correct.length}).`);
  }
  return correct[0]!.id;
}

export class NotEnoughQuestionsError extends Error {
  constructor(
    readonly kind: QuestionKind,
    readonly needed: number,
    readonly available: number,
    readonly topicId?: number,
  ) {
    super(`Questions « ${kind} » insuffisantes${topicId ? ` (thème ${topicId})` : ''} : ${available} disponibles pour ${needed} demandées.`);
  }
}

export type PoolQuestion = { id: number; kind: QuestionKind; topicId: number; notion: string | null };
export type Quota = { topicId: number; kind: QuestionKind; notion: string | null; count: number };

/**
 * Tire un examen blanc selon la répartition officielle par thème, famille et notion (A04).
 * Les quotas les plus précis passent d'abord. Si une notion manque de questions, le reste
 * est pris dans le même thème et la même famille, pour garder le bon nombre par thème.
 */
export function drawWithQuotas(pool: readonly PoolQuestion[], quotas: readonly Quota[], rng: Rng = secureRng): number[] {
  const used = new Set<number>();
  const picked: number[] = [];
  const shortfalls: Quota[] = [];

  const take = (candidates: PoolQuestion[], count: number) => {
    const chosen = shuffle(candidates, rng).slice(0, count);
    for (const question of chosen) {
      used.add(question.id);
      picked.push(question.id);
    }
    return chosen.length;
  };

  const specificFirst = [...quotas].sort((a, b) => Number(b.notion !== null) - Number(a.notion !== null));
  for (const quota of specificFirst) {
    const candidates = pool.filter(
      (q) => !used.has(q.id) && q.topicId === quota.topicId && q.kind === quota.kind && (quota.notion === null || q.notion === quota.notion),
    );
    const taken = take(candidates, quota.count);
    if (taken < quota.count) shortfalls.push({ ...quota, notion: null, count: quota.count - taken });
  }

  for (const quota of shortfalls) {
    const candidates = pool.filter((q) => !used.has(q.id) && q.topicId === quota.topicId && q.kind === quota.kind);
    if (candidates.length < quota.count) {
      throw new NotEnoughQuestionsError(quota.kind, quota.count, candidates.length, quota.topicId);
    }
    take(candidates, quota.count);
  }

  return shuffle(picked, rng);
}

/** Tire au sort les questions d'un examen blanc selon le seul nombre de questions par famille. */
export function drawExamQuestions(
  pool: readonly { id: number; kind: QuestionKind }[],
  counts: Record<QuestionKind, number>,
  rng: Rng = secureRng,
): number[] {
  const pick = (kind: QuestionKind) => {
    const candidates = pool.filter((question) => question.kind === kind);
    if (candidates.length < counts[kind]) {
      throw new NotEnoughQuestionsError(kind, counts[kind], candidates.length);
    }
    return shuffle(candidates, rng)
      .slice(0, counts[kind])
      .map((question) => question.id);
  };
  return shuffle([...pick('knowledge'), ...pick('situation')], rng);
}

export type ScoredItem = {
  topic: { slug: string; title: string };
  chosenAnswerId: number | null;
  correctAnswerId: number;
};

export type ExamScore = {
  score: number;
  total: number;
  passThreshold: number;
  thresholdReached: boolean;
  byTopic: { slug: string; title: string; correct: number; total: number }[];
};

/** Calcule le score côté serveur à partir des réponses enregistrées. Une question sans réponse compte comme fausse. */
export function scoreExam(items: readonly ScoredItem[], passThreshold: number): ExamScore {
  const byTopic = new Map<string, ExamScore['byTopic'][number]>();
  let score = 0;

  for (const item of items) {
    const correct = item.chosenAnswerId !== null && item.chosenAnswerId === item.correctAnswerId;
    if (correct) score++;
    const topic = byTopic.get(item.topic.slug) ?? { ...item.topic, correct: 0, total: 0 };
    topic.total++;
    if (correct) topic.correct++;
    byTopic.set(item.topic.slug, topic);
  }

  return { score, total: items.length, passThreshold, thresholdReached: score >= passThreshold, byTopic: [...byTopic.values()] };
}

/** Marge accordée à une réponse envoyée juste avant la fin du temps (latence réseau). */
export const ANSWER_GRACE_MS = 5_000;

export function canStillAnswer(expiresAt: Date, now: Date): boolean {
  return now.getTime() <= expiresAt.getTime() + ANSWER_GRACE_MS;
}
