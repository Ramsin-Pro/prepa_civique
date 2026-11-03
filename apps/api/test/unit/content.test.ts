import { describe, expect, it } from 'vitest';
import { answersForInsert, formCues, harmonizeAnswers } from '../../src/seed/content.js';

describe('answersForInsert', () => {
  const answers = ['La bonne réponse', 'Deuxième', 'Troisième', 'Quatrième'];

  it('garde les quatre propositions et une seule bonne réponse, la première du fichier', () => {
    const rows = answersForInsert(answers);
    expect(rows.map((row) => row.text).sort()).toEqual([...answers].sort());
    expect(rows.filter((row) => row.isCorrect)).toEqual([{ text: 'La bonne réponse', isCorrect: true }]);
  });

  it('ne met pas toujours la bonne réponse en premier', () => {
    const firstPositions = new Set(Array.from({ length: 200 }, () => answersForInsert(answers).findIndex((row) => row.isCorrect)));
    expect(firstPositions.size).toBeGreaterThan(1);
  });
});

describe('harmonizeAnswers', () => {
  it('retire le point final si toutes les propositions ne l’ont pas', () => {
    expect(harmonizeAnswers(['Il dirige la commune.', 'Il juge', 'Il vote les lois', 'Il commande l’armée'])).toEqual([
      'Il dirige la commune',
      'Il juge',
      'Il vote les lois',
      'Il commande l’armée',
    ]);
  });

  it('garde les points quand les quatre propositions en ont un', () => {
    const answers = ['Vous refusez.', 'Vous acceptez.', 'Vous partez.', 'Vous attendez.'];
    expect(harmonizeAnswers(answers)).toEqual(answers);
  });

  it('ne touche pas aux points de suspension', () => {
    expect(harmonizeAnswers(['Oui...', 'Non', 'Peut-être', 'Jamais'])).toEqual(['Oui...', 'Non', 'Peut-être', 'Jamais']);
  });
});

describe('formCues', () => {
  it('repère une bonne réponse beaucoup plus longue que les autres', () => {
    expect(formCues(['La loi garantit la liberté de conscience de chacun', 'Non', 'Jamais', 'Parfois'])).toHaveLength(1);
  });

  it('repère les propositions passe-partout « toutes » ou « aucune »', () => {
    expect(formCues(['1958', '1946', '1789', 'Toutes les réponses'])).toHaveLength(1);
    expect(formCues(['1958', '1946', '1789', 'Aucune de ces propositions'])).toHaveLength(1);
  });

  it('accepte une phrase ordinaire qui commence par « Toutes » ou « Aucune »', () => {
    expect(formCues(['Toutes les personnes en France', 'Les Français seulement', 'Les majeurs seulement', 'Les électeurs seulement'])).toEqual([]);
    expect(formCues(['Une amende ou de la prison', 'Aucune sanction la première fois', 'Un simple avertissement', 'Une sanction pour les Français'])).toEqual([]);
  });

  it('ne signale rien sur des propositions équilibrées', () => {
    expect(formCues(['Bleu, blanc, rouge', 'Bleu, blanc, vert', 'Rouge, blanc, noir', 'Vert, blanc, rouge'])).toEqual([]);
  });
});
