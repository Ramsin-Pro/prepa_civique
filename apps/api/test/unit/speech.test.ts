import { describe, expect, it } from 'vitest';
import { cardinalWords, ordinalWords, questionSpeech, romanToNumber, sheetSpeech, speechText, ssml } from '../../src/speech/text.js';

describe('nombres en lettres', () => {
  it('écrit les nombres de 0 à 99', () => {
    expect([0, 16, 17, 21, 31, 45, 70, 71, 72, 80, 81, 90, 91, 99].map(cardinalWords)).toEqual([
      'zéro',
      'seize',
      'dix-sept',
      'vingt et un',
      'trente et un',
      'quarante-cinq',
      'soixante-dix',
      'soixante et onze',
      'soixante-douze',
      'quatre-vingts',
      'quatre-vingt-un',
      'quatre-vingt-dix',
      'quatre-vingt-onze',
      'quatre-vingt-dix-neuf',
    ]);
  });

  it('forme les ordinaux', () => {
    expect([1, 2, 4, 5, 9, 11, 18, 20, 21, 80].map((n) => ordinalWords(n))).toEqual([
      'premier',
      'deuxième',
      'quatrième',
      'cinquième',
      'neuvième',
      'onzième',
      'dix-huitième',
      'vingtième',
      'vingt et unième',
      'quatre-vingtième',
    ]);
    expect(ordinalWords(1, true)).toBe('première');
  });

  it('lit les chiffres romains simples', () => {
    expect(['I', 'IV', 'V', 'IX', 'XIV', 'XVIII', 'XXI'].map(romanToNumber)).toEqual([1, 4, 5, 9, 14, 18, 21]);
    expect(romanToNumber('IIII')).toBeNull();
    expect(romanToNumber('')).toBeNull();
  });
});

describe('texte lu à voix haute', () => {
  it('développe les siècles, les Républiques et les rangs', () => {
    expect(speechText('La Ve République, au XXe siècle')).toBe('La cinquième République, au vingtième siècle');
    expect(speechText('Napoléon Ier et la Ire République')).toBe('Napoléon premier et la première République');
    expect(speechText('le 1er mai, la 1re fois, le 2e tour')).toBe('le premier mai, la première fois, le deuxième tour');
    expect(speechText('le XVIIIᵉ siècle')).toBe('le dix-huitième siècle');
  });

  it('ne transforme pas les mots ordinaires', () => {
    expect(speechText('Ce matin, Le Vers et Vie')).toBe('Ce matin, Le Vers et Vie');
    expect(speechText('les musées d’art. Ensuite')).toBe('les musées d’art. Ensuite');
    expect(speechText('En 1789e')).toBe('En 1789e');
  });

  it('développe les abréviations courantes', () => {
    expect(speechText('art. 3 de la loi n° 2024-42')).toBe('article 3 de la loi numéro 2024-42');
    expect(speechText('Mme Dupont et M. Martin, etc.')).toBe('Madame Dupont et Monsieur Martin, et cetera.');
  });

  it('retire la mise en forme Markdown', () => {
    expect(speechText('**Important** : _voter_ est un droit')).toBe('Important : voter est un droit');
  });

  it('annonce les réponses dans l’ordre et avec les lettres affichés', () => {
    expect(questionSpeech('Quelle est la devise de la République ?', ['Liberté, Égalité, Fraternité', 'Travail, Famille, Patrie.'])).toBe(
      'Quelle est la devise de la République ? Réponse A : Liberté, Égalité, Fraternité. Réponse B : Travail, Famille, Patrie.',
    );
  });

  it('lit une fiche : titre, résumé puis points clés', () => {
    expect(sheetSpeech({ title: 'La laïcité', summary: 'Un principe de neutralité', keyPoints: ['Loi de 1905'] })).toBe(
      'La laïcité. Un principe de neutralité. Points clés. Loi de 1905.',
    );
  });

  it('échappe le texte dans le SSML et impose l’accent français', () => {
    const xml = ssml('Tom & Jerry <test>', 'fr-FR-RemyMultilingualNeural');
    expect(xml).toContain("<voice name='fr-FR-RemyMultilingualNeural'><lang xml:lang='fr-FR'>Tom &amp; Jerry &lt;test&gt;</lang>");
  });
});
