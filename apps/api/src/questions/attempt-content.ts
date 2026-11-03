import { z } from 'zod';
import { prisma } from '../db.js';
import type { QuestionStatus } from '../generated/prisma/client.js';

// Un examen blanc montre et corrige ses questions telles qu'elles étaient au début de la tentative (§5) : une question
// retouchée ensuite (et renvoyée en relecture) ne change ni l'énoncé, ni les propositions, ni la bonne réponse, ni
// l'explication de la tentative, et un contenu pas encore relu n'apparaît jamais dans un résultat.
// Chaque modification au back-office garde l'état précédent dans l'historique des versions : la première version
// enregistrée après le début de la tentative est donc le contenu d'alors. Sans version depuis, c'est le contenu actuel.

const snapshotSchema = z.object({
  statement: z.string(),
  explanation: z.string(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED']).optional(),
  answers: z.array(z.object({ text: z.string(), isCorrect: z.boolean(), position: z.number().int() })),
});

export type QuestionSnapshot = z.infer<typeof snapshotSchema>;

/** Contenu d'avant la première modification faite après `at`, pour chaque question modifiée depuis. */
export async function snapshotsSince(questionIds: readonly number[], at: Date): Promise<Map<number, QuestionSnapshot>> {
  const versions = await prisma.questionVersion.findMany({
    where: { questionId: { in: [...questionIds] }, createdAt: { gt: at } },
    orderBy: { version: 'asc' },
    select: { questionId: true, snapshot: true },
  });
  const snapshots = new Map<number, QuestionSnapshot>();
  const handled = new Set<number>();
  for (const { questionId, snapshot } of versions) {
    if (handled.has(questionId)) continue;
    handled.add(questionId);
    // Une version illisible laisse le contenu actuel plutôt que d'empêcher l'affichage de l'examen.
    const parsed = snapshotSchema.safeParse(snapshot);
    if (parsed.success) snapshots.set(questionId, parsed.data);
  }
  return snapshots;
}

type LiveAnswer = { id: number; text: string; isCorrect: boolean; position: number };
type LiveQuestion = { statement: string; explanation: string; status: QuestionStatus; answers: readonly LiveAnswer[] };

/**
 * Question telle que la tentative l'a montrée : énoncé, explication, et propositions dans l'ordre affiché
 * (`answerOrder`, tiré au départ), avec leur texte et leur exactitude d'alors.
 */
export function questionAsShown(question: LiveQuestion, answerOrder: readonly number[], snapshot?: QuestionSnapshot) {
  // Les propositions sont modifiées à leur place : leur position relie l'ancienne version aux lignes actuelles.
  const before = new Map(snapshot?.answers.map((answer) => [answer.position, answer]));
  const byId = new Map(question.answers.map((answer) => [answer.id, answer]));
  const answers = answerOrder.flatMap((id) => {
    const answer = byId.get(id);
    if (!answer) return [];
    const old = snapshot ? before.get(answer.position) : undefined;
    return [{ id: answer.id, text: old?.text ?? answer.text, isCorrect: old?.isCorrect ?? answer.isCorrect }];
  });
  return {
    statement: snapshot?.statement ?? question.statement,
    explanation: snapshot?.explanation ?? question.explanation,
    status: snapshot?.status ?? question.status,
    answers,
  };
}
