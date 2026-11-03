import type { QuestionStatus, Role } from '../generated/prisma/client.js';
import { HttpError } from '../http/errors.js';

// Workflow éditorial (A03, A05), commun aux questions, fiches et pages :
// brouillon → à relire → validée → publiée → archivée. Rien n'est publié sans relecture humaine (§7).

const NEXT: Record<QuestionStatus, readonly QuestionStatus[]> = {
  DRAFT: ['IN_REVIEW', 'ARCHIVED'],
  IN_REVIEW: ['APPROVED', 'PUBLISHED', 'DRAFT', 'ARCHIVED'],
  APPROVED: ['PUBLISHED', 'IN_REVIEW', 'ARCHIVED'],
  PUBLISHED: ['IN_REVIEW', 'ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export const STATUS_LABELS: Record<QuestionStatus, string> = {
  DRAFT: 'brouillon',
  IN_REVIEW: 'à relire',
  APPROVED: 'validé',
  PUBLISHED: 'publié',
  ARCHIVED: 'archivé',
};

export function canTransition(from: QuestionStatus, to: QuestionStatus): boolean {
  return NEXT[from].includes(to);
}

/** Passer de « à relire » à « publié » vaut validation : la relecture humaine a lieu au même moment. */
export const approves = (from: QuestionStatus, to: QuestionStatus) => to === 'APPROVED' || (to === 'PUBLISHED' && from === 'IN_REVIEW');

/**
 * Relecture à quatre yeux : la personne qui valide n'est pas la dernière à avoir modifié le contenu.
 * Seul un super-administrateur peut valider son propre travail (petite équipe), ce qui est noté au journal.
 */
export function assertTransition(
  from: QuestionStatus,
  to: QuestionStatus,
  actor: { userId: string; role: Role },
  lastEditorId: string | null,
): { selfApproved: boolean } {
  if (!canTransition(from, to)) {
    throw new HttpError(409, 'invalid_transition', `Impossible de passer de « ${STATUS_LABELS[from]} » à « ${STATUS_LABELS[to]} ».`);
  }
  const selfApproved = approves(from, to) && lastEditorId === actor.userId;
  if (selfApproved && actor.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'same_reviewer', 'La validation doit être faite par une autre personne que la dernière à avoir modifié ce contenu.');
  }
  return { selfApproved };
}

/** Une modification de fond (énoncé, bonne réponse) d'un contenu validé ou publié le renvoie en relecture. */
export const statusAfterSubstantiveEdit = (status: QuestionStatus): QuestionStatus =>
  status === 'APPROVED' || status === 'PUBLISHED' ? 'IN_REVIEW' : status;
