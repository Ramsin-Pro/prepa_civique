import { Router } from 'express';
import { z } from 'zod';
import { assertTransition, approves, statusAfterSubstantiveEdit } from '../../admin/workflow.js';
import { audit } from '../../audit.js';
import { requireUser, staff, type Auth } from '../../auth/guards.js';
import { prisma } from '../../db.js';
import type { Prisma, QuestionStatus } from '../../generated/prisma/client.js';
import { HttpError, notFound } from '../../http/errors.js';
import { idParam } from '../../http/params.js';
import { answersForInsert, questionSchema, sourceKey } from '../../seed/content.js';

// Gestion des questions (A03) : recherche, édition versionnée, relecture et publication, duplication.
export const adminQuestionsRouter = Router();

const editors = staff('EDITOR', 'SUPER_ADMIN');
const STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] as const;
const today = () => new Date(new Date().toISOString().slice(0, 10));

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  type: z.enum(['OFFICIAL_KNOWLEDGE', 'ORIGINAL_KNOWLEDGE', 'ORIGINAL_SITUATION']).optional(),
  topic: z.string().optional(),
  path: z.string().optional(),
  notion: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  reported: z.enum(['true']).optional(),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

adminQuestionsRouter.get('/', async (req, res) => {
  const query = listQuery.parse(req.query);
  const where: Prisma.QuestionWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.type ? { type: query.type } : {}),
    ...(query.topic ? { topic: { slug: query.topic } } : {}),
    ...(query.path ? { paths: { some: { path: { slug: query.path } } } } : {}),
    ...(query.notion ? { notion: query.notion } : {}),
    ...(query.confidence ? { draftConfidence: query.confidence } : {}),
    ...(query.reported ? { reports: { some: { status: 'OPEN' } } } : {}),
    ...(query.q
      ? {
          OR: [
            { reference: { contains: query.q, mode: 'insensitive' } },
            { statement: { contains: query.q, mode: 'insensitive' } },
            { explanation: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [total, rows, byStatus] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy: { reference: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        reference: true,
        type: true,
        status: true,
        statement: true,
        notion: true,
        draftConfidence: true,
        verifiedAt: true,
        updatedAt: true,
        topic: { select: { slug: true, title: true } },
        _count: { select: { reports: { where: { status: 'OPEN' } } } },
      },
    }),
    prisma.question.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  res.json({
    total,
    page: query.page,
    pageSize: query.pageSize,
    byStatus: Object.fromEntries(byStatus.map((group) => [group.status, group._count._all])),
    items: rows.map(({ _count, ...row }) => ({ ...row, openReports: _count.reports })),
  });
});

adminQuestionsRouter.get('/meta/options', async (_req, res) => {
  const [topics, paths, sources, notions] = await Promise.all([
    prisma.topic.findMany({ orderBy: { position: 'asc' }, select: { slug: true, title: true } }),
    prisma.path.findMany({ orderBy: { position: 'asc' }, select: { slug: true, title: true, code: true } }),
    prisma.source.findMany({ orderBy: { label: 'asc' }, select: { id: true, label: true, url: true } }),
    prisma.question.findMany({ where: { notion: { not: null } }, distinct: ['topicId', 'notion'], select: { notion: true, topic: { select: { slug: true } } } }),
  ]);
  res.json({ topics, paths, sources, notions: notions.map((row) => ({ topic: row.topic.slug, notion: row.notion })) });
});

const detailSelect = {
  id: true,
  reference: true,
  type: true,
  status: true,
  statement: true,
  explanation: true,
  difficulty: true,
  notion: true,
  version: true,
  verifiedAt: true,
  author: true,
  draftConfidence: true,
  reviewNote: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  lastEditedById: true,
  topic: { select: { id: true, slug: true, title: true } },
  paths: { select: { path: { select: { slug: true, title: true, code: true } } } },
  statementSource: { select: { id: true, key: true, label: true, url: true } },
  answerSource: { select: { id: true, key: true, label: true, url: true, licence: true } },
  answers: { select: { id: true, text: true, isCorrect: true, position: true }, orderBy: { position: 'asc' } },
  lastEditedBy: { select: { email: true } },
  reviewedBy: { select: { email: true } },
  versions: {
    orderBy: { version: 'desc' },
    take: 20,
    select: { id: true, version: true, snapshot: true, createdAt: true, editor: { select: { email: true } } },
  },
  reports: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, reason: true, message: true, status: true, createdAt: true } },
} satisfies Prisma.QuestionSelect;

adminQuestionsRouter.get('/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const question = await prisma.question.findUnique({ where: { id }, select: detailSelect });
  if (!question) throw notFound('Question introuvable.');
  const stats = await prisma.visitorQuestionState.aggregate({
    where: { questionId: id },
    _sum: { attempts: true, correctCount: true },
    _count: { _all: true },
  });
  res.json({
    ...question,
    paths: question.paths.map((entry) => entry.path),
    stats: { learners: stats._count._all, attempts: stats._sum.attempts ?? 0, correct: stats._sum.correctCount ?? 0 },
  });
});

const answersInput = z
  .array(z.object({ text: z.string().trim().min(1, 'Une proposition est vide.').max(300), isCorrect: z.boolean() }))
  .length(4, 'Une question a exactement 4 propositions.')
  .refine((answers) => answers.filter((answer) => answer.isCorrect).length === 1, 'Une question a une seule bonne réponse.');

const contentFields = {
  explanation: z.string().trim().min(10, 'L’explication est trop courte.').max(2000),
  answers: answersInput,
  topicSlug: z.string().min(1),
  notion: z.string().trim().max(80).nullable(),
  pathSlugs: z.array(z.string().min(1)).min(1, 'Choisissez au moins un parcours.'),
  answerSourceId: z.number().int().positive().nullable(),
  difficulty: z.number().int().min(1).max(3),
  reviewNote: z.string().trim().max(1000).nullable(),
};

const editBody = z
  .object(contentFields)
  .partial()
  .extend({
    // Version affichée au moment de l'édition : protège contre l'écrasement d'une modification concurrente.
    version: z.number().int().positive(),
    statement: z.string().trim().min(5, 'L’énoncé est trop court.').max(600).optional(),
  });

async function resolveRelations(input: { topicSlug?: string; pathSlugs?: string[]; answerSourceId?: number | null }) {
  const topic = input.topicSlug ? await prisma.topic.findUnique({ where: { slug: input.topicSlug }, select: { id: true } }) : null;
  if (input.topicSlug && !topic) throw new HttpError(400, 'invalid_topic', 'Thème inconnu.');
  const paths = input.pathSlugs ? await prisma.path.findMany({ where: { slug: { in: input.pathSlugs } }, select: { id: true } }) : null;
  if (input.pathSlugs && paths!.length !== new Set(input.pathSlugs).size) throw new HttpError(400, 'invalid_path', 'Parcours inconnu.');
  if (input.answerSourceId && !(await prisma.source.count({ where: { id: input.answerSourceId } }))) {
    throw new HttpError(400, 'invalid_source', 'Source inconnue.');
  }
  return { topicId: topic?.id, pathIds: paths?.map((path) => path.id) };
}

type QuestionDetail = Prisma.QuestionGetPayload<{ select: typeof detailSelect }>;

/** État d'une question avant modification, gardé dans l'historique des versions (§5). */
const snapshotOf = (question: QuestionDetail) =>
  ({
    statement: question.statement,
    explanation: question.explanation,
    answers: question.answers.map(({ text, isCorrect, position }) => ({ text, isCorrect, position })),
    topic: question.topic.slug,
    notion: question.notion,
    paths: question.paths.map((entry) => entry.path.slug),
    answerSourceId: question.answerSource?.id ?? null,
    difficulty: question.difficulty,
    status: question.status,
    reviewNote: question.reviewNote,
  }) satisfies Prisma.InputJsonValue;

adminQuestionsRouter.patch('/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const body = editBody.parse(req.body);
  const question = await prisma.question.findUnique({ where: { id }, select: detailSelect });
  if (!question) throw notFound('Question introuvable.');
  if (question.version !== body.version) {
    throw new HttpError(409, 'version_conflict', 'Cette question a été modifiée entre-temps. Rechargez la page pour voir la dernière version.');
  }
  // L'énoncé d'une question officielle est repris mot pour mot de la liste publiée (charte éditoriale §2).
  const statementChanged = body.statement !== undefined && body.statement !== question.statement;
  if (statementChanged && question.type === 'OFFICIAL_KNOWLEDGE') {
    throw new HttpError(400, 'official_statement_locked', 'L’énoncé d’une question officielle ne se modifie pas : il reprend la liste publiée.');
  }

  const { topicId, pathIds } = await resolveRelations(body);
  // Les propositions du formulaire sont celles de la question, dans l'ordre de leurs positions enregistrées
  // (de 0 ou de 1 selon l'origine de la question) : chacune met à jour la sienne, jamais une ligne de plus.
  if (body.answers && body.answers.length !== question.answers.length) {
    throw new HttpError(
      409,
      'answers_mismatch',
      `Cette question a ${question.answers.length} propositions enregistrées au lieu de 4 : elle doit être corrigée avant toute modification.`,
    );
  }
  // Relecture à quatre yeux : tout ce que le candidat lit (énoncé, propositions, bonne réponse, explication, source)
  // renvoie une question validée ou publiée en relecture quand il change.
  const answersChanged =
    body.answers !== undefined &&
    body.answers.some((answer, index) => answer.text !== question.answers[index]!.text || answer.isCorrect !== question.answers[index]!.isCorrect);
  const explanationChanged = body.explanation !== undefined && body.explanation !== question.explanation;
  const sourceChanged = body.answerSourceId !== undefined && body.answerSourceId !== (question.answerSource?.id ?? null);
  const substantive = statementChanged || answersChanged || explanationChanged || sourceChanged;
  const status = substantive ? statusAfterSubstantiveEdit(question.status) : question.status;

  await prisma.$transaction(async (tx) => {
    await tx.questionVersion.create({
      data: { questionId: id, version: question.version, snapshot: snapshotOf(question), editorId: actor.userId },
    });
    await tx.question.update({
      where: { id },
      data: {
        ...(body.statement !== undefined ? { statement: body.statement } : {}),
        ...(body.explanation !== undefined ? { explanation: body.explanation } : {}),
        ...(topicId !== undefined ? { topicId } : {}),
        ...(body.notion !== undefined ? { notion: body.notion || null } : {}),
        ...(body.answerSourceId !== undefined ? { answerSourceId: body.answerSourceId } : {}),
        ...(body.difficulty !== undefined ? { difficulty: body.difficulty } : {}),
        ...(body.reviewNote !== undefined ? { reviewNote: body.reviewNote || null } : {}),
        status,
        ...(status !== question.status ? { reviewedById: null } : {}),
        version: question.version + 1,
        lastEditedById: actor.userId,
      },
    });
    // Les propositions sont mises à jour à leur place (même ligne, même position) : les examens déjà passés gardent
    // leurs références, et l'historique des versions relie l'ancien contenu aux mêmes lignes.
    if (body.answers) {
      for (const [index, answer] of body.answers.entries()) {
        await tx.answer.update({
          where: { id: question.answers[index]!.id },
          data: { text: answer.text, isCorrect: answer.isCorrect },
        });
      }
    }
    if (pathIds) {
      await tx.questionPath.deleteMany({ where: { questionId: id, pathId: { notIn: pathIds } } });
      await tx.questionPath.createMany({ data: pathIds.map((pathId) => ({ questionId: id, pathId })), skipDuplicates: true });
    }
  });
  await audit(actor.userId, 'question.edit', 'question', id, {
    version: question.version + 1,
    ...(status !== question.status ? { status: { from: question.status, to: status } } : {}),
  });
  res.json({ ok: true, status, statusChanged: status !== question.status });
});

const transitionBody = z.object({ to: z.enum(STATUSES), note: z.string().trim().max(1000).optional() });

/** Change le statut d'une question en respectant le workflow, et le note au journal. */
async function transitionQuestion(actor: Auth, id: number, to: QuestionStatus, note?: string) {
  const question = await prisma.question.findUnique({ where: { id }, select: { status: true, lastEditedById: true, reference: true } });
  if (!question) throw notFound('Question introuvable.');
  const { selfApproved } = assertTransition(question.status, to, actor, question.lastEditedById);
  const approving = approves(question.status, to);
  await prisma.question.update({
    where: { id },
    data: {
      status: to,
      ...(approving ? { reviewedById: actor.userId, verifiedAt: today() } : {}),
      ...(to === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
      ...(note ? { reviewNote: note } : {}),
    },
  });
  await audit(actor.userId, `question.${to.toLowerCase()}`, 'question', id, {
    from: question.status,
    to,
    ...(selfApproved ? { selfApproved: true } : {}),
    ...(note ? { note } : {}),
  });
}

adminQuestionsRouter.post('/:id/transition', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const { to, note } = transitionBody.parse(req.body);
  await transitionQuestion(actor, id, to, note);
  res.json({ ok: true, status: to });
});

// Relecture par lots : chaque question est traitée séparément, les refus sont expliqués un par un.
const bulkBody = z.object({ ids: z.array(z.number().int().positive()).min(1).max(200), to: z.enum(STATUSES) });

adminQuestionsRouter.post('/bulk-transition', editors, async (req, res) => {
  const actor = requireUser(req);
  const { ids, to } = bulkBody.parse(req.body);
  const results: { id: number; ok: boolean; error?: string }[] = [];
  for (const id of new Set(ids)) {
    try {
      await transitionQuestion(actor, id, to);
      results.push({ id, ok: true });
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      results.push({ id, ok: false, error: error.message });
    }
  }
  res.json({ results, done: results.filter((result) => result.ok).length });
});

const createBody = z.object({
  type: z.enum(['ORIGINAL_KNOWLEDGE', 'ORIGINAL_SITUATION']),
  statement: z.string().trim().min(5, 'L’énoncé est trop court.').max(600),
  ...contentFields,
  notion: contentFields.notion.optional(),
  answerSourceId: contentFields.answerSourceId.optional(),
  difficulty: contentFields.difficulty.default(1),
  reviewNote: contentFields.reviewNote.optional(),
});

/**
 * Référence d'une question créée au back-office : BO-<code du thème>[S]-<numéro>.
 * Le préfixe BO évite toute collision avec les références des fichiers de contenu (CSP-…).
 */
async function nextReference(topicId: number, situation: boolean) {
  const sample = await prisma.question.findFirst({ where: { topicId, reference: { startsWith: 'CSP-' } }, select: { reference: true } });
  const topic = await prisma.topic.findUniqueOrThrow({ where: { id: topicId }, select: { slug: true } });
  const code = /^CSP-([A-Z]{2})/.exec(sample?.reference ?? '')?.[1] ?? topic.slug.slice(0, 2).toUpperCase();
  const prefix = `BO-${code}${situation ? 'S' : ''}-`;
  const existing = await prisma.question.findMany({ where: { reference: { startsWith: prefix } }, select: { reference: true } });
  const max = existing.reduce((highest, row) => Math.max(highest, Number(row.reference.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

adminQuestionsRouter.post('/', editors, async (req, res) => {
  const actor = requireUser(req);
  const body = createBody.parse(req.body);
  const { topicId, pathIds } = await resolveRelations(body);
  const reference = await nextReference(topicId!, body.type === 'ORIGINAL_SITUATION');
  const question = await prisma.question.create({
    data: {
      reference,
      type: body.type,
      status: 'DRAFT',
      statement: body.statement,
      explanation: body.explanation,
      difficulty: body.difficulty,
      topicId: topicId!,
      notion: body.notion || null,
      answerSourceId: body.answerSourceId ?? null,
      reviewNote: body.reviewNote || null,
      author: actor.email,
      lastEditedById: actor.userId,
      paths: { create: pathIds!.map((pathId) => ({ pathId })) },
      answers: { create: body.answers.map((answer, position) => ({ ...answer, position })) },
    },
    select: { id: true, reference: true },
  });
  await audit(actor.userId, 'question.create', 'question', question.id, { reference });
  res.status(201).json(question);
});

adminQuestionsRouter.post('/:id/duplicate', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const source = await prisma.question.findUnique({ where: { id }, select: detailSelect });
  if (!source) throw notFound('Question introuvable.');
  // Une copie est toujours une question de l'équipe : une officielle copiée devient une question originale.
  const type = source.type === 'OFFICIAL_KNOWLEDGE' ? 'ORIGINAL_KNOWLEDGE' : source.type;
  const reference = await nextReference(source.topic.id, type === 'ORIGINAL_SITUATION');
  const paths = await prisma.questionPath.findMany({ where: { questionId: id }, select: { pathId: true } });
  const copy = await prisma.question.create({
    data: {
      reference,
      type,
      status: 'DRAFT',
      statement: source.statement,
      explanation: source.explanation,
      difficulty: source.difficulty,
      topicId: source.topic.id,
      notion: source.notion,
      answerSourceId: source.answerSource?.id ?? null,
      reviewNote: `Copie de ${source.reference}`,
      author: actor.email,
      lastEditedById: actor.userId,
      paths: { create: paths.map(({ pathId }) => ({ pathId })) },
      answers: { create: source.answers.map(({ text, isCorrect, position }) => ({ text, isCorrect, position })) },
    },
    select: { id: true, reference: true },
  });
  await audit(actor.userId, 'question.duplicate', 'question', copy.id, { from: source.reference });
  res.status(201).json(copy);
});

// Import (A03) : un fichier au format des contenus (docs/charte-editoriale.md), la bonne réponse en premier.
// Les propositions sont mélangées avant l'insertion : ni leur position ni leur numéro ne désignent la bonne réponse.
// Seules les questions rédigées par l'équipe s'importent ici, toujours en brouillon : les énoncés officiels
// passent par le chargement des listes officielles, qui vérifie chaque énoncé mot pour mot.
const importBody = z.object({
  topic: z.string().min(1),
  pathSlugs: z.array(z.string().min(1)).min(1),
  questions: z.array(z.unknown()).max(300).default([]),
  situations: z.array(z.unknown()).max(300).default([]),
});

adminQuestionsRouter.post('/import', editors, async (req, res) => {
  const actor = requireUser(req);
  const body = importBody.parse(req.body);
  const { topicId, pathIds } = await resolveRelations({ topicSlug: body.topic, pathSlugs: body.pathSlugs });
  const results: { reference: string; ok: boolean; error?: string }[] = [];

  for (const raw of [...body.questions, ...body.situations]) {
    const parsed = questionSchema.safeParse(raw);
    const reference = (raw as { reference?: unknown })?.reference;
    const label = typeof reference === 'string' ? reference : '?';
    if (!parsed.success) {
      results.push({ reference: label, ok: false, error: parsed.error.issues.map((issue) => `${issue.path.join('.')} : ${issue.message}`).join(' ; ') });
      continue;
    }
    const question = parsed.data;
    if (question.type === 'OFFICIAL_KNOWLEDGE') {
      results.push({ reference: label, ok: false, error: 'Les questions officielles se chargent avec la liste officielle, pas par import.' });
      continue;
    }
    if (await prisma.question.count({ where: { reference: question.reference } })) {
      results.push({ reference: label, ok: false, error: 'Cette référence existe déjà.' });
      continue;
    }
    let answerSourceId: number | null = null;
    if (question.answerSource) {
      const key = sourceKey(question.answerSource);
      answerSourceId = (
        await prisma.source.upsert({
          where: { key },
          create: { key, label: question.answerSource.label, url: question.answerSource.url ?? null },
          update: {},
          select: { id: true },
        })
      ).id;
    }
    const created = await prisma.question.create({
      data: {
        reference: question.reference,
        type: question.type,
        status: 'DRAFT',
        statement: question.statement,
        explanation: question.explanation,
        difficulty: question.difficulty,
        topicId: topicId!,
        notion: question.type === 'ORIGINAL_SITUATION' ? null : (question.notion ?? null),
        answerSourceId,
        draftConfidence: question.confidence,
        reviewNote: question.reviewNote ?? null,
        author: actor.email,
        lastEditedById: actor.userId,
        paths: { create: pathIds!.map((pathId) => ({ pathId })) },
        answers: { create: answersForInsert(question.answers).map((answer, position) => ({ ...answer, position })) },
      },
      select: { id: true },
    });
    results.push({ reference: question.reference, ok: true });
    await audit(actor.userId, 'question.import', 'question', created.id, { reference: question.reference });
  }
  res.status(201).json({ imported: results.filter((result) => result.ok).length, results });
});
