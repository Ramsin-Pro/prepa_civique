import { Router } from 'express';
import { z } from 'zod';
import { assertTransition, approves } from '../../admin/workflow.js';
import { audit } from '../../audit.js';
import { requireUser, staff } from '../../auth/guards.js';
import { prisma } from '../../db.js';
import { HttpError, notFound } from '../../http/errors.js';
import { idParam } from '../../http/params.js';
import { clearGlossaryCache } from '../../questions/glossary-store.js';

// Contenus éditoriaux (A02, A05) : parcours et thèmes, fiches de révision, pages, lexique,
// et suivi des signalements d'erreur (A01).
export const adminEditorialRouter = Router();

const editors = staff('EDITOR', 'SUPER_ADMIN');
const STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'] as const;
const today = () => new Date(new Date().toISOString().slice(0, 10));
const statusQuery = z.object({ status: z.enum(STATUSES).optional() });

/** Dernière personne à avoir modifié une fiche ou une page, d'après le journal (relecture à quatre yeux). */
async function lastEditor(entity: 'sheet' | 'page', id: number) {
  const entry = await prisma.auditLog.findFirst({
    where: { entity, entityId: String(id), action: `${entity}.edit` },
    orderBy: { createdAt: 'desc' },
    select: { actorId: true },
  });
  return entry?.actorId ?? null;
}

// ─── Parcours et thèmes (A02) ───────────────────────────────────────────────

adminEditorialRouter.get('/paths', async (_req, res) => {
  const [paths, topics] = await Promise.all([
    prisma.path.findMany({
      orderBy: { position: 'asc' },
      select: {
        id: true,
        code: true,
        slug: true,
        title: true,
        description: true,
        active: true,
        position: true,
        sources: true,
        verifiedAt: true,
        _count: { select: { questions: true, users: true } },
        examTemplates: { where: { active: true }, select: { version: true } },
      },
    }),
    prisma.topic.findMany({
      orderBy: { position: 'asc' },
      select: { id: true, slug: true, title: true, position: true, _count: { select: { questions: true, sheets: true } } },
    }),
  ]);
  res.json({
    paths: paths.map(({ _count, examTemplates, ...path }) => ({
      ...path,
      questionCount: _count.questions,
      learnerCount: _count.users,
      activeExamVersion: examTemplates[0]?.version ?? null,
    })),
    topics: topics.map(({ _count, ...topic }) => ({ ...topic, questionCount: _count.questions, sheetCount: _count.sheets })),
  });
});

const pathBody = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().min(10).max(1000).optional(),
  active: z.boolean().optional(),
  position: z.number().int().min(0).max(100).optional(),
  // Sources officielles et date de vérification affichées sur la page du parcours (E03)
  sources: z.array(z.object({ label: z.string().trim().min(3).max(200), url: z.url() })).max(10).optional(),
  verifiedAt: z.iso.date().nullable().optional(),
});

adminEditorialRouter.patch('/paths/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const body = pathBody.parse(req.body);
  if (!(await prisma.path.count({ where: { id } }))) throw notFound('Parcours introuvable.');
  const { verifiedAt, ...fields } = body;
  await prisma.path.update({
    where: { id },
    data: { ...fields, ...(verifiedAt !== undefined ? { verifiedAt: verifiedAt ? new Date(verifiedAt) : null } : {}) },
  });
  await audit(actor.userId, 'path.edit', 'path', id, body);
  res.json({ ok: true });
});

const topicBody = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  position: z.number().int().min(0).max(100).optional(),
});

const newTopicBody = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Adresse en minuscules et tirets.').max(80),
  title: z.string().trim().min(3).max(120),
  position: z.number().int().min(0).max(100).default(0),
});

adminEditorialRouter.post('/topics', editors, async (req, res) => {
  const actor = requireUser(req);
  const body = newTopicBody.parse(req.body);
  if (await prisma.topic.count({ where: { slug: body.slug } })) throw new HttpError(409, 'duplicate_topic', 'Ce thème existe déjà.');
  const topic = await prisma.topic.create({ data: body, select: { id: true, slug: true } });
  await audit(actor.userId, 'topic.create', 'topic', topic.id, body);
  res.status(201).json(topic);
});

adminEditorialRouter.patch('/topics/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const body = topicBody.parse(req.body);
  if (!(await prisma.topic.count({ where: { id } }))) throw notFound('Thème introuvable.');
  await prisma.topic.update({ where: { id }, data: body });
  await audit(actor.userId, 'topic.edit', 'topic', id, body);
  res.json({ ok: true });
});

// ─── Fiches de révision (A05, E12) ───────────────────────────────────────────

adminEditorialRouter.get('/sheets', async (req, res) => {
  const { status } = statusQuery.parse(req.query);
  const sheets = await prisma.revisionSheet.findMany({
    where: status ? { status } : {},
    orderBy: [{ topic: { position: 'asc' } }, { position: 'asc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      notion: true,
      status: true,
      draftConfidence: true,
      reviewedAt: true,
      publishedAt: true,
      updatedAt: true,
      topic: { select: { slug: true, title: true } },
    },
  });
  res.json(sheets);
});

adminEditorialRouter.get('/sheets/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const sheet = await prisma.revisionSheet.findUnique({ where: { id }, include: { topic: { select: { slug: true, title: true } } } });
  if (!sheet) throw notFound('Fiche introuvable.');
  res.json(sheet);
});

const sheetBody = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  summary: z.string().trim().min(10).max(1500).optional(),
  notion: z.string().trim().max(80).nullable().optional(),
  position: z.number().int().min(0).max(1000).optional(),
  keyPoints: z.array(z.string().trim().min(1).max(500)).max(12).optional(),
  examples: z.array(z.string().trim().min(1).max(600)).max(8).optional(),
  vocabulary: z.array(z.object({ term: z.string().trim().min(1).max(80), definition: z.string().trim().min(1).max(400) })).max(12).optional(),
  sources: z.array(z.object({ label: z.string().trim().min(1).max(200), url: z.url() })).max(8).optional(),
  reviewNote: z.string().trim().max(4000).nullable().optional(),
});

adminEditorialRouter.patch('/sheets/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const body = sheetBody.parse(req.body);
  const sheet = await prisma.revisionSheet.findUnique({ where: { id }, select: { status: true } });
  if (!sheet) throw notFound('Fiche introuvable.');
  // Une fiche validée ou publiée qui change repasse en relecture.
  const status = sheet.status === 'APPROVED' || sheet.status === 'PUBLISHED' ? 'IN_REVIEW' : sheet.status;
  await prisma.revisionSheet.update({ where: { id }, data: { ...body, notion: body.notion === '' ? null : body.notion, status } });
  await audit(actor.userId, 'sheet.edit', 'sheet', id, { fields: Object.keys(body), ...(status !== sheet.status ? { status } : {}) });
  res.json({ ok: true, status, statusChanged: status !== sheet.status });
});

const sheetTransitionBody = z.object({
  to: z.enum(STATUSES),
  // Nom affiché sur la fiche publiée (E12) : jamais l'adresse email d'un membre de l'équipe.
  reviewerName: z.string().trim().min(2).max(120).optional(),
});

adminEditorialRouter.post('/sheets/:id/transition', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const { to, reviewerName } = sheetTransitionBody.parse(req.body);
  const sheet = await prisma.revisionSheet.findUnique({ where: { id }, select: { status: true, reviewedByName: true } });
  if (!sheet) throw notFound('Fiche introuvable.');
  const { selfApproved } = assertTransition(sheet.status, to, actor, await lastEditor('sheet', id));
  const approving = approves(sheet.status, to);
  await prisma.revisionSheet.update({
    where: { id },
    data: {
      status: to,
      ...(approving ? { reviewedAt: today(), reviewedByName: reviewerName ?? sheet.reviewedByName ?? 'Équipe éditoriale' } : {}),
      ...(to === 'PUBLISHED' ? { publishedAt: new Date() } : {}),
    },
  });
  await audit(actor.userId, `sheet.${to.toLowerCase()}`, 'sheet', id, { from: sheet.status, to, ...(selfApproved ? { selfApproved } : {}) });
  res.json({ ok: true, status: to });
});

// ─── Pages éditoriales et légales (A05) ──────────────────────────────────────

adminEditorialRouter.get('/pages', async (_req, res) => {
  res.json(
    await prisma.contentPage.findMany({
      orderBy: { slug: 'asc' },
      select: { id: true, slug: true, title: true, status: true, reviewedAt: true, publishedAt: true, updatedAt: true },
    }),
  );
});

adminEditorialRouter.get('/pages/:id', async (req, res) => {
  const id = idParam.parse(req.params.id);
  const page = await prisma.contentPage.findUnique({ where: { id } });
  if (!page) throw notFound('Page introuvable.');
  res.json(page);
});

const pageBody = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  body: z.string().trim().min(10).max(100_000).optional(),
});

adminEditorialRouter.patch('/pages/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const body = pageBody.parse(req.body);
  const page = await prisma.contentPage.findUnique({ where: { id }, select: { status: true } });
  if (!page) throw notFound('Page introuvable.');
  const status = page.status === 'APPROVED' || page.status === 'PUBLISHED' ? 'IN_REVIEW' : page.status;
  await prisma.contentPage.update({ where: { id }, data: { ...body, status } });
  await audit(actor.userId, 'page.edit', 'page', id, { fields: Object.keys(body), ...(status !== page.status ? { status } : {}) });
  res.json({ ok: true, status, statusChanged: status !== page.status });
});

adminEditorialRouter.post('/pages/:id/transition', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const { to } = z.object({ to: z.enum(STATUSES) }).parse(req.body);
  const page = await prisma.contentPage.findUnique({ where: { id }, select: { status: true } });
  if (!page) throw notFound('Page introuvable.');
  const { selfApproved } = assertTransition(page.status, to, actor, await lastEditor('page', id));
  await prisma.contentPage.update({
    where: { id },
    data: { status: to, ...(approves(page.status, to) ? { reviewedAt: new Date() } : {}), ...(to === 'PUBLISHED' ? { publishedAt: new Date() } : {}) },
  });
  await audit(actor.userId, `page.${to.toLowerCase()}`, 'page', id, { from: page.status, to, ...(selfApproved ? { selfApproved } : {}) });
  res.json({ ok: true, status: to });
});

// ─── Lexique ─────────────────────────────────────────────────────────────────

adminEditorialRouter.get('/glossary', async (_req, res) => {
  res.json(await prisma.glossaryTerm.findMany({ orderBy: { term: 'asc' } }));
});

const glossaryBody = z.object({
  term: z.string().trim().min(2).max(80),
  definition: z.string().trim().min(5).max(400),
});

adminEditorialRouter.post('/glossary', editors, async (req, res) => {
  const actor = requireUser(req);
  const body = glossaryBody.parse(req.body);
  if (await prisma.glossaryTerm.count({ where: { term: { equals: body.term, mode: 'insensitive' } } })) {
    throw new HttpError(409, 'duplicate_term', 'Ce mot est déjà dans le lexique.');
  }
  const entry = await prisma.glossaryTerm.create({ data: body });
  clearGlossaryCache();
  await audit(actor.userId, 'glossary.create', 'glossary', entry.id, { term: entry.term });
  res.status(201).json(entry);
});

adminEditorialRouter.patch('/glossary/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const body = glossaryBody.partial().parse(req.body);
  if (!(await prisma.glossaryTerm.count({ where: { id } }))) throw notFound('Mot introuvable.');
  await prisma.glossaryTerm.update({ where: { id }, data: body });
  clearGlossaryCache();
  await audit(actor.userId, 'glossary.edit', 'glossary', id, body);
  res.json({ ok: true });
});

adminEditorialRouter.delete('/glossary/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const entry = await prisma.glossaryTerm.findUnique({ where: { id }, select: { term: true } });
  if (!entry) throw notFound('Mot introuvable.');
  await prisma.glossaryTerm.delete({ where: { id } });
  clearGlossaryCache();
  await audit(actor.userId, 'glossary.delete', 'glossary', id, { term: entry.term });
  res.status(204).end();
});

// ─── Signalements d'erreur (E08 → A01) ───────────────────────────────────────

const reportsQuery = z.object({ status: z.enum(['OPEN', 'RESOLVED', 'REJECTED']).default('OPEN') });

adminEditorialRouter.get('/reports', async (req, res) => {
  const { status } = reportsQuery.parse(req.query);
  const reports = await prisma.questionReport.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      reason: true,
      message: true,
      status: true,
      createdAt: true,
      question: { select: { id: true, reference: true, statement: true, status: true } },
    },
  });
  res.json(reports);
});

const reportBody = z.object({ status: z.enum(['OPEN', 'RESOLVED', 'REJECTED']) });

adminEditorialRouter.patch('/reports/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const { status } = reportBody.parse(req.body);
  if (!(await prisma.questionReport.count({ where: { id } }))) throw notFound('Signalement introuvable.');
  await prisma.questionReport.update({ where: { id }, data: { status } });
  await audit(actor.userId, `report.${status.toLowerCase()}`, 'report', id);
  res.json({ ok: true });
});

// ─── Sources (A03 : adresse, licence, date de consultation) ─────────────────

adminEditorialRouter.get('/sources', async (_req, res) => {
  const sources = await prisma.source.findMany({
    orderBy: { label: 'asc' },
    select: {
      id: true,
      key: true,
      label: true,
      url: true,
      licence: true,
      consultedAt: true,
      _count: { select: { answerQuestions: true, statementQuestions: true } },
    },
  });
  res.json(sources.map(({ _count, ...source }) => ({ ...source, questionCount: _count.answerQuestions + _count.statementQuestions })));
});

const sourceBody = z.object({
  label: z.string().trim().min(3).max(300),
  url: z.url().nullable().optional(),
  licence: z.string().trim().max(200).nullable().optional(),
  consultedAt: z.iso.date().nullable().optional(),
});

const sourceData = (body: z.infer<typeof sourceBody>) => ({
  ...body,
  ...(body.consultedAt !== undefined ? { consultedAt: body.consultedAt ? new Date(body.consultedAt) : null } : {}),
});

adminEditorialRouter.post('/sources', editors, async (req, res) => {
  const actor = requireUser(req);
  const body = sourceBody.parse(req.body);
  const key = `bo-${body.label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)}-${Date.now().toString(36)}`;
  const source = await prisma.source.create({ data: { key, ...sourceData(body) }, select: { id: true, key: true } });
  await audit(actor.userId, 'source.create', 'source', source.id, { label: body.label });
  res.status(201).json(source);
});

adminEditorialRouter.patch('/sources/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const body = sourceBody.partial().parse(req.body);
  if (!(await prisma.source.count({ where: { id } }))) throw notFound('Source introuvable.');
  await prisma.source.update({ where: { id }, data: sourceData(body as z.infer<typeof sourceBody>) });
  await audit(actor.userId, 'source.edit', 'source', id, body);
  res.json({ ok: true });
});

// ─── Témoignages (E01) : modération avant publication ───────────────────────

const testimonialsQuery = z.object({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') });

adminEditorialRouter.get('/testimonials', async (req, res) => {
  const { status } = testimonialsQuery.parse(req.query);
  res.json(
    await prisma.testimonial.findMany({
      where: { status },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, displayName: true, text: true, pathCode: true, status: true, consentAt: true, updatedAt: true, user: { select: { id: true } } },
    }),
  );
});

adminEditorialRouter.patch('/testimonials/:id', editors, async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const { status } = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).parse(req.body);
  if (!(await prisma.testimonial.count({ where: { id } }))) throw notFound('Témoignage introuvable.');
  await prisma.testimonial.update({ where: { id }, data: { status, reviewedAt: new Date() } });
  await audit(actor.userId, `testimonial.${status.toLowerCase()}`, 'testimonial', id);
  res.json({ ok: true });
});

