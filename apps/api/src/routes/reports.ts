import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { notFound } from '../http/errors.js';
import { idParam } from '../http/params.js';
import { visibleWhere } from '../questions/visibility.js';

// Signalement d'une erreur dans une question (E08). Les signalements remontent au back-office (A01).
export const reportsRouter = Router();

// Signalement anonyme, sans champ piège (le formulaire du site n'en envoie pas) : plafonds par adresse IP pour qu'un
// script ne noie pas la file de relecture. Quelques signalements par heure, et pas plus de trois par jour pour une même
// question, ce qui laisse plusieurs personnes d'une même salle signaler la même erreur.
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.env === 'test',
});
const questionReportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.env === 'test',
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${String(req.params.id)}`,
});

const reportBody = z.object({
  reason: z.enum(['WRONG_ANSWER', 'UNCLEAR_STATEMENT', 'WRONG_SOURCE', 'OTHER']),
  // Texte libre facultatif et court : on ne demande aucune donnée personnelle.
  message: z.string().trim().max(1000).optional(),
});

reportsRouter.post('/questions/:id/reports', reportLimiter, questionReportLimiter, async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { reason, message } = reportBody.parse(req.body);

  const visible = await prisma.question.count({ where: { id, ...visibleWhere } });
  if (!visible) throw notFound('Question introuvable.');

  await prisma.questionReport.create({ data: { questionId: id, reason, message: message || null } });
  res.status(201).json({ ok: true });
});
