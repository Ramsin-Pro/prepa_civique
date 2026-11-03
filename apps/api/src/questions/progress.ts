import { prisma } from '../db.js';
import { nextState } from './learning.js';

/** États d'apprentissage d'un apprenant (visiteur ou compte) pour une liste de questions. */
export async function loadStates(learnerKey: string, questionIds: readonly number[]) {
  const rows = await prisma.visitorQuestionState.findMany({
    where: { learnerKey, questionId: { in: [...questionIds] } },
    select: { questionId: true, box: true, attempts: true, correctCount: true, dueAt: true },
  });
  return new Map(rows.map((row) => [row.questionId, row]));
}

/** Enregistre des réponses (entraînement ou examen blanc) et recalcule la prochaine révision de chaque question. */
export async function recordAnswers(learnerKey: string, answers: readonly { questionId: number; correct: boolean }[], now = new Date()) {
  if (answers.length === 0) return new Map<number, ReturnType<typeof nextState>>();
  const previous = await loadStates(learnerKey, answers.map((answer) => answer.questionId));
  const updates = answers.map(({ questionId, correct }) => ({ questionId, state: nextState(previous.get(questionId) ?? null, correct, now) }));

  await prisma.$transaction(
    updates.map(({ questionId, state }) =>
      prisma.visitorQuestionState.upsert({
        where: { learnerKey_questionId: { learnerKey, questionId } },
        create: { learnerKey, questionId, ...state },
        update: state,
      }),
    ),
  );
  return new Map(updates.map(({ questionId, state }) => [questionId, state]));
}
