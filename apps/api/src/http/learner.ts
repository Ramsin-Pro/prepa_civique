import type { Request, Response } from 'express';
import { prisma } from '../db.js';
import { ensureVisitor, visitorHash } from './visitor.js';

// L'apprenant est la personne dont on suit la progression : le compte s'il est connecté,
// sinon le visiteur anonyme (cookie). À la connexion, la progression anonyme rejoint le compte.

export const userLearnerKey = (userId: string) => `user:${userId}`;

export function learnerKey(req: Request): string | null {
  return req.auth ? userLearnerKey(req.auth.userId) : visitorHash(req);
}

export function ensureLearner(req: Request, res: Response): string {
  return req.auth ? userLearnerKey(req.auth.userId) : ensureVisitor(req, res);
}

/**
 * Rattache au compte la progression du visiteur anonyme : révisions, favoris (questions et fiches) et examens blancs.
 * Pour une question suivie des deux côtés, l'état le plus récent l'emporte et les compteurs s'additionnent.
 * Le visiteur garde une trace de ses examens blancs : son examen gratuit reste utilisé après la déconnexion.
 */
export async function mergeVisitorProgress(req: Request, userId: string) {
  const visitor = visitorHash(req);
  if (!visitor) return;
  const target = userLearnerKey(userId);

  await prisma.$transaction(async (tx) => {
    const [fromVisitor, fromUser] = await Promise.all([
      tx.visitorQuestionState.findMany({ where: { learnerKey: visitor } }),
      tx.visitorQuestionState.findMany({ where: { learnerKey: target } }),
    ]);
    const userStates = new Map(fromUser.map((state) => [state.questionId, state]));

    for (const state of fromVisitor) {
      const existing = userStates.get(state.questionId);
      if (!existing) continue;
      const latest = state.lastAnsweredAt > existing.lastAnsweredAt ? state : existing;
      await tx.visitorQuestionState.update({
        where: { learnerKey_questionId: { learnerKey: target, questionId: state.questionId } },
        data: {
          box: latest.box,
          dueAt: latest.dueAt,
          lastCorrect: latest.lastCorrect,
          lastAnsweredAt: latest.lastAnsweredAt,
          attempts: existing.attempts + state.attempts,
          correctCount: existing.correctCount + state.correctCount,
        },
      });
    }
    await tx.visitorQuestionState.deleteMany({ where: { learnerKey: visitor, questionId: { in: [...userStates.keys()] } } });
    await tx.visitorQuestionState.updateMany({ where: { learnerKey: visitor }, data: { learnerKey: target } });

    const favorites = await tx.visitorFavorite.findMany({ where: { learnerKey: visitor }, select: { questionId: true } });
    if (favorites.length > 0) {
      await tx.visitorFavorite.createMany({
        data: favorites.map(({ questionId }) => ({ learnerKey: target, questionId })),
        skipDuplicates: true,
      });
      await tx.visitorFavorite.deleteMany({ where: { learnerKey: visitor } });
    }

    const sheetFavorites = await tx.sheetFavorite.findMany({ where: { learnerKey: visitor }, select: { sheetId: true } });
    if (sheetFavorites.length > 0) {
      await tx.sheetFavorite.createMany({
        data: sheetFavorites.map(({ sheetId }) => ({ learnerKey: target, sheetId })),
        skipDuplicates: true,
      });
      await tx.sheetFavorite.deleteMany({ where: { learnerKey: visitor } });
    }

    // Les examens passent au compte avec leur identifiant (la page de résultat reste valable). Pour chacun, le visiteur
    // garde une trace sans questions ni réponses, déjà expirée et jamais terminée : invisible dans ses listes, elle
    // compte seulement dans ses examens commencés. Sans elle, se déconnecter rendrait l'examen gratuit, à refaire
    // autant de fois que l'on se connecte. Les traces ne sont jamais rattachées à un compte.
    const attempts = await tx.examAttempt.findMany({
      where: { learnerKey: visitor, items: { some: {} } },
      select: { id: true, templateId: true, startedAt: true },
    });
    if (attempts.length > 0) {
      await tx.examAttempt.updateMany({ where: { id: { in: attempts.map((attempt) => attempt.id) } }, data: { learnerKey: target } });
      await tx.examAttempt.createMany({
        data: attempts.map(({ templateId, startedAt }) => ({ templateId, learnerKey: visitor, startedAt, expiresAt: startedAt })),
      });
    }
  });
}
