import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../http/errors.js';
import { learnerKey } from '../http/learner.js';
import { accessOf, freeAllowedIds } from '../premium/access.js';
import { MASTERED_BOX, isDue, recommend } from '../questions/learning.js';
import { visibleWhere } from '../questions/visibility.js';

// Progression du visiteur (E06, E13) : maîtrise par thème, révisions à faire, examens blancs passés.
// Aucune prédiction de réussite (E13).
export const progressRouter = Router();

const query = z.object({ path: z.string().min(1) });

progressRouter.get('/', async (req, res) => {
  const { path: pathSlug } = query.parse(req.query);
  const path = await prisma.path.findUnique({ where: { slug: pathSlug }, select: { id: true, slug: true, title: true } });
  if (!path) throw notFound('Parcours introuvable.');

  const visitor = learnerKey(req);
  const [topics, questions] = await Promise.all([
    prisma.topic.findMany({ orderBy: { position: 'asc' }, select: { id: true, slug: true, title: true } }),
    prisma.question.findMany({ where: { ...visibleWhere, paths: { some: { pathId: path.id } } }, select: { id: true, topicId: true } }),
  ]);
  const states = visitor
    ? await prisma.visitorQuestionState.findMany({
        where: { learnerKey: visitor, questionId: { in: questions.map((question) => question.id) } },
        select: { questionId: true, box: true, attempts: true, correctCount: true, dueAt: true, lastCorrect: true },
      })
    : [];
  const stateById = new Map(states.map((state) => [state.questionId, state]));
  const now = new Date();
  // Offre gratuite : seules les questions qu'elle ouvre se revoient à l'entraînement. Une question vue seulement
  // dans un examen blanc (tiré dans toute la banque) compte dans la maîtrise, pas dans les révisions annoncées.
  const reviewable = (await accessOf(req)).premium ? null : await freeAllowedIds(visitor, path.id, visibleWhere);
  const canReview = (state: { questionId: number }) => reviewable === null || reviewable.has(state.questionId);

  const perTopic = topics.map((topic) => {
    const own = questions.filter((question) => question.topicId === topic.id);
    const seen = own.flatMap((question) => {
      const state = stateById.get(question.id);
      return state ? [state] : [];
    });
    const attempts = seen.reduce((sum, state) => sum + state.attempts, 0);
    const correct = seen.reduce((sum, state) => sum + state.correctCount, 0);
    return {
      slug: topic.slug,
      title: topic.title,
      total: own.length,
      seen: seen.length,
      mastered: seen.filter((state) => state.box >= MASTERED_BOX).length,
      toReview: seen.filter((state) => isDue(state, now) && canReview(state)).length,
      accuracy: attempts > 0 ? correct / attempts : null,
    };
  });

  const upcoming = states.filter((state) => !isDue(state, now) && canReview(state)).map((state) => state.dueAt.getTime());
  const favorites = visitor
    ? await prisma.visitorFavorite.count({ where: { learnerKey: visitor, question: { ...visibleWhere, paths: { some: { pathId: path.id } } } } })
    : 0;
  const exams = visitor
    ? await prisma.examAttempt.findMany({
        where: { learnerKey: visitor, endedAt: { not: null }, template: { pathId: path.id } },
        orderBy: { endedAt: 'desc' },
        take: 10,
        select: { id: true, endedAt: true, score: true, template: { select: { passThreshold: true, knowledgeCount: true, situationCount: true } } },
      })
    : [];

  res.json({
    path: { slug: path.slug, title: path.title },
    totals: {
      questions: questions.length,
      seen: perTopic.reduce((sum, topic) => sum + topic.seen, 0),
      mastered: perTopic.reduce((sum, topic) => sum + topic.mastered, 0),
      toReview: perTopic.reduce((sum, topic) => sum + topic.toReview, 0),
      // Questions manquées à leur dernière réponse (mode « erreurs », E07 et E13)
      errors: states.filter((state) => !state.lastCorrect && canReview(state)).length,
      favorites,
    },
    nextReviewAt: upcoming.length > 0 ? new Date(Math.min(...upcoming)) : null,
    topics: perTopic,
    recommendation: recommend(perTopic),
    exams: exams.map(({ template, ...exam }) => ({
      ...exam,
      total: template.knowledgeCount + template.situationCount,
      passThreshold: template.passThreshold,
      thresholdReached: (exam.score ?? 0) >= template.passThreshold,
    })),
  });
});
