import { describe, expect, it } from 'vitest';
import {
  ANSWER_GRACE_MS,
  NotEnoughQuestionsError,
  canStillAnswer,
  correctAnswerOf,
  drawExamQuestions,
  kindOf,
  scoreExam,
  shuffle,
  type Rng,
} from '../../src/questions/logic.js';

/** Aléa déterministe pour des tests reproductibles. */
function seededRng(seed = 42): Rng {
  let state = seed;
  return (maxExclusive) => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state % maxExclusive;
  };
}

describe('shuffle', () => {
  it('renvoie une permutation sans modifier le tableau d’origine', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const result = shuffle(items, seededRng());
    expect(result).toHaveLength(items.length);
    expect([...result].sort()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('gère les tableaux vides et à un élément', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['seul'])).toEqual(['seul']);
  });
});

describe('kindOf', () => {
  it('range les mises en situation à part des questions de connaissance', () => {
    expect(kindOf('OFFICIAL_KNOWLEDGE')).toBe('knowledge');
    expect(kindOf('ORIGINAL_KNOWLEDGE')).toBe('knowledge');
    expect(kindOf('ORIGINAL_SITUATION')).toBe('situation');
  });
});

describe('correctAnswerOf', () => {
  it('renvoie la seule bonne réponse', () => {
    expect(correctAnswerOf([{ id: 1, isCorrect: false }, { id: 2, isCorrect: true }])).toBe(2);
  });

  it('refuse une question sans bonne réponse ou avec plusieurs', () => {
    expect(() => correctAnswerOf([{ id: 1, isCorrect: false }])).toThrow();
    expect(() => correctAnswerOf([{ id: 1, isCorrect: true }, { id: 2, isCorrect: true }])).toThrow();
  });
});

describe('drawExamQuestions', () => {
  const pool = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: i + 1, kind: 'knowledge' as const })),
    ...Array.from({ length: 15 }, (_, i) => ({ id: 100 + i, kind: 'situation' as const })),
  ];

  it('respecte la répartition du modèle d’examen, sans doublon', () => {
    const drawn = drawExamQuestions(pool, { knowledge: 28, situation: 12 }, seededRng());
    expect(drawn).toHaveLength(40);
    expect(new Set(drawn).size).toBe(40);
    expect(drawn.filter((id) => id >= 100)).toHaveLength(12);
  });

  it('signale le type de question qui manque', () => {
    expect(() => drawExamQuestions(pool, { knowledge: 28, situation: 20 })).toThrow(NotEnoughQuestionsError);
    try {
      drawExamQuestions(pool, { knowledge: 31, situation: 12 });
    } catch (error) {
      expect(error).toBeInstanceOf(NotEnoughQuestionsError);
      expect((error as NotEnoughQuestionsError).kind).toBe('knowledge');
      expect((error as NotEnoughQuestionsError).available).toBe(30);
    }
  });
});

describe('scoreExam', () => {
  const principes = { slug: 'principes', title: 'Principes' };
  const histoire = { slug: 'histoire', title: 'Histoire' };

  it('compte les bonnes réponses, et une absence de réponse comme une erreur', () => {
    const result = scoreExam(
      [
        { topic: principes, chosenAnswerId: 1, correctAnswerId: 1 },
        { topic: principes, chosenAnswerId: 2, correctAnswerId: 3 },
        { topic: histoire, chosenAnswerId: null, correctAnswerId: 5 },
        { topic: histoire, chosenAnswerId: 7, correctAnswerId: 7 },
      ],
      2,
    );
    expect(result.score).toBe(2);
    expect(result.total).toBe(4);
    expect(result.byTopic).toEqual([
      { ...principes, correct: 1, total: 2 },
      { ...histoire, correct: 1, total: 2 },
    ]);
  });

  it('atteint le seuil à égalité exacte (32 sur 40)', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      topic: principes,
      chosenAnswerId: i < 32 ? 1 : 2,
      correctAnswerId: 1,
    }));
    expect(scoreExam(items, 32).thresholdReached).toBe(true);
    expect(scoreExam(items.slice(1), 32).thresholdReached).toBe(false);
  });
});

describe('canStillAnswer', () => {
  const expiresAt = new Date('2026-10-31T10:45:00Z');

  it('accepte une réponse avant la fin et pendant la marge de latence', () => {
    expect(canStillAnswer(expiresAt, new Date('2026-10-31T10:44:59Z'))).toBe(true);
    expect(canStillAnswer(expiresAt, new Date(expiresAt.getTime() + ANSWER_GRACE_MS))).toBe(true);
  });

  it('refuse une réponse après la marge', () => {
    expect(canStillAnswer(expiresAt, new Date(expiresAt.getTime() + ANSWER_GRACE_MS + 1))).toBe(false);
  });
});
