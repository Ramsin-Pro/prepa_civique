import { describe, expect, it } from 'vitest';
import { MIN_GROUP_FOR_AVERAGES, groupStatistics, shiftAfterRevocations } from '../../src/organizations/service.js';

// Révocation d'un accès suivi d'un autre (remboursement, litige, place retirée) et chiffres de groupe sans personne
// reconnaissable dans l'espace des structures.

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-02T10:00:00Z');
const at = (days: number) => new Date(now.getTime() + days * DAY);
const access = (id: number, startsAt: number, expiresAt: number, userId = 'personne-1') => ({ id, userId, startsAt: at(startsAt), expiresAt: at(expiresAt) });

describe('accès suivants après une révocation', () => {
  // Pass de 90 jours acheté il y a 10 jours, puis un deuxième il y a 5 jours : il s'ajoute à la fin du premier.
  const first = access(1, -10, 80);
  const second = access(2, -5, 170);

  it('avance le pass suivant de ce qui restait au pass révoqué', () => {
    expect(shiftAfterRevocations([first], [second], now)).toEqual([{ ...second, expiresAt: at(90) }]);
  });

  it('ne retire que la part propre d’un pass placé au milieu', () => {
    const third = access(3, -1, 260);
    // Le deuxième pass couvrait les jours 80 à 170 : le troisième finit 90 jours plus tôt, le premier ne change pas.
    expect(shiftAfterRevocations([second], [first, third], now)).toEqual([{ ...third, expiresAt: at(170) }]);
  });

  it('ne change rien quand l’accès révoqué était déjà écoulé', () => {
    expect(shiftAfterRevocations([access(1, -100, -10)], [access(2, -20, 80)], now)).toEqual([]);
  });

  it('fait commencer plus tôt un accès pas encore commencé, jamais avant maintenant', () => {
    const seat = access(1, -30, 150);
    const pass = access(2, 150, 240);
    expect(shiftAfterRevocations([seat], [pass], now)).toEqual([{ ...pass, startsAt: now, expiresAt: at(90) }]);
  });

  it('révoque plusieurs accès d’une même personne, dans n’importe quel ordre', () => {
    const third = access(3, -1, 260);
    expect(shiftAfterRevocations([first, second], [third], now)).toEqual([{ ...third, expiresAt: at(90) }]);
    expect(shiftAfterRevocations([second, first], [third], now)).toEqual([{ ...third, expiresAt: at(90) }]);
  });

  it('ne touche pas aux accès d’une autre personne', () => {
    expect(shiftAfterRevocations([first], [access(5, -5, 170, 'personne-2')], now)).toEqual([]);
  });

  it('ne retire rien quand un accès pris avant couvrait déjà toute la période révoquée', () => {
    // Accès offert de 30 jours, puis pass inscrit à la main sur une journée : le rembourser n'enlève rien à l'accès offert.
    expect(shiftAfterRevocations([access(2, 0, 1)], [access(1, 0, 30)], now)).toEqual([]);
    // Pass prolongé (110 jours) puis place courte ajoutée à sa fin d'origine (87 jours) : retirer la place laisse le pass.
    expect(shiftAfterRevocations([access(2, -5, 87)], [access(1, -10, 110)], now)).toEqual([]);
  });
});

describe('chiffres du groupe', () => {
  const member = (shared: boolean, options: { exam?: number; active?: boolean; weak?: string[] } = {}) => ({
    shared,
    bestExam: options.exam ?? null,
    lastActivityAt: options.active ? at(-1) : null,
    weakTopics: options.weak ?? [],
  });
  const sharing = (count: number, options?: Parameters<typeof member>[1]) => Array.from({ length: count }, () => member(true, options));
  const discreet = (count: number, options?: Parameters<typeof member>[1]) => Array.from({ length: count }, () => member(false, options));

  it('n’affiche rien sous le seuil du groupe', () => {
    expect(groupStatistics(sharing(MIN_GROUP_FOR_AVERAGES - 1), now)).toBeNull();
  });

  it('publie tout quand chacun partage sa progression', () => {
    const group = groupStatistics([member(true, { exam: 30, active: true, weak: ['Laïcité'] }), ...sharing(4)], now);
    expect(group).toEqual({ activeLast7Days: 1, withExam: 1, averageBestExam: 30, weakTopics: [{ title: 'Laïcité', count: 1 }] });
  });

  it('masque chaque chiffre où entrent de 1 à 4 personnes discrètes, quelles que soient leurs données', () => {
    const masked = { activeLast7Days: null, withExam: null, averageBestExam: null, weakTopics: null };
    // Avec 4 personnes qui partagent sur 5, le score de la cinquième se retrouverait par différence.
    expect(groupStatistics([...sharing(4, { exam: 30, active: true }), member(false, { exam: 12, active: true, weak: ['Histoire'] })], now)).toEqual(masked);
    // Masquer ou non ne dépend pas de ce qu'a fait la personne discrète : le masquage lui-même ne dit rien d'elle.
    expect(groupStatistics([...sharing(4, { exam: 30, active: true }), member(false)], now)).toEqual(masked);
  });

  it('avec au moins 5 personnes discrètes, publie les comptes mais pas une moyenne qui reposerait sur une seule d’entre elles', () => {
    const group = groupStatistics([member(true, { exam: 35 }), member(false, { exam: 20, active: true }), ...discreet(4)], now);
    expect(group).toMatchObject({ activeLast7Days: 1, withExam: 2, averageBestExam: null, weakTopics: [] });
  });

  it('publie la moyenne et les thèmes quand au moins 5 personnes discrètes y contribuent', () => {
    const scores = [20, 24, 28, 32, 36];
    const group = groupStatistics([member(true, { exam: 30 }), ...scores.map((exam) => member(false, { exam, weak: ['Institutions'] }))], now);
    expect(group?.averageBestExam).toBeCloseTo(170 / 6);
    expect(group?.weakTopics).toEqual([{ title: 'Institutions', count: 5 }]);
  });

  it('masque les thèmes quand ils ne viennent que de 1 à 4 personnes discrètes', () => {
    const group = groupStatistics([...sharing(2), member(false, { weak: ['Histoire'] }), ...discreet(4)], now);
    expect(group).toMatchObject({ activeLast7Days: 0, withExam: 0, weakTopics: null });
  });
});
