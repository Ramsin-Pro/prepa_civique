import { hashPassword, randomToken } from '../auth/crypto.js';
import { prisma } from '../db.js';
import { userLearnerKey } from '../http/learner.js';
import { sendMail } from '../mail/mailer.js';
import { inactivityWarningMail } from '../mail/templates.js';

// Durées de conservation (§9) : celles proposées dans la politique de confidentialité, à valider avant le lancement.
// Chaque passage peut être relancé sans risque : il ne supprime que ce qui a dépassé sa durée.
const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION = {
  visitorDays: 180, // progression sans compte, après la dernière activité
  unverifiedAccountDays: 30, // compte jamais confirmé
  inactiveAccountDays: 730, // compte sans connexion (2 ans)
  inactivityNoticeDays: 30, // avertissement avant suppression
  contactMessageDays: 365, // messages traités
  reportDays: 365, // signalements traités
  analyticsDays: 395, // 13 mois, puis totaux anonymes
  auditDays: 365, // journal des actions de l'équipe
  organizationRequestDays: 1095, // demandes de devis des structures traitées (3 ans)
} as const;

const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS);

/** Progression des visiteurs sans compte, sans activité depuis la durée prévue. */
async function purgeVisitors(cutoff: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ key: string }[]>`
    SELECT key FROM (
      SELECT visitor_hash AS key, MAX(last_answered_at) AS at FROM visitor_question_states WHERE visitor_hash NOT LIKE 'user:%' GROUP BY 1
      UNION ALL SELECT visitor_hash, MAX(started_at) FROM exam_attempts WHERE visitor_hash NOT LIKE 'user:%' GROUP BY 1
      UNION ALL SELECT visitor_hash, MAX(created_at) FROM visitor_favorites WHERE visitor_hash NOT LIKE 'user:%' GROUP BY 1
      UNION ALL SELECT learner_key, MAX(created_at) FROM sheet_favorites WHERE learner_key NOT LIKE 'user:%' GROUP BY 1
    ) activity
    GROUP BY key
    HAVING MAX(at) < ${cutoff}`;
  const keys = rows.map((row) => row.key);
  if (keys.length === 0) return 0;
  await prisma.$transaction([
    prisma.visitorQuestionState.deleteMany({ where: { learnerKey: { in: keys } } }),
    prisma.visitorFavorite.deleteMany({ where: { learnerKey: { in: keys } } }),
    prisma.sheetFavorite.deleteMany({ where: { learnerKey: { in: keys } } }),
    prisma.examAttempt.deleteMany({ where: { learnerKey: { in: keys } } }),
  ]);
  return keys.length;
}

/** Suppression d'un compte de candidat : effacé, ou anonymisé s'il a des commandes (pièces comptables à garder). */
export async function removeAccount(userId: string): Promise<'deleted' | 'anonymized'> {
  const learnerKey = userLearnerKey(userId);
  const hasOrders = (await prisma.order.count({ where: { userId } })) > 0;
  const unusablePassword = await hashPassword(randomToken());
  await prisma.$transaction(async (tx) => {
    await tx.visitorQuestionState.deleteMany({ where: { learnerKey } });
    await tx.visitorFavorite.deleteMany({ where: { learnerKey } });
    await tx.sheetFavorite.deleteMany({ where: { learnerKey } });
    await tx.examAttempt.deleteMany({ where: { learnerKey } });
    await tx.contactMessage.updateMany({ where: { userId }, data: { userId: null } });
    // Places offertes par une structure : la place est rendue et plus rien n'est partagé.
    await tx.organizationMember.deleteMany({ where: { userId } });
    if (hasOrders) {
      await tx.session.deleteMany({ where: { userId } });
      await tx.emailToken.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `supprime-${userId}@invalid.local`,
          passwordHash: unusablePassword,
          status: 'DISABLED',
          marketingConsentAt: null,
          mfaSecret: null,
          mfaEnabledAt: null,
          acquisitionChannel: null,
          pathId: null,
          inactivityNoticeAt: null,
        },
      });
    } else {
      await tx.user.delete({ where: { id: userId } });
    }
  });
  return hasOrders ? 'anonymized' : 'deleted';
}

export async function runRetention(now = new Date()) {
  const report: Record<string, number> = {};

  report.sessions = (await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } })).count;
  report.emailTokens = (await prisma.emailToken.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { usedAt: { not: null } }] } })).count;
  report.visitors = await purgeVisitors(daysAgo(now, RETENTION.visitorDays));

  report.unverifiedAccounts = (
    await prisma.user.deleteMany({
      where: { role: 'LEARNER', emailVerifiedAt: null, createdAt: { lt: daysAgo(now, RETENTION.unverifiedAccountDays) }, orders: { none: {} } },
    })
  ).count;

  // Comptes inactifs : un avertissement 30 jours avant, puis la suppression. Une connexion annule l'avertissement.
  const noticeCutoff = daysAgo(now, RETENTION.inactiveAccountDays - RETENTION.inactivityNoticeDays);
  await prisma.user.updateMany({
    where: { inactivityNoticeAt: { not: null }, lastLoginAt: { gte: noticeCutoff } },
    data: { inactivityNoticeAt: null },
  });
  const toWarn = await prisma.user.findMany({
    where: {
      role: 'LEARNER',
      status: 'ACTIVE',
      emailVerifiedAt: { not: null },
      inactivityNoticeAt: null,
      // Un coordinateur de structure n'est pas supprimé automatiquement : la structure en dépend.
      ownedOrganizations: { none: {} },
      OR: [{ lastLoginAt: { lt: noticeCutoff } }, { lastLoginAt: null, createdAt: { lt: noticeCutoff } }],
    },
    select: { id: true, email: true },
    take: 500,
  });
  for (const user of toWarn) {
    await sendMail(inactivityWarningMail(user.email, new Date(now.getTime() + RETENTION.inactivityNoticeDays * DAY_MS)));
    await prisma.user.update({ where: { id: user.id }, data: { inactivityNoticeAt: now } });
  }
  report.inactivityNotices = toWarn.length;

  const toRemove = await prisma.user.findMany({
    where: { role: 'LEARNER', status: 'ACTIVE', ownedOrganizations: { none: {} }, inactivityNoticeAt: { lt: daysAgo(now, RETENTION.inactivityNoticeDays) } },
    select: { id: true },
    take: 500,
  });
  for (const user of toRemove) await removeAccount(user.id);
  report.inactiveAccounts = toRemove.length;

  report.contactMessages = (
    await prisma.contactMessage.deleteMany({ where: { status: { not: 'NEW' }, createdAt: { lt: daysAgo(now, RETENTION.contactMessageDays) } } })
  ).count;
  report.organizationRequests = (
    await prisma.organizationRequest.deleteMany({
      where: { status: { not: 'NEW' }, updatedAt: { lt: daysAgo(now, RETENTION.organizationRequestDays) } },
    })
  ).count;
  report.reports = (await prisma.questionReport.deleteMany({ where: { status: { not: 'OPEN' }, createdAt: { lt: daysAgo(now, RETENTION.reportDays) } } })).count;
  // Statistiques : après 13 mois, seuls les totaux restent (l'empreinte du jour est effacée).
  report.analytics = (
    await prisma.analyticsEvent.updateMany({
      where: { day: { lt: daysAgo(now, RETENTION.analyticsDays) }, learnerKey: { not: null } },
      data: { learnerKey: null },
    })
  ).count;
  report.auditLogs = (await prisma.auditLog.deleteMany({ where: { createdAt: { lt: daysAgo(now, RETENTION.auditDays) } } })).count;

  return report;
}
