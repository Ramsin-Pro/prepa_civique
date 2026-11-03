import { Router } from 'express';
import { z } from 'zod';
import { toCsv } from '../../admin/csv.js';
import { prisma } from '../../db.js';
import { HttpError } from '../../http/errors.js';

// Statistiques (A08) : audience, entonnoir visite → entraînement → inscription → achat, conversion par parcours
// et par canal, questions les plus difficiles. Sans traceur : compteurs internes uniquement.
export const adminStatsRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;
const EVENT_TYPES = [
  'visit',
  'training_answer',
  'exam_start',
  'exam_finish',
  'paywall_view',
  'premium_click',
  'signup',
  'checkout_start',
  'purchase',
] as const;

const rangeQuery = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() });

/** Période demandée (30 derniers jours par défaut), bornes incluses, au plus 2 ans. */
function range(query: z.infer<typeof rangeQuery>) {
  const to = query.to ? new Date(query.to) : new Date(new Date().toISOString().slice(0, 10));
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 29 * DAY_MS);
  if (from > to) throw new HttpError(400, 'invalid_range', 'La date de début doit précéder la date de fin.');
  if (to.getTime() - from.getTime() > 731 * DAY_MS) throw new HttpError(400, 'invalid_range', 'La période ne peut pas dépasser deux ans.');
  return { from, to, toExclusive: new Date(to.getTime() + DAY_MS) };
}

type DailyRow = { day: Date; type: string; events: bigint; learners: bigint };

/** Par jour et par type : nombre d'événements et nombre de personnes distinctes ce jour-là. */
async function daily(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<DailyRow[]>`
    SELECT day, type, COUNT(*) AS events, COUNT(DISTINCT learner_key) AS learners
    FROM analytics_events
    WHERE day >= ${from}::date AND day <= ${to}::date
    GROUP BY day, type
    ORDER BY day`;
  return rows.map((row) => ({ day: row.day.toISOString().slice(0, 10), type: row.type, events: Number(row.events), learners: Number(row.learners) }));
}

adminStatsRouter.get('/', async (req, res) => {
  const { from, to, toExclusive } = range(rangeQuery.parse(req.query));
  const rows = await daily(from, to);

  // Entonnoir : personnes distinctes par jour, additionnées sur la période (l'empreinte change chaque jour).
  const totals = Object.fromEntries(
    EVENT_TYPES.map((type) => {
      const own = rows.filter((row) => row.type === type);
      return [type, { events: own.reduce((sum, row) => sum + row.events, 0), learners: own.reduce((sum, row) => sum + row.learners, 0) }];
    }),
  );

  const [byPathRaw, signups, paidOrders, revenue, hardest, reported, activePremium, offerRaw] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ['pathCode', 'type'],
      where: { day: { gte: from, lte: to }, pathCode: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: from, lt: toExclusive }, role: 'LEARNER' },
      select: { acquisitionChannel: true, orders: { where: { status: 'PAID' }, select: { id: true }, take: 1 } },
    }),
    prisma.order.findMany({
      where: { status: 'PAID', paidAt: { gte: from, lt: toExclusive } },
      select: { amountCents: true, user: { select: { path: { select: { code: true } }, acquisitionChannel: true } } },
    }),
    prisma.order.aggregate({ where: { status: 'PAID', paidAt: { gte: from, lt: toExclusive } }, _sum: { amountCents: true }, _count: { _all: true } }),
    // Questions les plus difficiles : taux de bonnes réponses le plus bas, avec assez de réponses pour être significatif.
    prisma.$queryRaw<{ id: number; reference: string; statement: string; attempts: bigint; correct: bigint }[]>`
      SELECT q.id, q.reference, q.statement, SUM(s.attempts) AS attempts, SUM(s.correct_count) AS correct
      FROM visitor_question_states s JOIN questions q ON q.id = s.question_id
      GROUP BY q.id
      HAVING SUM(s.attempts) >= 20
      ORDER BY SUM(s.correct_count)::float / SUM(s.attempts) ASC
      LIMIT 15`,
    prisma.questionReport.groupBy({ by: ['questionId'], where: { status: 'OPEN' }, _count: { _all: true }, orderBy: { _count: { questionId: 'desc' } }, take: 10 }),
    prisma.entitlement.findMany({ where: { revokedAt: null, startsAt: { lte: new Date() }, expiresAt: { gt: new Date() } }, distinct: ['userId'], select: { userId: true } }),
    // Offre Premium : où elle est vue, et où elle donne envie d'aller voir les tarifs.
    prisma.analyticsEvent.groupBy({
      by: ['place', 'type'],
      where: { day: { gte: from, lte: to }, type: { in: ['paywall_view', 'premium_click'] }, place: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const byPath = new Map<string, Record<string, number>>();
  for (const group of byPathRaw) {
    const entry = byPath.get(group.pathCode!) ?? {};
    entry[group.type] = group._count._all;
    byPath.set(group.pathCode!, entry);
  }
  for (const order of paidOrders) {
    const code = order.user.path?.code ?? 'sans-parcours';
    const entry = byPath.get(code) ?? {};
    entry.paid = (entry.paid ?? 0) + 1;
    byPath.set(code, entry);
  }

  const byPlace = new Map<string, { views: number; clicks: number }>();
  for (const group of offerRaw) {
    const entry = byPlace.get(group.place!) ?? { views: 0, clicks: 0 };
    if (group.type === 'paywall_view') entry.views += group._count._all;
    else entry.clicks += group._count._all;
    byPlace.set(group.place!, entry);
  }

  const byChannel = new Map<string, { signups: number; buyers: number }>();
  for (const user of signups) {
    const channel = user.acquisitionChannel ?? 'direct';
    const entry = byChannel.get(channel) ?? { signups: 0, buyers: 0 };
    entry.signups += 1;
    if (user.orders.length > 0) entry.buyers += 1;
    byChannel.set(channel, entry);
  }

  const reportedQuestions = await prisma.question.findMany({
    where: { id: { in: reported.map((group) => group.questionId) } },
    select: { id: true, reference: true, statement: true },
  });
  const reportedById = new Map(reportedQuestions.map((question) => [question.id, question]));

  res.json({
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    totals,
    daily: rows,
    revenue: { orders: revenue._count._all, amountCents: revenue._sum.amountCents ?? 0 },
    activePremium: activePremium.length,
    byPath: [...byPath.entries()].map(([pathCode, counts]) => ({ pathCode, ...counts })),
    offerByPlace: [...byPlace.entries()]
      .map(([place, counts]) => ({ place, ...counts, clickRate: counts.views > 0 ? counts.clicks / counts.views : null }))
      .sort((a, b) => b.views - a.views),
    byChannel: [...byChannel.entries()]
      .map(([channel, counts]) => ({ channel, ...counts, conversion: counts.signups > 0 ? counts.buyers / counts.signups : null }))
      .sort((a, b) => b.signups - a.signups),
    hardestQuestions: hardest.map((row) => ({
      id: row.id,
      reference: row.reference,
      statement: row.statement,
      attempts: Number(row.attempts),
      successRate: Number(row.correct) / Number(row.attempts),
    })),
    mostReported: reported.map((group) => ({ ...reportedById.get(group.questionId), openReports: group._count._all })),
  });
});

adminStatsRouter.get('/export.csv', async (req, res) => {
  const { from, to } = range(rangeQuery.parse(req.query));
  const rows = await daily(from, to);
  res.set('Content-Disposition', `attachment; filename="statistiques-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`);
  res.type('text/csv; charset=utf-8').send(toCsv(['Jour', 'Événement', 'Nombre', 'Personnes distinctes'], rows.map((row) => [row.day, row.type, row.events, row.learners])));
});
