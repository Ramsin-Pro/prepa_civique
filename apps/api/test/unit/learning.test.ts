import { describe, expect, it } from 'vitest';
import { findGlossaryTerms } from '../../src/questions/glossary.js';
import { BOX_INTERVAL_DAYS, MASTERED_BOX, nextState, prioritize, recommend } from '../../src/questions/learning.js';
import { NotEnoughQuestionsError, drawWithQuotas, type PoolQuestion } from '../../src/questions/logic.js';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-10-31T10:00:00Z');

describe('nextState (répétition espacée)', () => {
  it('une première bonne réponse fait revenir la question le lendemain', () => {
    const state = nextState(null, true, now);
    expect(state.box).toBe(2);
    expect(state.dueAt.getTime() - now.getTime()).toBe(BOX_INTERVAL_DAYS[1] * DAY);
    expect(state).toMatchObject({ attempts: 1, correctCount: 1, lastCorrect: true });
  });

  it('une erreur renvoie la question en boîte 1, à revoir tout de suite', () => {
    const state = nextState({ box: 4, attempts: 5, correctCount: 4 }, false, now);
    expect(state.box).toBe(1);
    expect(state.dueAt.getTime()).toBe(now.getTime());
    expect(state).toMatchObject({ attempts: 6, correctCount: 4, lastCorrect: false });
  });

  it('espace de plus en plus les révisions, sans dépasser la dernière boîte', () => {
    let state = nextState(null, true, now);
    for (let i = 0; i < 10; i++) state = nextState(state, true, now);
    expect(state.box).toBe(BOX_INTERVAL_DAYS.length);
    expect(state.box).toBeGreaterThanOrEqual(MASTERED_BOX);
  });
});

describe('prioritize', () => {
  it('place d’abord les questions à revoir, puis les nouvelles, puis les autres par date', () => {
    const states = new Map([
      [1, { dueAt: new Date(now.getTime() + 3 * DAY) }],
      [2, { dueAt: new Date(now.getTime() - DAY) }],
      [3, { dueAt: new Date(now.getTime() + DAY) }],
    ]);
    const order = prioritize([1, 2, 3, 4], states, now);
    expect(order[0]).toBe(2); // à revoir
    expect(order[1]).toBe(4); // jamais vue
    expect(order.slice(2)).toEqual([3, 1]); // révision la plus proche d'abord
  });
});

describe('recommend', () => {
  const topic = (slug: string, total: number, seen: number, mastered: number, toReview = 0) => ({
    slug,
    title: slug,
    total,
    seen,
    mastered,
    toReview,
  });

  it('propose d’abord les révisions en attente', () => {
    expect(recommend([topic('a', 10, 5, 2, 3), topic('b', 10, 0, 0)])).toEqual({ kind: 'review', count: 3 });
  });

  it('sinon le thème le moins maîtrisé', () => {
    expect(recommend([topic('a', 10, 8, 6), topic('b', 10, 2, 1)])).toMatchObject({ kind: 'topic', slug: 'b' });
  });

  it('propose un examen blanc quand tout est acquis', () => {
    expect(recommend([topic('a', 2, 2, 2)])).toEqual({ kind: 'exam' });
  });
});

describe('drawWithQuotas', () => {
  const pool: PoolQuestion[] = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: 10 + i, kind: 'knowledge' as const, topicId: 1, notion: 'symboles' })),
    ...Array.from({ length: 1 }, (_, i) => ({ id: 20 + i, kind: 'knowledge' as const, topicId: 1, notion: 'laicite' })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: 30 + i, kind: 'situation' as const, topicId: 1, notion: null })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: 40 + i, kind: 'knowledge' as const, topicId: 2, notion: 'vote' })),
  ];

  it('respecte le nombre de questions par thème, famille et notion', () => {
    const drawn = drawWithQuotas(pool, [
      { topicId: 1, kind: 'knowledge', notion: 'symboles', count: 3 },
      { topicId: 1, kind: 'situation', notion: null, count: 6 },
      { topicId: 2, kind: 'knowledge', notion: 'vote', count: 2 },
    ]);
    expect(drawn).toHaveLength(11);
    expect(new Set(drawn).size).toBe(11);
    expect(drawn.filter((id) => id >= 10 && id < 20)).toHaveLength(3);
    expect(drawn.filter((id) => id >= 30 && id < 40)).toHaveLength(6);
    expect(drawn.filter((id) => id >= 40)).toHaveLength(2);
  });

  it('complète une notion trop peu fournie avec le même thème et la même famille', () => {
    const drawn = drawWithQuotas(pool, [{ topicId: 1, kind: 'knowledge', notion: 'laicite', count: 2 }]);
    expect(drawn).toHaveLength(2);
    expect(drawn).toContain(20);
  });

  it('échoue clairement quand le thème lui-même manque de questions', () => {
    expect(() => drawWithQuotas(pool, [{ topicId: 2, kind: 'knowledge', notion: null, count: 5 }])).toThrow(NotEnoughQuestionsError);
  });
});

describe('findGlossaryTerms', () => {
  const entries = [
    { term: 'suffrage universel', definition: 'Tous les citoyens majeurs peuvent voter.' },
    { term: 'suffrage', definition: 'Le vote.' },
    { term: 'laïcité', definition: 'L’État ne favorise aucune religion.' },
    { term: 'préfet', definition: 'Représentant de l’État dans le département.' },
  ];

  it('trouve les mots entiers, au pluriel, sans tenir compte des majuscules', () => {
    const found = findGlossaryTerms(['La Laïcité garantit la liberté. Les préfets représentent l’État.'], entries);
    expect(found.map((entry) => entry.term)).toEqual(expect.arrayContaining(['laïcité', 'préfet']));
  });

  it('préfère l’expression la plus longue et ne répète pas le mot court', () => {
    const found = findGlossaryTerms(['Le président est élu au suffrage universel direct.'], entries);
    expect(found.map((entry) => entry.term)).toEqual(['suffrage universel']);
  });

  it('ne trouve pas un mot à l’intérieur d’un autre', () => {
    expect(findGlossaryTerms(['La préfecture est ouverte.'], entries)).toEqual([]);
  });
});
