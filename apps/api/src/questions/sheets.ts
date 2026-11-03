import { prisma } from '../db.js';
import { visibleStatuses } from './visibility.js';

export type SheetLink = { slug: string; title: string };

const key = (topicId: number, notion: string | null) => `${topicId}:${notion ?? ''}`;

/**
 * Fiche de révision de chaque notion (E09 : lien vers la fiche depuis la correction).
 * Une seule requête pour toutes les questions d'une correction.
 */
export async function sheetsFor(questions: readonly { topicId: number; notion: string | null }[]): Promise<Map<string, SheetLink>> {
  const wanted = questions.filter((question) => question.notion !== null);
  if (wanted.length === 0) return new Map();
  const sheets = await prisma.revisionSheet.findMany({
    where: {
      status: { in: visibleStatuses },
      OR: wanted.map((question) => ({ topicId: question.topicId, notion: question.notion })),
    },
    orderBy: { position: 'asc' },
    select: { slug: true, title: true, topicId: true, notion: true },
  });
  const byKey = new Map<string, SheetLink>();
  for (const sheet of sheets) {
    if (!byKey.has(key(sheet.topicId, sheet.notion))) byKey.set(key(sheet.topicId, sheet.notion), { slug: sheet.slug, title: sheet.title });
  }
  return byKey;
}

export const sheetOf = (sheets: Map<string, SheetLink>, question: { topicId: number; notion: string | null }) =>
  sheets.get(key(question.topicId, question.notion)) ?? null;
