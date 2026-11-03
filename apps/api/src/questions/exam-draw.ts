import { prisma } from '../db.js';
import type { QuestionKind as DbQuestionKind, QuestionStatus } from '../generated/prisma/client.js';
import { NotEnoughQuestionsError, drawExamQuestions, drawWithQuotas, kindOf, type PoolQuestion } from './logic.js';
import { visibleStatuses } from './visibility.js';

/** Ce qu'il faut d'un modèle d'examen pour tirer ses questions. */
export type DrawableTemplate = {
  knowledgeCount: number;
  situationCount: number;
  quotas: readonly { topicId: number; kind: DbQuestionKind; notion: string | null; count: number }[];
};

/** Questions d'un parcours qui peuvent être tirées : par défaut, celles que voient les candidats. */
export async function examPool(pathId: number, statuses: readonly QuestionStatus[] = visibleStatuses): Promise<PoolQuestion[]> {
  const rows = await prisma.question.findMany({
    where: { status: { in: [...statuses] }, paths: { some: { pathId } } },
    select: { id: true, type: true, topicId: true, notion: true },
  });
  return rows.map((row) => ({ id: row.id, kind: kindOf(row.type), topicId: row.topicId, notion: row.notion }));
}

/** Tire les questions d'un examen : selon la répartition du modèle si elle existe, sinon par famille. */
export function drawForTemplate(template: DrawableTemplate, pool: readonly PoolQuestion[]): number[] {
  if (template.quotas.length === 0) {
    return drawExamQuestions(pool, { knowledge: template.knowledgeCount, situation: template.situationCount });
  }
  return drawWithQuotas(
    pool,
    template.quotas.map((quota) => ({
      topicId: quota.topicId,
      kind: quota.kind === 'SITUATION' ? 'situation' : 'knowledge',
      notion: quota.notion,
      count: quota.count,
    })),
  );
}

/**
 * Essai à blanc d'un modèle (A04) : plusieurs tirages successifs, pour vérifier qu'un examen complet
 * peut toujours être composé avec les questions disponibles.
 */
export function dryRun(template: DrawableTemplate, pool: readonly PoolQuestion[], runs = 20) {
  for (let run = 0; run < runs; run += 1) {
    try {
      drawForTemplate(template, pool);
    } catch (error) {
      if (error instanceof NotEnoughQuestionsError) {
        return { ok: false as const, error: { kind: error.kind, needed: error.needed, available: error.available, topicId: error.topicId ?? null } };
      }
      throw error;
    }
  }
  return { ok: true as const, error: null };
}
