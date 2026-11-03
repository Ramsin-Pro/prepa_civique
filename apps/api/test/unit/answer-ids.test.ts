import { describe, expect, it } from 'vitest';
import { answerToken, answerTokenSchema, findByToken } from '../../src/questions/answer-ids.js';

// Identifiants opaques des propositions : rien dans ce que reçoit le candidat ne doit refléter le numéro en base.

describe('identifiants opaques des propositions', () => {
  const answers = [101, 102, 103, 104].map((id) => ({ id, text: `Proposition ${id}` }));

  it('sont courts, sûrs dans une adresse, stables et propres à chaque proposition', () => {
    const tokens = answers.map((answer) => answerToken(answer.id));
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{16}$/);
      expect(answerTokenSchema.safeParse(token).success).toBe(true);
    }
    expect(new Set(tokens).size).toBe(4);
    expect(answers.map((answer) => answerToken(answer.id))).toEqual(tokens);
  });

  it('retrouvent la proposition désignée, et seulement parmi celles de la question', () => {
    expect(findByToken(answers, answerToken(103))).toBe(answers[2]);
    expect(findByToken(answers, answerToken(999))).toBeUndefined();
  });

  it('refusent un numéro ou un texte quelconque', () => {
    expect(answerTokenSchema.safeParse(101).success).toBe(false);
    expect(answerTokenSchema.safeParse('101').success).toBe(false);
    expect(answerTokenSchema.safeParse('../../admin/users').success).toBe(false);
  });
});
