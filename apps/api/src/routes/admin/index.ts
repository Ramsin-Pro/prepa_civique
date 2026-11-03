import { Router } from 'express';
import { requireUser, staff } from '../../auth/guards.js';
import { config } from '../../config.js';
import { prisma } from '../../db.js';
import { dryRun, examPool } from '../../questions/exam-draw.js';
import { speechConfigured } from '../../speech/azure.js';
import { adminEditorialRouter } from './editorial.js';
import { adminExamsRouter } from './exams.js';
import { adminOrganizationsRouter } from './organizations.js';
import { adminPeopleRouter } from './people.js';
import { adminQuestionsRouter } from './questions.js';
import { adminStatsRouter } from './stats.js';

// Back-office (A01 à A09). Réservé à l'équipe, avec double authentification (A09) ;
// chaque rôle ne voit et ne modifie que ce qui le concerne.
export const adminRouter = Router();

adminRouter.use(staff(), (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const DAY_MS = 24 * 60 * 60 * 1000;
const LEGAL_PAGES = ['mentions-legales', 'cgu', 'cgv', 'confidentialite', 'cookies'];

const countByStatus = (groups: { status: string; _count: { _all: number } }[]) =>
  Object.fromEntries(groups.map((group) => [group.status, group._count._all]));

/** Tableau de bord (A01) : contenus à relire, signalements, comptes, ventes, et points de vigilance avant lancement. */
adminRouter.get('/dashboard', async (req, res) => {
  const auth = requireUser(req);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);

  const [questions, sheets, pages, openReports, newMessages, learners, newLearners, premium, sales, templates] = await Promise.all([
    prisma.question.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.revisionSheet.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.contentPage.findMany({ select: { slug: true, title: true, status: true } }),
    prisma.questionReport.count({ where: { status: 'OPEN' } }),
    prisma.contactMessage.count({ where: { status: 'NEW' } }),
    prisma.user.count({ where: { role: 'LEARNER', status: 'ACTIVE' } }),
    prisma.user.count({ where: { role: 'LEARNER', createdAt: { gte: weekAgo } } }),
    prisma.entitlement.findMany({ where: { revokedAt: null, startsAt: { lte: now }, expiresAt: { gt: now } }, distinct: ['userId'], select: { userId: true } }),
    prisma.order.aggregate({ where: { status: 'PAID', paidAt: { gte: monthAgo } }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.examTemplate.findMany({ where: { active: true }, include: { quotas: true, path: { select: { title: true, active: true } } } }),
  ]);

  // Points de vigilance : ce qui empêcherait un lancement en production.
  const alerts: { level: 'error' | 'warning'; message: string }[] = [];
  const blockedExams: string[] = [];
  for (const template of templates.filter((entry) => entry.path.active)) {
    const check = dryRun(template, await examPool(template.pathId, ['PUBLISHED']));
    if (!check.ok) blockedExams.push(`${template.path.title} (${check.error.available} pour ${check.error.needed} demandées)`);
  }
  if (blockedExams.length > 0) {
    alerts.push({ level: 'error', message: `Examens blancs impossibles à tirer avec les questions publiées : ${blockedExams.join(', ')}.` });
  }
  const unpublishedLegal = pages.filter((page) => LEGAL_PAGES.includes(page.slug) && page.status !== 'PUBLISHED');
  if (unpublishedLegal.length > 0) {
    alerts.push({ level: 'error', message: `Pages légales à faire valider puis publier : ${unpublishedLegal.map((page) => page.title).join(', ')}.` });
  }
  const pendingTestimonials = await prisma.testimonial.count({ where: { status: 'PENDING' } });
  if (pendingTestimonials > 0) {
    alerts.push({ level: 'warning', message: `${pendingTestimonials} témoignage${pendingTestimonials > 1 ? 's' : ''} à relire avant publication.` });
  }
  const newOrganizationRequests = await prisma.organizationRequest.count({ where: { status: 'NEW' } });
  if (newOrganizationRequests > 0) {
    alerts.push({
      level: 'warning',
      message: `${newOrganizationRequests} demande${newOrganizationRequests > 1 ? 's' : ''} d’association à traiter (devis, virement ou pilote).`,
    });
  }
  if (config.paymentProvider !== 'stripe') alerts.push({ level: 'warning', message: 'Paiement : aucune clé Stripe configurée (paiement simulé en développement).' });
  if (!config.mail.host) alerts.push({ level: 'warning', message: 'Emails : aucun serveur SMTP configuré, les emails ne partent pas.' });
  if (!speechConfigured()) alerts.push({ level: 'warning', message: 'Voix Rémy : Azure Speech n’est pas configuré, la voix du navigateur est utilisée.' });
  if (config.contentPreview) alerts.push({ level: 'warning', message: 'Aperçu du contenu activé : les contenus « à relire » sont visibles. À désactiver en production.' });

  const pagesByStatus: Record<string, number> = {};
  for (const page of pages) pagesByStatus[page.status] = (pagesByStatus[page.status] ?? 0) + 1;

  res.json({
    role: auth.role,
    content: {
      questions: countByStatus(questions),
      sheets: countByStatus(sheets),
      pages: pagesByStatus,
      openReports,
    },
    support: { newMessages },
    learners: { active: learners, newThisWeek: newLearners, premium: premium.length },
    sales: { last30Days: { orders: sales._count._all, amountCents: sales._sum.amountCents ?? 0 } },
    alerts,
  });
});

adminRouter.use('/questions', adminQuestionsRouter);
adminRouter.use('/exam-templates', adminExamsRouter);
adminRouter.use('/stats', adminStatsRouter);
adminRouter.use(adminEditorialRouter);
adminRouter.use(adminOrganizationsRouter);
adminRouter.use(adminPeopleRouter);
