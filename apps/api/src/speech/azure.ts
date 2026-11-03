import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { HttpError } from '../http/errors.js';
import { speechText, ssml } from './text.js';

// Voix Rémy de Microsoft (Azure Speech, voix neuronale fr-FR-RemyMultilingualNeural).
// Chaque extrait n'est synthétisé qu'une fois, puis servi depuis la base : les contenus changent peu.
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const MAX_CHARACTERS = 4000;

export const speechConfigured = () => Boolean(config.speech.key && config.speech.region);

export const clipHash = (text: string, voice = config.speech.voice) =>
  createHash('sha256').update(`${voice}|${OUTPUT_FORMAT}|${text}`).digest('hex');

async function synthesize(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(`https://${config.speech.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.speech.key!,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': OUTPUT_FORMAT,
      'User-Agent': 'repere-api',
    },
    body: ssml(text, config.speech.voice),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Azure Speech a répondu ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

const unavailable = () => new HttpError(503, 'speech_unavailable', 'La lecture audio n’est pas disponible pour le moment.');

type ClipOptions = {
  log?: Pick<Request['log'], 'warn'>;
  /** Appelé avant chaque synthèse (extrait absent du cache) : peut la refuser en levant une erreur, par exemple une limite. */
  beforeSynthesis?: () => Promise<void>;
};

/** Extrait MP3 d'un texte : depuis le cache s'il existe, sinon synthétisé par Azure puis gardé. */
export async function speechClip(rawText: string, { log, beforeSynthesis }: ClipOptions = {}): Promise<Uint8Array> {
  const text = speechText(rawText).slice(0, MAX_CHARACTERS);
  const hash = clipHash(text);
  const cached = await prisma.speechClip.findUnique({ where: { hash }, select: { audio: true } });
  if (cached) return cached.audio;
  if (!speechConfigured()) throw unavailable();
  await beforeSynthesis?.();

  let audio: Uint8Array<ArrayBuffer>;
  try {
    audio = await synthesize(text);
  } catch (error) {
    log?.warn({ err: error }, 'Synthèse vocale indisponible');
    throw unavailable();
  }
  await prisma.speechClip.upsert({ where: { hash }, create: { hash, voice: config.speech.voice, audio }, update: {} });
  return audio;
}
