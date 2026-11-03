import { Router } from 'express';
import { prisma } from '../db.js';
import { notFound } from '../http/errors.js';
import { visibleWhere } from '../questions/visibility.js';

export const pathsRouter = Router();

const pathSelect = {
  id: true,
  code: true,
  slug: true,
  title: true,
  description: true,
  active: true,
  sources: true,
  verifiedAt: true,
} as const;

/** Thématiques avec le nombre de questions visibles pour le parcours donné. */
async function topicsWithCounts(pathId: number) {
  const topics = await prisma.topic.findMany({
    orderBy: { position: 'asc' },
    select: {
      slug: true,
      title: true,
      _count: { select: { questions: { where: { ...visibleWhere, paths: { some: { pathId } } } } } },
    },
  });
  return topics.map(({ _count, ...topic }) => ({ ...topic, questionCount: _count.questions }));
}

type PathRow = { id: number; code: string; slug: string; title: string; description: string; active: boolean; sources: unknown; verifiedAt: Date | null };

async function present({ id, ...path }: PathRow) {
  return { ...path, topics: await topicsWithCounts(id) };
}

pathsRouter.get('/', async (_req, res) => {
  const paths = await prisma.path.findMany({ orderBy: { position: 'asc' }, select: pathSelect });
  res.json(await Promise.all(paths.map(present)));
});

pathsRouter.get('/:slug', async (req, res) => {
  const path = await prisma.path.findUnique({ where: { slug: req.params.slug }, select: pathSelect });
  if (!path) throw notFound('Parcours introuvable.');
  res.json(await present(path));
});
