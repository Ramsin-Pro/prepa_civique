import { NextResponse, type NextRequest } from 'next/server';
import { trustedProxyHeaders } from '@/lib/proxy-headers';

// Appels du navigateur vers /api, relayés vers l'API par next.config.ts : on y joint l'adresse du visiteur et le
// secret partagé, pour que les limites d'essais comptent par visiteur et non par serveur du site.
export function proxy(request: NextRequest) {
  const extra = trustedProxyHeaders(request.headers.get('x-forwarded-for'));
  const headers = new Headers(request.headers);
  // Un visiteur ne doit jamais pouvoir fournir lui-même ces en-têtes.
  headers.delete('x-repere-proxy');
  headers.delete('x-repere-client-ip');
  if (extra) for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: '/api/:path*' };
