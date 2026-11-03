import { prisma } from '../db.js';
import type { GlossaryEntry } from './glossary.js';

// Le glossaire change rarement : il est gardé en mémoire une minute.
const TTL_MS = 60_000;
let cache: { entries: GlossaryEntry[]; loadedAt: number } | null = null;

export async function glossaryEntries(): Promise<GlossaryEntry[]> {
  if (!cache || Date.now() - cache.loadedAt > TTL_MS) {
    const entries = await prisma.glossaryTerm.findMany({ select: { term: true, definition: true }, orderBy: { term: 'asc' } });
    cache = { entries, loadedAt: Date.now() };
  }
  return cache.entries;
}

/** À appeler après une modification du lexique depuis le back-office. */
export function clearGlossaryCache() {
  cache = null;
}
