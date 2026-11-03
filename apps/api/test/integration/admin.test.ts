import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { answerToken } from '../../src/questions/answer-ids.js';
import { createTestPath, createUser, deleteTestPath, deleteUsers, loginAs } from './helpers.js';

// Back-office (A01 à A09) : droits par rôle, workflow de relecture à quatre yeux, versions,
// modèles d'examen, utilisateurs, commandes et journal.

const app = createApp();
let fixture: Awaited<ReturnType<typeof createTestPath>>;
const created: string[] = [];
const agents: Record<'learner' | 'readonly' | 'support' | 'editor' | 'reviewer' | 'admin', request.Agent> = {} as never;
const ids: Record<string, string> = {};

beforeAll(async () => {
  fixture = await createTestPath({ knowledge: 3, situations: 1, status: 'IN_REVIEW' });
  const roles = { learner: 'LEARNER', readonly: 'READONLY', support: 'SUPPORT', editor: 'EDITOR', reviewer: 'EDITOR', admin: 'SUPER_ADMIN' } as const;
  for (const [name, role] of Object.entries(roles) as [keyof typeof roles, (typeof roles)[keyof typeof roles]][]) {
    const user = await createUser(role);
    created.push(user.id);
    ids[name] = user.id;
    agents[name] = await loginAs(app, user.email);
  }
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entity: 'question', entityId: { in: fixture.questions.map((question) => String(question.id)) } } });
  await deleteUsers(created);
  await deleteTestPath(fixture);
  await prisma.$disconnect();
});

describe('accès au back-office', () => {
  it('est fermé aux visiteurs et aux candidats', async () => {
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    expect((await agents.learner.get('/api/admin/dashboard')).status).toBe(403);
  });

  it('montre le tableau de bord à toute l’équipe, avec les points de vigilance', async () => {
    const res = await agents.readonly.get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.content.questions.IN_REVIEW).toBeGreaterThan(0);
    expect(Array.isArray(res.body.alerts)).toBe(true);
  });

  it('réserve les données personnelles au support et aux super-administrateurs', async () => {
    expect((await agents.editor.get('/api/admin/users')).status).toBe(403);
    expect((await agents.readonly.get('/api/admin/orders')).status).toBe(403);
    expect((await agents.support.get('/api/admin/users')).status).toBe(200);
    expect((await agents.support.get('/api/admin/audit')).status).toBe(403);
    expect((await agents.admin.get('/api/admin/audit')).status).toBe(200);
  });
});

describe('questions et relecture', () => {
  it('liste et filtre les questions', async () => {
    const res = await agents.readonly.get(`/api/admin/questions?topic=${fixture.topic.slug}&status=IN_REVIEW`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items[0]).toMatchObject({ reference: fixture.questions[0]!.reference, status: 'IN_REVIEW' });
  });

  it('refuse les modifications en lecture seule', async () => {
    const question = fixture.questions[0]!;
    const res = await agents.readonly.patch(`/api/admin/questions/${question.id}`).send({ version: 1, explanation: 'Une explication modifiée par erreur.' });
    expect(res.status).toBe(403);
  });

  it('garde l’ancienne version, protège contre les modifications concurrentes', async () => {
    const question = fixture.questions[0]!;
    const edit = await agents.editor.patch(`/api/admin/questions/${question.id}`).send({ version: 1, explanation: 'Une explication relue et améliorée.' });
    expect(edit.status).toBe(200);
    const stale = await agents.reviewer.patch(`/api/admin/questions/${question.id}`).send({ version: 1, explanation: 'Une autre explication.' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('version_conflict');

    const detail = await agents.readonly.get(`/api/admin/questions/${question.id}`);
    expect(detail.body.version).toBe(2);
    expect(detail.body.versions).toHaveLength(1);
    expect(detail.body.versions[0].snapshot.explanation).toBe('Explication de test, assez longue pour être valide.');
  });

  it('fait valider par une autre personne que la dernière à avoir modifié la question', async () => {
    const question = fixture.questions[0]!;
    const self = await agents.editor.post(`/api/admin/questions/${question.id}/transition`).send({ to: 'PUBLISHED' });
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe('same_reviewer');

    const other = await agents.reviewer.post(`/api/admin/questions/${question.id}/transition`).send({ to: 'PUBLISHED' });
    expect(other.status).toBe(200);
    const published = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    expect(published).toMatchObject({ status: 'PUBLISHED', reviewedById: ids.reviewer });
    expect(published.verifiedAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { entity: 'question', entityId: String(question.id), action: 'question.published' } })).toBe(1);
  });

  it('remet en relecture une question publiée dont la bonne réponse change', async () => {
    const question = fixture.questions[0]!;
    const current = await agents.readonly.get(`/api/admin/questions/${question.id}`);
    const answers = current.body.answers.map((answer: { text: string }, index: number) => ({ text: answer.text, isCorrect: index === 0 }));
    const res = await agents.editor.patch(`/api/admin/questions/${question.id}`).send({ version: current.body.version, answers });
    expect(res.body).toMatchObject({ status: 'IN_REVIEW', statusChanged: true });
    // Les propositions gardent leurs identifiants : les examens déjà passés restent lisibles.
    const after = await prisma.answer.findMany({ where: { questionId: question.id }, orderBy: { position: 'asc' } });
    expect(after.map((answer) => answer.id)).toEqual(question.answers.map((answer) => answer.id));
    expect(after[0]!.isCorrect).toBe(true);
  });

  it('refuse une transition impossible et les lots mélangés sont traités un par un', async () => {
    const archivedTarget = fixture.questions[1]!;
    const invalid = await agents.editor.post(`/api/admin/questions/${archivedTarget.id}/transition`).send({ to: 'DRAFT' });
    expect(invalid.status).toBe(200);
    const impossible = await agents.editor.post(`/api/admin/questions/${archivedTarget.id}/transition`).send({ to: 'PUBLISHED' });
    expect(impossible.status).toBe(409);

    const bulk = await agents.reviewer
      .post('/api/admin/questions/bulk-transition')
      .send({ ids: [fixture.questions[2]!.id, fixture.questions[3]!.id, archivedTarget.id], to: 'PUBLISHED' });
    expect(bulk.status).toBe(200);
    expect(bulk.body.done).toBe(2);
    expect(bulk.body.results.find((result: { id: number }) => result.id === archivedTarget.id).ok).toBe(false);
  });

  it('remet en relecture une question publiée dont l’explication ou le texte d’une proposition change', async () => {
    // Les questions 2 et 3 viennent d'être publiées par le lot.
    const explained = fixture.questions[2]!;
    const before = await agents.readonly.get(`/api/admin/questions/${explained.id}`);
    const minor = await agents.editor.patch(`/api/admin/questions/${explained.id}`).send({ version: before.body.version, difficulty: 2 });
    expect(minor.body).toMatchObject({ status: 'PUBLISHED', statusChanged: false });
    const edited = await agents.editor
      .patch(`/api/admin/questions/${explained.id}`)
      .send({ version: before.body.version + 1, explanation: 'Une explication reformulée, à faire relire.' });
    expect(edited.body).toMatchObject({ status: 'IN_REVIEW', statusChanged: true });

    const reworded = fixture.questions[3]!;
    const current = await agents.readonly.get(`/api/admin/questions/${reworded.id}`);
    const answers = current.body.answers.map((answer: { text: string; isCorrect: boolean }, index: number) => ({
      text: index === 3 ? `${answer.text} reformulée` : answer.text,
      isCorrect: answer.isCorrect,
    }));
    const res = await agents.editor.patch(`/api/admin/questions/${reworded.id}`).send({ version: current.body.version, answers });
    expect(res.body).toMatchObject({ status: 'IN_REVIEW', statusChanged: true });

    // Relues par une autre personne, elles sont republiées : la suite (modèles d'examen) compte sur elles.
    const republished = await agents.reviewer
      .post('/api/admin/questions/bulk-transition')
      .send({ ids: [explained.id, reworded.id], to: 'PUBLISHED' });
    expect(republished.body.done).toBe(2);
  });

  it('met à jour les propositions à leur place, même numérotées à partir de 1 comme au chargement des contenus', async () => {
    const loaded = await prisma.question.create({
      data: {
        reference: `TEST-${fixture.suffix}-901`,
        type: 'ORIGINAL_KNOWLEDGE',
        status: 'DRAFT',
        statement: 'Question chargée depuis un fichier de contenu',
        explanation: 'Explication de test, assez longue pour être valide.',
        topicId: fixture.topic.id,
        paths: { create: { pathId: fixture.path.id } },
        answers: { create: [1, 2, 3, 4].map((position) => ({ text: `Proposition ${position}`, isCorrect: position === 3, position })) },
      },
      include: { answers: { orderBy: { position: 'asc' } } },
    });
    const detail = await agents.readonly.get(`/api/admin/questions/${loaded.id}`);
    const answers = detail.body.answers.map((answer: { text: string }, index: number) => ({ text: `${answer.text} revue`, isCorrect: index === 0 }));
    expect((await agents.editor.patch(`/api/admin/questions/${loaded.id}`).send({ version: detail.body.version, answers })).status).toBe(200);

    // Toujours quatre lignes, les mêmes, à leurs positions : aucune cinquième proposition, aucun décalage.
    const after = await prisma.answer.findMany({ where: { questionId: loaded.id }, orderBy: { position: 'asc' } });
    expect(after.map((answer) => [answer.id, answer.position])).toEqual(loaded.answers.map((answer) => [answer.id, answer.position]));
    expect(after.map((answer) => answer.text)).toEqual(['Proposition 1 revue', 'Proposition 2 revue', 'Proposition 3 revue', 'Proposition 4 revue']);
    expect(after.filter((answer) => answer.isCorrect).map((answer) => answer.position)).toEqual([1]);
  });

  it('crée et duplique des questions en brouillon, avec une référence propre au back-office', async () => {
    const created = await agents.editor.post('/api/admin/questions').send({
      type: 'ORIGINAL_SITUATION',
      statement: 'Votre voisin fait du bruit la nuit. Que pouvez-vous faire ?',
      answers: [
        { text: 'Lui en parler calmement', isCorrect: true },
        { text: 'Couper son électricité', isCorrect: false },
        { text: 'Casser sa porte', isCorrect: false },
        { text: 'Ne rien dire et déménager', isCorrect: false },
      ],
      explanation: 'Le dialogue est la première étape. En cas de troubles répétés, on peut faire appel à un conciliateur de justice.',
      topicSlug: fixture.topic.slug,
      pathSlugs: [fixture.path.slug],
    });
    expect(created.status).toBe(201);
    expect(created.body.reference).toMatch(/^BO-[A-Z]{2}S-\d{3}$/);
    const copy = await agents.editor.post(`/api/admin/questions/${created.body.id}/duplicate`);
    expect(copy.status).toBe(201);
    expect(copy.body.reference).not.toBe(created.body.reference);
    expect((await prisma.question.findUniqueOrThrow({ where: { id: copy.body.id } })).status).toBe('DRAFT');
  });

  it('refuse de modifier l’énoncé d’une question officielle', async () => {
    const official = await prisma.question.findFirstOrThrow({ where: { type: 'OFFICIAL_KNOWLEDGE' }, select: { id: true, version: true } });
    const res = await agents.editor.patch(`/api/admin/questions/${official.id}`).send({ version: official.version, statement: 'Un énoncé réécrit' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('official_statement_locked');
  });
});

describe('examen blanc et retouches', () => {
  it('garde le contenu et la correction du début de la tentative quand une question est retouchée', async () => {
    const exam = await createTestPath({ knowledge: 1, situations: 1 });
    try {
      await prisma.examTemplate.create({
        data: { pathId: exam.path.id, version: 1, knowledgeCount: 1, situationCount: 1, durationSeconds: 600, passThreshold: 1, active: true },
      });
      const learner = request.agent(app);
      const start = await learner.post('/api/exams').send({ path: exam.path.slug });
      expect(start.status).toBe(201);
      const target = exam.questions[0]!;
      const correct = target.answers.find((answer) => answer.isCorrect)!;
      await learner.put(`/api/exams/${start.body.id}/answers/${target.id}`).send({ answerId: answerToken(correct.id) }).expect(204);

      // Pendant l'examen, l'équipe change la bonne réponse et l'explication : la question repart en relecture.
      const detail = await agents.readonly.get(`/api/admin/questions/${target.id}`);
      const edit = await agents.editor.patch(`/api/admin/questions/${target.id}`).send({
        version: detail.body.version,
        explanation: 'Une explication retouchée, pas encore relue.',
        answers: detail.body.answers.map((answer: { text: string }, index: number) => ({
          text: index === 0 ? 'Une proposition réécrite' : answer.text,
          isCorrect: index === 0,
        })),
      });
      expect(edit.body).toMatchObject({ status: 'IN_REVIEW' });

      // La tentative est corrigée et montrée avec le contenu relu d'alors, pas avec la retouche.
      const finish = await learner.post(`/api/exams/${start.body.id}/finish`);
      expect(finish.status).toBe(200);
      expect(finish.body.result.corrections.find((entry: { questionId: number }) => entry.questionId === target.id)).toMatchObject({
        correct: true,
        correctAnswerId: answerToken(correct.id),
        explanation: 'Explication de test, assez longue pour être valide.',
      });
      const shown = finish.body.questions.find((question: { id: number }) => question.id === target.id);
      expect(shown.answers.map((answer: { text: string }) => answer.text).sort()).toEqual(target.answers.map((answer) => answer.text).sort());
      expect(JSON.stringify(finish.body)).not.toContain('retouchée');
    } finally {
      await deleteTestPath(exam);
    }
  });
});

describe('modèles d’examen', () => {
  it('crée une nouvelle version inactive, vérifie qu’elle peut être tirée, puis l’active', async () => {
    const bad = await agents.editor.post('/api/admin/exam-templates').send({
      pathSlug: fixture.path.slug,
      knowledgeCount: 2,
      situationCount: 1,
      durationSeconds: 600,
      passThreshold: 2,
      quotas: [{ topicSlug: fixture.topic.slug, kind: 'KNOWLEDGE', count: 1 }],
    });
    expect(bad.status).toBe(400);

    const created = await agents.editor.post('/api/admin/exam-templates').send({
      pathSlug: fixture.path.slug,
      knowledgeCount: 2,
      situationCount: 1,
      durationSeconds: 600,
      passThreshold: 2,
      quotas: [
        { topicSlug: fixture.topic.slug, kind: 'KNOWLEDGE', count: 2 },
        { topicSlug: fixture.topic.slug, kind: 'SITUATION', count: 1 },
      ],
    });
    expect(created.status).toBe(201);

    expect((await agents.editor.post(`/api/admin/exam-templates/${created.body.id}/activate`)).status).toBe(403);
    const activated = await agents.admin.post(`/api/admin/exam-templates/${created.body.id}/activate`);
    expect(activated.status).toBe(200);
    const list = await agents.readonly.get('/api/admin/exam-templates');
    const mine = list.body.find((template: { id: number }) => template.id === created.body.id);
    expect(mine).toMatchObject({ active: true });
    // Publiées à ce stade : une question de connaissance (les autres sont en relecture ou en brouillon) et la mise en situation.
    expect(mine.quotas.map((quota: { publishedAvailable: number }) => quota.publishedAvailable)).toEqual([1, 1]);
  });
});

describe('utilisateurs et commandes', () => {
  it('ne laisse que le super-administrateur changer les rôles', async () => {
    expect((await agents.support.patch(`/api/admin/users/${ids.learner}/role`).send({ role: 'EDITOR' })).status).toBe(403);
    expect((await agents.admin.patch(`/api/admin/users/${ids.admin}/role`).send({ role: 'LEARNER' })).status).toBe(400);
    const res = await agents.admin.patch(`/api/admin/users/${ids.readonly}/role`).send({ role: 'SUPPORT' });
    expect(res.status).toBe(200);
    // Un changement de droits ferme les sessions de la personne.
    expect((await agents.readonly.get('/api/admin/dashboard')).status).toBe(401);
  });

  it('laisse le support désactiver un candidat, pas un membre de l’équipe', async () => {
    expect((await agents.support.patch(`/api/admin/users/${ids.editor}/status`).send({ status: 'DISABLED' })).status).toBe(403);
    const target = await createUser();
    created.push(target.id);
    const targetAgent = await loginAs(app, target.email);
    expect((await agents.support.patch(`/api/admin/users/${target.id}/status`).send({ status: 'DISABLED' })).status).toBe(200);
    expect((await targetAgent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('offre un accès Premium avec un motif, et rembourse une commande payée', async () => {
    const buyer = await createUser();
    created.push(buyer.id);
    const grant = await agents.admin.post(`/api/admin/users/${buyer.id}/grant`).send({ days: 30, reason: 'Geste commercial (test)' });
    expect(grant.status).toBe(201);
    expect((await agents.admin.get(`/api/admin/users/${buyer.id}`)).body.premiumUntil).not.toBeNull();

    const plan = await prisma.plan.findFirstOrThrow();
    const order = await prisma.order.create({
      data: { userId: buyer.id, planId: plan.id, amountCents: 1900, currency: 'EUR', provider: 'simulation', status: 'PAID', paidAt: new Date(), waiverAcceptedAt: new Date() },
    });
    await prisma.entitlement.create({ data: { userId: buyer.id, orderId: order.id, startsAt: new Date(), expiresAt: new Date(Date.now() + 86_400_000) } });

    expect((await agents.support.post(`/api/admin/orders/${order.id}/refund`)).status).toBe(403);
    expect((await agents.admin.post(`/api/admin/orders/${order.id}/refund`)).status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('REFUNDED');
    expect((await agents.admin.post(`/api/admin/orders/${order.id}/refund`)).status).toBe(409);

    const csv = await agents.admin.get('/api/admin/orders/export.csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text.split('\r\n')[0]).toContain('Commande;Date;Email');
  });

  it('calcule les statistiques de la période', async () => {
    const res = await agents.editor.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body).toHaveProperty('totals.visit');
    expect((await agents.editor.get('/api/admin/stats?from=2026-02-01&to=2026-01-01')).status).toBe(400);
  });
});
