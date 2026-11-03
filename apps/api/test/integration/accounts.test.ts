import { createHash, randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { outbox } from '../../src/mail/mailer.js';
import { PASSWORD, createUser, deleteUsers, lastToken, loginAs } from './helpers.js';

// Comptes (E05, E16) : inscription sans divulguer les adresses inscrites, confirmation par email,
// connexion, mot de passe oublié, profil, export et suppression des données.

const app = createApp();
const created: string[] = [];

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { endsWith: '@inscription.test' } }, select: { id: true } });
  await deleteUsers([...created, ...users.map((user) => user.id)]);
  await prisma.$disconnect();
});

const newEmail = () => `${randomUUID().slice(0, 10)}@inscription.test`;

describe('inscription et confirmation', () => {
  it('répond pareil pour une nouvelle adresse et pour une adresse déjà inscrite', async () => {
    const email = newEmail();
    const first = await request(app).post('/api/auth/register').send({ email, password: PASSWORD, acceptTerms: true });
    const again = await request(app).post('/api/auth/register').send({ email, password: PASSWORD, acceptTerms: true });
    expect(first.status).toBe(202);
    expect(again.status).toBe(202);
    expect(again.body).toEqual(first.body);
    // La personne déjà inscrite est prévenue par email, sans que la page ne le révèle.
    expect(outbox.filter((mail) => mail.to === email).map((mail) => mail.subject)).toEqual([
      'Confirmez votre adresse email',
      'Vous avez déjà un compte',
    ]);
  });

  it('exige l’acceptation des conditions d’utilisation', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: newEmail(), password: PASSWORD, acceptTerms: false });
    expect(res.status).toBe(400);
  });

  it('refuse la connexion avant la confirmation ; le lien confirme l’adresse sans connecter', async () => {
    const email = newEmail();
    await request(app).post('/api/auth/register').send({ email, password: PASSWORD, acceptTerms: true, marketingConsent: true, channel: 'TikTok' });

    const early = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe('email_not_verified');

    const agent = request.agent(app);
    const verified = await agent.post('/api/auth/verify-email').send({ token: lastToken(email) });
    expect(verified.status).toBe(200);
    // Quelqu'un a pu s'inscrire avec l'adresse d'une autre personne : le lien n'ouvre pas de session, le mot de passe reste exigé.
    expect(String(verified.headers['set-cookie'] ?? '')).not.toContain('session=');
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await agent.post('/api/auth/login').send({ email, password: PASSWORD })).status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toMatchObject({ email, emailVerified: true, marketingConsent: true, staff: false, premium: { active: false } });

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.acquisitionChannel).toBe('tiktok');
    expect(user.passwordHash).not.toContain(PASSWORD);

    // Un lien ne sert qu'une fois.
    const reused = await request(app).post('/api/auth/verify-email').send({ token: lastToken(email) });
    expect(reused.status).toBe(400);

    // Un lien tronqué par la messagerie reçoit un message compréhensible.
    const truncated = await request(app).post('/api/auth/verify-email').send({ token: 'abc' });
    expect(truncated.body.error.details[0].message).toBe('Ce lien n’est plus valable. Demandez-en un nouveau.');
  });

  it('rattache au compte la progression faite sans compte', async () => {
    const user = await createUser();
    created.push(user.id);
    const visitor = randomBytes(32).toString('base64url');
    const question = await prisma.question.findFirstOrThrow({ select: { id: true } });
    const hash = createHash('sha256').update(visitor).digest('hex');
    await prisma.visitorQuestionState.create({
      data: { learnerKey: hash, questionId: question.id, box: 2, attempts: 1, correctCount: 1, lastCorrect: true, lastAnsweredAt: new Date(), dueAt: new Date() },
    });

    const res = await request(app).post('/api/auth/login').set('Cookie', `visiteur=${visitor}`).send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
    const moved = await prisma.visitorQuestionState.findMany({ where: { learnerKey: `user:${user.id}` } });
    expect(moved.map((state) => state.questionId)).toEqual([question.id]);
    expect(await prisma.visitorQuestionState.count({ where: { learnerKey: hash } })).toBe(0);
  });
});

describe('connexion', () => {
  it('donne la même erreur pour un email inconnu et un mauvais mot de passe', async () => {
    const user = await createUser();
    created.push(user.id);
    const unknown = await request(app).post('/api/auth/login').send({ email: newEmail(), password: PASSWORD });
    const wrong = await request(app).post('/api/auth/login').send({ email: user.email, password: 'pas le bon mot de passe' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('refuse un compte désactivé', async () => {
    const user = await createUser();
    created.push(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'DISABLED' } });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it('déconnecte et oublie la session', async () => {
    const user = await createUser();
    created.push(user.id);
    const agent = await loginAs(app, user.email);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe(user.email);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('change le mot de passe avec le lien reçu et ferme les sessions ouvertes', async () => {
    const user = await createUser();
    created.push(user.id);
    const agent = await loginAs(app, user.email);

    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: newEmail() });
    const known = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    expect(known.status).toBe(202);
    expect(known.body).toEqual(unknown.body);

    const reset = await request(app).post('/api/auth/reset-password').send({ token: lastToken(user.email), password: 'un tout nouveau mot de passe' });
    expect(reset.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'un tout nouveau mot de passe' });
    expect(login.status).toBe(200);
  });

  it('refuse une requête qui modifie quelque chose depuis un autre site', async () => {
    const res = await request(app).post('/api/auth/logout').set('Origin', 'https://site-malveillant.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden_origin');
  });
});

describe('mon compte', () => {
  it('demande d’être connecté', async () => {
    expect((await request(app).get('/api/account')).status).toBe(401);
  });

  it('met à jour la démarche et le consentement, puis exporte les données', async () => {
    const user = await createUser();
    created.push(user.id);
    const agent = await loginAs(app, user.email);
    const path = await prisma.path.findFirstOrThrow({ where: { active: true }, select: { slug: true } });

    expect((await agent.patch('/api/account').send({ pathSlug: path.slug, marketingConsent: true })).status).toBe(204);
    const account = await agent.get('/api/account');
    expect(account.body).toMatchObject({ email: user.email, path: { slug: path.slug }, premium: { active: false }, orders: [] });
    expect(account.body.marketingConsentAt).not.toBeNull();

    const exported = await agent.get('/api/account/export');
    expect(exported.status).toBe(200);
    expect(exported.headers['content-disposition']).toContain('attachment');
    expect(exported.body.user.email).toBe(user.email);
    expect(JSON.stringify(exported.body)).not.toContain('passwordHash');
  });

  it('supprime le compte après confirmation du mot de passe', async () => {
    const user = await createUser();
    const agent = await loginAs(app, user.email);
    expect((await agent.delete('/api/account').send({ password: 'mauvais mot de passe' })).status).toBe(401);
    expect((await agent.delete('/api/account').send({ password: PASSWORD })).status).toBe(204);
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(0);
  });
});
