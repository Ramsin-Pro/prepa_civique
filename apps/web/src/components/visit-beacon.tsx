'use client';

import { useEffect } from 'react';
import { detectChannel, rememberChannel } from '@/lib/channel';

/**
 * Mesure d'audience interne (A08) : une visite comptée par session de navigation, avec son canal d'arrivée.
 * Sans cookie ni traceur tiers ; rien n'est envoyé si la session a déjà été comptée.
 */
export function VisitBeacon() {
  useEffect(() => {
    const channel = detectChannel();
    if (!rememberChannel(channel)) return;
    const path = /^\/entrainement\/([^/]+)/.exec(window.location.pathname)?.[1];
    void fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, path }),
      keepalive: true,
    }).catch(() => undefined);
  }, []);
  return null;
}
