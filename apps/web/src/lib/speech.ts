import { useSyncExternalStore } from 'react';

// Lecture à voix haute : vitesse choisie par l'apprenant (gardée sur l'appareil), disponibilité de la voix Rémy
// côté serveur, et choix de la meilleure voix du navigateur en secours.

export const SPEECH_RATES = [0.75, 1, 1.25, 1.5, 2] as const;
const RATE_KEY = 'repere:vitesse-lecture';
const DEFAULT_RATE = 1;

let rate: number = DEFAULT_RATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const saved = Number(localStorage.getItem(RATE_KEY));
    if ((SPEECH_RATES as readonly number[]).includes(saved)) rate = saved;
  } catch {
    // stockage indisponible (navigation privée) : vitesse normale
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSpeechRate(next: number) {
  rate = next;
  try {
    localStorage.setItem(RATE_KEY, String(next));
  } catch {
    // la vitesse reste valable pour cette page
  }
  listeners.forEach((listener) => listener());
}

/** Vitesse suivante dans la liste : 1× → 1,25× → 1,5× → 2× → 0,75× → 1×. */
export function nextSpeechRate(current: number): number {
  const index = SPEECH_RATES.indexOf(current as (typeof SPEECH_RATES)[number]);
  return SPEECH_RATES[(index + 1) % SPEECH_RATES.length]!;
}

/** Vitesse de lecture partagée par tous les boutons « Écouter » de la page. */
export function useSpeechRate(): number {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return rate;
    },
    () => DEFAULT_RATE,
  );
}

export const formatRate = (value: number) => `${value.toLocaleString('fr-FR')}×`;

type SpeechStatus = { available: boolean; voice: string | null };
let status: Promise<SpeechStatus> | null = null;
let knownStatus: SpeechStatus | null = null;

/** La voix Rémy du serveur (Azure Speech) est-elle configurée ? Demandé une seule fois par page. */
export function speechStatus(): Promise<SpeechStatus> {
  status ??= fetch('/api/speech/status')
    .then((res) => (res.ok ? (res.json() as Promise<SpeechStatus>) : { available: false, voice: null }))
    .catch(() => ({ available: false, voice: null }))
    .then((result) => (knownStatus = result));
  return status;
}

/** Réponse déjà connue, sans attendre : au clic, la lecture doit démarrer dans le geste de la personne (Safari). */
export const speechStatusNow = () => knownStatus;

/** Voix du navigateur : Rémy si elle existe (Edge), sinon une voix naturelle française, sinon la voix française par défaut. */
export function pickBrowserVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const french = voices.filter((voice) => voice.lang.toLowerCase().startsWith('fr'));
  return (
    french.find((voice) => /r[ée]my/i.test(voice.name)) ??
    french.find((voice) => voice.lang === 'fr-FR' && /natural|online|neural/i.test(voice.name)) ??
    french.find((voice) => voice.lang === 'fr-FR') ??
    french[0] ??
    null
  );
}

/** Les voix arrivent parfois après le chargement de la page (Chrome) : on les attend un court instant. */
export function browserVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (voices.length > 0) return Promise.resolve(voices);
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 700);
  });
}
