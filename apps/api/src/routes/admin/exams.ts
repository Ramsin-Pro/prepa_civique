import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../audit.js';
import { requireUser, staff } from '../../auth/guards.js';
import { prisma } from '../../db.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError, notFound } from '../../http/errors.js';
import { idParam } from '../../http/params.js';
import { dryRun, examPool } from '../../questions/exam-draw.js';
import type { PoolQuestion } from '../../questions/logic.js';
import { visibleStatuses } from '../../questions/visibility.js';

// Modèles d'examen blanc (A04) : versions, répartition par thème et notion, essai à blanc avant activation.
// Les nombres de questions, la durée et le seuil ne sont jamais codés en dur (§5).
export const adminExamsRouter = Router();

const templateInclude = {
  path: { select: { slug: true, title: true, code: true } },
  quotas: { orderBy: [{ topic: { position: 'asc' } }, { kind: 'asc' }], include: { topic: { select: { slug: true, title: true } } } },
  // Les traces gardées pour un visiteur après la fusion avec son compte n'ont pas de questions : elles ne comptent pas.
  _count: { select: { attempts: { where: { items: { some: {} } } } } },
} satisfies Prisma.ExamTemplateInclude;

/** Questions disponibles pour chaque ligne de répartition, avec le contenu publié seulement. */
function quotaAvailability(quotas: readonly { topicId: number; kind: 'KNOWLEDGE' | 'SITUATION'; notion: string | null }[], pool: PoolQuestion[]) {
  return quotas.map((quota) =>
    pool.filter(
      (question) =>
        question.topicId === quota.topicId &&
        question.kind === (quota.kind === 'SITUATION' ? 'situation' : 'knowledge') &&
        (quota.notion === null || question.notion === quota.notion),
    ).length,
  );
}

adminExamsRouter.get('/', async (_req, res) => {
  const templates = await prisma.examTemplate.findMany({
    orderBy: [{ path: { position: 'asc' } }, { version: 'desc' }],
    include: templateInclude,
  });
  const pools = new Map<number, { published: PoolQuestion[]; visible: PoolQuestion[] }>();
  for (const pathId of new Set(templates.map((template) => template.pathId))) {
    pools.set(pathId, { published: await examPool(pathId, ['PUBLISHED']), visible: await examPool(pathId, visibleStatuses) });
  }
  res.json(
    templates.map(({ _count, quotas, ...template }) => {
      const pool = pools.get(template.pathId)!;
      const available = quotaAvailability(quotas, pool.published);
      return {
        ...template,
        attempts: _count.attempts,
        quotas: quotas.map((quota, index) => ({
          id: quota.id,
          topic: quota.topic,
          kind: quota.kind,
          notion: quota.notion,
          count: quota.count,
          publishedAvailable: available[index],
        })),
        // Avec le contenu publié (production) et avec le contenu visible ici (aperçu de développement).
        check: { published: dryRun({ ...template, quotas }, pool.published), visible: dryRun({ ...template, quotas }, pool.visible) },
      };
    }),
  );
});

const quotaInput = z.object({
  topicSlug: z.string().min(1),
  kind: z.enum(['KNOWLEDGE', 'SITUATION']),
  notion: z.string().trim().max(80).nullable().optional(),
  count: z.number().int().min(1).max(40),
});

const templateBody = z
  .object({
    pathSlug: z.string().min(1),
    knowledgeCount: z.number().int().min(1).max(100),
    situationCount: z.number().int().min(0).max(100),
    durationSeconds: z.number().int().min(60).max(4 * 60 * 60),
    passThreshold: z.number().int().min(1),
    regulatoryRef: z.string().trim().max(500).nullable().optional(),
    quotas: z.array(quotaInput).max(80).default([]),
  })
  .refine((body) => body.passThreshold <= body.knowledgeCount + body.situationCount, {
    message: 'Le seuil ne peut pas dépasser le nombre de questions.',
    path: ['passThreshold'],
  })
  .refine(
    (body) =>
      body.quotas.length === 0 ||
      (body.quotas.filter((quota) => quota.kind === 'KNOWLEDGE').reduce((sum, quota) => sum + quota.count, 0) === body.knowledgeCount &&
        body.quotas.filter((quota) => quota.kind === 'SITUATION').reduce((sum, quota) => sum + quota.count, 0) === body.situationCount),
    { message: 'La répartition doit totaliser le nombre de questions de connaissance et de mise en situation.', path: ['quotas'] },
  );

/** Nouvelle version (inactive) d'un modèle : une version utilisée par des examens passés ne change jamais. */
adminExamsRouter.post('/', staff('EDITOR', 'SUPER_ADMIN'), async (req, res) => {
  const actor = requireUser(req);
  const body = templateBody.parse(req.body);
  const path = await prisma.path.findUnique({ where: { slug: body.pathSlug }, select: { id: true } });
  if (!path) throw new HttpError(400, 'invalid_path', 'Parcours inconnu.');
  const topics = await prisma.topic.findMany({ select: { id: true, slug: true } });
  const topicId = new Map(topics.map((topic) => [topic.slug, topic.id]));
  const unknown = body.quotas.find((quota) => !topicId.has(quota.topicSlug));
  if (unknown) throw new HttpError(400, 'invalid_topic', `Thème inconnu : ${unknown.topicSlug}.`);

  const last = await prisma.examTemplate.findFirst({ where: { pathId: path.id }, orderBy: { version: 'desc' }, select: { version: true } });
  const template = await prisma.examTemplate.create({
    data: {
      pathId: path.id,
      version: (last?.version ?? 0) + 1,
      knowledgeCount: body.knowledgeCount,
      situationCount: body.situationCount,
      durationSeconds: body.durationSeconds,
      passThreshold: body.passThreshold,
      regulatoryRef: body.regulatoryRef ?? null,
      active: false,
      quotas: {
        create: body.quotas.map((quota) => ({
          topicId: topicId.get(quota.topicSlug)!,
          kind: quota.kind,
          notion: quota.notion || null,
          count: quota.count,
        })),
      },
    },
    select: { id: true, version: true },
  });
  await audit(actor.userId, 'exam_template.create', 'exam_template', template.id, { path: body.pathSlug, version: template.version });
  res.status(201).json(template);
});

/** Activation (super-administrateur) : seulement si un examen complet peut être tiré avec le contenu publié. */
adminExamsRouter.post('/:id/activate', staff('SUPER_ADMIN'), async (req, res) => {
  const actor = requireUser(req);
  const id = idParam.parse(req.params.id);
  const template = await prisma.examTemplate.findUnique({ where: { id }, include: { quotas: true } });
  if (!template) throw notFound('Modèle introuvable.');
  const check = dryRun(template, await examPool(template.pathId, visibleStatuses));
  if (!check.ok) {
    throw new HttpError(
      409,
      'not_enough_questions',
      `Ce modèle ne peut pas encore être tiré : ${check.error.available} questions disponibles pour ${check.error.needed} demandées.`,
    );
  }
  await prisma.$transaction([
    prisma.examTemplate.updateMany({ where: { pathId: template.pathId, id: { not: id } }, data: { active: false } }),
    prisma.examTemplate.update({ where: { id }, data: { active: true } }),
  ]);
  await audit(actor.userId, 'exam_template.activate', 'exam_template', id, { version: template.version });
  res.json({ ok: true });
});
