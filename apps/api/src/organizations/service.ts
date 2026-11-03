import { randomInt } from 'node:crypto';
import { prisma } from '../db.js';
import { Prisma } from '../generated/prisma/client.js';
import { HttpError } from '../http/errors.js';

// Associations et structures : packs de places. Une place = un accès Premium pour la personne qui l'active
// avec le code d'invitation de la structure. La structure gère ses places ; la personne garde la main sur ses données.

const DAY_MS = 24 * 60 * 60 * 1000;
// Sans 0/O ni 1/I/L : le code se lit et se dicte sans erreur.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const ORGANIZATION_KINDS = ['association', 'centre-social', 'formation', 'collectivite', 'autre'] as const;

export function newInviteCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

export const normalizeCode = (code: string) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Email masqué montré à la structure sans accord de partage : de quoi reconnaître une personne, pas de quoi la contacter. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}

type Tx = Prisma.TransactionClient;

/** Places des packs encore utilisables (non révoqués, date limite non passée), avec le nombre de places prises. */
export async function openLicenses(organizationId: string, now = new Date(), tx: Tx = prisma) {
  const licenses = await tx.organizationLicense.findMany({
    where: { organizationId, revokedAt: null, validUntil: { gt: now } },
    orderBy: { validUntil: 'asc' },
    select: { id: true, seats: true, seatDays: true, validUntil: true, _count: { select: { members: { where: { removedAt: null } } } } },
  });
  return licenses.map(({ _count, ...license }) => ({ ...license, used: _count.members, free: license.seats - _count.members }));
}

export async function seatSummary(organizationId: string, tx: Tx = prisma) {
  const licenses = await openLicenses(organizationId, new Date(), tx);
  return {
    total: licenses.reduce((sum, license) => sum + license.seats, 0),
    used: licenses.reduce((sum, license) => sum + license.used, 0),
    free: licenses.reduce((sum, license) => sum + license.free, 0),
  };
}

/**
 * Activation d'une place : la personne rejoint la structure et reçoit un accès Premium. Transaction sérialisable :
 * deux activations simultanées ne peuvent pas prendre la même dernière place.
 */
export async function joinOrganization(userId: string, code: string, shareProgress: boolean) {
  const now = new Date();
  try {
    return await prisma.$transaction(
      async (tx) => {
        const organization = await tx.organization.findUnique({
          where: { inviteCode: normalizeCode(code) },
          select: { id: true, name: true, status: true, ownerId: true },
        });
        if (!organization || organization.status !== 'ACTIVE') throw new HttpError(404, 'invalid_code', 'Ce lien d’invitation n’est pas valable.');

        const existing = await tx.organizationMember.findUnique({
          where: { organizationId_userId: { organizationId: organization.id, userId } },
          select: { removedAt: true, entitlement: { select: { expiresAt: true } } },
        });
        if (existing && !existing.removedAt) {
          throw new HttpError(409, 'already_member', `Vous avez déjà une place chez ${organization.name}.`);
        }
        if (existing?.removedAt) {
          throw new HttpError(409, 'removed_member', `${organization.name} a mis fin à votre place. Contactez la structure si c’est une erreur.`);
        }

        const license = (await openLicenses(organization.id, now, tx)).find((candidate) => candidate.free > 0);
        if (!license) throw new HttpError(409, 'no_seat_left', `Il n’y a plus de place disponible chez ${organization.name}. Prévenez la structure.`);

        // Un accès encore actif (pass acheté, par exemple) est prolongé plutôt que remplacé.
        const current = await tx.entitlement.findFirst({
          where: { userId, revokedAt: null, expiresAt: { gt: now } },
          orderBy: { expiresAt: 'desc' },
          select: { expiresAt: true },
        });
        const expiresAt = new Date((current?.expiresAt ?? now).getTime() + license.seatDays * DAY_MS);
        const entitlement = await tx.entitlement.create({ data: { userId, startsAt: now, expiresAt } });
        await tx.organizationMember.create({
          data: {
            organizationId: organization.id,
            licenseId: license.id,
            userId,
            entitlementId: entitlement.id,
            shareProgressAt: shareProgress ? now : null,
          },
        });
        return { organizationId: organization.id, organizationName: organization.name, expiresAt };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // Conflit de sérialisation : une autre activation a eu lieu au même instant.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new HttpError(409, 'retry', 'Beaucoup de personnes activent leur place en même temps. Réessayez dans un instant.');
    }
    throw error;
  }
}

type Period = { id: number; userId: string; startsAt: Date; expiresAt: Date };

/**
 * Accès à avancer après des révocations. Un nouvel accès s'ajoute à la fin de celui en cours : sans correction, le pass
 * acheté ensuite couvrirait encore la période retirée. Chaque accès révoqué libère ce qui lui restait à courir : de la fin
 * des accès pris avant lui (ou de son début) jusqu'à sa fin, sans la part déjà passée. Les accès pris après lui par la
 * même personne, ajoutés à sa fin, sont avancés d'autant ; un accès pas encore commencé commence plus tôt, jamais avant
 * maintenant. L'ordre de création suit l'identifiant. Renvoie seulement les accès non révoqués qui changent.
 */
export function shiftAfterRevocations(revoked: readonly Period[], others: readonly Period[], now: Date): Period[] {
  // Les accès encore à révoquer restent dans la chaîne tant qu'on ne les a pas traités : l'ordre de traitement ne compte pas.
  const pool = new Map([...others, ...revoked].map((entry) => [entry.id, entry]));
  for (const { id } of revoked) {
    const gone = pool.get(id);
    if (!gone) continue;
    pool.delete(id);
    const chain = [...pool.values()].filter((entry) => entry.userId === gone.userId);
    // Un accès pris avant et qui finit plus tard (accès offert, pass prolongé) couvrait déjà toute sa période : rien à avancer.
    const previousEnd = Math.max(gone.startsAt.getTime(), ...chain.filter((entry) => entry.id < gone.id).map((entry) => entry.expiresAt.getTime()));
    const remaining = gone.expiresAt.getTime() - Math.max(now.getTime(), previousEnd);
    if (remaining <= 0) continue;
    for (const entry of chain) {
      if (entry.id < gone.id || entry.expiresAt <= gone.expiresAt) continue;
      pool.set(entry.id, {
        ...entry,
        startsAt: entry.startsAt > now ? new Date(Math.max(now.getTime(), entry.startsAt.getTime() - remaining)) : entry.startsAt,
        expiresAt: new Date(entry.expiresAt.getTime() - remaining),
      });
    }
  }
  return others.flatMap((entry) => {
    const next = pool.get(entry.id);
    return next && next !== entry ? [next] : [];
  });
}

/**
 * Révocation d'accès Premium (remboursement, litige, place retirée), dans la transaction de l'appelant. Un accès déjà
 * révoqué ne l'est pas deux fois, même si deux révocations se croisent, et les accès pris ensuite sont avancés
 * (shiftAfterRevocations) pour que la période retirée ne reste pas couverte.
 */
export async function revokeEntitlements(tx: Tx, ids: readonly number[], now = new Date()) {
  if (ids.length === 0) return;
  const revoked = await tx.entitlement.updateManyAndReturn({
    where: { id: { in: [...ids] }, revokedAt: null },
    data: { revokedAt: now },
    select: { id: true, userId: true, startsAt: true, expiresAt: true },
  });
  if (revoked.length === 0) return;
  const others = await tx.entitlement.findMany({
    where: { userId: { in: [...new Set(revoked.map((entry) => entry.userId))] }, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true, userId: true, startsAt: true, expiresAt: true },
  });
  for (const entry of shiftAfterRevocations(revoked, others, now)) {
    await tx.entitlement.update({ where: { id: entry.id }, data: { startsAt: entry.startsAt, expiresAt: entry.expiresAt } });
  }
}

/**
 * Fin d'une place : l'accès offert est clos (un pass acheté ensuite est avancé d'autant) et la place redevient
 * disponible pour quelqu'un d'autre. Idempotent : une place déjà libérée ne change plus.
 */
export async function endMembership(memberId: number) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const ended = await tx.organizationMember.updateManyAndReturn({
      where: { id: memberId, removedAt: null },
      data: { removedAt: now },
      select: { entitlementId: true },
    });
    if (ended.length === 0) return false;
    await revokeEntitlements(tx, ended.map((member) => member.entitlementId), now);
    return true;
  });
}

// ─── Chiffres du groupe vus par la structure ─────────────────────────────────

// Seuil d'anonymat : le groupe compte au moins 5 personnes, et chaque chiffre mêle 0 ou au moins 5 personnes qui ne partagent pas.
export const MIN_GROUP_FOR_AVERAGES = 5;

type GroupEntry = { shared: boolean; lastActivityAt: Date | null; bestExam: number | null; weakTopics: readonly string[] };

/**
 * Chiffres du groupe, sans nom. La structure voit le détail des personnes qui partagent leur progression : un chiffre où
 * entrent de 1 à 4 personnes qui ne partagent pas laisserait retrouver leur situation par différence (le score du seul
 * examen passé, l'activité de la seule personne discrète…). Chaque indicateur n'est donc publié que si ces personnes y
 * sont 0 ou au moins 5 ; sinon il vaut null. Les comptes portent sur tout le groupe : la décision de publier la moyenne ou
 * les thèmes ne doit pas, à elle seule, révéler quelque chose des personnes discrètes.
 */
export function groupStatistics(entries: readonly GroupEntry[], now = new Date()) {
  if (entries.length < MIN_GROUP_FOR_AVERAGES) return null;
  const publishable = (contributors: readonly GroupEntry[]) => {
    const discreet = contributors.filter((entry) => !entry.shared).length;
    return discreet === 0 || discreet >= MIN_GROUP_FOR_AVERAGES;
  };
  const counts = publishable(entries);
  const withExam = entries.filter((entry) => entry.bestExam !== null);
  const withWeakTopics = entries.filter((entry) => entry.weakTopics.length > 0);
  const weakCount = new Map<string, number>();
  for (const entry of withWeakTopics) for (const topic of entry.weakTopics) weakCount.set(topic, (weakCount.get(topic) ?? 0) + 1);
  return {
    activeLast7Days: counts
      ? entries.filter((entry) => entry.lastActivityAt && now.getTime() - entry.lastActivityAt.getTime() < 7 * DAY_MS).length
      : null,
    withExam: counts ? withExam.length : null,
    averageBestExam:
      counts && publishable(withExam) && withExam.length > 0
        ? withExam.reduce((sum, entry) => sum + (entry.bestExam ?? 0), 0) / withExam.length
        : null,
    weakTopics:
      counts && publishable(withWeakTopics)
        ? [...weakCount.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([title, count]) => ({ title, count }))
        : null,
  };
}

/** Nouveau code d'invitation unique (l'ancien lien cesse de fonctionner). */
export async function rotateInviteCode(organizationId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return (await prisma.organization.update({ where: { id: organizationId }, data: { inviteCode: newInviteCode() }, select: { inviteCode: true } }))
        .inviteCode;
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
  }
  throw new HttpError(500, 'code_generation_failed', 'Impossible de créer un nouveau code. Réessayez.');
}

/**
 * Pack de places ajouté à une structure (commande payée, virement reçu ou pilote). Une structure en attente de son
 * premier paiement devient active ; une structure suspendue le reste : la rouvrir est une décision de l'équipe, sinon un
 * nouveau pack rouvrirait aussi ses anciens packs.
 */
export async function addLicense(
  organizationId: string,
  data: { seats: number; seatDays: number; activationDays: number; priceCents: number; source: 'commande' | 'virement' | 'pilote'; orderId?: string; note?: string | null },
  tx: Tx = prisma,
) {
  const now = new Date();
  const license = await tx.organizationLicense.create({
    data: {
      organizationId,
      orderId: data.orderId ?? null,
      seats: data.seats,
      seatDays: data.seatDays,
      validUntil: new Date(now.getTime() + data.activationDays * DAY_MS),
      priceCents: data.priceCents,
      source: data.source,
      note: data.note ?? null,
    },
  });
  await tx.organization.updateMany({ where: { id: organizationId, status: 'PENDING' }, data: { status: 'ACTIVE' } });
  return license;
}
