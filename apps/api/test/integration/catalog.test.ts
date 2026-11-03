import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { answerToken } from '../../src/questions/answer-ids.js';
import { createTestPath, createUser, deleteTestPath, deleteUsers, loginAs } from './helpers.js';

// Fonctions ajoutées pour couvrir tout le cahier : filtres du catalogue (E07), lien vers la fiche (E09),
// favoris de fiches (E12), reçu (E16), sources des parcours (E03), et back-office : import, sources,
// formules, thèmes, expirations (A02, A03, A07).

const app = createApp();
let fixture: Awaited<ReturnType<typeof createTestPath>>;
const created: string[] = [];
const sheetSlug = () => `fiche-catalogue-${fixture.suffix}`;
// Référence au format des fichiers de contenu (lettres majuscules entre les tirets).
const importCode = () => fixture.suffix.replace(/[0-9]/g, (digit) => 'ABCDEFGHIJ'[Number(digit)]!).toUpperCase().slice(0, 4);

beforeAll(async () => {
  fixture = await createTestPath({ knowledge: 4, situations: 1 });
  await prisma.question.update({ where: { id: fixture.questions[0]!.id }, data: { difficulty: 3 } });
  await prisma.revisionSheet.create({
    data: {
      slug: sheetSlug(),
      topicId: fixture.topic.id,
      notion: 'notion-de-test',
      title: 'Fiche du catalogue',
      summary: 'Résumé de la fiche du catalogue.',
      keyPoints: ['Point un', 'Point deux'],
      examples: [],
      vocabulary: [],
      sources: [],
      status: 'PUBLISHED',
    },
  });
});

afterAll(async () => {
  await prisma.question.deleteMany({ where: { reference: { startsWith: `IMP-${importCode()}` } } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: 'test-' } } });
  await prisma.source.deleteMany({ where: { label: { startsWith: 'Source de test' } } });
  await prisma.topic.deleteMany({ where: { slug: { startsWith: 'theme-cree-' } } });
  await prisma.sheetFavorite.deleteMany({ where: { sheet: { slug: sheetSlug() } } });
  await deleteUsers(created);
  await deleteTestPath(fixture);
  await prisma.$disconnect();
});

describe('catalogue et correction', () => {
  it('filtre une série par difficulté', async () => {
    const res = await request(app).get(`/api/training/questions?path=${fixture.path.slug}&mode=mixed&topic=${fixture.topic.slug}&difficulty=3`);
    expect(res.body.questions.map((question: { id: number }) => question.id)).toEqual([fixture.questions[0]!.id]);
  });

  it('sépare les questions jamais vues de celles déjà travaillées', async () => {
    const agent = request.agent(app);
    const target = fixture.questions[1]!;
    await agent.post(`/api/training/questions/${target.id}/check`).send({ answerId: answerToken(target.answers[2]!.id) });
    const seen = await agent.get(`/api/training/questions?path=${fixture.path.slug}&mode=mixed&topic=${fixture.topic.slug}&seen=seen`);
    const fresh = await agent.get(`/api/training/questions?path=${fixture.path.slug}&mode=mixed&topic=${fixture.topic.slug}&seen=new`);
    expect(seen.body.questions.map((question: { id: number }) => question.id)).toEqual([target.id]);
    expect(fresh.body.questions.map((question: { id: number }) => question.id)).not.toContain(target.id);
  });

  it('propose la fiche de la notion avec la correction', async () => {
    const question = fixture.questions[2]!;
    const res = await request(app).post(`/api/training/questions/${question.id}/check`).send({ answerId: answerToken(question.answers[0]!.id) });
    expect(res.body.sheet).toEqual({ slug: sheetSlug(), title: 'Fiche du catalogue' });
  });

  it('montre les sources officielles et la date de vérification des parcours', async () => {
    const res = await request(app).get('/api/paths/carte-de-sejour-pluriannuelle');
    expect(res.body.sources.length).toBeGreaterThan(0);
    expect(res.body.verifiedAt).toBeTruthy();
  });
});

describe('fiches favorites', () => {
  it('met une fiche de côté, la retrouve dans la liste et la retire', async () => {
    const agent = request.agent(app);
    expect((await agent.put(`/api/sheets/${sheetSlug()}/favorite`)).body).toEqual({ favorite: true });
    const list = await agent.get('/api/sheets');
    const topic = list.body.find((entry: { slug: string }) => entry.slug === fixture.topic.slug);
    expect(topic.sheets[0].favorite).toBe(true);
    expect((await agent.get(`/api/sheets/${sheetSlug()}`)).body.favorite).toBe(true);
    await agent.delete(`/api/sheets/${sheetSlug()}/favorite`);
    expect((await agent.get(`/api/sheets/${sheetSlug()}`)).body.favorite).toBe(false);
  });
});

describe('reçu de commande', () => {
  it('donne le reçu de sa propre commande payée, pas celle d’une autre personne', async () => {
    const buyer = await createUser();
    const other = await createUser();
    created.push(buyer.id, other.id);
    const plan = await prisma.plan.findFirstOrThrow();
    const order = await prisma.order.create({
      data: {
        userId: buyer.id,
        planId: plan.id,
        amountCents: 1900,
        currency: 'EUR',
        provider: 'simulation',
        status: 'PAID',
        paidAt: new Date(),
        waiverAcceptedAt: new Date(),
        salesTermsVersion: 'test',
        salesTermsAcceptedAt: new Date(),
      },
    });
    const mine = await (await loginAs(app, buyer.email)).get(`/api/account/orders/${order.id}`);
    expect(mine.status).toBe(200);
    expect(mine.body).toMatchObject({ id: order.id, amountCents: 1900, salesTermsVersion: 'test', user: { email: buyer.email } });
    expect((await (await loginAs(app, other.email)).get(`/api/account/orders/${order.id}`)).status).toBe(404);
  });
});

describe('back-office', () => {
  let editor: request.Agent;
  let admin: request.Agent;
  let support: request.Agent;

  beforeAll(async () => {
    const [editorUser, adminUser, supportUser] = [await createUser('EDITOR'), await createUser('SUPER_ADMIN'), await createUser('SUPPORT')];
    created.push(editorUser.id, adminUser.id, supportUser.id);
    editor = await loginAs(app, editorUser.email);
    admin = await loginAs(app, adminUser.email);
    support = await loginAs(app, supportUser.email);
  });

  it('importe des questions de l’équipe en brouillon et refuse les énoncés officiels', async () => {
    const question = (reference: string, type: string) => ({
      reference,
      type,
      notion: 'notion-de-test',
      statement: `Énoncé importé ${reference}`,
      answers: ['La bonne réponse', 'Une autre réponse', 'Une troisième réponse', 'Une quatrième réponse'],
      explanation: 'Une explication assez longue pour être acceptée.',
      confidence: 'high',
    });
    const res = await editor.post('/api/admin/questions/import').send({
      topic: fixture.topic.slug,
      pathSlugs: [fixture.path.slug],
      questions: [question(`IMP-${importCode()}-001`, 'ORIGINAL_KNOWLEDGE'), question(`IMP-${importCode()}-002`, 'OFFICIAL_KNOWLEDGE'), { reference: 'mal-formee' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(1);
    const imported = await prisma.question.findUniqueOrThrow({
      where: { reference: `IMP-${importCode()}-001` },
      include: { answers: { orderBy: { position: 'asc' } } },
    });
    expect(imported.status).toBe('DRAFT');
    // La bonne réponse, la première du fichier, est enregistrée avec les autres dans un ordre mélangé.
    expect(imported.answers).toHaveLength(4);
    expect(imported.answers.filter((answer) => answer.isCorrect).map((answer) => answer.text)).toEqual(['La bonne réponse']);
    expect(res.body.results.filter((result: { ok: boolean }) => !result.ok)).toHaveLength(2);
  });

  it('gère les sources avec leur licence et leur date de consultation', async () => {
    const created = await editor.post('/api/admin/sources').send({ label: 'Source de test officielle', url: 'https://www.legifrance.gouv.fr', licence: 'Licence Ouverte', consultedAt: '2026-10-31' });
    expect(created.status).toBe(201);
    expect((await editor.patch(`/api/admin/sources/${created.body.id}`).send({ licence: 'Etalab 2.0' })).status).toBe(200);
    const list = await support.get('/api/admin/sources');
    expect(list.body.find((source: { id: number }) => source.id === created.body.id)).toMatchObject({ licence: 'Etalab 2.0' });
  });

  it('crée un thème et met à jour les sources d’un parcours', async () => {
    const topic = await editor.post('/api/admin/topics').send({ slug: `theme-cree-${fixture.suffix}`, title: 'Thème créé' });
    expect(topic.status).toBe(201);
    const res = await editor.patch(`/api/admin/paths/${fixture.path.id}`).send({ sources: [{ label: 'Texte officiel', url: 'https://www.service-public.gouv.fr' }], verifiedAt: '2026-10-31' });
    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/paths/${fixture.path.slug}`)).body).toMatchObject({ sources: [{ label: 'Texte officiel' }], verifiedAt: '2026-10-31T00:00:00.000Z' });
  });

  it('réserve les formules au super-administrateur', async () => {
    const plan = { code: `test-${fixture.suffix}`, name: 'Formule de test', description: 'Description de la formule de test.', priceCents: 990, durationDays: 30, active: false };
    expect((await support.post('/api/admin/plans').send(plan)).status).toBe(403);
    const res = await admin.post('/api/admin/plans').send(plan);
    expect(res.status).toBe(201);
    expect((await admin.patch(`/api/admin/plans/${res.body.id}`).send({ priceCents: 1290 })).status).toBe(200);
    expect((await prisma.plan.findUniqueOrThrow({ where: { id: res.body.id } })).priceCents).toBe(1290);
    expect((await support.get('/api/admin/entitlements?within=30')).status).toBe(200);
  });
});
