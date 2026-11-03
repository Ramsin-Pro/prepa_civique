import { reminderToken } from '../auth/reminder-token.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { userLearnerKey } from '../http/learner.js';
import { sendMail } from '../mail/mailer.js';
import { examFollowUpMail, premiumEndingMail, revisionReminderMail } from '../mail/templates.js';
import { visibleWhere } from '../questions/visibility.js';

// Emails de service envoyés par la tâche quotidienne :
// - la fin prochaine d'un accès Premium (il n'y a pas de renouvellement automatique : la personne est prévenue) ;
// - un rappel quand des questions sont à revoir, seulement pour qui l'a demandé, au plus une fois par semaine ;
// - après la date d'examen indiquée, une demande d'avis, une seule fois, avec l'accord pour les emails d'information.

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 500;
export const NOTICE_DAYS_BEFORE_EXPIRY = 7;
export const REMINDER_EVERY_DAYS = 7;
// La demande d'avis part quelques jours après l'examen, et jamais pour une date trop ancienne.
export const FOLLOW_UP_AFTER_DAYS = 3;
const FOLLOW_UP_WINDOW_DAYS = 60;

export async function runNotifications(now = new Date()) {
  const report = { premiumEnding: 0, revisionReminders: 0, examFollowUps: 0 };

  // Accès qui se terminent dans les 7 jours, sans autre accès qui prend le relais. Chaque accès traité est marqué :
  // la requête suivante renvoie donc les accès restants.
  for (;;) {
    const ending = await prisma.entitlement.findMany({
      where: {
        revokedAt: null,
        expiryNoticeAt: null,
        expiresAt: { gt: now, lte: new Date(now.getTime() + NOTICE_DAYS_BEFORE_EXPIRY * DAY_MS) },
        user: { status: 'ACTIVE' },
      },
      select: { id: true, userId: true, expiresAt: true, user: { select: { email: true } } },
      take: BATCH,
    });
    for (const entitlement of ending) {
      const later = await prisma.entitlement.count({
        where: { userId: entitlement.userId, revokedAt: null, expiresAt: { gt: entitlement.expiresAt } },
      });
      if (later === 0) {
        await sendMail(premiumEndingMail(entitlement.user.email, entitlement.expiresAt));
        report.premiumEnding++;
      }
      await prisma.entitlement.update({ where: { id: entitlement.id }, data: { expiryNoticeAt: now } });
    }
    if (ending.length < BATCH) break;
  }

  // Rappels de révision, sur accord explicite. Les personnes sans question à revoir ne sont pas marquées :
  // on avance donc dans la liste par identifiant, pour que tout le monde soit examiné.
  let after: string | undefined;
  for (;;) {
    const candidates = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        emailVerifiedAt: { not: null },
        reminderOptInAt: { not: null },
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: new Date(now.getTime() - REMINDER_EVERY_DAYS * DAY_MS) } }],
        ...(after ? { id: { gt: after } } : {}),
      },
      select: { id: true, email: true, path: { select: { id: true, slug: true, title: true } } },
      orderBy: { id: 'asc' },
      take: BATCH,
    });
    for (const user of candidates) {
      const due = await prisma.visitorQuestionState.count({
        where: {
          learnerKey: userLearnerKey(user.id),
          dueAt: { lte: now },
          question: { ...visibleWhere, ...(user.path ? { paths: { some: { pathId: user.path.id } } } : {}) },
        },
      });
      if (due === 0) continue;
      const target = user.path ? `/entrainement/${user.path.slug}/revisions` : '/entrainement';
      await sendMail(
        revisionReminderMail(user.email, {
          count: due,
          pathTitle: user.path?.title ?? null,
          url: `${config.publicUrl}${target}`,
          unsubscribeUrl: `${config.publicUrl}/rappels/desinscription?jeton=${reminderToken(user.id)}`,
        }),
      );
      await prisma.user.update({ where: { id: user.id }, data: { lastReminderAt: now } });
      report.revisionReminders++;
    }
    const last = candidates[candidates.length - 1];
    if (!last || candidates.length < BATCH) break;
    after = last.id;
  }

  // Demande d'avis après l'examen : chaque personne traitée est marquée, la requête suivante renvoie les restantes.
  for (;;) {
    const followUps = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        emailVerifiedAt: { not: null },
        marketingConsentAt: { not: null },
        examFollowUpAt: null,
        testimonial: null,
        examDate: {
          lte: new Date(now.getTime() - FOLLOW_UP_AFTER_DAYS * DAY_MS),
          gte: new Date(now.getTime() - FOLLOW_UP_WINDOW_DAYS * DAY_MS),
        },
      },
      select: { id: true, email: true },
      take: BATCH,
    });
    for (const user of followUps) {
      await sendMail(examFollowUpMail(user.email));
      await prisma.user.update({ where: { id: user.id }, data: { examFollowUpAt: now } });
      report.examFollowUps++;
    }
    if (followUps.length < BATCH) break;
  }

  return report;
}
