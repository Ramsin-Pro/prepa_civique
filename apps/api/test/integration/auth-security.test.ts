import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { encrypt } from '../../src/auth/crypto.js';
import { generateTotpSecret, totp } from '../../src/auth/totp.js';
import { prisma } from '../../src/db.js';
import { outbox } from '../../src/mail/mailer.js';
import { PASSWORD, createUser, deleteUsers, lastToken, loginAs } from './helpers.js';

// Sécurité des comptes : double authentification (rejeu, nouvelle session), actions sensibles, changement d'adresse,
// liens à usage unique, expiration des sessions de l'équipe, en-têtes de cache et d'origine, accusés de réception.

const app = createApp();
const created: string[] = [];
const HOUR_MS = 60 * 60 * 1000;

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { endsWith: '@securite.test' } }, select: { id: true } });
  await deleteUsers([...created, ...users.map((user) => user.id)]);
  await prisma.organizationRequest.deleteMany({ where: { email: { endsWith: '@securite.test' } } });
  await prisma.$disconnect();
});

const newEmail = () => `${randomUUID().slice(0, 10)}@securite.test`;

/** Cookie de session posé par une réponse (« session=… »), pour pouvoir rejouer un ancien jeton. */
function sessionCookie(res: request.Response): string {
  const lines = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = lines.map((line) => line.split(';')[0]!).find((pair) => /^session=.+/.test(pair));
  if (!cookie) throw new Error('Aucun cookie de session dans la réponse');
  return cookie;
}

/** Membre de l'équipe dont la double authentification est activée. */
async function staffWithMfa() {
  const user = await createUser('EDITOR');
  created.push(user.id);
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { mfaSecret: encrypt(secret), mfaEnabledAt: new Date() } });
  return { user, secret };
}

describe('double authentification', () => {
  it('ouvre une nouvelle session après le code : le jeton d’avant ne sert plus', async () => {
    const { user, secret } = await staffWithMfa();
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
    expect(login.body).toMatchObject({ ok: true, mfaRequired: true });
    const before = sessionCookie(login);
    expect((await request(app).get('/api/admin/dashboard').set('Cookie', before)).body.error.code).toBe('mfa_required');

    const verified = await request(app).post('/api/auth/mfa').set('Cookie', before).send({ code: totp(secret) });
    expect(verified.status).toBe(200);
    const after = sessionCookie(verified);
    expect(after).not.toBe(before);
    // Fixation de session : le jeton connu avant le code n'ouvre plus rien, le nouveau ouvre le back-office.
    expect((await request(app).get('/api/auth/me').set('Cookie', before)).body.user).toBeNull();
    expect((await request(app).get('/api/admin/dashboard').set('Cookie', after)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', after)).body.user.mfa).toMatchObject({ enabled: true, verified: true });
  });

  it('refuse un code déjà accepté, même s’il est encore valable', async () => {
    const { user, secret } = await staffWithMfa();
    const code = totp(secret);
    const first = await loginAs(app, user.email);
    expect((await first.post('/api/auth/mfa').send({ code })).status).toBe(200);

    const second = await loginAs(app, user.email);
    const replay = await second.post('/api/auth/mfa').send({ code });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('invalid_code');
    expect((await second.get('/api/admin/dashboard')).status).toBe(403);
    // Le code suivant de l'application, lui, est accepté.
    expect((await second.post('/api/auth/mfa').send({ code: totp(secret, Date.now() + 30_000) })).status).toBe(200);
  });

  it('demande le code avant les actions sensibles du compte', async () => {
    const { user, secret } = await staffWithMfa();
    const agent = await loginAs(app, user.email);
    const refused = [
      await agent.get('/api/account/export'),
      await agent.post('/api/account/password').send({ currentPassword: PASSWORD, newPassword: 'un nouveau mot de passe' }),
      await agent.post('/api/auth/change-email').send({ newEmail: newEmail(), password: PASSWORD }),
      await agent.delete('/api/account').send({ password: PASSWORD }),
    ];
    expect(refused.map((res) => [res.status, res.body.error?.code])).toEqual(Array(4).fill([403, 'mfa_required']));
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);

    expect((await agent.post('/api/auth/mfa').send({ code: totp(secret) })).status).toBe(200);
    expect((await agent.get('/api/account/export')).status).toBe(200);
  });
});

describe('changement d’adresse', () => {
  it('annule la demande précédente, confirme sans connecter, ferme les sessions et prévient l’ancienne adresse', async () => {
    const user = await createUser();
    created.push(user.id);
    const agent = await loginAs(app, user.email);
    const otherDevice = await loginAs(app, user.email);

    const first = newEmail();
    expect((await agent.post('/api/auth/change-email').send({ newEmail: first, password: PASSWORD })).status).toBe(202);
    const firstToken = lastToken(first);
    const second = newEmail();
    expect((await agent.post('/api/auth/change-email').send({ newEmail: second, password: PASSWORD })).status).toBe(202);
    // Une seule demande à la fois : le lien de la première ne fonctionne plus.
    expect((await request(app).post('/api/auth/verify-email').send({ token: firstToken })).status).toBe(400);

    const elsewhere = request.agent(app);
    const confirmed = await elsewhere.post('/api/auth/verify-email').send({ token: lastToken(second) });
    expect(confirmed.status).toBe(200);
    expect(String(confirmed.headers['set-cookie'] ?? '')).not.toContain('session=');
    expect((await elsewhere.get('/api/auth/me')).body.user).toBeNull();
    // Confirmé depuis un navigateur sans session : toutes les sessions du compte sont fermées.
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await otherDevice.get('/api/auth/me')).body.user).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(second);

    const notice = outbox.findLast((mail) => mail.to === user.email);
    expect(notice?.subject).toBe('L’adresse email de votre compte a changé');
    expect(notice?.text).not.toContain(second);
    expect((await request(app).post('/api/auth/login').send({ email: second, password: PASSWORD })).status).toBe(200);
  });

  it('garde la session du navigateur qui confirme, si c’est celle de la personne', async () => {
    const user = await createUser();
    created.push(user.id);
    const agent = await loginAs(app, user.email);
    const otherDevice = await loginAs(app, user.email);
    const target = newEmail();
    await agent.post('/api/auth/change-email').send({ newEmail: target, password: PASSWORD });

    expect((await agent.post('/api/auth/verify-email').send({ token: lastToken(target) })).status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe(target);
    expect((await otherDevice.get('/api/auth/me')).body.user).toBeNull();
  });

  it('annule un changement en attente quand le mot de passe est changé', async () => {
    const user = await createUser();
    created.push(user.id);
    const agent = await loginAs(app, user.email);
    const target = newEmail();
    await agent.post('/api/auth/change-email').send({ newEmail: target, password: PASSWORD });
    const pending = lastToken(target);

    const changed = await agent.post('/api/account/password').send({ currentPassword: PASSWORD, newPassword: 'un autre mot de passe solide' });
    expect(changed.status).toBe(204);
    expect((await request(app).post('/api/auth/verify-email').send({ token: pending })).status).toBe(400);
  });

  it('annule un changement en attente quand le mot de passe est réinitialisé', async () => {
    const user = await createUser();
    created.push(user.id);
    const agent = await loginAs(app, user.email);
    const target = newEmail();
    await agent.post('/api/auth/change-email').send({ newEmail: target, password: PASSWORD });
    const pending = lastToken(target);

    await request(app).post('/api/auth/forgot-password').send({ email: user.email });
    const reset = await request(app).post('/api/auth/reset-password').send({ token: lastToken(user.email), password: 'un mot de passe tout neuf' });
    expect(reset.status).toBe(200);
    expect((await request(app).post('/api/auth/verify-email').send({ token: pending })).status).toBe(400);
  });
});

describe('liens envoyés par email', () => {
  it('ne laisse passer qu’une confirmation quand plusieurs arrivent en même temps', async () => {
    const email = newEmail();
    await request(app).post('/api/auth/register').send({ email, password: PASSWORD, acceptTerms: true });
    const token = lastToken(email);
    const results = await Promise.all([1, 2, 3].map(() => request(app).post('/api/auth/verify-email').send({ token })));
    expect(results.map((res) => res.status).sort()).toEqual([200, 400, 400]);
  });
});

describe('sessions et en-têtes', () => {
  it('ferme la session d’un membre de l’équipe après 8 heures sans activité, pas celle d’un candidat', async () => {
    const member = await createUser('SUPPORT');
    const learner = await createUser();
    created.push(member.id, learner.id);
    const memberAgent = await loginAs(app, member.email);
    const learnerAgent = await loginAs(app, learner.email);
    await prisma.session.updateMany({
      where: { userId: { in: [member.id, learner.id] } },
      data: { lastSeenAt: new Date(Date.now() - 9 * HOUR_MS) },
    });

    expect((await memberAgent.get('/api/auth/me')).body.user).toBeNull();
    expect(await prisma.session.count({ where: { userId: member.id } })).toBe(0);
    expect((await learnerAgent.get('/api/auth/me')).body.user.email).toBe(learner.email);
  });

  it('interdit la mise en cache des réponses du compte', async () => {
    const user = await createUser();
    created.push(user.id);
    const agent = await loginAs(app, user.email);
    expect((await request(app).get('/api/auth/me')).headers['cache-control']).toBe('no-store');
    expect((await agent.get('/api/auth/me')).headers['cache-control']).toBe('no-store');
    expect((await agent.get('/api/account')).headers['cache-control']).toBe('no-store');
  });

  it('refuse sans Origin une requête que le navigateur annonce venue d’un autre site', async () => {
    for (const site of ['cross-site', 'same-site']) {
      const res = await request(app).post('/api/auth/logout').set('Sec-Fetch-Site', site);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden_origin');
    }
    expect((await request(app).post('/api/auth/logout').set('Sec-Fetch-Site', 'same-origin')).status).toBe(204);
    // Ni Origin ni Sec-Fetch-Site : un client qui n'est pas un navigateur, accepté.
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
    // Les notifications de paiement n'ont pas ces en-têtes : elles ne sont pas bloquées par ce contrôle.
    expect((await request(app).post('/api/payments/stripe/webhook').send({})).body.error?.code).not.toBe('forbidden_origin');
  });
});

describe('suppression du compte', () => {
  it('refuse au dernier super-administrateur actif de supprimer son compte', async () => {
    const admin = await createUser('SUPER_ADMIN');
    created.push(admin.id);
    const agent = await loginAs(app, admin.email);
    // La base de test peut contenir d'autres super-administrateurs : le comptage répond « aucun autre ».
    const count = vi.spyOn(prisma.user, 'count').mockResolvedValueOnce(0 as never);
    const refused = await agent.delete('/api/account').send({ password: PASSWORD });
    count.mockRestore();
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('last_super_admin');
    expect(await prisma.user.count({ where: { id: admin.id } })).toBe(1);
  });

  it('laisse un super-administrateur supprimer son compte quand il en reste un autre', async () => {
    const admin = await createUser('SUPER_ADMIN');
    const other = await createUser('SUPER_ADMIN');
    created.push(admin.id, other.id);
    const agent = await loginAs(app, admin.email);
    expect((await agent.delete('/api/account').send({ password: PASSWORD })).status).toBe(204);
    expect(await prisma.user.count({ where: { id: admin.id } })).toBe(0);
  });
});

describe('accusés de réception', () => {
  it('ne reprend pas le nom saisi dans la demande d’une structure (adresse non vérifiée)', async () => {
    const email = newEmail();
    const sent = await request(app).post('/api/organizations/requests').send({
      organizationName: 'Gagnez un prix sur https://hameconnage.example',
      kind: 'association',
      contactName: 'Personne Test',
      email,
      seats: 10,
      wish: 'devis',
    });
    expect(sent.status).toBe(201);
    const ack = outbox.findLast((mail) => mail.to === email);
    expect(ack?.subject).toBe('Nous avons bien reçu votre demande');
    expect(`${ack?.text} ${ack?.html}`).not.toContain('hameconnage');
  });
});
