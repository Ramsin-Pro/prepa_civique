/**
 * Adresse de retour après connexion : seulement un chemin du site, jamais un autre domaine. Les caractères de
 * contrôle et les barres obliques inverses sont refusés : le navigateur retire tabulations et retours à la ligne,
 * si bien que « /\t/site.example » deviendrait « //site.example », une autre adresse.
 */
export function safeNext(next: string | null | undefined, fallback = '/espace'): string {
  if (!next?.startsWith('/') || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, 'https://repere.invalid');
    return url.origin === 'https://repere.invalid' ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
