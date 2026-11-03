'use client';

import { useEffect, useRef, useState } from 'react';
import { browserVoices, formatRate, nextSpeechRate, pickBrowserVoice, setSpeechRate, speechStatus, speechStatusNow, useSpeechRate } from '@/lib/speech';

// Un seul extrait lu à la fois sur la page : lancer une lecture arrête la précédente.
let stopCurrent: (() => void) | null = null;

/**
 * Lecture à voix haute (aide à la lecture, public A2-B1) avec la voix Rémy de Microsoft :
 * l'extrait vient du serveur (Azure Speech) quand `src` est fourni et que la voix est configurée,
 * sinon la voix du navigateur lit `text`. La vitesse se règle à côté, même pendant la lecture.
 */
export function SpeakButton({ text, src, label = 'Écouter' }: { text: string; src?: string; label?: string }) {
  const rate = useSpeechRate();
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const spokenUpTo = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    let cancelled = false;
    const canSpeak = 'speechSynthesis' in window;
    setSupported(canSpeak || Boolean(src));
    if (src) {
      void speechStatus().then((status) => {
        if (cancelled) return;
        if (status.available) {
          setSupported(true);
          setVoiceName('Rémy');
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Un nouveau texte (question suivante) arrête la lecture en cours.
  useEffect(() => stop, [text, src]);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    utteranceRef.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPlaying(false);
    if (stopCurrent === stop) stopCurrent = null;
  }

  async function speakWithBrowser(from = 0) {
    if (!('speechSynthesis' in window)) {
      setPlaying(false);
      return;
    }
    const synth = window.speechSynthesis;
    const voice = pickBrowserVoice(await browserVoices());
    const utterance = new SpeechSynthesisUtterance(text.slice(from));
    utterance.lang = 'fr-FR';
    utterance.rate = rateRef.current;
    if (voice) {
      utterance.voice = voice;
      setVoiceName((current) => current ?? (/r[ée]my/i.test(voice.name) ? 'Rémy' : null));
    }
    spokenUpTo.current = from;
    // Position atteinte, pour reprendre au même mot si la vitesse change pendant la lecture.
    utterance.onboundary = (event) => {
      spokenUpTo.current = from + event.charIndex;
    };
    // Une lecture interrompue pour changer de vitesse ne doit pas arrêter celle qui la remplace.
    const finished = () => {
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null;
        setPlaying(false);
      }
    };
    utterance.onend = finished;
    utterance.onerror = finished;
    utteranceRef.current = utterance;
    synth.cancel();
    synth.speak(utterance);
  }

  async function play() {
    stopCurrent?.();
    stopCurrent = stop;
    setPlaying(true);

    const status = speechStatusNow() ?? (src ? await speechStatus() : null);
    if (src && status?.available) {
      const audio = new Audio(src);
      audio.playbackRate = rateRef.current;
      audio.onended = () => setPlaying(false);
      // Extrait indisponible (quota, réseau…) : la voix du navigateur prend le relais.
      audio.onerror = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          void speakWithBrowser();
        }
      };
      audioRef.current = audio;
      try {
        await audio.play();
        return;
      } catch {
        if (audioRef.current !== audio) return;
        audioRef.current = null;
      }
    }
    await speakWithBrowser();
  }

  function changeRate() {
    const next = nextSpeechRate(rate);
    setSpeechRate(next);
    rateRef.current = next;
    if (!playing) return;
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    } else if (utteranceRef.current) {
      // La synthèse du navigateur ne change pas de vitesse en cours de phrase : on reprend au dernier mot lu.
      void speakWithBrowser(spokenUpTo.current);
    }
  }

  if (!supported) return null;

  const pill =
    'inline-flex min-h-9 items-center gap-1.5 border border-ligne bg-white px-3 text-[0.8125rem] font-bold text-encre-doux transition-colors hover:border-sapin-500 hover:text-sapin-700';

  return (
    <span className="inline-flex" title={voiceName ? `Voix ${voiceName} (Microsoft)` : undefined}>
      <button type="button" onClick={playing ? stop : play} aria-pressed={playing} className={`${pill} rounded-l-full`}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5L6 9H3v6h3l5 4V5z" />
          {playing ? <path d="M16 9l5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />}
        </svg>
        {playing ? 'Arrêter' : label}
      </button>
      <button
        type="button"
        onClick={changeRate}
        aria-label={`Vitesse de lecture : ${formatRate(rate)}. Changer la vitesse`}
        className={`${pill} -ml-px rounded-r-full tabular-nums`}
      >
        {formatRate(rate)}
      </button>
    </span>
  );
}
