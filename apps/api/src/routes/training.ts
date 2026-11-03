import { Router } from 'express';
import { z } from 'zod';
import { track } from '../audit.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../http/errors.js';
import { ensureLearner, learnerKey } from '../http/learner.js';
import { idParam } from '../http/params.js';
import { accessOf, freeAllowedIds, isFreeQuestion } from '../premium/access.js';
import { answerToken, answerTokenSchema, findByToken } from '../questions/answer-ids.js';
import { findGlossaryTerms } from '../questions/glossary.js';
import { glossaryEntries } from '../questions/glossary-store.js';
import { isDue, prioritize } from '../questions/learning.js';
import { correctAnswerOf, shuffle } from '../questions/logic.js';
import { loadStates, recordAnswers } from '../questions/progress.js';
import { answerSourceSelect, presentQuestion, publicQuestionSelect } from '../questions/public.js';
import { sheetOf, sheetsFor } from '../questions/sheets.js';
import { visibleWhere } from '../questions/visibility.js';

// Mode entraînement (§5, E07) : la correction est donnée après chaque réponse, et chaque réponse
// alimente la répétition espacée. L'offre gratuite ouvre un nombre limité de questions par thème.
export const trainingRouter = Router();

const listQuery = z
  .object({
    path: z.string().min(1),
    // topic : un thème (éventuellement une notion, pour le mini-quiz d'une fiche) ; mixed : tous les thèmes,
    // ou un seul pour une série personnalisée ; review : les questions à revoir ; favorites : les questions mises de côté ;
    // errors : les questions manquées à la dernière réponse (E07, mode « erreurs »)
    mode: z.enum(['topic', 'mixed', 'review', 'favorites', 'errors']).default('topic'),
    topic: z.string().min(1).optional(),
    notion: z.string().min(1).optional(),
    // Filtres du catalogue (E07) : difficulté, questions jamais vues ou déjà travaillées
    difficulty: z.coerce.number().int().min(1).max(3).optional(),
    seen: z.enum(['new', 'seen']).optional(),
    limit: z.coerce.number().int().min(1).max(40).default(10),
  })
  .refine((query) => query.mode !== 'topic' || query.topic, { message: 'Le thème est obligatoire.', path: ['topic'] });

trainingRouter.get('/questions', async (req, res) => {
  const { path, mode, topic, notion, difficulty, seen, limit } = listQuery.parse(req.query);
  const learner = learnerKey(req);
  const access = await accessOf(req);
  const accessInfo = { premium: access.premium, freeQuestionsPerTopic: config.free.questionsPerTopic };

  const pathRow = await prisma.path.findFirst({ where: { slug: path, active: true }, select: { id: true } });
  if (!pathRow || ((mode === 'favorites' || mode === 'review' || mode === 'errors') && !learner)) {
    res.json({ questions: [], access: { ...accessInfo, locked: 0 } });
    return;
  }

  const candidates = await prisma.question.findMany({
    where: {
      ...visibleWhere,
      paths: { some: { pathId: pathRow.id } },
      ...((mode === 'topic' || mode === 'mixed') && topic ? { topic: { slug: topic }, ...(notion ? { notion } : {}) } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(mode === 'favorites' ? { favorites: { some: { learnerKey: learner! } } } : {}),
      ...(mode === 'errors' ? { learnerStates: { some: { learnerKey: learner!, lastCorrect: false } } } : {}),
    },
    select: { id: true },
  });
  let ids = candidates.map((question) => question.id);
  let locked = 0;
  if (!access.premium) {
    const allowed = await freeAllowedIds(learner, pathRow.id, visibleWhere);
    locked = ids.filter((id) => !allowed.has(id)).length;
    ids = ids.filter((id) => allowed.has(id));
  }

  const states = learner ? await loadStates(learner, ids) : new Map<number, { dueAt: Date }>();
  if (seen) ids = ids.filter((id) => states.has(id) === (seen === 'seen'));
  const now = new Date();
  const ordered =
    mode === 'errors'
      ? shuffle(ids)
      : mode === 'review'
      ? shuffle(ids.filter((id) => {
          const state = states.get(id);
          return state !== undefined && isDue(state, now);
        }))
      : prioritize(ids, states, now);
  const chosen = ordered.slice(0, limit);

  const [rows, glossary, favorites] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: chosen } }, select: publicQuestionSelect }),
    glossaryEntries(),
    learner
      ? prisma.visitorFavorite.findMany({ where: { learnerKey: learner, questionId: { in: chosen } }, select: { questionId: true } })
      : Promise.resolve([]),
  ]);
  const favoriteIds = new Set(favorites.map((favorite) => favorite.questionId));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const questions = chosen.flatMap((id) => {
    const row = byId.get(id);
    return row ? [presentQuestion(row, glossary, favoriteIds.has(id))] : [];
  });

  res.json({ questions, access: { ...accessInfo, locked } });
});

// La proposition choisie est désignée par son identifiant opaque, celui reçu avec la question.
const checkBody = z.object({ answerId: answerTokenSchema });

trainingRouter.post('/questions/:id/check', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { answerId } = checkBody.parse(req.body);

  const question = await prisma.question.findFirst({
    where: { id, ...visibleWhere },
    select: {
      explanation: true,
      verifiedAt: true,
      topicId: true,
      notion: true,
      answers: { select: { id: true, isCorrect: true } },
      answerSource: answerSourceSelect,
      // Les parcours ouverts seulement : ce sont ceux où la question peut être proposée à l'entraînement.
      paths: { where: { path: { active: true } }, select: { path: { select: { id: true, code: true } } } },
    },
  });
  if (!question) throw notFound('Question introuvable.');
  const chosen = findByToken(question.answers, answerId);
  if (!chosen) {
    throw new HttpError(400, 'invalid_answer', "Cette réponse n'appartient pas à la question.");
  }

  // En mode examen, aucune correction avant la soumission finale (§5) : l'entraînement ne doit pas servir à la contourner.
  const existingLearner = learnerKey(req);
  if (existingLearner) {
    const inRunningExam = await prisma.examAttemptQuestion.count({
      where: { questionId: id, attempt: { learnerKey: existingLearner, endedAt: null, expiresAt: { gt: new Date() } } },
    });
    if (inRunningExam > 0) {
      throw new HttpError(
        409,
        'exam_in_progress',
        "Cette question fait partie de votre examen blanc en cours. Sa correction sera visible à la fin de l'examen.",
      );
    }
  }

  // L'offre gratuite ne corrige que les questions qu'elle ouvre, sur l'un des parcours de la question :
  // une question sans parcours ouvert, ou réservée au Premium sur chacun, n'est corrigée qu'en Premium.
  const access = await accessOf(req);
  if (!access.premium && !(await isFreeQuestion(existingLearner, id, question.paths.map(({ path }) => path.id), visibleWhere))) {
    throw new HttpError(403, 'premium_required', 'Cette question fait partie de l’offre Premium.');
  }

  const correctAnswerId = correctAnswerOf(question.answers);
  const correct = chosen.id === correctAnswerId;
  const learner = ensureLearner(req, res);
  const [states, glossary, sheets] = await Promise.all([
    recordAnswers(learner, [{ questionId: id, correct }]),
    glossaryEntries(),
    sheetsFor([question]),
  ]);
  await track('training_answer', { learnerKey: learner, pathCode: question.paths[0]?.path.code });
  const state = states.get(id)!;

  res.json({
    correct,
    correctAnswerId: answerToken(correctAnswerId),
    explanation: question.explanation,
    answerSource: question.answerSource,
    verifiedAt: question.verifiedAt,
    glossary: findGlossaryTerms([question.explanation], glossary),
    nextReviewAt: state.dueAt,
    sheet: sheetOf(sheets, question),
  });
});
