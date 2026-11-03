import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Offre gratuite et Premium (E14, E15) : limites annoncées, paiement simulé en développement,
// notifications Stripe signées et traitées une seule fois. La configuration est lue au chargement :
// on la fixe avant d'importer l'application.
process.env.FREE_QUESTIONS_PER_TOPIC = '2';
process.env.FREE_EXAMS = '1';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_signature_des_notifications';
delete process.env.STRIPE_SECRET_KEY;

const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/db.js');
const { testSignature } = await import('../../src/premium/stripe.js');
const { outbox } = await import('../../src/mail/mailer.js');
const { answerToken } = await import('../../src/questions/answer-ids.js');
const { PASSWORD, createTestPath, createUser, deleteTestPath, deleteUsers, loginAs } = await import('./helpers.js');

const app = createApp();
let fixture: Awaited<ReturnType<typeof createTestPath>>;
const created: string[] = [];
const PLAN_CODE = 'pass-test';
const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  fixture = await createTestPath({ knowledge: 5, situations: 1 });
  await prisma.examTemplate.create({
    data: { pathId: fixture.path.id, version: 1, knowledgeCount: 2, situationCount: 1, durationSeconds: 600, passThreshold: 2, active: true },
  });
  await prisma.plan.upsert({
    where: { code: PLAN_CODE },
    create: { code: PLAN_CODE, name: 'Pass de test', description: 'Test', priceCents: 1900, durationDays: 90, active: false },
    update: {},
  });
});

afterAll(async () => {
  await deleteUsers(created);
  await prisma.plan.deleteMany({ where: { code: PLAN_CODE } });
  await deleteTestPath(fixture);
  await prisma.$disconnect();
});

async function newLearner() {
  const user = await createUser();
  created.push(user.id);
  return { user, agent: await loginAs(app, user.email) };
}

async function startCheckout(agent: request.Agent) {
  // L'offre de test est inactive : on l'active le temps de la commande, sans toucher aux vraies offres.
  await prisma.plan.update({ where: { code: PLAN_CODE }, data: { active: true } });
  try {
    return await agent.post('/api/checkout').send({ planCode: PLAN_CODE, salesTermsAccepted: true, waiverAccepted: true });
  } finally {
    await prisma.plan.update({ where: { code: PLAN_CODE }, data: { active: false } });
  }
}

describe('offre gratuite', () => {
  it('ouvre les premières questions de chaque thème et annonce les autres', async () => {
    const res = await request(app).get(`/api/training/questions?path=${fixture.path.slug}&mode=topic&topic=${fixture.topic.slug}`);
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.access).toEqual({ premium: false, freeQuestionsPerTopic: 2, locked: 4 });
  });

  it('ne corrige pas une question réservée au Premium', async () => {
    const locked = fixture.questions.at(-1)!;
    const res = await request(app).post(`/api/training/questions/${locked.id}/check`).send({ answerId: answerToken(locked.answers[0]!.id) });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('premium_required');
  });

  it('ne corrige pas une question sans parcours ouvert', async () => {
    const question = fixture.questions[0]!; // ouverte gratuitement sur le parcours de test
    await prisma.path.update({ where: { id: fixture.path.id }, data: { active: false } });
    try {
      const res = await request(app).post(`/api/training/questions/${question.id}/check`).send({ answerId: answerToken(question.answers[0]!.id) });
      expect(res.status).toBe(403);
    } finally {
      await prisma.path.update({ where: { id: fixture.path.id }, data: { active: true } });
    }
  });

  it('permet un examen blanc gratuit, pas deux', async () => {
    const agent = request.agent(app);
    const before = await agent.get(`/api/exams/template?path=${fixture.path.slug}`);
    expect(before.body.access).toEqual({ premium: false, freeExamsLeft: 1 });

    const first = await agent.post('/api/exams').send({ path: fixture.path.slug });
    expect(first.status).toBe(201);
    await agent.post(`/api/exams/${first.body.id}/finish`);

    const second = await agent.post('/api/exams').send({ path: fixture.path.slug });
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe('premium_required');
  });

  it('n’ouvre pas de question en plus à l’entraînement après un examen blanc tiré dans toute la banque', async () => {
    const agent = request.agent(app);
    const exam = await agent.post('/api/exams').send({ path: fixture.path.slug });
    expect(exam.status).toBe(201);
    const drawn = exam.body.questions as { id: number; answers: { id: string }[] }[];
    for (const question of drawn) {
      await agent.put(`/api/exams/${exam.body.id}/answers/${question.id}`).send({ answerId: question.answers[0]!.id }).expect(204);
    }
    await agent.post(`/api/exams/${exam.body.id}/finish`).expect(200);

    // Trois questions vues pendant l'examen, toujours deux questions gratuites par thème à l'entraînement.
    const training = await agent.get(`/api/training/questions?path=${fixture.path.slug}&mode=topic&topic=${fixture.topic.slug}&limit=20`);
    expect(training.body.questions).toHaveLength(2);
    expect(training.body.access.locked).toBe(4);
    const review = await agent.get(`/api/training/questions?path=${fixture.path.slug}&mode=errors&limit=20`);
    expect(review.body.questions.length).toBeLessThanOrEqual(2);

    // Une question de l'examen restée hors de l'offre gratuite ne se corrige pas à l'entraînement.
    const open = new Set((training.body.questions as { id: number }[]).map((question) => question.id));
    const premiumOnly = drawn.find((question) => !open.has(question.id))!;
    const check = await agent.post(`/api/training/questions/${premiumOnly.id}/check`).send({ answerId: premiumOnly.answers[0]!.id });
    expect(check.status).toBe(403);
  });

  it('garde l’examen gratuit utilisé par le visiteur après sa connexion puis sa déconnexion', async () => {
    const browser = request.agent(app);
    const exam = await browser.post('/api/exams').send({ path: fixture.path.slug });
    expect(exam.status).toBe(201);
    await browser.post(`/api/exams/${exam.body.id}/finish`).expect(200);

    // À la connexion, l'examen rejoint le compte avec son identifiant : la page de résultat reste valable.
    const user = await createUser();
    created.push(user.id);
    expect((await browser.post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(200);
    expect((await browser.get(`/api/exams/${exam.body.id}`)).status).toBe(200);
    expect((await browser.get(`/api/exams/template?path=${fixture.path.slug}`)).body.access).toEqual({ premium: false, freeExamsLeft: 0 });

    // Déconnecté, le même navigateur n'a pas retrouvé d'examen gratuit, et la trace laissée n'apparaît nulle part.
    expect((await browser.post('/api/auth/logout')).status).toBe(204);
    expect((await browser.get(`/api/exams/template?path=${fixture.path.slug}`)).body.access).toEqual({ premium: false, freeExamsLeft: 0 });
    expect((await browser.post('/api/exams').send({ path: fixture.path.slug })).status).toBe(403);
    expect((await browser.get(`/api/exams?path=${fixture.path.slug}`)).body).toEqual({ active: null, finished: [] });

    // Une nouvelle connexion ne fait pas passer la trace au compte.
    expect((await browser.post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(200);
    expect(await prisma.examAttempt.count({ where: { learnerKey: `user:${user.id}` } })).toBe(1);
  });
});

describe('paiement', () => {
  it('demande un compte confirmé, les CGV et l’accord pour l’accès immédiat', async () => {
    expect((await request(app).post('/api/checkout').send({ planCode: PLAN_CODE, salesTermsAccepted: true, waiverAccepted: true })).status).toBe(401);

    const { agent } = await newLearner();
    await prisma.plan.update({ where: { code: PLAN_CODE }, data: { active: true } });
    const withoutWaiver = await agent.post('/api/checkout').send({ planCode: PLAN_CODE, salesTermsAccepted: true });
    const withoutTerms = await agent.post('/api/checkout').send({ planCode: PLAN_CODE, waiverAccepted: true });
    await prisma.plan.update({ where: { code: PLAN_CODE }, data: { active: false } });
    expect(withoutWaiver.status).toBe(400);
    expect(withoutTerms.status).toBe(400);
  });

  it('ouvre le Premium après un paiement simulé réussi, une seule fois', async () => {
    const { user, agent } = await newLearner();
    const checkout = await startCheckout(agent);
    expect(checkout.status).toBe(201);
    expect(checkout.body.url).toBe(`/paiement/simulation?commande=${checkout.body.orderId}`);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.body.orderId } });
    expect(order).toMatchObject({ status: 'PENDING', provider: 'simulation', amountCents: 1900 });
    expect(order.waiverAcceptedAt).not.toBeNull();
    expect(order.salesTermsVersion).toBeTruthy();

    expect((await agent.post('/api/checkout/simulate').send({ orderId: order.id, outcome: 'paid' })).status).toBe(200);
    expect((await agent.post('/api/checkout/simulate').send({ orderId: order.id, outcome: 'paid' })).status).toBe(200);
    expect(await prisma.entitlement.count({ where: { userId: user.id } })).toBe(1);

    const me = await agent.get('/api/auth/me');
    expect(me.body.user.premium.active).toBe(true);
    const view = await agent.get(`/api/checkout/orders/${order.id}`);
    expect(view.body.status).toBe('PAID');

    // L'email de confirmation rappelle l'accord pour l'accès immédiat (article L221-13).
    const mail = outbox.findLast((entry) => entry.to === user.email);
    expect(mail?.subject).toBe('Votre accès Premium est activé');
    expect(mail?.text).toContain('droit de rétractation');

    // Avec le Premium, toutes les questions du thème sont ouvertes.
    const questions = await agent.get(`/api/training/questions?path=${fixture.path.slug}&mode=topic&topic=${fixture.topic.slug}&limit=20`);
    expect(questions.body.questions).toHaveLength(6);
    expect(questions.body.access.locked).toBe(0);
  });

  it('n’ouvre rien après un paiement échoué', async () => {
    const { user, agent } = await newLearner();
    const checkout = await startCheckout(agent);
    await agent.post('/api/checkout/simulate').send({ orderId: checkout.body.orderId, outcome: 'failed' });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: checkout.body.orderId } })).status).toBe('FAILED');
    expect(await prisma.entitlement.count({ where: { userId: user.id } })).toBe(0);
  });

  it('ne montre pas la commande d’une autre personne', async () => {
    const { agent } = await newLearner();
    const checkout = await startCheckout(agent);
    const { agent: other } = await newLearner();
    expect((await other.get(`/api/checkout/orders/${checkout.body.orderId}`)).status).toBe(404);
  });
});

describe('notifications Stripe', () => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  const send = (payload: object, signature?: string) => {
    const body = JSON.stringify(payload);
    return request(app)
      .post('/api/payments/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature ?? testSignature(body, secret))
      .send(body);
  };

  it('refuse une notification mal signée', async () => {
    const res = await send({ id: 'evt_faux', type: 'checkout.session.completed', data: { object: {} } }, 't=1,v1=signature-inventee');
    expect(res.status).toBe(400);
  });

  /** Commande passée comme avec Stripe : le serveur a enregistré la session de paiement créée pour elle. */
  async function stripeOrder(orderId: string) {
    const sessionId = `cs_test_${orderId}`;
    await prisma.order.update({ where: { id: orderId }, data: { provider: 'stripe', providerSessionId: sessionId } });
    return sessionId;
  }

  async function cleanUp(orderIds: string[]) {
    await prisma.paymentEvent.deleteMany({ where: { OR: orderIds.map((id) => ({ id: { endsWith: id } })) } });
    await prisma.auditLog.deleteMany({ where: { entity: 'order', entityId: { in: orderIds } } });
  }

  it('active la commande payée et ignore la même notification reçue deux fois', async () => {
    const { user, agent } = await newLearner();
    const checkout = await startCheckout(agent);
    const sessionId = await stripeOrder(checkout.body.orderId);
    const event = {
      id: `evt_test_${checkout.body.orderId}`,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: sessionId,
          client_reference_id: checkout.body.orderId,
          payment_status: 'paid',
          payment_intent: 'pi_test_123',
          amount_total: 1900,
          currency: 'eur',
        },
      },
    };
    expect((await send(event)).status).toBe(200);
    expect((await send(event)).status).toBe(200);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.body.orderId } });
    expect(order).toMatchObject({ status: 'PAID', providerPaymentId: 'pi_test_123' });
    expect(await prisma.entitlement.count({ where: { userId: user.id } })).toBe(1);
    await cleanUp([checkout.body.orderId]);
  });

  it('n’active que la session enregistrée pour la commande, au bon montant, et jamais une commande close', async () => {
    const { user, agent } = await newLearner();
    const orderId = (await startCheckout(agent)).body.orderId as string;
    const sessionId = await stripeOrder(orderId);
    const paid = (suffix: string, session: object) =>
      send({
        id: `evt_${suffix}_${orderId}`,
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: { id: sessionId, client_reference_id: orderId, payment_status: 'paid', payment_intent: `pi_${suffix}`, amount_total: 1900, currency: 'eur', ...session },
        },
      });

    // Un autre paiement du compte (lien de paiement à 1 €…) qui reprend l'identifiant de la commande n'ouvre rien.
    expect((await paid('autre_session', { id: 'cs_test_lien_de_paiement', amount_total: 100 })).status).toBe(200);
    expect((await paid('montant', { amount_total: 100 })).status).toBe(200);
    expect((await paid('devise', { currency: 'usd' })).status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
    expect(await prisma.auditLog.count({ where: { action: 'order.payment_mismatch', entityId: orderId } })).toBe(3);

    // La fin d'une autre session ne ferme pas la commande ; celle de sa propre session, si.
    await send({ id: `evt_expire_autre_${orderId}`, object: 'event', type: 'checkout.session.expired', data: { object: { id: 'cs_test_autre', client_reference_id: orderId } } });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
    await send({ id: `evt_expire_${orderId}`, object: 'event', type: 'checkout.session.expired', data: { object: { id: sessionId, client_reference_id: orderId } } });

    // Commande expirée : un paiement annoncé ensuite n'ouvre rien et il est noté pour être remboursé.
    expect((await paid('apres_expiration', {})).status).toBe(200);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('EXPIRED');
    expect(await prisma.entitlement.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'order.payment_for_closed_order', entityId: orderId } })).toBe(1);
    await cleanUp([orderId]);
  });

  it('retire aussi la période remboursée quand un deuxième pass suivait le premier', async () => {
    const { user, agent } = await newLearner();
    const first = (await startCheckout(agent)).body.orderId as string;
    await agent.post('/api/checkout/simulate').send({ orderId: first, outcome: 'paid' });
    const second = (await startCheckout(agent)).body.orderId as string;
    await agent.post('/api/checkout/simulate').send({ orderId: second, outcome: 'paid' });
    // Le deuxième pass s'ajoute à la fin du premier : 180 jours en tout.
    const stacked = await prisma.entitlement.findUniqueOrThrow({ where: { orderId: second } });
    expect(stacked.expiresAt.getTime() - Date.now()).toBeGreaterThan(179 * DAY_MS);

    await prisma.order.update({ where: { id: first }, data: { providerPaymentId: `pi_premier_${user.id}` } });
    await send({
      id: `evt_refund_premier_${first}`,
      object: 'event',
      type: 'charge.refunded',
      data: { object: { id: 'ch_test', payment_intent: `pi_premier_${user.id}`, refunded: true, amount_refunded: 1900 } },
    });

    // Il ne reste que les 90 jours du deuxième pass, à partir d'aujourd'hui.
    const shifted = await prisma.entitlement.findUniqueOrThrow({ where: { orderId: second } });
    expect(Math.abs(shifted.expiresAt.getTime() - (Date.now() + 90 * DAY_MS))).toBeLessThan(60 * 1000);
    expect(shifted.revokedAt).toBeNull();
    expect((await prisma.entitlement.findUniqueOrThrow({ where: { orderId: first } })).revokedAt).not.toBeNull();
    await cleanUp([first, second]);
  });

  it('retire l’accès après un paiement contesté, une seule fois', async () => {
    const { user, agent } = await newLearner();
    const orderId = (await startCheckout(agent)).body.orderId as string;
    await agent.post('/api/checkout/simulate').send({ orderId, outcome: 'paid' });
    await prisma.order.update({ where: { id: orderId }, data: { providerPaymentId: `pi_litige_${user.id}` } });
    const dispute = (suffix: string) => ({
      id: `evt_dispute_${suffix}_${orderId}`,
      object: 'event',
      type: 'charge.dispute.created',
      data: { object: { id: `dp_${suffix}`, object: 'dispute', charge: 'ch_test', payment_intent: `pi_litige_${user.id}`, reason: 'fraudulent', amount: 1900 } },
    });

    expect((await send(dispute('premier'))).status).toBe(200);
    expect((await send(dispute('premier'))).status).toBe(200);
    // Un remboursement qui suit le litige ne change plus rien.
    await send({
      id: `evt_refund_apres_litige_${orderId}`,
      object: 'event',
      type: 'charge.refunded',
      data: { object: { id: 'ch_test', payment_intent: `pi_litige_${user.id}`, refunded: true, amount_refunded: 1900 } },
    });

    expect((await agent.get('/api/auth/me')).body.user.premium.active).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('REFUNDED');
    expect(await prisma.auditLog.count({ where: { entity: 'order', entityId: orderId, action: { in: ['order.dispute', 'order.refund'] } } })).toBe(1);
    expect(await prisma.auditLog.findFirst({ where: { action: 'order.dispute', entityId: orderId } })).toMatchObject({
      details: { disputeId: 'dp_premier', reason: 'fraudulent' },
    });
    await cleanUp([orderId]);
  });

  it('garde l’accès après un remboursement partiel et le retire après un remboursement total', async () => {
    const { user, agent } = await newLearner();
    const checkout = await startCheckout(agent);
    await agent.post('/api/checkout/simulate').send({ orderId: checkout.body.orderId, outcome: 'paid' });
    await prisma.order.update({ where: { id: checkout.body.orderId }, data: { providerPaymentId: `pi_rembourse_${user.id}` } });

    const charge = (refunded: boolean, suffix: string) => ({
      id: `evt_refund_${suffix}_${user.id}`,
      object: 'event',
      type: 'charge.refunded',
      data: { object: { id: 'ch_test', payment_intent: `pi_rembourse_${user.id}`, refunded, amount_refunded: refunded ? 1900 : 500 } },
    });

    await send(charge(false, 'partiel'));
    expect((await agent.get('/api/auth/me')).body.user.premium.active).toBe(true);

    await send(charge(true, 'total'));
    expect((await agent.get('/api/auth/me')).body.user.premium.active).toBe(false);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: checkout.body.orderId } })).status).toBe('REFUNDED');
    await prisma.paymentEvent.deleteMany({ where: { id: { endsWith: user.id } } });
  });
});
