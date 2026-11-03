import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';

// Les numéros des propositions en base ne sont jamais montrés aux candidats : créées à la suite, les quatre
// propositions d'une question ont des numéros qui se suivent, et leur ordre a longtemps désigné la bonne réponse.
// Chaque proposition est désignée par un identifiant opaque : son numéro signé avec le secret de l'application,
// impossible à deviner ou à ramener au numéro, mais stable d'un affichage à l'autre.
// Le back-office, réservé à l'équipe, garde les vrais numéros.

const TOKEN_LENGTH = 16; // 96 bits

export function answerToken(answerId: number): string {
  return createHmac('sha256', config.appSecret).update(`reponse:${answerId}`).digest('base64url').slice(0, TOKEN_LENGTH);
}

export const ANSWER_TOKEN_PATTERN = `[A-Za-z0-9_-]{${TOKEN_LENGTH}}`;

/** Identifiant opaque d'une proposition, tel que l'envoie le navigateur. */
export const answerTokenSchema = z.string().regex(new RegExp(`^${ANSWER_TOKEN_PATTERN}$`), 'Proposition inconnue.');

/** La proposition, parmi celles d'une question, que désigne un identifiant opaque. */
export function findByToken<T extends { id: number }>(answers: readonly T[], token: string): T | undefined {
  return answers.find((answer) => answerToken(answer.id) === token);
}
