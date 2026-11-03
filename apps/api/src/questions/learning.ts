import { shuffle, type Rng } from './logic.js';

// Moteur d'apprentissage : répétition espacée en 5 boîtes (méthode de Leitner).
// Une erreur renvoie la question en boîte 1, à revoir tout de suite. Chaque bonne réponse la fait monter
// d'une boîte et espace la révision suivante. Logique pure : testable sans base de données.

/** Délai avant la révision suivante, en jours, pour les boîtes 1 à 5. */
export const BOX_INTERVAL_DAYS = [0, 1, 3, 7, 16] as const;
export const MAX_BOX = BOX_INTERVAL_DAYS.length;
/** À partir de la boîte 4, la question a été réussie plusieurs fois à quelques jours d'écart : elle est acquise. */
export const MASTERED_BOX = 4;

const DAY_MS = 24 * 60 * 60 * 1000;

export type LearnerState = {
  box: number;
  attempts: number;
  correctCount: number;
  lastCorrect: boolean;
  lastAnsweredAt: Date;
  dueAt: Date;
};

export function nextState(
  previous: Pick<LearnerState, 'box' | 'attempts' | 'correctCount'> | null,
  correct: boolean,
  now: Date,
): LearnerState {
  const box = correct ? Math.min((previous?.box ?? 1) + 1, MAX_BOX) : 1;
  return {
    box,
    attempts: (previous?.attempts ?? 0) + 1,
    correctCount: (previous?.correctCount ?? 0) + (correct ? 1 : 0),
    lastCorrect: correct,
    lastAnsweredAt: now,
    dueAt: new Date(now.getTime() + BOX_INTERVAL_DAYS[box - 1]! * DAY_MS),
  };
}

export const isDue = (state: { dueAt: Date }, now: Date) => state.dueAt.getTime() <= now.getTime();

/**
 * Ordre d'une série d'entraînement : d'abord les questions à revoir, puis les nouvelles,
 * puis celles dont la révision approche. Le hasard ne joue qu'à l'intérieur de chaque groupe.
 */
export function prioritize(
  ids: readonly number[],
  states: ReadonlyMap<number, { dueAt: Date }>,
  now: Date,
  rng?: Rng,
): number[] {
  const due: number[] = [];
  const unseen: number[] = [];
  const later: number[] = [];
  for (const id of ids) {
    const state = states.get(id);
    if (!state) unseen.push(id);
    else if (isDue(state, now)) due.push(id);
    else later.push(id);
  }
  later.sort((a, b) => states.get(a)!.dueAt.getTime() - states.get(b)!.dueAt.getTime());
  return [...shuffle(due, rng), ...shuffle(unseen, rng), ...later];
}

export type TopicProgress = {
  slug: string;
  title: string;
  total: number;
  seen: number;
  mastered: number;
  toReview: number;
};

/**
 * Conseil affiché sur la page de progression. Jamais de prédiction de réussite (E13) :
 * seulement la prochaine chose utile à faire.
 */
export function recommend(topics: readonly TopicProgress[]):
  | { kind: 'review'; count: number }
  | { kind: 'topic'; slug: string; title: string }
  | { kind: 'exam' } {
  const toReview = topics.reduce((sum, topic) => sum + topic.toReview, 0);
  if (toReview > 0) return { kind: 'review', count: toReview };

  const open = topics.filter((topic) => topic.total > 0 && topic.mastered < topic.total);
  if (open.length === 0) return { kind: 'exam' };
  const weakest = [...open].sort((a, b) => a.mastered / a.total - b.mastered / b.total || a.seen - b.seen)[0]!;
  return { kind: 'topic', slug: weakest.slug, title: weakest.title };
}
