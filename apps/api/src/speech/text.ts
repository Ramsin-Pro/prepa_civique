// Préparation des textes lus à voix haute : la voix doit dire « cinquième République », pas « V e République ».

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS: Record<number, string> = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };

/** Nombre en lettres, de 0 à 99. */
export function cardinalWords(n: number): string {
  if (n < 20) return UNITS[n]!;
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  if (ten === 7 || ten === 9) {
    const base = ten === 7 ? 'soixante' : 'quatre-vingt';
    return ten === 7 && unit === 1 ? 'soixante et onze' : `${base}-${UNITS[10 + unit]}`;
  }
  if (ten === 8) return unit === 0 ? 'quatre-vingts' : `quatre-vingt-${UNITS[unit]}`;
  const base = TENS[ten]!;
  if (unit === 0) return base;
  return unit === 1 ? `${base} et un` : `${base}-${UNITS[unit]}`;
}

/** Nombre ordinal en lettres (1 à 99) : premier, deuxième, vingt et unième… */
export function ordinalWords(n: number, feminine = false): string {
  if (n === 1) return feminine ? 'première' : 'premier';
  const words = cardinalWords(n);
  if (words.endsWith('cinq')) return `${words}uième`;
  if (words.endsWith('neuf')) return `${words.slice(0, -1)}vième`;
  if (words.endsWith('quatre-vingts')) return `${words.slice(0, -1)}ième`;
  if (words.endsWith('e')) return `${words.slice(0, -1)}ième`;
  return `${words}ième`;
}

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10 };

/** Chiffres romains simples (I à XXXIX), suffisants pour les siècles et les Républiques. */
export function romanToNumber(roman: string): number | null {
  if (!/^X{0,3}(IX|IV|V?I{0,3})$/.test(roman) || roman === '') return null;
  let total = 0;
  for (let index = 0; index < roman.length; index += 1) {
    const value = ROMAN[roman[index]!]!;
    const next = ROMAN[roman[index + 1] ?? ''] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

const notLetterBefore = '(?<![\\p{L}\\p{N}])';
const notLetterAfter = '(?![\\p{L}\\p{N}])';
const ROMAN_ORDINAL = new RegExp(`${notLetterBefore}([IVX]+)(ère|ème|er|re|e)${notLetterAfter}`, 'gu');
const NUMBER_ORDINAL = new RegExp(`${notLetterBefore}(\\d{1,2})(ère|ème|er|re|e)${notLetterAfter}`, 'gu');

function ordinalFor(value: number | null, suffix: string, original: string) {
  if (value === null || value < 1 || value > 99) return original;
  return ordinalWords(value, suffix === 're' || suffix === 'ère');
}

/** Texte prêt à être lu : ordinaux en lettres, abréviations développées, mise en forme retirée. */
export function speechText(text: string): string {
  return text
    .replace(/ᵉ/g, 'e')
    .replace(/ʳ/g, 'r')
    .replace(/[*_#`]+/g, '')
    .replace(ROMAN_ORDINAL, (match, roman: string, suffix: string) => ordinalFor(romanToNumber(roman), suffix, match))
    .replace(NUMBER_ORDINAL, (match, digits: string, suffix: string) => ordinalFor(Number(digits), suffix, match))
    .replace(/\bn°\s*/giu, 'numéro ')
    .replace(/\bart\.\s*(?=(?:[LRD]\.?\s*)?\d)/gu, 'article ')
    .replace(/\bMme\b\.?/gu, 'Madame')
    .replace(/\bM\.\s+(?=\p{Lu})/gu, 'Monsieur ')
    .replace(/\betc\./gu, 'et cetera.')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Termine une phrase par un point si elle n'a pas déjà de ponctuation finale. */
export const sentence = (text: string) => {
  const trimmed = text.trim();
  return /[.!?…:»"]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Énoncé suivi des réponses, dans l'ordre et avec les lettres affichés à l'écran. */
export function questionSpeech(statement: string, answers: readonly string[]): string {
  const propositions = answers.map((answer, index) => `Réponse ${LETTERS[index] ?? index + 1} : ${sentence(answer)}`);
  return [sentence(statement), ...propositions].join(' ');
}

export function correctionSpeech(correctAnswer: string | null, explanation: string): string {
  return [correctAnswer ? `La bonne réponse est : ${sentence(correctAnswer)}` : '', explanation].filter(Boolean).join(' ');
}

export function sheetSpeech(sheet: { title: string; summary: string; keyPoints: readonly string[] }): string {
  const points = sheet.keyPoints.length > 0 ? ['Points clés.', ...sheet.keyPoints.map(sentence)] : [];
  return [sentence(sheet.title), sentence(sheet.summary), ...points].join(' ');
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * SSML pour Azure Speech. La voix Rémy est multilingue : la balise <lang> lui impose l'accent français,
 * quel que soit le mot (« Brexit », « Erasmus »…).
 */
export function ssml(text: string, voice: string): string {
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='fr-FR'>` +
    `<voice name='${escapeXml(voice)}'><lang xml:lang='fr-FR'>${escapeXml(text)}</lang></voice></speak>`
  );
}
