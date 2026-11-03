import { randomBytes } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/db.js';
import { outbox } from '../../src/mail/mailer.js';
import { RETENTION, runRetention } from '../../src/maintenance/retention.js';
import { createUser, deleteUsers } from './helpers.js';

// Durées de conservation (§9) : ce qui a dépassé sa durée disparaît, le reste est gardé.

const DAY_MS = 24 * 60 * 60 * 1000;
const created: string[] = [];
const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS);

afterAll(async () => {
  await deleteUsers(created);
  await prisma.$disconnect();
});

describe('durées de conservation', () => {
  it('efface la progression d’un visiteur sans compte inactif, garde celle d’un visiteur récent', async () => {
    const question = await prisma.question.findFirstOrThrow({ select: { id: true } });
    const old = `test-${randomBytes(12).toString('hex')}`;
    const recent = `test-${randomBytes(12).toString('hex')}`;
    const state = (learnerKey: string, at: Date) => ({
      learnerKey,
      questionId: question.id,
      box: 1,
      attempts: 1,
      correctCount: 0,
      lastCorrect: false,
      lastAnsweredAt: at,
      dueAt: at,
    });
    await prisma.visitorQuestionState.createMany({ data: [state(old, daysAgo(RETENTION.visitorDays + 5)), state(recent, daysAgo(2))] });

    await runRetention();

    expect(await prisma.visitorQuestionState.count({ where: { learnerKey: old } })).toBe(0);
    expect(await prisma.visitorQuestionState.count({ where: { learnerKey: recent } })).toBe(1);
    await prisma.visitorQuestionState.deleteMany({ where: { learnerKey: recent } });
  });

  it('supprime un compte jamais confirmé après 30 jours', async () => {
    const stale = await createUser('LEARNER', { verified: false });
    const fresh = await createUser('LEARNER', { verified: false });
    created.push(fresh.id);
    await prisma.user.update({ where: { id: stale.id }, data: { createdAt: daysAgo(RETENTION.unverifiedAccountDays + 1) } });

    await runRetention();

    expect(await prisma.user.count({ where: { id: stale.id } })).toBe(0);
    expect(await prisma.user.count({ where: { id: fresh.id } })).toBe(1);
  });

  it('prévient un compte inactif, puis le supprime 30 jours plus tard sauf s’il revient', async () => {
    const inactive = await createUser();
    const back = await createUser();
    created.push(back.id);
    const longAgo = daysAgo(RETENTION.inactiveAccountDays - 10);
    await prisma.user.updateMany({ where: { id: { in: [inactive.id, back.id] } }, data: { lastLoginAt: longAgo, createdAt: longAgo } });

    await runRetention();
    expect(outbox.some((mail) => mail.to === inactive.email && mail.subject === 'Votre compte sera bientôt supprimé')).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: inactive.id } })).inactivityNoticeAt).not.toBeNull();

    // 31 jours plus tard : l'un ne s'est pas reconnecté, l'autre si.
    await prisma.user.update({ where: { id: inactive.id }, data: { inactivityNoticeAt: daysAgo(RETENTION.inactivityNoticeDays + 1) } });
    await prisma.user.update({ where: { id: back.id }, data: { inactivityNoticeAt: daysAgo(RETENTION.inactivityNoticeDays + 1), lastLoginAt: new Date() } });

    await runRetention();
    expect(await prisma.user.count({ where: { id: inactive.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: back.id } })).inactivityNoticeAt).toBeNull();
  });

  it('garde les totaux des statistiques mais efface l’empreinte après 13 mois', async () => {
    const event = await prisma.analyticsEvent.create({
      data: { type: 'visit', day: daysAgo(RETENTION.analyticsDays + 3), learnerKey: 'empreinte-de-test', pathCode: 'TEST-RETENTION' },
    });
    await runRetention();
    const after = await prisma.analyticsEvent.findUniqueOrThrow({ where: { id: event.id } });
    expect(after.learnerKey).toBeNull();
    await prisma.analyticsEvent.delete({ where: { id: event.id } });
  });

  it('efface les sessions expirées', async () => {
    const user = await createUser();
    created.push(user.id);
    await prisma.session.create({ data: { id: `expiree-${randomBytes(8).toString('hex')}`, userId: user.id, expiresAt: daysAgo(1) } });
    await runRetention();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});
