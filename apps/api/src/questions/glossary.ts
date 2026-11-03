// Repère les mots du glossaire présents dans un texte (charte éditoriale §6).

export type GlossaryEntry = { term: string; definition: string };

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeApostrophes = (text: string) => text.replace(/[’ʼ]/g, "'");

const patterns = new Map<string, RegExp>();

function patternFor(term: string): RegExp {
  let pattern = patterns.get(term);
  if (!pattern) {
    // Mot entier, insensible à la casse, avec le pluriel en -s ou -x.
    pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(normalizeApostrophes(term))}(?:s|x)?(?![\\p{L}\\p{N}])`, 'iu');
    patterns.set(term, pattern);
  }
  return pattern;
}

/** Les mots du glossaire présents dans les textes, les expressions longues d'abord (« suffrage universel » avant « suffrage »). */
export function findGlossaryTerms(texts: readonly string[], entries: readonly GlossaryEntry[], limit = 6): GlossaryEntry[] {
  const haystack = normalizeApostrophes(texts.join('\n'));
  const found: GlossaryEntry[] = [];
  const longestFirst = [...entries].sort((a, b) => b.term.length - a.term.length);
  for (const entry of longestFirst) {
    if (found.length >= limit) break;
    // Un terme déjà couvert par une expression plus longue n'est pas répété.
    if (found.some((other) => other.term.toLowerCase().includes(entry.term.toLowerCase()))) continue;
    if (patternFor(entry.term).test(haystack)) found.push(entry);
  }
  return found;
}
