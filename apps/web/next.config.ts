import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

// En local, les variables viennent du .env à la racine du dépôt ; en Docker, de l'environnement.
const repoRoot = path.join(process.cwd(), '../..');
const rootEnv = path.join(repoRoot, '.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Adresse de l'API, figée au build. Une barre ou un « /api » final doublerait le chemin (/api/api/...).
const apiUrl = (process.env.API_INTERNAL_URL ?? 'http://localhost:4001').trim().replace(/\/+$/, '').replace(/\/api$/, '');
// Sur Vercel, une adresse manquante enverrait tous les appels vers localhost, donc des 404 : on arrête le build.
if (process.env.VERCEL && !apiUrl.startsWith('https://')) {
  throw new Error(
    "API_INTERNAL_URL manque ou n'est pas en https dans les variables Vercel (Settings > Environment Variables, case Production) : mettez l'adresse Railway de l'API, puis relancez le build.",
  );
}

// Politique de sécurité du contenu : seulement des ressources du site lui-même, pas d'affichage dans un cadre,
// formulaires et balise <base> verrouillés. Les scripts en ligne de Next.js imposent 'unsafe-inline' (sans nonce) ;
// le développement a besoin de 'unsafe-eval' et du WebSocket du rechargement à chaud.
const dev = process.env.NODE_ENV !== 'production';
// Fixé au build : en Docker, l'en-tête HSTS est posé par le reverse proxy (docs/exploitation.md).
const https = (process.env.PUBLIC_URL ?? '').startsWith('https://');
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${dev ? ' ws:' : ''}`,
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  ...(https ? ['upgrade-insecure-requests'] : []),
].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  turbopack: { root: repoRoot },
  poweredByHeader: false,
  async rewrites() {
    // Le navigateur appelle /api/... sur le même domaine que le site : Next.js relaie vers l'API Express.
    // Pas de CORS à gérer, et le cookie du visiteur reste propre au site.
    return [{ source: '/api/:path*', destination: `${apiUrl}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          ...(https ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
