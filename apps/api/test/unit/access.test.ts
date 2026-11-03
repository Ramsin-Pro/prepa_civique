import { describe, expect, it } from 'vitest';
import { freeSelection } from '../../src/premium/access.js';

// Offre gratuite (décision n° 3) : un nombre fixe de questions par thème, réparties entre les notions.

const question = (id: number, topicId: number, notion: string | null) => ({ id, topicId, notion, reference: `R-${String(id).padStart(3, '0')}` });

describe('questions de l’offre gratuite', () => {
  const questions = [
    question(1, 1, 'devise'),
    question(2, 1, 'devise'),
    question(3, 1, 'devise'),
    question(4, 1, 'devise'),
    question(5, 1, 'laicite'),
    question(6, 1, 'laicite'),
    question(7, 2, null),
    question(8, 2, null),
  ];

  it('ouvre la limite par thème en alternant les notions', () => {
    expect([...freeSelection(questions, new Set(), 3)].sort((a, b) => a - b)).toEqual([1, 2, 5, 7, 8]);
  });

  it('garde ouvertes les questions déjà travaillées, sans dépasser la limite avec les autres', () => {
    // La question 6 a été vue (par exemple pendant l'examen blanc gratuit) : elle reste ouverte et compte dans la limite.
    expect([...freeSelection(questions, new Set([6]), 3)].sort((a, b) => a - b)).toEqual([1, 5, 6, 7, 8]);
  });

  it('donne toujours le même choix', () => {
    const shuffled = [...questions].reverse();
    expect(freeSelection(shuffled, new Set(), 3)).toEqual(freeSelection(questions, new Set(), 3));
  });

  it('ne dépasse jamais la limite par thème, même avec des questions vues en examen blanc', () => {
    // Examens blancs tirés dans toute la banque : quatre questions du thème 1 vues, trois places seulement.
    const allowed = freeSelection(questions, new Set([2, 3, 4, 6]), 3);
    expect([...allowed].filter((id) => id <= 6)).toHaveLength(3);
    expect([...allowed].sort((a, b) => a - b)).toEqual([2, 3, 6, 7, 8]);
  });

  it('garde la sélection habituelle déjà travaillée plutôt que les questions vues ailleurs', () => {
    // 1, 5 et 2 sont la sélection habituelle du thème 1 ; 6 a été vue pendant un examen blanc.
    expect([...freeSelection(questions, new Set([1, 2, 5, 6]), 3)].sort((a, b) => a - b)).toEqual([1, 2, 5, 7, 8]);
  });
});
