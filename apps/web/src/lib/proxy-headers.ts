// En-têtes qui disent à l'API quelle est l'adresse du visiteur, accompagnés du secret partagé (PROXY_SECRET, même
// valeur côté API). Sans secret configuré (développement), rien n'est ajouté. Côté serveur uniquement.
export function trustedProxyHeaders(forwardedFor: string | null): Record<string, string> | null {
  const secret = process.env.PROXY_SECRET;
  // Première adresse de la chaîne : celle que l'hébergeur du site (Vercel) a vue, qu'un visiteur ne peut pas imposer.
  const ip = forwardedFor?.split(',')[0]?.trim();
  if (!secret || !ip) return null;
  return { 'x-repere-proxy': secret, 'x-repere-client-ip': ip };
}
