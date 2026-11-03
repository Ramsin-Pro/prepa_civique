import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import request from 'supertest';
import { hashPassword } from '../../src/auth/crypto.js';
import { prisma } from '../../src/db.js';
import type { Role } from '../../src/generated/prisma/client.js';
import { outbox } from '../../src/mail/mailer.js';

// Outils partagés des tests d'intégration : comptes de test, contenus de test, jetons reçus par email.

export const PASSWORD = 'un mot de passe de test';

let passwordHash: string | null = null;

/** Compte de test déjà confirmé, créé directement en base. */
export async function createUser(role: Role = 'LEARNER', options: { verified?: boolean } = {}) {
  passwordHash ??= await hashPassword(PASSWORD);
  const email = `test-${randomUUID().slice(0, 12)}@exemple.test`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role,
      emailVerifiedAt: options.verified === false ? null : new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: 'test',
    },
  });
  return user;
}

/** Agent connecté (cookie de session conservé entre les requêtes). */
export async function loginAs(app: Express, email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Connexion impossible pour ${email} : ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

/** Jeton du dernier lien envoyé à une adresse (emails gardés en mémoire pendant les tests). */
export function lastToken(to: string): string {
  const mail = [...outbox].reverse().find((entry) => entry.to === to);
  const token = mail ? /jeton=([A-Za-z0-9_-]+)/.exec(mail.text)?.[1] : undefined;
  if (!token) throw new Error(`Aucun lien reçu par ${to}`);
  return token;
}

/** Supprime les comptes de test et tout ce qui leur est rattaché. */
export async function deleteUsers(ids: string[]) {
  if (ids.length === 0) return;
  const learnerKeys = ids.map((id) => `user:${id}`);
  await prisma.examAttempt.deleteMany({ where: { learnerKey: { in: learnerKeys } } });
  await prisma.visitorQuestionState.deleteMany({ where: { learnerKey: { in: learnerKeys } } });
  await prisma.visitorFavorite.deleteMany({ where: { learnerKey: { in: learnerKeys } } });
  // Structures : places des comptes de test, puis structures qu'ils gèrent (packs et places avec).
  await prisma.organizationMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.organization.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.entitlement.deleteMany({ where: { userId: { in: ids } } });
  await prisma.order.deleteMany({ where: { userId: { in: ids } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.questionVersion.updateMany({ where: { editorId: { in: ids } }, data: { editorId: null } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

/** Parcours isolé avec un thème et des questions publiées (3 de connaissance, 1 mise en situation par défaut). */
export async function createTestPath(options: { knowledge?: number; situations?: number; status?: 'PUBLISHED' | 'IN_REVIEW' } = {}) {
  const suffix = randomUUID().slice(0, 8);
  const path = await prisma.path.create({
    data: { code: `T${suffix}`, slug: `test-${suffix}`, title: 'Parcours de test', description: 'Test', active: true },
  });
  const topic = await prisma.topic.create({ data: { slug: `theme-${suffix}`, title: 'Thème de test' } });
  const types = [
    ...Array.from({ length: options.knowledge ?? 3 }, () => 'ORIGINAL_KNOWLEDGE' as const),
    ...Array.from({ length: options.situations ?? 1 }, () => 'ORIGINAL_SITUATION' as const),
  ];
  const questions = [];
  for (const [index, type] of types.entries()) {
    questions.push(
      await prisma.question.create({
        data: {
          reference: `TEST-${suffix}-${String(index).padStart(3, '0')}`,
          type,
          status: options.status ?? 'PUBLISHED',
          statement: `Question de test ${index}`,
          explanation: 'Explication de test, assez longue pour être valide.',
          topicId: topic.id,
          notion: 'notion-de-test',
          paths: { create: { pathId: path.id } },
          answers: { create: [0, 1, 2, 3].map((position) => ({ text: `Réponse ${position}`, isCorrect: position === 2, position })) },
        },
        include: { answers: { orderBy: { position: 'asc' } } },
      }),
    );
  }
  return { path, topic, questions, suffix };
}

export async function deleteTestPath({ path, topic }: { path: { id: number }; topic: { id: number } }) {
  await prisma.examAttempt.deleteMany({ where: { template: { pathId: path.id } } });
  await prisma.examTemplate.deleteMany({ where: { pathId: path.id } });
  await prisma.question.deleteMany({ where: { topicId: topic.id } });
  await prisma.revisionSheet.deleteMany({ where: { topicId: topic.id } });
  await prisma.topic.delete({ where: { id: topic.id } });
  await prisma.path.delete({ where: { id: path.id } });
}
