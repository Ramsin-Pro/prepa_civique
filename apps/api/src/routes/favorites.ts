import { Router } from 'express';
import { prisma } from '../db.js';
import { notFound } from '../http/errors.js';
import { idParam } from '../http/params.js';
import { ensureLearner, learnerKey } from '../http/learner.js';
import { visibleWhere } from '../questions/visibility.js';

// Favoris (E09, E13) : les questions qu'un visiteur met de côté pour les retravailler.
export const favoritesRouter = Router();

favoritesRouter.put('/:questionId', async (req, res) => {
  const questionId = idParam.parse(req.params.questionId);
  const visible = await prisma.question.count({ where: { id: questionId, ...visibleWhere } });
  if (!visible) throw notFound('Question introuvable.');

  const visitor = ensureLearner(req, res);
  await prisma.visitorFavorite.upsert({
    where: { learnerKey_questionId: { learnerKey: visitor, questionId } },
    create: { learnerKey: visitor, questionId },
    update: {},
  });
  res.json({ favorite: true });
});

favoritesRouter.delete('/:questionId', async (req, res) => {
  const questionId = idParam.parse(req.params.questionId);
  const visitor = learnerKey(req);
  if (visitor) await prisma.visitorFavorite.deleteMany({ where: { learnerKey: visitor, questionId } });
  res.json({ favorite: false });
});
