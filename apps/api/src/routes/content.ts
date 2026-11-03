import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { normalizeChannel, track } from '../audit.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { notFound } from '../http/errors.js';
import { ensureLearner, learnerKey } from '../http/learner.js';
import { sendMail } from '../mail/mailer.js';
import { contactAckMail } from '../mail/templates.js';
import { answerToken } from '../questions/answer-ids.js';
import { answerSourceSelect } from '../questions/public.js';
import { visibleStatuses, visibleWhere } from '../questions/visibility.js';

// Contenus publics : fiches de révision (E12), pages éditoriales et légales, contact (E17),
// et mesure d'audience interne sans traceur (A08).
export const contentRouter = Router();

const slugParam = z.string().min(1).max(120);
const visibleContent = { status: { in: visibleStatuses } };

/** Fiches mises de côté par l'apprenant (E12). */
async function favoriteSheetIds(req: Request): Promise<Set<number>> {
  const learner = learnerKey(req);
  if (!learner) return new Set();
  const rows = await prisma.sheetFavorite.findMany({ where: { learnerKey: learner }, select: { sheetId: true } });
  return new Set(rows.map((row) => row.sheetId));
}

contentRouter.get('/sheets', async (req, res) => {
  const favorites = await favoriteSheetIds(req);
  const topics = await prisma.topic.findMany({
    orderBy: { position: 'asc' },
    select: {
      slug: true,
      title: true,
      sheets: {
        where: visibleContent,
        orderBy: { position: 'asc' },
        select: { id: true, slug: true, title: true, summary: true, notion: true, status: true },
      },
    },
  });
  res.json(
    topics.map(({ sheets, ...topic }) => ({
      ...topic,
      sheets: sheets.map(({ id, status, ...sheet }) => ({ ...sheet, inReview: status !== 'PUBLISHED', favorite: favorites.has(id) })),
    })),
  );
});

contentRouter.get('/sheets/:slug', async (req, res) => {
  const slug = slugParam.parse(req.params.slug);
  const sheet = await prisma.revisionSheet.findFirst({
    where: { slug, ...visibleContent },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      notion: true,
      keyPoints: true,
      examples: true,
      vocabulary: true,
      sources: true,
      status: true,
      reviewedByName: true,
      reviewedAt: true,
      updatedAt: true,
      topicId: true,
      topic: { select: { slug: true, title: true } },
    },
  });
  if (!sheet) throw notFound('Fiche introuvable.');

  const [questionCount, siblings, favorites] = await Promise.all([
    sheet.notion ? prisma.question.count({ where: { ...visibleWhere, topicId: sheet.topicId, notion: sheet.notion } }) : 0,
    prisma.revisionSheet.findMany({
      where: { topicId: sheet.topicId, ...visibleContent },
      orderBy: { position: 'asc' },
      select: { slug: true, title: true },
    }),
    favoriteSheetIds(req),
  ]);
  const index = siblings.findIndex((sibling) => sibling.slug === slug);
  const { id, status, topicId: _topicId, ...rest } = sheet;
  res.json({
    ...rest,
    inReview: status !== 'PUBLISHED',
    favorite: favorites.has(id),
    questionCount,
    previous: siblings[index - 1] ?? null,
    next: siblings[index + 1] ?? null,
  });
});

contentRouter.put('/sheets/:slug/favorite', async (req, res) => {
  const slug = slugParam.parse(req.params.slug);
  const sheet = await prisma.revisionSheet.findFirst({ where: { slug, ...visibleContent }, select: { id: true } });
  if (!sheet) throw notFound('Fiche introuvable.');
  const learner = ensureLearner(req, res);
  await prisma.sheetFavorite.upsert({
    where: { learnerKey_sheetId: { learnerKey: learner, sheetId: sheet.id } },
    create: { learnerKey: learner, sheetId: sheet.id },
    update: {},
  });
  res.json({ favorite: true });
});

contentRouter.delete('/sheets/:slug/favorite', async (req, res) => {
  const slug = slugParam.parse(req.params.slug);
  const learner = learnerKey(req);
  if (learner) await prisma.sheetFavorite.deleteMany({ where: { learnerKey: learner, sheet: { slug } } });
  res.json({ favorite: false });
});

/**
 * Témoignages publiés (E01) : uniquement des personnes inscrites, avec leur accord, après modération. La date de
 * publication accompagne chaque avis (Code de la consommation, D111-17).
 */
contentRouter.get('/testimonials', async (_req, res) => {
  const [testimonials, paths] = await Promise.all([
    prisma.testimonial.findMany({
      where: { status: 'APPROVED' },
      orderBy: { reviewedAt: 'desc' },
      take: 6,
      select: { id: true, displayName: true, text: true, pathCode: true, reviewedAt: true },
    }),
    prisma.path.findMany({ select: { code: true, title: true } }),
  ]);
  const titles = new Map(paths.map((path) => [path.code, path.title]));
  res.json(
    testimonials.map(({ pathCode, reviewedAt, ...testimonial }) => ({
      ...testimonial,
      pathTitle: pathCode ? (titles.get(pathCode) ?? null) : null,
      publishedAt: reviewedAt,
    })),
  );
});

/**
 * Exemple de correction pour les pages Accueil et Tarifs (montrer le niveau de langue avant de payer). Une vraie question,
 * soumise aux mêmes règles de publication que l'entraînement : tant qu'elle n'est pas relue et publiée, rien n'est montré.
 */
export const EXAMPLE_QUESTION_REFERENCE = 'CSP-PV-031';

contentRouter.get('/example-correction', async (_req, res) => {
  const question = await prisma.question.findFirst({
    where: { reference: EXAMPLE_QUESTION_REFERENCE, ...visibleWhere },
    select: {
      id: true,
      status: true,
      statement: true,
      explanation: true,
      answers: { select: { id: true, text: true, isCorrect: true }, orderBy: { position: 'asc' } },
      answerSource: answerSourceSelect,
    },
  });
  if (!question) throw notFound('Aucun exemple publié.');
  const { status, answers, ...rest } = question;
  res.json({ ...rest, answers: answers.map((answer) => ({ ...answer, id: answerToken(answer.id) })), inReview: status !== 'PUBLISHED' });
});

contentRouter.get('/pages/:slug', async (req, res) => {
  const slug = slugParam.parse(req.params.slug);
  const page = await prisma.contentPage.findFirst({
    where: { slug, ...visibleContent },
    select: { slug: true, title: true, body: true, status: true, reviewedAt: true, updatedAt: true },
  });
  if (!page) throw notFound('Page introuvable.');
  const { status, ...rest } = page;
  res.json({ ...rest, inReview: status !== 'PUBLISHED' });
});

// Contact (E17) : collecte minimale, accusé de réception, aucune pièce jointe ni document d'identité.
const CONTACT_TOPICS = {
  compte: 'Mon compte',
  paiement: 'Paiement et accès Premium',
  contenu: 'Une question ou une fiche',
  donnees: 'Mes données personnelles',
  autre: 'Autre demande',
} as const;

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.env === 'test',
});

const contactBody = z.object({
  email: z.email('Adresse email invalide.').max(254),
  topic: z.enum(Object.keys(CONTACT_TOPICS) as [keyof typeof CONTACT_TOPICS, ...(keyof typeof CONTACT_TOPICS)[]]),
  message: z.string().trim().min(10, 'Votre message est trop court.').max(3000, 'Votre message est trop long (3 000 caractères au plus).'),
  // Champ invisible pour les personnes : seuls les robots le remplissent.
  website: z.string().max(200).optional(),
});

contentRouter.post('/contact', contactLimiter, async (req, res) => {
  const { email, topic, message, website } = contactBody.parse(req.body);
  if (website) {
    res.status(201).json({ ok: true });
    return;
  }
  const subject = CONTACT_TOPICS[topic];
  const to = email.toLowerCase();
  await prisma.contactMessage.create({ data: { email: to, subject, message, userId: req.auth?.userId ?? null } });
  await sendMail(contactAckMail(to, subject));
  res.status(201).json({ ok: true });
});

// Mesure d'audience interne (A08) : un compteur par jour, sans cookie ni adresse IP.
// Chaque appel ajoute une ligne : plafond par adresse IP (visites et offre ensemble), pour qu'un script ne remplisse pas
// la table ni ne fausse les chiffres. Le site envoie une visite par session et quelques vues de l'offre : une salle
// d'association derrière une même adresse reste loin du plafond.
const analyticsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.env === 'test',
});

const visitBody = z.object({
  path: z.string().max(60).optional(),
  channel: z.string().max(100).optional(),
});

contentRouter.post('/analytics/visit', analyticsLimiter, async (req, res) => {
  const { path, channel } = visitBody.parse(req.body ?? {});
  const pathCode = path ? ((await prisma.path.findUnique({ where: { slug: path }, select: { code: true } }))?.code ?? null) : null;
  await track('visit', { learnerKey: learnerKey(req), pathCode, channel: normalizeChannel(channel) });
  res.status(204).end();
});

// Offre Premium vue ou cliquée (A08) : pour savoir quel endroit du site amène réellement vers les tarifs.
export const OFFER_PLACES = ['quiz', 'resultat-examen', 'examen-blanc', 'accueil'] as const;
const offerBody = z.object({ event: z.enum(['view', 'click']), place: z.enum(OFFER_PLACES), path: z.string().max(60).optional() });

contentRouter.post('/analytics/offer', analyticsLimiter, async (req, res) => {
  const { event, place, path } = offerBody.parse(req.body ?? {});
  const pathCode = path ? ((await prisma.path.findUnique({ where: { slug: path }, select: { code: true } }))?.code ?? null) : null;
  await track(event === 'view' ? 'paywall_view' : 'premium_click', { learnerKey: learnerKey(req), pathCode, place });
  res.status(204).end();
});
