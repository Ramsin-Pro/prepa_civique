import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Offre associations et structures : packs de places, invitation par code, espace de suivi, back-office,
// et ce qui va avec pour les particuliers (prolongation gratuite, demande d'avis après l'examen).
// Paiement simulé : la configuration est lue au chargement, on la fixe avant d'importer l'application.
delete process.env.STRIPE_SECRET_KEY;
process.env.PREMIUM_EXTENSION_DAYS = '30';

const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/db.js');
const { outbox } = await import('../../src/mail/mailer.js');
const { runNotifications } = await import('../../src/maintenance/notifications.js');
const { createUser, deleteUsers, loginAs } = await import('./helpers.js');

const app = createApp();
const created: string[] = [];
const PACK = 'pack-test-structure';
const PASS = 'pass-test-structure';
const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await prisma.plan.upsert({
    where: { code: PACK },
    create: {
      code: PACK,
      name: 'Pack de test',
      description: 'Deux places de test',
      priceCents: 1200,
      durationDays: 180,
      active: false,
      audience: 'ORGANIZATION',
      seats: 2,
      activationDays: 365,
    },
    update: {},
  });
  await prisma.plan.upsert({
    where: { code: PASS },
    create: { code: PASS, name: 'Pass de test', description: 'Pass de test', priceCents: 1900, durationDays: 90, active: false },
    update: {},
  });
});

afterAll(async () => {
  await deleteUsers(created);
  await prisma.organizationRequest.deleteMany({ where: { email: { endsWith: '@exemple.test' } } });
  await prisma.plan.deleteMany({ where: { code: { in: [PACK, PASS] } } });
  await prisma.$disconnect();
});

async function person(options: { verified?: boolean; role?: 'LEARNER' | 'SUPER_ADMIN' | 'SUPPORT' } = {}) {
  const user = await createUser(options.role ?? 'LEARNER', { verified: options.verified });
  created.push(user.id);
  return { user, agent: await loginAs(app, user.email) };
}

/** Commande d'un pack payée (paiement simulé) par un coordinateur : renvoie le code d'invitation. */
async function buyPack(agent: request.Agent) {
  await prisma.plan.update({ where: { code: PACK }, data: { active: true } });
  try {
    const checkout = await agent.post('/api/organizations/checkout').send({
      planCode: PACK,
      organization: { name: 'Association Test Accueil', kind: 'association', city: 'Lyon', contactName: 'Camille Test' },
      salesTermsAccepted: true,
    });
    expect(checkout.status).toBe(201);
    expect((await agent.post('/api/checkout/simulate').send({ orderId: checkout.body.orderId, outcome: 'paid' })).status).toBe(200);
    return { orderId: checkout.body.orderId as string, inviteCode: (await agent.get('/api/organizations/mine')).body.inviteCode as string };
  } finally {
    await prisma.plan.update({ where: { code: PACK }, data: { active: false } });
  }
}

describe('offre des structures', () => {
  it('sépare les packs des structures des pass individuels', async () => {
    await prisma.plan.updateMany({ where: { code: { in: [PACK, PASS] } }, data: { active: true } });
    try {
      const individual = await request(app).get('/api/plans');
      const organizations = await request(app).get('/api/organizations/offer');
      expect(individual.body.plans.map((plan: { code: string }) => plan.code)).toContain(PASS);
      expect(individual.body.plans.map((plan: { code: string }) => plan.code)).not.toContain(PACK);
      expect(organizations.body.plans.map((plan: { code: string }) => plan.code)).toEqual(expect.arrayContaining([PACK]));
      expect(organizations.body.plans.map((plan: { code: string }) => plan.code)).not.toContain(PASS);
      // Un pack ne s'achète pas comme un pass individuel.
      const { agent } = await person();
      expect((await agent.post('/api/checkout').send({ planCode: PACK, salesTermsAccepted: true, waiverAccepted: true })).status).toBe(404);
    } finally {
      await prisma.plan.updateMany({ where: { code: { in: [PACK, PASS] } }, data: { active: false } });
    }
  });

  it('ouvre les places après le paiement, une seule fois, et prévient le coordinateur', async () => {
    const { user, agent } = await person();
    expect((await request(app).post('/api/organizations/checkout').send({ planCode: PACK })).status).toBe(401);
    const { orderId, inviteCode } = await buyPack(agent);
    // Une deuxième confirmation n'ajoute rien.
    await agent.post('/api/checkout/simulate').send({ orderId, outcome: 'paid' });

    const space = await agent.get('/api/organizations/mine');
    expect(space.body).toMatchObject({ name: 'Association Test Accueil', status: 'ACTIVE', seats: { total: 2, used: 0, free: 2 } });
    expect(inviteCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(await prisma.organizationLicense.count({ where: { organization: { ownerId: user.id } } })).toBe(1);
    const mail = outbox.findLast((entry) => entry.to === user.email);
    expect(mail?.text).toContain(`/rejoindre/${inviteCode}`);
    const view = await agent.get(`/api/checkout/orders/${orderId}`);
    expect(view.body.license.seats).toBe(2);
    expect((await agent.get('/api/auth/me')).body.user.organization.owned).toBe('Association Test Accueil');
  });
});

describe('places et invitation', () => {
  it('active une place avec le code, sans dépasser le nombre de places', async () => {
    const { agent: coordinator } = await person();
    const { inviteCode } = await buyPack(coordinator);

    const info = await request(app).get(`/api/organizations/join/${inviteCode.toLowerCase()}`);
    expect(info.body).toMatchObject({ name: 'Association Test Accueil', seatsAvailable: true, seatDays: 180 });
    expect((await request(app).get('/api/organizations/join/ZZZZZZZZ')).status).toBe(404);

    // Adresse pas (ou plus) confirmée : la session la relit à chaque requête.
    const unverified = await person();
    await prisma.user.update({ where: { id: unverified.user.id }, data: { emailVerifiedAt: null } });
    expect((await unverified.agent.post('/api/organizations/join').send({ code: inviteCode })).status).toBe(403);

    const first = await person();
    const joined = await first.agent.post('/api/organizations/join').send({ code: inviteCode, shareProgress: true });
    expect(joined.status).toBe(201);
    expect((await first.agent.get('/api/auth/me')).body.user).toMatchObject({ premium: { active: true }, organization: { memberOf: 'Association Test Accueil' } });
    expect((await first.agent.post('/api/organizations/join').send({ code: inviteCode })).status).toBe(409);

    const second = await person();
    expect((await second.agent.post('/api/organizations/join').send({ code: inviteCode })).status).toBe(201);
    const third = await person();
    const full = await third.agent.post('/api/organizations/join').send({ code: inviteCode });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('no_seat_left');

    // La structure voit l'email complet seulement avec l'accord de la personne.
    const space = (await coordinator.get('/api/organizations/mine')).body;
    const shared = space.members.find((member: { shared: boolean }) => member.shared);
    const hidden = space.members.find((member: { shared: boolean }) => !member.shared);
    expect(shared.email).toBe(first.user.email);
    expect(shared.progress).toMatchObject({ answered: 0, bestExam: null });
    expect(hidden.email).not.toBe(second.user.email);
    expect(hidden.email).toContain('•');
    expect(hidden.progress).toBeNull();
    expect(space.group).toBeNull();

    // Retirer une personne arrête son accès et libère la place.
    const removed = await coordinator.delete(`/api/organizations/mine/members/${hidden.id}`);
    expect(removed.status).toBe(204);
    expect((await second.agent.get('/api/auth/me')).body.user.premium.active).toBe(false);
    expect(outbox.findLast((entry) => entry.to === second.user.email)?.subject).toMatch(/terminé/);
    expect((await second.agent.post('/api/organizations/join').send({ code: inviteCode })).status).toBe(409);
    expect((await third.agent.post('/api/organizations/join').send({ code: inviteCode })).status).toBe(201);
  });

  it('remplace le lien d’invitation et laisse la personne choisir ce qu’elle partage', async () => {
    const { agent: coordinator } = await person();
    const { inviteCode } = await buyPack(coordinator);
    const rotated = await coordinator.post('/api/organizations/mine/invite-code');
    expect(rotated.body.inviteCode).not.toBe(inviteCode);
    expect((await request(app).get(`/api/organizations/join/${inviteCode}`)).status).toBe(404);

    // L'affiche reprend le nouveau lien, avec son QR code.
    const poster = (await coordinator.get('/api/organizations/mine/poster')).body;
    expect(poster.inviteUrl).toContain(`/rejoindre/${rotated.body.inviteCode}`);
    expect(poster.qrSvg).toMatch(/^<svg[^>]*viewBox/);
    expect((await request(app).get('/api/organizations/mine/poster')).status).toBe(401);

    const learner = await person();
    await learner.agent.post('/api/organizations/join').send({ code: rotated.body.inviteCode });
    const account = (await learner.agent.get('/api/account')).body;
    expect(account.memberships).toHaveLength(1);
    expect(account.memberships[0].shareProgress).toBe(false);
    expect((await learner.agent.patch(`/api/account/memberships/${account.memberships[0].id}`).send({ shareProgress: true })).status).toBe(204);
    expect((await coordinator.get('/api/organizations/mine')).body.members[0].email).toBe(learner.user.email);

    // Quitter la structure rend la place.
    expect((await learner.agent.delete(`/api/account/memberships/${account.memberships[0].id}`)).status).toBe(204);
    expect((await coordinator.get('/api/organizations/mine')).body.seats).toMatchObject({ used: 0, free: 2 });
    const exported = (await learner.agent.get('/api/account/export')).body;
    expect(exported.organizationMemberships).toHaveLength(1);
  });

  it('révoque les places et les accès quand le pack est remboursé', async () => {
    const { agent: coordinator } = await person();
    const { orderId, inviteCode } = await buyPack(coordinator);
    const learner = await person();
    await learner.agent.post('/api/organizations/join').send({ code: inviteCode });
    const { markRefunded } = await import('../../src/premium/fulfillment.js');
    await markRefunded(orderId, null);
    expect((await learner.agent.get('/api/auth/me')).body.user.premium.active).toBe(false);
    expect((await coordinator.get('/api/organizations/mine')).body.seats.total).toBe(0);
  });

  it('avance le pass acheté après la place quand la structure retire la personne', async () => {
    const { agent: coordinator } = await person();
    const { inviteCode } = await buyPack(coordinator);
    const learner = await person();
    await learner.agent.post('/api/organizations/join').send({ code: inviteCode });
    await prisma.plan.update({ where: { code: PASS }, data: { active: true } });
    const checkout = await learner.agent.post('/api/checkout').send({ planCode: PASS, salesTermsAccepted: true, waiverAccepted: true });
    await prisma.plan.update({ where: { code: PASS }, data: { active: false } });
    await learner.agent.post('/api/checkout/simulate').send({ orderId: checkout.body.orderId, outcome: 'paid' });
    // Le pass s'ajoute à la fin de la place : 180 jours de place, puis 90 jours de pass.
    const stacked = await prisma.entitlement.findUniqueOrThrow({ where: { orderId: checkout.body.orderId } });
    expect(stacked.expiresAt.getTime() - Date.now()).toBeGreaterThan(269 * DAY_MS);

    const member = (await coordinator.get('/api/organizations/mine')).body.members[0];
    expect((await coordinator.delete(`/api/organizations/mine/members/${member.id}`)).status).toBe(204);
    // La place retirée ne couvre plus rien : il reste les 90 jours du pass, à partir d'aujourd'hui.
    const pass = await prisma.entitlement.findUniqueOrThrow({ where: { orderId: checkout.body.orderId } });
    expect(Math.abs(pass.expiresAt.getTime() - (Date.now() + 90 * DAY_MS))).toBeLessThan(60 * 1000);
    expect((await learner.agent.get('/api/auth/me')).body.user.premium.active).toBe(true);
  });

  it('masque chaque chiffre du groupe qui laisserait reconnaître une personne qui ne partage pas', async () => {
    const { agent: coordinator } = await person();
    const { inviteCode } = await buyPack(coordinator);
    const { addLicense } = await import('../../src/organizations/service.js');
    await addLicense((await coordinator.get('/api/organizations/mine')).body.id, { seats: 10, seatDays: 180, activationDays: 365, priceCents: 0, source: 'pilote' });
    const learners = [];
    for (let index = 0; index < 5; index += 1) {
      const learner = await person();
      expect((await learner.agent.post('/api/organizations/join').send({ code: inviteCode, shareProgress: index < 4 })).status).toBe(201);
      learners.push(learner);
    }

    // Quatre personnes partagent sur cinq : chaque chiffre du groupe dirait quelque chose de la cinquième.
    const space = (await coordinator.get('/api/organizations/mine')).body;
    expect(space.group).toEqual({ activeLast7Days: null, withExam: null, averageBestExam: null, weakTopics: null });
    // La fin d'accès dirait si elle avait déjà un pass : seulement avec l'accord de la personne.
    expect(space.members.find((entry: { shared: boolean }) => !entry.shared).accessUntil).toBeNull();
    expect(space.members.filter((entry: { shared: boolean }) => entry.shared).every((entry: { accessUntil: string | null }) => entry.accessUntil !== null)).toBe(true);

    // La cinquième accepte de partager : il n'y a plus personne à protéger, tout s'affiche.
    const fifth = learners[4]!;
    const membership = (await fifth.agent.get('/api/account')).body.memberships[0];
    expect((await fifth.agent.patch(`/api/account/memberships/${membership.id}`).send({ shareProgress: true })).status).toBe(204);
    const open = (await coordinator.get('/api/organizations/mine')).body;
    expect(open.group).toEqual({ activeLast7Days: 0, withExam: 0, averageBestExam: null, weakTopics: [] });
  }, 30_000);

  it('refuse de vendre des places à une structure suspendue et ne la rouvre pas en ajoutant un pack', async () => {
    const { agent: coordinator } = await person();
    const { inviteCode } = await buyPack(coordinator);
    const id = (await coordinator.get('/api/organizations/mine')).body.id as string;
    await prisma.organization.update({ where: { id }, data: { status: 'SUSPENDED' } });

    await prisma.plan.update({ where: { code: PACK }, data: { active: true } });
    try {
      const checkout = await coordinator.post('/api/organizations/checkout').send({
        planCode: PACK,
        organization: { name: 'Association Test Accueil', kind: 'association', contactName: 'Camille Test' },
        salesTermsAccepted: true,
      });
      expect(checkout.status).toBe(403);
      expect(checkout.body.error.code).toBe('organization_suspended');
    } finally {
      await prisma.plan.update({ where: { code: PACK }, data: { active: false } });
    }

    // Un pack ajouté pendant la suspension (paiement d'une session ouverte avant) ne rouvre ni la structure ni ses anciens packs.
    const { addLicense } = await import('../../src/organizations/service.js');
    await addLicense(id, { seats: 5, seatDays: 30, activationDays: 30, priceCents: 0, source: 'pilote' });
    expect((await prisma.organization.findUniqueOrThrow({ where: { id } })).status).toBe('SUSPENDED');
    expect((await request(app).get(`/api/organizations/join/${inviteCode}`)).status).toBe(404);

    // Dans le back-office, la structure est d'abord réactivée, explicitement.
    const { agent: admin } = await person({ role: 'SUPER_ADMIN' });
    const pack = { seats: 5, seatDays: 30, activationDays: 30, priceCents: 0, source: 'pilote' };
    expect((await admin.post(`/api/admin/organizations/${id}/licenses`).send(pack)).status).toBe(409);
    expect((await admin.patch(`/api/admin/organizations/${id}`).send({ status: 'ACTIVE' })).status).toBe(200);
    expect((await admin.post(`/api/admin/organizations/${id}/licenses`).send(pack)).status).toBe(201);
  });

  it('empêche un coordinateur de supprimer son compte tant qu’il gère une structure', async () => {
    const { agent } = await person();
    await buyPack(agent);
    const deletion = await agent.delete('/api/account').send({ password: 'un mot de passe de test' });
    expect(deletion.status).toBe(409);
    expect(deletion.body.error.code).toBe('organization_owner');
  });
});

describe('demandes et back-office', () => {
  it('enregistre une demande de devis et la fait apparaître dans le back-office', async () => {
    const email = `contact-${Date.now()}@exemple.test`;
    const sent = await request(app).post('/api/organizations/requests').send({
      organizationName: 'Centre social Test',
      kind: 'centre-social',
      contactName: 'Sam Test',
      email,
      seats: 120,
      wish: 'virement',
    });
    expect(sent.status).toBe(201);
    expect(outbox.findLast((entry) => entry.to === email)?.subject).toMatch(/demande/);
    // Un robot qui remplit le champ piège reçoit la même réponse, sans savoir qu'il est repéré : rien n'est gardé ni envoyé.
    const robot = `robot-${Date.now()}@exemple.test`;
    expect(
      (
        await request(app)
          .post('/api/organizations/requests')
          .send({ organizationName: 'Robot', kind: 'autre', contactName: 'Robot', email: robot, seats: 1, wish: 'devis', website: 'spam' })
      ).status,
    ).toBe(201);
    expect(await prisma.organizationRequest.count({ where: { email: robot } })).toBe(0);
    expect(outbox.some((entry) => entry.to === robot)).toBe(false);

    const { agent: support } = await person({ role: 'SUPPORT' });
    const list = await support.get('/api/admin/organization-requests?status=NEW');
    const mine = list.body.find((entry: { email: string }) => entry.email === email);
    expect(mine).toMatchObject({ seats: 120, wish: 'virement', status: 'NEW' });
    expect((await support.patch(`/api/admin/organization-requests/${mine.id}`).send({ status: 'CONTACTED' })).status).toBe(200);
    const dashboard = await support.get('/api/admin/dashboard');
    expect(dashboard.status).toBe(200);
  });

  it('crée une structure payée par virement, avec un compte coordinateur invité, puis des places d’essai', async () => {
    const { agent: admin } = await person({ role: 'SUPER_ADMIN' });
    const ownerEmail = `coordination-${Date.now()}@exemple.test`;
    const createdOrganization = await admin.post('/api/admin/organizations').send({
      name: 'Organisme Test Formation',
      kind: 'formation',
      contactName: 'Alex Test',
      ownerEmail,
    });
    expect(createdOrganization.status).toBe(201);
    expect(createdOrganization.body.invited).toBe(true);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: ownerEmail } });
    created.push(owner.id);
    expect(outbox.findLast((entry) => entry.to === ownerEmail)?.text).toContain('jeton=');

    const id = createdOrganization.body.id as string;
    expect((await admin.post(`/api/admin/organizations/${id}/licenses`).send({ seats: 10, seatDays: 30, activationDays: 60, priceCents: 500, source: 'pilote' })).status).toBe(400);
    expect((await admin.post(`/api/admin/organizations/${id}/licenses`).send({ seats: 10, seatDays: 30, activationDays: 60, priceCents: 0, source: 'pilote' })).status).toBe(201);
    expect((await admin.post(`/api/admin/organizations/${id}/licenses`).send({ seats: 50, seatDays: 180, activationDays: 365, priceCents: 35000, source: 'virement', note: 'Facture 2026-001' })).status).toBe(201);
    const detail = await admin.get(`/api/admin/organizations/${id}`);
    expect(detail.body).toMatchObject({ status: 'ACTIVE', seats: { total: 60, used: 0 } });
    expect(outbox.findLast((entry) => entry.to === ownerEmail)?.subject).toMatch(/places/);

    // Le support lit, mais n'écrit pas.
    const { agent: support } = await person({ role: 'SUPPORT' });
    expect((await support.get('/api/admin/organizations')).status).toBe(200);
    expect((await support.post(`/api/admin/organizations/${id}/licenses`).send({ seats: 1, seatDays: 30, activationDays: 30, priceCents: 0, source: 'pilote' })).status).toBe(403);
  });
});

describe('pour les particuliers', () => {
  it('prolonge gratuitement un pass une seule fois', async () => {
    const { user, agent } = await person();
    await prisma.plan.update({ where: { code: PASS }, data: { active: true } });
    const checkout = await agent.post('/api/checkout').send({ planCode: PASS, salesTermsAccepted: true, waiverAccepted: true });
    await prisma.plan.update({ where: { code: PASS }, data: { active: false } });
    await agent.post('/api/checkout/simulate').send({ orderId: checkout.body.orderId, outcome: 'paid' });
    const before = await prisma.entitlement.findFirstOrThrow({ where: { userId: user.id } });

    expect((await agent.get('/api/account')).body.extension).toMatchObject({ days: 30, available: true });
    const extended = await agent.post('/api/account/premium/extension');
    expect(extended.status).toBe(200);
    expect(new Date(extended.body.expiresAt).getTime() - before.expiresAt.getTime()).toBe(30 * DAY_MS);
    expect((await agent.post('/api/account/premium/extension')).status).toBe(409);
    expect((await agent.get('/api/account')).body.extension.available).toBe(false);
  });

  it('demande un avis après l’examen, une fois, seulement avec l’accord pour les emails d’information', async () => {
    const examDate = new Date(Date.now() - 5 * DAY_MS);
    const { user: willing } = await person();
    const { user: silent } = await person();
    await prisma.user.update({ where: { id: willing.id }, data: { examDate, marketingConsentAt: new Date() } });
    await prisma.user.update({ where: { id: silent.id }, data: { examDate } });

    await runNotifications();
    await runNotifications();
    expect(outbox.filter((entry) => entry.to === willing.email && /examen/.test(entry.subject))).toHaveLength(1);
    expect(outbox.some((entry) => entry.to === silent.email && /examen/.test(entry.subject))).toBe(false);
  });
});
