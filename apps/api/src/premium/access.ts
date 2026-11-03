import type { Request } from 'express';
import { config } from '../config.js';
import { prisma } from '../db.js';

// Droits Premium (§5 : les droits dépendent d'un paiement confirmé et d'une période de validité)
// et limites de l'offre gratuite, annoncées clairement (parcours A, E07, E14).

export async function premiumUntil(userId: string | null | undefined): Promise<Date | null> {
  if (!userId) return null;
  const now = new Date();
  const entitlement = await prisma.entitlement.findFirst({
    where: { userId, revokedAt: null, startsAt: { lte: now }, expiresAt: { gt: now } },
    orderBy: { expiresAt: 'desc' },
    select: { expiresAt: true },
  });
  return entitlement?.expiresAt ?? null;
}

export async function accessOf(req: Request) {
  const until = await premiumUntil(req.auth?.userId);
  return { premium: until !== null, premiumUntil: until };
}

type FreeCandidate = { id: number; topicId: number; reference: string; notion?: string | null };

/**
 * Questions ouvertes avec l'offre gratuite, par thème et jamais plus que la limite : les questions déjà travaillées,
 * complétées par des questions réparties entre les notions du thème (la première de chaque notion, puis la deuxième…),
 * pour que chaque fiche de révision garde son mini-quiz. Le choix est stable : toujours les mêmes questions.
 */
export function freeSelection(questions: readonly FreeCandidate[], seen: ReadonlySet<number>, perTopic: number): Set<number> {
  const allowed = new Set<number>();
  const byTopic = new Map<number, FreeCandidate[]>();
  for (const question of questions) {
    byTopic.set(question.topicId, [...(byTopic.get(question.topicId) ?? []), question]);
  }
  for (const topicQuestions of byTopic.values()) {
    const byNotion = new Map<string, FreeCandidate[]>();
    for (const question of [...topicQuestions].sort((a, b) => a.reference.localeCompare(b.reference))) {
      byNotion.set(question.notion ?? '', [...(byNotion.get(question.notion ?? '') ?? []), question]);
    }
    const queues = [...byNotion.values()];
    const ordered: FreeCandidate[] = [];
    for (let rank = 0; ordered.length < topicQuestions.length; rank += 1) {
      for (const queue of queues) {
        const question = queue[rank];
        if (question) ordered.push(question);
      }
    }

    // Les examens blancs sont tirés dans toute la banque : leurs questions comptent comme travaillées, mais
    // n'ouvrent jamais de place en plus. D'abord les questions travaillées de la sélection habituelle, puis les
    // autres questions travaillées, puis le reste de la sélection habituelle, dans la limite du thème.
    const usual = ordered.slice(0, perTopic);
    const prioritized = [
      ...usual.filter((question) => seen.has(question.id)),
      ...ordered.slice(perTopic).filter((question) => seen.has(question.id)),
      ...usual.filter((question) => !seen.has(question.id)),
    ];
    for (const question of prioritized.slice(0, perTopic)) allowed.add(question.id);
  }
  return allowed;
}

/** Ensemble des questions accessibles pour un apprenant gratuit, sur un parcours. */
export async function freeAllowedIds(learnerKey: string | null, pathId: number, visibleWhere: object): Promise<Set<number>> {
  const questions = await prisma.question.findMany({
    where: { ...visibleWhere, paths: { some: { pathId } } },
    select: { id: true, topicId: true, reference: true, notion: true },
  });
  const seen = learnerKey
    ? new Set(
        (
          await prisma.visitorQuestionState.findMany({
            where: { learnerKey, questionId: { in: questions.map((question) => question.id) } },
            select: { questionId: true },
          })
        ).map((state) => state.questionId),
      )
    : new Set<number>();
  return freeSelection(questions, seen, config.free.questionsPerTopic);
}

/**
 * Une question est ouverte avec l'offre gratuite si elle l'est sur au moins un des parcours donnés (ceux,
 * ouverts, auxquels elle appartient). Sans parcours, elle ne l'est sur aucun : seul le Premium y donne accès.
 */
export async function isFreeQuestion(
  learnerKey: string | null,
  questionId: number,
  pathIds: readonly number[],
  visibleWhere: object,
): Promise<boolean> {
  for (const pathId of new Set(pathIds)) {
    if ((await freeAllowedIds(learnerKey, pathId, visibleWhere)).has(questionId)) return true;
  }
  return false;
}

/**
 * Nombre d'examens blancs déjà commencés par l'apprenant. Pour un visiteur, les examens rattachés à un compte
 * lors d'une connexion comptent encore : il en garde une trace (voir mergeVisitorProgress).
 */
export async function examsStarted(learnerKey: string | null): Promise<number> {
  if (!learnerKey) return 0;
  return prisma.examAttempt.count({ where: { learnerKey } });
}
