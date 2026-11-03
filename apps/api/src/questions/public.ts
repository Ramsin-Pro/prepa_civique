import type { Prisma } from '../generated/prisma/client.js';
import { answerToken } from './answer-ids.js';
import { findGlossaryTerms, type GlossaryEntry } from './glossary.js';
import { shuffle } from './logic.js';

/** Champs d'une question lus avant correction : jamais l'indicateur de bonne réponse. */
export const publicQuestionSelect = {
  id: true,
  reference: true,
  type: true,
  status: true,
  statement: true,
  topic: { select: { slug: true, title: true } },
  statementSource: { select: { label: true, url: true } },
  answers: { select: { id: true, text: true }, orderBy: { position: 'asc' } },
} satisfies Prisma.QuestionSelect;

type PublicQuestionRow = Prisma.QuestionGetPayload<{ select: typeof publicQuestionSelect }>;

/**
 * Question prête pour l'entraînement : réponses mélangées et désignées par un identifiant opaque (jamais leur
 * numéro en base), mots difficiles de l'énoncé et des propositions.
 */
export function presentQuestion(
  { status, answers, ...question }: PublicQuestionRow,
  glossary: readonly GlossaryEntry[],
  favorite = false,
) {
  return {
    ...question,
    inReview: status !== 'PUBLISHED',
    favorite,
    answers: shuffle(answers).map((answer) => ({ id: answerToken(answer.id), text: answer.text })),
    glossary: findGlossaryTerms([question.statement, ...answers.map((answer) => answer.text)], glossary),
  };
}

/** Source affichée avec la correction. */
export const answerSourceSelect = {
  select: { label: true, url: true, licence: true },
} satisfies { select: Prisma.SourceSelect };
