import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { reminderToken } from '../../src/auth/reminder-token.js';
import { prisma } from '../../src/db.js';
import { outbox } from '../../src/mail/mailer.js';
import { runNotifications } from '../../src/maintenance/notifications.js';
import { answerToken } from '../../src/questions/answer-ids.js';
import { createTestPath, createUser, deleteTestPath, deleteUsers, loginAs } from './helpers.js';

// Apprentissage et fidélité : mode « erreurs » (E07), témoignages authentiques (E01), date d'examen,
// rappels de révision sur accord, et email avant la fin d'un accès Premium.

const app = createApp();
let fixture: Awaited<ReturnType<typeof createTestPath>>;
const created: string[] = [];
const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  fixture = await createTestPath({ knowledge: 3, situations: 1 });
});

afterAll(async () => {
  await deleteUsers(created);
  await deleteTestPath(fixture);
  await prisma.$disconnect();
});

async function learner() {
  const user = await createUser();
  created.push(user.id);
  return { user, agent: await loginAs(app, user.email) };
}

describe('mode « erreurs »', () => {
  it('propose seulement les questions manquées, et les retire une fois réussies', async () => {
    const agent = request.agent(app);
    const [missed, success] = fixture.questions;
    await agent.post(`/api/training/questions/${missed!.id}/check`).send({ answerId: answerToken(missed!.answers[0]!.id) });
    await agent.post(`/api/training/questions/${success!.id}/check`).send({ answerId: answerToken(success!.answers[2]!.id) });

    const errors = await agent.get(`/api/training/questions?path=${fixture.path.slug}&mode=errors`);
    expect(errors.body.questions.map((question: { id: number }) => question.id)).toEqual([missed!.id]);
    expect((await agent.get(`/api/progress?path=${fixture.path.slug}`)).body.totals.errors).toBe(1);

    await agent.post(`/api/training/questions/${missed!.id}/check`).send({ answerId: answerToken(missed!.answers[2]!.id) });
    expect((await agent.get(`/api/training/questions?path=${fixture.path.slug}&mode=errors`)).body.questions).toEqual([]);
  });

  it('ne renvoie rien à un visiteur qui n’a jamais répondu', async () => {
    const res = await request(app).get(`/api/training/questions?path=${fixture.path.slug}&mode=errors`);
    expect(res.body.questions).toEqual([]);
  });
});

describe('témoignages', () => {
  it('demande d’avoir vraiment utilisé le site, puis passe par la modération avant publication', async () => {
    const { user, agent } = await learner();
    const body = { displayName: 'Amina B.', text: 'Les explications simples m’ont aidée à comprendre les institutions.', consent: true };
    expect((await agent.put('/api/account/testimonial').send(body)).status).toBe(403);

    await prisma.visitorQuestionState.create({
      data: {
        learnerKey: `user:${user.id}`,
        questionId: fixture.questions[0]!.id,
        box: 2,
        attempts: 25,
        correctCount: 20,
        lastCorrect: true,
        lastAnsweredAt: new Date(),
        dueAt: new Date(),
      },
    });
    expect((await agent.get('/api/account/testimonial')).body.eligible).toBe(true);
    expect((await agent.put('/api/account/testimonial').send({ ...body, consent: false })).status).toBe(400);
    expect((await agent.put('/api/account/testimonial').send(body)).body.status).toBe('PENDING');

    const published = () => request(app).get('/api/testimonials');
    expect((await published()).body.some((entry: { displayName: string }) => entry.displayName === 'Amina B.')).toBe(false);

    const editor = await createUser('EDITOR');
    created.push(editor.id);
    const editorAgent = await loginAs(app, editor.email);
    const pending = await editorAgent.get('/api/admin/testimonials?status=PENDING');
    const mine = pending.body.find((entry: { user: { id: string } }) => entry.user.id === user.id);
    expect((await editorAgent.patch(`/api/admin/testimonials/${mine.id}`).send({ status: 'APPROVED' })).status).toBe(200);
    // Publié avec sa date de publication (Code de la consommation, D111-17).
    const shown = (await published()).body.find((entry: { displayName: string }) => entry.displayName === 'Amina B.');
    expect(shown?.publishedAt).toEqual(expect.any(String));

    // Une modification repasse par la relecture ; l'auteur peut retirer son témoignage.
    await agent.put('/api/account/testimonial').send({ ...body, text: `${body.text} Merci !` });
    expect((await published()).body.some((entry: { displayName: string }) => entry.displayName === 'Amina B.')).toBe(false);
    expect((await agent.delete('/api/account/testimonial')).status).toBe(204);
    expect(await prisma.testimonial.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('date d’examen et rappels', () => {
  it('enregistre la date d’examen et l’accord pour les rappels', async () => {
    const { agent } = await learner();
    await agent.patch('/api/account').send({ examDate: '2027-02-15', reminders: true });
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ reminders: true, examDate: '2027-02-15T00:00:00.000Z' });
  });

  it('envoie un rappel seulement à qui l’a demandé, au plus une fois par semaine, avec un lien pour l’arrêter', async () => {
    const { user, agent } = await learner();
    const { user: silent } = await learner();
    for (const target of [user, silent]) {
      await prisma.visitorQuestionState.create({
        data: {
          learnerKey: `user:${target.id}`,
          questionId: fixture.questions[1]!.id,
          box: 1,
          attempts: 1,
          correctCount: 0,
          lastCorrect: false,
          lastAnsweredAt: new Date(Date.now() - 2 * DAY_MS),
          dueAt: new Date(Date.now() - DAY_MS),
        },
      });
    }
    await agent.patch('/api/account').send({ reminders: true });

    await runNotifications();
    const reminder = outbox.findLast((mail) => mail.to === user.email);
    expect(reminder?.subject).toMatch(/à revoir/);
    expect(reminder?.text).toContain('/rappels/desinscription?jeton=');
    expect(outbox.some((mail) => mail.to === silent.email)).toBe(false);

    const sent = outbox.filter((mail) => mail.to === user.email).length;
    await runNotifications();
    expect(outbox.filter((mail) => mail.to === user.email).length).toBe(sent);

    expect((await request(app).post('/api/account/reminders/unsubscribe').send({ token: `${reminderToken(user.id)}x` })).status).toBe(400);
    const truncated = await request(app).post('/api/account/reminders/unsubscribe').send({ token: 'abc' });
    expect(truncated.body.error.details[0].message).toBe('Ce lien n’est pas valable.');
    const [encoded] = reminderToken(user.id).split('.');
    expect((await request(app).post('/api/account/reminders/unsubscribe').send({ token: `${encoded}.${'é'.repeat(32)}` })).status).toBe(400);
    expect((await request(app).post('/api/account/reminders/unsubscribe').send({ token: reminderToken(user.id) })).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).reminderOptInAt).toBeNull();
  });
});

describe('fin d’un accès Premium', () => {
  it('prévient une fois, quelques jours avant la fin, sauf si un autre accès prend le relais', async () => {
    const { user } = await learner();
    const { user: extended } = await learner();
    const soon = new Date(Date.now() + 3 * DAY_MS);
    await prisma.entitlement.create({ data: { userId: user.id, startsAt: new Date(Date.now() - 80 * DAY_MS), expiresAt: soon } });
    await prisma.entitlement.createMany({
      data: [
        { userId: extended.id, startsAt: new Date(Date.now() - 80 * DAY_MS), expiresAt: soon },
        { userId: extended.id, startsAt: soon, expiresAt: new Date(Date.now() + 90 * DAY_MS) },
      ],
    });

    await runNotifications();
    await runNotifications();
    expect(outbox.filter((mail) => mail.to === user.email && mail.subject === 'Votre accès Premium se termine bientôt')).toHaveLength(1);
    expect(outbox.some((mail) => mail.to === extended.email && mail.subject === 'Votre accès Premium se termine bientôt')).toBe(false);
  });
});

describe('offre Premium (statistiques)', () => {
  it('compte où l’offre est vue et cliquée, sans accepter d’endroit inconnu', async () => {
    const visitor = request.agent(app);
    const before = await prisma.analyticsEvent.count({ where: { type: 'premium_click', place: 'resultat-examen' } });
    expect((await visitor.post('/api/analytics/offer').send({ event: 'view', place: 'resultat-examen', path: fixture.path.slug })).status).toBe(204);
    expect((await visitor.post('/api/analytics/offer').send({ event: 'click', place: 'resultat-examen' })).status).toBe(204);
    expect((await visitor.post('/api/analytics/offer').send({ event: 'click', place: 'ailleurs' })).status).toBe(400);
    expect(await prisma.analyticsEvent.count({ where: { type: 'premium_click', place: 'resultat-examen' } })).toBe(before + 1);

    const editor = await createUser('EDITOR');
    created.push(editor.id);
    const stats = await (await loginAs(app, editor.email)).get('/api/admin/stats');
    const place = stats.body.offerByPlace.find((row: { place: string }) => row.place === 'resultat-examen');
    expect(place.views).toBeGreaterThanOrEqual(1);
    expect(place.clicks).toBeGreaterThanOrEqual(1);
    expect(stats.body.totals).toHaveProperty('paywall_view');
  });
});
