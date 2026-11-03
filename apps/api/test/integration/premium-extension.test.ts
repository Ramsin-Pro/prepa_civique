import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { config } from '../../src/config.js';
import { prisma } from '../../src/db.js';
import { createUser, deleteUsers, loginAs } from './helpers.js';

// Prolongation gratuite d'un pass (examen repoussé) : les accès pris après le pass sont décalés d'autant,
// et la prolongation n'a lieu qu'une fois, même si la demande part deux fois.

const app = createApp();
const created: string[] = [];
const DAY_MS = 24 * 60 * 60 * 1000;
const shift = config.premiumExtensionDays * DAY_MS;

afterAll(async () => {
  await deleteUsers(created);
  await prisma.$disconnect();
});

/**
 * Un accès terminé, un pass payé en cours, puis un accès pris après lui (place de structure, geste commercial),
 * créés comme le fait l'application : début à la date d'achat ou d'activation, fin à la suite de l'accès précédent.
 */
async function passWithEarlierAndLaterAccess() {
  const user = await createUser();
  created.push(user.id);
  const now = Date.now();
  const earlier = await prisma.entitlement.create({
    data: { userId: user.id, startsAt: new Date(now - 60 * DAY_MS), expiresAt: new Date(now - 30 * DAY_MS) },
  });
  const plan = await prisma.plan.findFirstOrThrow();
  const order = await prisma.order.create({
    data: { userId: user.id, planId: plan.id, amountCents: 1900, currency: 'EUR', provider: 'simulation', status: 'PAID', paidAt: new Date(now - 10 * DAY_MS), waiverAcceptedAt: new Date(now - 10 * DAY_MS) },
  });
  const pass = await prisma.entitlement.create({
    data: { userId: user.id, orderId: order.id, startsAt: new Date(now - 10 * DAY_MS), expiresAt: new Date(now + 20 * DAY_MS) },
  });
  const later = await prisma.entitlement.create({
    data: { userId: user.id, startsAt: new Date(now), expiresAt: new Date(pass.expiresAt.getTime() + 90 * DAY_MS) },
  });
  return { earlier, pass, later, agent: await loginAs(app, user.email) };
}

describe('prolongation gratuite d’un pass', () => {
  it('décale aussi les accès pris après le pass, sans changer leur début ni les accès plus anciens', async () => {
    const { earlier, pass, later, agent } = await passWithEarlierAndLaterAccess();
    const res = await agent.post('/api/account/premium/extension');
    expect(res.status).toBe(200);
    expect(new Date(res.body.expiresAt).getTime()).toBe(pass.expiresAt.getTime() + shift);

    const after = await prisma.entitlement.findUniqueOrThrow({ where: { id: later.id } });
    expect(after.expiresAt.getTime()).toBe(later.expiresAt.getTime() + shift);
    expect(after.startsAt.getTime()).toBe(later.startsAt.getTime());
    expect((await prisma.entitlement.findUniqueOrThrow({ where: { id: earlier.id } })).expiresAt).toEqual(earlier.expiresAt);
    // L'accès affiché court jusqu'à la nouvelle fin du dernier accès : aucun jour de prolongation n'est perdu.
    expect(new Date((await agent.get('/api/account')).body.premium.until).getTime()).toBe(after.expiresAt.getTime());
  });

  it('ne prolonge qu’une fois quand la demande part deux fois en même temps', async () => {
    const { pass, later, agent } = await passWithEarlierAndLaterAccess();
    const results = await Promise.all([agent.post('/api/account/premium/extension'), agent.post('/api/account/premium/extension')]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect((await prisma.entitlement.findUniqueOrThrow({ where: { id: pass.id } })).expiresAt.getTime()).toBe(pass.expiresAt.getTime() + shift);
    expect((await prisma.entitlement.findUniqueOrThrow({ where: { id: later.id } })).expiresAt.getTime()).toBe(later.expiresAt.getTime() + shift);
  });
});
