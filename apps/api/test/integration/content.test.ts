import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { outbox } from '../../src/mail/mailer.js';
import { answerToken } from '../../src/questions/answer-ids.js';
import { clipHash } from '../../src/speech/azure.js';
import { correctionSpeech, questionSpeech, speechText } from '../../src/speech/text.js';
import { createTestPath, deleteTestPath } from './helpers.js';

// Contenus publics (E12, E17), mesure d'audience (A08) et lecture audio avec la voix Rémy.
// Sans clé Azure, seuls les extraits déjà en cache sont servis : on en dépose pour les tests.

const app = createApp();
let fixture: Awaited<ReturnType<typeof createTestPath>>;
const clipHashes: string[] = [];
const FAKE_MP3 = Buffer.from('ID3-extrait-de-test');

async function cacheClip(text: string) {
  const hash = clipHash(speechText(text));
  clipHashes.push(hash);
  await prisma.speechClip.upsert({ where: { hash }, create: { hash, voice: 'test', audio: new Uint8Array(FAKE_MP3) }, update: {} });
}

beforeAll(async () => {
  fixture = await createTestPath({ knowledge: 2, situations: 1 });
  await prisma.revisionSheet.create({
    data: {
      slug: `fiche-${fixture.suffix}`,
      topicId: fixture.topic.id,
      notion: 'notion-de-test',
      title: 'Fiche de test',
      summary: 'Un résumé de fiche de test.',
      keyPoints: ['Premier point', 'Deuxième point'],
      examples: [],
      vocabulary: [],
      sources: [{ label: 'Source', url: 'https://www.service-public.gouv.fr' }],
      status: 'PUBLISHED',
    },
  });
  await prisma.revisionSheet.create({
    data: {
      slug: `brouillon-${fixture.suffix}`,
      topicId: fixture.topic.id,
      title: 'Fiche en brouillon',
      summary: 'Pas encore relue.',
      keyPoints: [],
      examples: [],
      vocabulary: [],
      sources: [],
      status: 'DRAFT',
    },
  });
});

afterAll(async () => {
  await prisma.speechClip.deleteMany({ where: { hash: { in: clipHashes } } });
  await prisma.contactMessage.deleteMany({ where: { email: { endsWith: '@contact.test' } } });
  await deleteTestPath(fixture);
  await prisma.$disconnect();
});

describe('fiches de révision', () => {
  it('liste et affiche une fiche publiée, avec le nombre de questions de sa notion', async () => {
    const list = await request(app).get('/api/sheets');
    const topic = list.body.find((entry: { slug: string }) => entry.slug === fixture.topic.slug);
    expect(topic.sheets.map((sheet: { slug: string }) => sheet.slug)).toEqual([`fiche-${fixture.suffix}`]);

    const sheet = await request(app).get(`/api/sheets/fiche-${fixture.suffix}`);
    expect(sheet.status).toBe(200);
    expect(sheet.body).toMatchObject({ title: 'Fiche de test', inReview: false, questionCount: 3, previous: null, next: null });
  });

  it('ne montre jamais un brouillon', async () => {
    expect((await request(app).get(`/api/sheets/brouillon-${fixture.suffix}`)).status).toBe(404);
  });
});

describe('contact', () => {
  it('enregistre le message et envoie un accusé de réception', async () => {
    const email = `${randomUUID().slice(0, 8)}@contact.test`;
    const res = await request(app).post('/api/contact').send({ email, topic: 'paiement', message: 'Bonjour, je n’ai pas reçu ma facture.' });
    expect(res.status).toBe(201);
    expect(await prisma.contactMessage.count({ where: { email, subject: 'Paiement et accès Premium' } })).toBe(1);
    expect(outbox.some((mail) => mail.to === email && mail.subject === 'Nous avons bien reçu votre message')).toBe(true);
  });

  it('ignore discrètement les robots qui remplissent le champ piège', async () => {
    const email = `${randomUUID().slice(0, 8)}@contact.test`;
    const res = await request(app).post('/api/contact').send({ email, topic: 'autre', message: 'Message automatique de robot.', website: 'https://spam.example' });
    expect(res.status).toBe(201);
    expect(await prisma.contactMessage.count({ where: { email } })).toBe(0);
  });
});

describe('mesure d’audience', () => {
  it('compte une visite avec son canal, sans cookie', async () => {
    const res = await request(app).post('/api/analytics/visit').send({ channel: 'Google', path: fixture.path.slug });
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']).toBeUndefined();
    const event = await prisma.analyticsEvent.findFirst({ where: { type: 'visit', pathCode: fixture.path.code }, orderBy: { id: 'desc' } });
    expect(event).toMatchObject({ channel: 'google', learnerKey: null });
    await prisma.analyticsEvent.deleteMany({ where: { pathCode: fixture.path.code } });
  });
});

describe('lecture audio (voix Rémy)', () => {
  it('indique si la voix du serveur est configurée', async () => {
    const res = await request(app).get('/api/speech/status');
    expect(res.status).toBe(200);
    expect(typeof res.body.available).toBe('boolean');
  });

  it('lit l’énoncé et les réponses dans l’ordre affiché, depuis le cache', async () => {
    const question = fixture.questions[0]!;
    const order = [...question.answers].reverse();
    await cacheClip(questionSpeech(question.statement, order.map((answer) => answer.text)));

    const res = await request(app).get(`/api/speech/question/${question.id}?order=${order.map((answer) => answerToken(answer.id)).join(',')}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(Buffer.from(res.body).equals(FAKE_MP3)).toBe(true);
  });

  it('refuse un ordre de réponses qui ne correspond pas à la question', async () => {
    const question = fixture.questions[0]!;
    const tokens = question.answers.map((answer) => answerToken(answer.id));
    const other = answerToken(fixture.questions[1]!.answers[0]!.id);
    for (const order of [
      // les numéros en base ne sont plus acceptés
      question.answers.map((answer) => answer.id).join(','),
      // une proposition manquante, en double, ou d'une autre question
      tokens.slice(0, 3).join(','),
      [tokens[0], tokens[0], tokens[1], tokens[2]].join(','),
      [other, ...tokens.slice(1)].join(','),
    ]) {
      expect((await request(app).get(`/api/speech/question/${question.id}?order=${order}`)).status).toBe(400);
    }
  });

  it('exige l’ordre affiché : jamais celui de la base, qui pourrait lire la bonne réponse en premier', async () => {
    const question = fixture.questions[0]!;
    expect((await request(app).get(`/api/speech/question/${question.id}`)).status).toBe(400);
  });

  it('ne lit la correction qu’après une réponse', async () => {
    const question = fixture.questions[1]!;
    const correct = question.answers.find((answer) => answer.isCorrect)!;
    await cacheClip(correctionSpeech(correct.text, question.explanation));

    const agent = request.agent(app);
    expect((await agent.get(`/api/speech/correction/${question.id}`)).status).toBe(403);
    await agent.post(`/api/training/questions/${question.id}/check`).send({ answerId: answerToken(correct.id) });
    const res = await agent.get(`/api/speech/correction/${question.id}`);
    expect(res.status).toBe(200);
    expect(Buffer.from(res.body).equals(FAKE_MP3)).toBe(true);
  });

  it('répond 503 quand l’extrait n’est pas en cache et que la voix n’est pas configurée', async () => {
    const status = await request(app).get('/api/speech/status');
    if (status.body.available) return;
    const res = await request(app).get(`/api/speech/sheet/fiche-${fixture.suffix}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('speech_unavailable');
  });
});
