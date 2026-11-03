import { describe, expect, it } from 'vitest';
import { questionAsShown } from '../../src/questions/attempt-content.js';
import { correctAnswerOf } from '../../src/questions/logic.js';

// Un examen blanc montre et corrige ses questions telles qu'elles étaient au début de la tentative.

const current = {
  statement: 'Énoncé retouché',
  explanation: 'Explication retouchée, pas encore relue.',
  status: 'IN_REVIEW' as const,
  answers: [
    { id: 11, text: 'Nouvelle bonne réponse', isCorrect: true, position: 1 },
    { id: 12, text: 'Ancienne bonne réponse', isCorrect: false, position: 2 },
    { id: 13, text: 'Troisième', isCorrect: false, position: 3 },
    { id: 14, text: 'Quatrième', isCorrect: false, position: 4 },
  ],
};

const before = {
  statement: 'Énoncé d’origine',
  explanation: 'Explication relue.',
  status: 'PUBLISHED' as const,
  answers: [
    { text: 'Première', isCorrect: false, position: 1 },
    { text: 'Ancienne bonne réponse', isCorrect: true, position: 2 },
    { text: 'Troisième', isCorrect: false, position: 3 },
    { text: 'Quatrième', isCorrect: false, position: 4 },
  ],
};

describe('contenu figé d’une tentative', () => {
  it('reprend le contenu d’avant la modification, dans l’ordre tiré au départ', () => {
    const shown = questionAsShown(current, [13, 11, 14, 12], before);
    expect(shown).toMatchObject({ statement: 'Énoncé d’origine', explanation: 'Explication relue.', status: 'PUBLISHED' });
    expect(shown.answers.map((answer) => answer.text)).toEqual(['Troisième', 'Première', 'Quatrième', 'Ancienne bonne réponse']);
    // La correction se fait avec la bonne réponse d'alors, sur la même ligne.
    expect(correctAnswerOf(shown.answers)).toBe(12);
  });

  it('montre le contenu actuel quand la question n’a pas changé depuis le début', () => {
    const shown = questionAsShown(current, [12, 11, 13, 14]);
    expect(shown.statement).toBe('Énoncé retouché');
    expect(correctAnswerOf(shown.answers)).toBe(11);
  });

  it('ignore une proposition ajoutée après le tirage', () => {
    const withExtra = { ...current, answers: [...current.answers, { id: 15, text: 'Ajoutée ensuite', isCorrect: false, position: 0 }] };
    expect(questionAsShown(withExtra, [11, 12, 13, 14], before).answers.map((answer) => answer.id)).toEqual([11, 12, 13, 14]);
  });
});
