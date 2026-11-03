import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { HttpError, notFound } from '../http/errors.js';
import { learnerKey } from '../http/learner.js';
import { idParam } from '../http/params.js';
import { accessOf, isFreeQuestion } from '../premium/access.js';
import { ANSWER_TOKEN_PATTERN, answerToken } from '../questions/answer-ids.js';
import { correctAnswerOf } from '../questions/logic.js';
import { visibleStatuses, visibleWhere } from '../questions/visibility.js';
import { speechClip, speechConfigured } from '../speech/azure.js';
import { correctionSpeech, questionSpeech, sentence, sheetSpeech } from '../speech/text.js';

// Lecture à voix haute (aide à la lecture, public A2-B1) avec la voix Rémy de Microsoft.
// Les textes sont construits ici à partir des contenus : le service ne lit jamais un texte arbitraire.
// La vitesse de lecture se règle dans le navigateur, sur le même extrait.
export const speechRouter = Router();

speechRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => config.env === 'test',
  }),
);

speechRouter.get('/status', (_req, res) => {
  const available = speechConfigured();
  res.json({ available, voice: available ? 'Rémy' : null });
});

// Chaque extrait absent du cache coûte une synthèse Azure, puis une place dans le cache : les synthèses nouvelles
// sont limitées par adresse IP. Au-delà, le navigateur lit le texte avec sa propre voix.
const synthesisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: false,
  legacyHeaders: false,
  skip: () => config.env === 'test',
  handler: (_req, _res, next) =>
    next(new HttpError(429, 'speech_limit', 'Trop de nouvelles lectures audio en peu de temps. Réessayez dans un moment.')),
});

/** Compte une synthèse nouvelle pour l'adresse IP de la requête ; refusée au-delà de la limite. */
const countSynthesis = (req: Request, res: Response) =>
  new Promise<void>((resolve, reject) => {
    void synthesisLimiter(req, res, (error?: unknown) => (error ? reject(error) : resolve()));
  });

async function sendClip(req: Request, res: Response, text: string, visibility: 'public' | 'private') {
  const audio = await speechClip(text, { log: req.log, beforeSynthesis: () => countSynthesis(req, res) });
  res.set('Cache-Control', `${visibility}, max-age=3600`);
  res.type('audio/mpeg').send(Buffer.from(audio));
}

/** Mêmes droits que l'affichage : offre Premium, questions ouvertes gratuitement, ou questions d'un examen blanc passé. */
async function assertCanHear(req: Request, questionId: number, pathIds: readonly number[]) {
  if ((await accessOf(req)).premium) return;
  const learner = learnerKey(req);
  if (learner && (await prisma.examAttemptQuestion.count({ where: { questionId, attempt: { learnerKey: learner } } })) > 0) return;
  if (await isFreeQuestion(learner, questionId, pathIds, visibleWhere)) return;
  throw new HttpError(403, 'premium_required', 'Cette question fait partie de l’offre Premium.');
}

// Les propositions sont mélangées à l'affichage : le navigateur indique l'ordre dans lequel il les montre, par leurs
// identifiants opaques. L'ordre est obligatoire : celui de la base pourrait annoncer la bonne réponse en premier.
const questionQuery = z.object({
  order: z.string().regex(new RegExp(`^${ANSWER_TOKEN_PATTERN}(,${ANSWER_TOKEN_PATTERN}){1,9}$`), 'L’ordre des propositions est invalide.'),
});

speechRouter.get('/question/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { order } = questionQuery.parse(req.query);
  const question = await prisma.question.findFirst({
    where: { id, ...visibleWhere },
    select: {
      statement: true,
      answers: { select: { id: true, text: true } },
      paths: { where: { path: { active: true } }, select: { pathId: true } },
    },
  });
  if (!question) throw notFound('Question introuvable.');
  await assertCanHear(req, id, question.paths.map((path) => path.pathId));

  // Seule une permutation exacte des propositions de la question est lue : chaque ordre est un extrait de plus en cache.
  const textByToken = new Map(question.answers.map((answer) => [answerToken(answer.id), answer.text]));
  const tokens = order.split(',');
  if (tokens.length !== textByToken.size || new Set(tokens).size !== tokens.length || tokens.some((token) => !textByToken.has(token))) {
    throw new HttpError(400, 'invalid_order', 'L’ordre des propositions est invalide.');
  }
  await sendClip(req, res, questionSpeech(question.statement, tokens.map((token) => textByToken.get(token)!)), 'private');
});

speechRouter.get('/correction/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const question = await prisma.question.findFirst({
    where: { id, ...visibleWhere },
    select: { explanation: true, answers: { select: { id: true, text: true, isCorrect: true } } },
  });
  if (!question) throw notFound('Question introuvable.');

  // La correction s'écoute après une réponse, ou à la fin d'un examen blanc, jamais pendant (§5).
  const learner = learnerKey(req);
  const [answered, inEndedExam, inRunningExam] = learner
    ? await Promise.all([
        prisma.visitorQuestionState.count({ where: { learnerKey: learner, questionId: id } }),
        prisma.examAttemptQuestion.count({ where: { questionId: id, attempt: { learnerKey: learner, endedAt: { not: null } } } }),
        prisma.examAttemptQuestion.count({
          where: { questionId: id, attempt: { learnerKey: learner, endedAt: null, expiresAt: { gt: new Date() } } },
        }),
      ])
    : [0, 0, 0];
  if ((answered === 0 && inEndedExam === 0) || inRunningExam > 0) {
    throw new HttpError(403, 'not_answered', 'La correction s’écoute après votre réponse.');
  }

  const correctId = correctAnswerOf(question.answers);
  const correctText = question.answers.find((answer) => answer.id === correctId)?.text ?? null;
  await sendClip(req, res, correctionSpeech(correctText, question.explanation), 'private');
});

speechRouter.get('/sheet/:slug', async (req, res) => {
  const slug = z.string().min(1).max(120).parse(req.params.slug);
  const sheet = await prisma.revisionSheet.findFirst({
    where: { slug, status: { in: visibleStatuses } },
    select: { title: true, summary: true, keyPoints: true },
  });
  if (!sheet) throw notFound('Fiche introuvable.');
  await sendClip(req, res, sheetSpeech(sheet), 'public');
});

const glossaryQuery = z.object({ term: z.string().min(1).max(120) });

speechRouter.get('/glossary', async (req, res) => {
  const { term } = glossaryQuery.parse(req.query);
  const entry = await prisma.glossaryTerm.findUnique({ where: { term }, select: { term: true, definition: true } });
  if (!entry) throw notFound('Mot introuvable.');
  await sendClip(req, res, `${sentence(entry.term)} ${entry.definition}`, 'public');
});
