// Canal d'acquisition de la visite (A08) : utm_source, sinon le site d'origine. Gardé pour la session
// de navigation seulement, puis transmis à l'inscription. Aucun traceur, aucun cookie.

const KEY = 'repere:canal';

const KNOWN_SOURCES: [RegExp, string][] = [
  [/(^|\.)google\./, 'google'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)duckduckgo\.com$/, 'duckduckgo'],
  [/(^|\.)(facebook|fb)\.com$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)youtube\.com$/, 'youtube'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'x'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)whatsapp\.com$/, 'whatsapp'],
];

/** Canal de la visite en cours, calculé à la première page vue. */
export function detectChannel(): string {
  const utm = new URLSearchParams(window.location.search).get('utm_source');
  if (utm) return utm.toLowerCase().slice(0, 50);
  if (!document.referrer) return 'direct';
  try {
    const host = new URL(document.referrer).hostname;
    if (host === window.location.hostname) return 'direct';
    return KNOWN_SOURCES.find(([pattern]) => pattern.test(host))?.[1] ?? host.replace(/^www\./, '').slice(0, 50);
  } catch {
    return 'direct';
  }
}

export function readChannel(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Mémorise le canal pour la session ; renvoie true si c'est la première page vue de la session. */
export function rememberChannel(channel: string): boolean {
  try {
    if (sessionStorage.getItem(KEY)) return false;
    sessionStorage.setItem(KEY, channel);
    return true;
  } catch {
    return false;
  }
}
