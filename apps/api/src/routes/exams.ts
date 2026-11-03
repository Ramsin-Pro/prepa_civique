import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../http/errors.js';
import { idParam, uuidParam } from '../http/params.js';
import { ensureLearner, learnerKey } from '../http/learner.js';
import { answerToken, answerTokenSchema } from '../questions/answer-ids.js';
import { questionAsShown, snapshotsSince } from '../questions/attempt-content.js';
import { drawForTemplate, examPool } from '../questions/exam-draw.js';
import { NotEnoughQuestionsError, canStillAnswer, correctAnswerOf, scoreExam, shuffle } from '../questions/logic.js';
import { accessOf, examsStarted } from '../premium/access.js';
import { recordAnswers } from '../questions/progress.js';
import { sheetOf, sheetsFor } from '../questions/sheets.js';
import { track } from '../audit.js';
import { config } from '../config.js';
import { answerSourceSelect } from '../questions/public.js';

// Mode examen blanc (E10, E11) : questions tirées selon le modèle d'examen actif et sa répartition par thème,
// réponses enregistrées au fil de l'eau, score calculé uniquement côté serveur à la fin.
export const examsRouter = Router();

// Chaque examen crée une quarantaine de lignes : on limite les créations par adresse IP.
const startLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

const pathQuery = z.object({ path: z.string().min(1) });

function requireVisitor(req: Request): string {
  const visitor = learnerKey(req);
  if (!visitor) throw notFound('Examen blanc introuvable.');
  return visitor;
}

async function activeTemplate(pathSlug: string) {
  return prisma.examTemplate.findFirst({
    where: { active: true, path: { slug: pathSlug, active: true } },
    orderBy: { version: 'desc' },
    include: {
      path: { select: { slug: true, title: true, code: true } },
      quotas: { select: { kind: true, notion: true, count: true, topicId: true, topic: { select: { slug: true, title: true, position: true } } } },
    },
  });
}

type Template = NonNullable<Awaited<ReturnType<typeof activeTemplate>>>;

/** Composition affichée sur l'écran de préparation (E10) : nombre de questions par thème. */
function composition(template: Template) {
  const byTopic = new Map<string, { topic: { slug: string; title: string }; position: number; knowledge: number; situation: number }>();
  for (const quota of template.quotas) {
    const entry = byTopic.get(quota.topic.slug) ?? {
      topic: { slug: quota.topic.slug, title: quota.topic.title },
      position: quota.topic.position,
      knowledge: 0,
      situation: 0,
    };
    if (quota.kind === 'SITUATION') entry.situation += quota.count;
    else entry.knowledge += quota.count;
    byTopic.set(quota.topic.slug, entry);
  }
  return [...byTopic.values()].sort((a, b) => a.position - b.position).map(({ position: _position, ...entry }) => entry);
}

examsRouter.get('/template', async (req, res) => {
  const { path } = pathQuery.parse(req.query);
  const template = await activeTemplate(path);
  if (!template) throw notFound("Aucun examen blanc n'est disponible pour ce parcours.");

  let available = true;
  try {
    drawForTemplate(template, await examPool(template.pathId));
  } catch (error) {
    if (!(error instanceof NotEnoughQuestionsError)) throw error;
    available = false;
  }

  res.json({
    path: { slug: template.path.slug, title: template.path.title },
    version: template.version,
    questionCount: template.knowledgeCount + template.situationCount,
    knowledgeCount: template.knowledgeCount,
    situationCount: template.situationCount,
    durationSeconds: template.durationSeconds,
    passThreshold: template.passThreshold,
    regulatoryRef: template.regulatoryRef,
    composition: composition(template),
    available,
    access: await examAccess(req),
  });
});

/** Examens blancs encore possibles : illimités en Premium, limités dans l'offre gratuite (annoncé clairement, E14). */
async function examAccess(req: Request) {
  const access = await accessOf(req);
  if (access.premium) return { premium: true, freeExamsLeft: null };
  return { premium: false, freeExamsLeft: Math.max(0, config.free.exams - (await examsStarted(learnerKey(req)))) };
}

/** Examen en cours à reprendre, et examens terminés, pour le visiteur. */
examsRouter.get('/', async (req, res) => {
  const { path } = pathQuery.parse(req.query);
  const visitor = learnerKey(req);
  if (!visitor) {
    res.json({ active: null, finished: [] });
    return;
  }
  const where = { learnerKey: visitor, template: { path: { slug: path } } };
  const [active, finished] = await Promise.all([
    prisma.examAttempt.findFirst({
      where: { ...where, endedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, expiresAt: true },
    }),
    prisma.examAttempt.findMany({
      where: { ...where, endedAt: { not: null } },
      orderBy: { endedAt: 'desc' },
      take: 10,
      select: { id: true, endedAt: true, score: true, template: { select: { passThreshold: true, knowledgeCount: true, situationCount: true } } },
    }),
  ]);
  res.json({
    active,
    finished: finished.map(({ template, ...exam }) => ({
      ...exam,
      total: template.knowledgeCount + template.situationCount,
      passThreshold: template.passThreshold,
      thresholdReached: (exam.score ?? 0) >= template.passThreshold,
    })),
  });
});

type AttemptItem = { answerOrder: number[]; question: Parameters<typeof questionAsShown>[0] & { id: number } };

/** Questions d'une tentative telles qu'elles étaient à son début : c'est ce contenu qui est montré et corrigé. */
async function attemptContent<T extends AttemptItem>(startedAt: Date, items: readonly T[]) {
  const snapshots = await snapshotsSince(items.map((item) => item.question.id), startedAt);
  return items.map((item) => ({ ...item, shown: questionAsShown(item.question, item.answerOrder, snapshots.get(item.question.id)) }));
}

/**
 * Vue d'une tentative pour son auteur. Avant la fin, elle ne contient jamais la bonne réponse :
 * les champs sont recopiés un par un plutôt que renvoyés tels quels. Les propositions n'y sont désignées
 * que par leur identifiant opaque, jamais par leur numéro en base.
 */
async function examView(attemptId: string, visitor: string) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, learnerKey: visitor },
    select: {
      id: true,
      startedAt: true,
      expiresAt: true,
      endedAt: true,
      template: {
        select: { version: true, durationSeconds: true, passThreshold: true, path: { select: { slug: true, title: true } } },
      },
      items: {
        orderBy: { position: 'asc' },
        select: {
          position: true,
          answerOrder: true,
          answerId: true,
          question: {
            select: {
              id: true,
              type: true,
              status: true,
              statement: true,
              explanation: true,
              topicId: true,
              notion: true,
              topic: { select: { slug: true, title: true, position: true } },
              statementSource: { select: { label: true, url: true } },
              answerSource: answerSourceSelect,
              answers: { select: { id: true, text: true, isCorrect: true, position: true } },
            },
          },
        },
      },
    },
  });
  if (!attempt) throw notFound('Examen blanc introuvable.');

  const items = await attemptContent(attempt.startedAt, attempt.items);
  const questions = items.map(({ position, answerId, question, shown }) => ({
    position,
    id: question.id,
    type: question.type,
    inReview: shown.status !== 'PUBLISHED',
    statement: shown.statement,
    topic: { slug: question.topic.slug, title: question.topic.title },
    statementSource: question.statementSource,
    answers: shown.answers.map((answer) => ({ id: answerToken(answer.id), text: answer.text })),
    answerId: answerId === null ? null : answerToken(answerId),
  }));

  let result = null;
  if (attempt.endedAt) {
    const graded = items.map(({ position, answerId, question, shown }) => ({
      position,
      question,
      shown,
      topic: { slug: question.topic.slug, title: question.topic.title },
      chosenAnswerId: answerId,
      correctAnswerId: correctAnswerOf(shown.answers),
    }));
    // Les thèmes dans l'ordre officiel, comme sur l'écran de préparation.
    const topicOrder = new Map(attempt.items.map(({ question }) => [question.topic.slug, question.topic.position]));
    const score = scoreExam(graded, attempt.template.passThreshold);
    score.byTopic.sort((a, b) => (topicOrder.get(a.slug) ?? 0) - (topicOrder.get(b.slug) ?? 0));
    const sheets = await sheetsFor(attempt.items.map(({ question }) => question));
    result = {
      ...score,
      corrections: graded.map(({ position, question, shown, chosenAnswerId, correctAnswerId }) => ({
        position,
        questionId: question.id,
        chosenAnswerId: chosenAnswerId === null ? null : answerToken(chosenAnswerId),
        correctAnswerId: answerToken(correctAnswerId),
        correct: chosenAnswerId === correctAnswerId,
        explanation: shown.explanation,
        answerSource: question.answerSource,
        sheet: sheetOf(sheets, question),
      })),
    };
  }

  return {
    id: attempt.id,
    path: attempt.template.path,
    templateVersion: attempt.template.version,
    durationSeconds: attempt.template.durationSeconds,
    passThreshold: attempt.template.passThreshold,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    endedAt: attempt.endedAt,
    questions,
    result,
  };
}

const startBody = z.object({ path: z.string().min(1) });

examsRouter.post('/', startLimiter, async (req, res) => {
  const { path } = startBody.parse(req.body);
  const template = await activeTemplate(path);
  if (!template) throw notFound("Aucun examen blanc n'est disponible pour ce parcours.");

  const { freeExamsLeft } = await examAccess(req);
  if (freeExamsLeft === 0) {
    throw new HttpError(
      403,
      'premium_required',
      `L’offre gratuite comprend ${config.free.exams} examen${config.free.exams > 1 ? 's' : ''} blanc${config.free.exams > 1 ? 's' : ''}. Passez au Premium pour en faire d’autres.`,
    );
  }

  let drawn: number[];
  try {
    drawn = drawForTemplate(template, await examPool(template.pathId));
  } catch (error) {
    if (error instanceof NotEnoughQuestionsError) {
      throw new HttpError(409, 'not_enough_questions', "Il n'y a pas encore assez de questions publiées pour un examen blanc complet.");
    }
    throw error;
  }

  const answers = await prisma.answer.findMany({ where: { questionId: { in: drawn } }, select: { id: true, questionId: true } });
  const answerIdsByQuestion = new Map<number, number[]>();
  for (const { id, questionId } of answers) {
    answerIdsByQuestion.set(questionId, [...(answerIdsByQuestion.get(questionId) ?? []), id]);
  }

  const visitor = ensureLearner(req, res);
  const startedAt = new Date();
  const attempt = await prisma.examAttempt.create({
    data: {
      templateId: template.id,
      learnerKey: visitor,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + template.durationSeconds * 1000),
      items: {
        create: drawn.map((questionId, position) => ({
          questionId,
          position,
          answerOrder: shuffle(answerIdsByQuestion.get(questionId) ?? []),
        })),
      },
    },
    select: { id: true },
  });
  await track('exam_start', { learnerKey: visitor, pathCode: template.path.code });

  res.status(201).json(await examView(attempt.id, visitor));
});

examsRouter.get('/:id', async (req, res) => {
  const id = uuidParam.parse(req.params.id);
  res.json(await examView(id, requireVisitor(req)));
});

const answerBody = z.object({
  // Identifiant opaque de la proposition choisie ; null efface la réponse donnée à cette question
  answerId: answerTokenSchema.nullable(),
});

examsRouter.put('/:id/answers/:questionId', async (req, res) => {
  const id = uuidParam.parse(req.params.id);
  const questionId = idParam.parse(req.params.questionId);
  const { answerId } = answerBody.parse(req.body);
  const visitor = requireVisitor(req);

  const item = await prisma.examAttemptQuestion.findFirst({
    where: { attemptId: id, questionId, attempt: { learnerKey: visitor } },
    select: { id: true, answerOrder: true, attempt: { select: { endedAt: true, expiresAt: true } } },
  });
  if (!item) throw notFound("Cette question ne fait pas partie de l'examen blanc.");
  if (item.attempt.endedAt) throw new HttpError(409, 'exam_finished', 'Cet examen blanc est terminé.');
  if (!canStillAnswer(item.attempt.expiresAt, new Date())) {
    throw new HttpError(409, 'time_over', "Le temps de l'examen blanc est écoulé.");
  }
  // Seules les propositions tirées pour cette question sont acceptées.
  const chosenId = answerId === null ? null : item.answerOrder.find((candidate) => answerToken(candidate) === answerId);
  if (chosenId === undefined) {
    throw new HttpError(400, 'invalid_answer', "Cette réponse n'appartient pas à la question.");
  }

  await prisma.examAttemptQuestion.update({
    where: { id: item.id },
    data: { answerId: chosenId, answeredAt: chosenId === null ? null : new Date() },
  });
  res.status(204).end();
});

examsRouter.post('/:id/finish', async (req, res) => {
  const id = uuidParam.parse(req.params.id);
  const visitor = requireVisitor(req);

  const attempt = await prisma.examAttempt.findFirst({
    where: { id, learnerKey: visitor },
    select: {
      startedAt: true,
      endedAt: true,
      template: { select: { passThreshold: true } },
      items: {
        select: {
          id: true,
          questionId: true,
          answerId: true,
          answerOrder: true,
          question: {
            select: {
              id: true,
              statement: true,
              explanation: true,
              status: true,
              topic: { select: { slug: true, title: true } },
              answers: { select: { id: true, text: true, isCorrect: true, position: true } },
            },
          },
        },
      },
    },
  });
  if (!attempt) throw notFound('Examen blanc introuvable.');

  // Terminer deux fois renvoie le même résultat : le score n'est calculé qu'une fois,
  // avec la bonne réponse d'alors même si la question a été retouchée depuis le début de la tentative.
  if (!attempt.endedAt) {
    const items = await attemptContent(attempt.startedAt, attempt.items);
    const graded = items.map((item) => ({
      itemId: item.id,
      questionId: item.questionId,
      topic: item.question.topic,
      chosenAnswerId: item.answerId,
      correctAnswerId: correctAnswerOf(item.shown.answers),
    }));
    const { score } = scoreExam(graded, attempt.template.passThreshold);
    const isRight = (item: (typeof graded)[number]) => item.chosenAnswerId === item.correctAnswerId;

    const [, , ended] = await prisma.$transaction([
      prisma.examAttemptQuestion.updateMany({
        where: { id: { in: graded.filter(isRight).map((item) => item.itemId) } },
        data: { isCorrect: true },
      }),
      prisma.examAttemptQuestion.updateMany({
        where: { id: { in: graded.filter((item) => !isRight(item)).map((item) => item.itemId) } },
        data: { isCorrect: false },
      }),
      prisma.examAttempt.updateMany({ where: { id, endedAt: null }, data: { endedAt: new Date(), score } }),
    ]);

    // Les réponses données nourrissent la répétition espacée : une erreur revient en révision.
    // Une question laissée sans réponse (examen interrompu…) reste « à découvrir » au lieu de remplir les révisions.
    if (ended.count > 0) {
      await recordAnswers(
        visitor,
        graded.filter((item) => item.chosenAnswerId !== null).map((item) => ({ questionId: item.questionId, correct: isRight(item) })),
      );
      await track('exam_finish', { learnerKey: visitor });
    }
  }

  res.json(await examView(id, visitor));
});
