import { createHmac } from 'node:crypto';
import { config } from './config.js';
import { prisma } from './db.js';
import type { Prisma } from './generated/prisma/client.js';

/** Journal des actions sensibles du back-office (A09). */
export async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string | number,
  details?: Prisma.InputJsonValue,
) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId: String(entityId), details } });
}

export type AnalyticsType =
  | 'visit'
  | 'training_answer'
  | 'exam_start'
  | 'exam_finish'
  | 'signup'
  | 'checkout_start'
  | 'purchase'
  | 'paywall_view'
  | 'premium_click';

/** Canal d'acquisition lisible (utm_source ou site d'origine), réduit à quelques caractères sûrs. */
export const normalizeChannel = (channel: string | undefined | null) => {
  const cleaned = channel?.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 50);
  return cleaned ? cleaned : null;
};

/**
 * Empreinte d'un apprenant pour un jour donné : elle permet de compter les personnes distinctes dans la journée,
 * mais change chaque jour et dépend d'un secret serveur. On ne peut donc ni suivre une personne dans le temps,
 * ni retrouver son identifiant.
 */
const dailyFingerprint = (learnerKey: string, day: Date) =>
  createHmac('sha256', config.appSecret).update(`stats:${day.toISOString().slice(0, 10)}:${learnerKey}`).digest('hex').slice(0, 32);

/**
 * Statistiques internes (A08), sans traceur : un événement daté du jour, avec une empreinte quotidienne de
 * l'apprenant pour compter les personnes distinctes. Ne bloque jamais la requête en cas d'erreur.
 */
export async function track(
  type: AnalyticsType,
  data: { learnerKey?: string | null; pathCode?: string | null; channel?: string | null; place?: string | null } = {},
) {
  try {
    const now = new Date();
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    await prisma.analyticsEvent.create({
      data: {
        type,
        day,
        learnerKey: data.learnerKey ? dailyFingerprint(data.learnerKey, day) : null,
        pathCode: data.pathCode ?? null,
        channel: normalizeChannel(data.channel),
        place: data.place ?? null,
      },
    });
  } catch {
    // Les statistiques ne doivent jamais empêcher un candidat de s'entraîner.
  }
}
