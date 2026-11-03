import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { answerToken } from '../../src/questions/answer-ids.js';

// Tests de bout en bout de l'API sur une vraie base PostgreSQL (DATABASE_URL du .env).
// Ils créent un parcours de test isolé, puis le suppriment.

const app = createApp();
const suffix = randomUUID().slice(0, 8);
const pathSlug = `test-${suffix}`;
const topicSlug = `theme-${suffix}`;

let pathId: number;
let topicId: number;
const questionIds: number[] = [];
const correctAnswerIds = new Map<number, number>();

beforeAll(async () => {
  const path = await prisma.path.create({
    data: { code: `T${suffix}`, slug: pathSlug, title: 'Parcours de test', description: 'Test', active: true },
  });
  pathId = path.id;
  topicId = (await prisma.topic.create({ data: { slug: topicSlug, title: 'Thème de test' } })).id;

  const types = ['ORIGINAL_KNOWLEDGE', 'ORIGINAL_KNOWLEDGE', 'ORIGINAL_KNOWLEDGE', 'ORIGINAL_SITUATION'] as const;
  for (const [index, type] of types.entries()) {
    const question = await prisma.question.create({
      data: {
        reference: `TEST-${suffix}-${index}`,
        type,
        status: 'PUBLISHED',
        statement: `Question de test ${index}`,
        explanation: 'Explication de test',
        topicId,
        paths: { create: { pathId } },
        answers: {
          create: [0, 1, 2, 3].map((position) => ({ text: `Réponse ${position}`, isCorrect: position === 2, position })),
        },
      },
      include: { answers: true },
    });
    questionIds.push(question.id);
    correctAnswerIds.set(question.id, question.answers.find((answer) => answer.isCorrect)!.id);
  }

  await prisma.examTemplate.create({
    data: { pathId, version: 1, knowledgeCount: 3, situationCount: 1, durationSeconds: 600, passThreshold: 3, active: true },
  });
});

afterAll(async () => {
  await prisma.examAttempt.deleteMany({ where: { template: { pathId } } });
  await prisma.examTemplate.deleteMany({ where: { pathId } });
  await prisma.question.deleteMany({ where: { id: { in: questionIds } } });
  await prisma.topic.delete({ where: { id: topicId } });
  await prisma.path.delete({ where: { id: pathId } });
  await prisma.$disconnect();
});

describe('santé et parcours', () => {
  it('répond sur /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('compte les questions publiées par thème', async () => {
    const res = await request(app).get(`/api/paths/${pathSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.topics.find((topic: { slug: string }) => topic.slug === topicSlug).questionCount).toBe(4);
  });

  it('renvoie une erreur 404 lisible pour une adresse inconnue', async () => {
    const res = await request(app).get('/api/inconnu');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

describe('entraînement', () => {
  it('ne révèle pas la bonne réponse avant la validation', async () => {
    const res = await request(app).get('/api/training/questions').query({ path: pathSlug, topic: topicSlug, limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(4);
    expect(JSON.stringify(res.body)).not.toContain('isCorrect');
    // Les propositions ne sont désignées que par un identifiant opaque, jamais par leur numéro en base.
    for (const question of res.body.questions as { answers: { id: unknown }[] }[]) {
      for (const answer of question.answers) expect(answer.id).toMatch(/^[A-Za-z0-9_-]{16}$/);
    }
  });

  it('corrige une réponse après validation', async () => {
    const questionId = questionIds[0]!;
    const res = await request(app)
      .post(`/api/training/questions/${questionId}/check`)
      .send({ answerId: answerToken(correctAnswerIds.get(questionId)!) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correct: true, correctAnswerId: answerToken(correctAnswerIds.get(questionId)!), explanation: 'Explication de test' });
  });

  it('refuse une réponse qui n’appartient pas à la question', async () => {
    // Ni le numéro en base, ni l'identifiant d'une proposition d'une autre question.
    const byNumber = await request(app).post(`/api/training/questions/${questionIds[0]}/check`).send({ answerId: correctAnswerIds.get(questionIds[0]!) });
    expect(byNumber.status).toBe(400);
    const other = await request(app)
      .post(`/api/training/questions/${questionIds[0]}/check`)
      .send({ answerId: answerToken(correctAnswerIds.get(questionIds[1]!)!) });
    expect(other.status).toBe(400);
    expect(other.body.error.code).toBe('invalid_answer');
  });
});

describe('apprentissage', () => {
  it('une erreur fait revenir la question en révision, une bonne réponse l’espace', async () => {
    const agent = request.agent(app);
    const [first, second] = questionIds as [number, number];
    const wrongOf = async (questionId: number) =>
      answerToken((await prisma.answer.findFirst({ where: { questionId, isCorrect: false }, select: { id: true } }))!.id);

    const missed = await agent.post(`/api/training/questions/${first}/check`).send({ answerId: await wrongOf(first) });
    expect(missed.status).toBe(200);
    expect(missed.body.correct).toBe(false);
    expect(new Date(missed.body.nextReviewAt).getTime()).toBeLessThanOrEqual(Date.now());

    const right = await agent.post(`/api/training/questions/${second}/check`).send({ answerId: answerToken(correctAnswerIds.get(second)!) });
    expect(new Date(right.body.nextReviewAt).getTime()).toBeGreaterThan(Date.now());

    // Le mode révision ne propose que la question manquée.
    const review = await agent.get('/api/training/questions').query({ path: pathSlug, mode: 'review' });
    expect(review.body.questions.map((question: { id: number }) => question.id)).toEqual([first]);

    // En mode thème, la question à revoir passe en premier.
    const series = await agent.get('/api/training/questions').query({ path: pathSlug, topic: topicSlug });
    expect(series.body.questions[0].id).toBe(first);

    const progress = await agent.get('/api/progress').query({ path: pathSlug });
    expect(progress.status).toBe(200);
    const topic = progress.body.topics.find((entry: { slug: string }) => entry.slug === topicSlug);
    expect(topic).toMatchObject({ total: 4, seen: 2, toReview: 1, mastered: 0, accuracy: 0.5 });
    expect(progress.body.recommendation).toEqual({ kind: 'review', count: 1 });
  });

  it('met une question en favori, la propose en série favoris, puis la retire', async () => {
    const agent = request.agent(app);
    const questionId = questionIds[2]!;

    expect((await agent.put(`/api/favorites/${questionId}`)).body).toEqual({ favorite: true });
    const series = await agent.get('/api/training/questions').query({ path: pathSlug, mode: 'favorites' });
    expect(series.body.questions.map((question: { id: number }) => question.id)).toEqual([questionId]);
    expect(series.body.questions[0].favorite).toBe(true);
    expect((await agent.get('/api/progress').query({ path: pathSlug })).body.totals.favorites).toBe(1);

    await agent.delete(`/api/favorites/${questionId}`).expect(200);
    const empty = await agent.get('/api/training/questions').query({ path: pathSlug, mode: 'favorites' });
    expect(empty.body.questions).toEqual([]);
  });

  it('renvoie une progression vide pour un nouveau visiteur', async () => {
    const res = await request(app).get('/api/progress').query({ path: pathSlug });
    expect(res.body.totals).toMatchObject({ questions: 4, seen: 0, mastered: 0, toReview: 0 });
  });
});

describe('examen blanc', () => {
  it('se déroule de bout en bout, avec un score calculé par le serveur', async () => {
    const agent = request.agent(app);

    const start = await agent.post('/api/exams').send({ path: pathSlug });
    expect(start.status).toBe(201);
    expect(start.headers['set-cookie']?.[0]).toMatch(/^visiteur=.*HttpOnly/);
    expect(start.body.questions).toHaveLength(4);
    expect(start.body.result).toBeNull();
    // Aucune correction avant la fin de l'examen (§5)
    expect(JSON.stringify(start.body)).not.toContain('isCorrect');
    expect(JSON.stringify(start.body)).not.toContain('explanation');

    const examId: string = start.body.id;
    const [first, second, third] = start.body.questions as { id: number; answers: { id: string }[] }[];
    // Propositions désignées par un identifiant opaque : leur ordre ne désigne pas la bonne réponse.
    for (const question of start.body.questions as { answers: { id: unknown }[] }[]) {
      for (const answer of question.answers) expect(answer.id).toMatch(/^[A-Za-z0-9_-]{16}$/);
    }

    // Pendant l'examen, l'entraînement ne doit pas donner la correction d'une question de l'examen.
    const peek = await agent.post(`/api/training/questions/${first!.id}/check`).send({ answerId: first!.answers[0]!.id });
    expect(peek.status).toBe(409);

    // Le numéro en base n'est pas accepté comme réponse.
    const byNumber = await agent.put(`/api/exams/${examId}/answers/${first!.id}`).send({ answerId: correctAnswerIds.get(first!.id) });
    expect(byNumber.status).toBe(400);

    // Deux bonnes réponses, une mauvaise, une question sans réponse.
    await agent.put(`/api/exams/${examId}/answers/${first!.id}`).send({ answerId: answerToken(correctAnswerIds.get(first!.id)!) }).expect(204);
    await agent.put(`/api/exams/${examId}/answers/${second!.id}`).send({ answerId: answerToken(correctAnswerIds.get(second!.id)!) }).expect(204);
    const wrong = third!.answers.find((answer) => answer.id !== answerToken(correctAnswerIds.get(third!.id)!))!;
    await agent.put(`/api/exams/${examId}/answers/${third!.id}`).send({ answerId: wrong.id }).expect(204);

    const resumed = await agent.get(`/api/exams/${examId}`);
    expect(resumed.body.questions.filter((question: { answerId: string | null }) => question.answerId !== null)).toHaveLength(3);
    expect(resumed.body.questions.find((question: { id: number }) => question.id === third!.id).answerId).toBe(wrong.id);

    const finish = await agent.post(`/api/exams/${examId}/finish`);
    expect(finish.status).toBe(200);
    expect(finish.body.result).toMatchObject({ score: 2, total: 4, passThreshold: 3, thresholdReached: false });
    expect(finish.body.result.corrections).toHaveLength(4);
    expect(finish.body.result.corrections.find((correction: { questionId: number }) => correction.questionId === third!.id)).toMatchObject({
      correct: false,
      chosenAnswerId: wrong.id,
      correctAnswerId: answerToken(correctAnswerIds.get(third!.id)!),
    });

    // Une fois terminé, l'examen ne bouge plus.
    const late = await agent.put(`/api/exams/${examId}/answers/${first!.id}`).send({ answerId: null });
    expect(late.status).toBe(409);
    const again = await agent.post(`/api/exams/${examId}/finish`);
    expect(again.body.result.score).toBe(2);

    // L'examen apparaît dans l'historique. La réponse fausse part en révision ; la question laissée sans réponse,
    // elle, reste « à découvrir » plutôt que de remplir les révisions.
    const history = await agent.get('/api/exams').query({ path: pathSlug });
    expect(history.body.active).toBeNull();
    expect(history.body.finished[0]).toMatchObject({ id: examId, score: 2, total: 4, thresholdReached: false });
    const review = await agent.get('/api/training/questions').query({ path: pathSlug, mode: 'review' });
    expect(review.body.questions.map((question: { id: number }) => question.id)).toEqual([third!.id]);
  });

  it('présente le modèle d’examen avant le départ (E10)', async () => {
    const res = await request(app).get('/api/exams/template').query({ path: pathSlug });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ questionCount: 4, durationSeconds: 600, passThreshold: 3, available: true });
  });

  it('n’est visible que par son auteur', async () => {
    const start = await request.agent(app).post('/api/exams').send({ path: pathSlug });
    const stranger = await request(app).get(`/api/exams/${start.body.id}`).set('Cookie', 'visiteur=' + 'x'.repeat(43));
    expect(stranger.status).toBe(404);
  });

  it('refuse de démarrer quand il manque des questions', async () => {
    await prisma.examTemplate.updateMany({ where: { pathId }, data: { knowledgeCount: 10 } });
    const res = await request(app).post('/api/exams').send({ path: pathSlug });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('not_enough_questions');
  });
});
