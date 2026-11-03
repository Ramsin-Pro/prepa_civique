import { cookies, headers as incomingHeaders } from 'next/headers';
import { SERVICE_UNAVAILABLE, readErrorMessage } from './errors';
import { trustedProxyHeaders } from './proxy-headers';
import type { Me, PathSummary } from './types';

// Appels à l'API depuis le serveur Next.js (composants serveur). Le navigateur, lui, appelle /api/...
const API_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:4001';
// Cookies de l'apprenant : visiteur anonyme et session de connexion.
const PERSONAL_COOKIES = ['visiteur', 'session'];

/**
 * Adresse du visiteur posée par le reverse proxy. Transmise à l'API, elle fait compter la limite de débit par visiteur :
 * sans elle, tous les rendus serveur partagent l'adresse du conteneur web et un seul script peut épuiser le quota du site.
 */
async function visitorAddress(): Promise<string | null> {
  try {
    return (await incomingHeaders()).get('x-forwarded-for');
  } catch {
    // Appel hors d'une requête (build, plan du site, images générées) : pas de visiteur à transmettre.
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Lecture d'une ressource de l'API. Avec `personal`, les cookies du visiteur et de la session sont transmis :
 * l'API renvoie alors sa progression, ses examens et son compte.
 */
export async function apiGet<T>(path: string, options: { personal?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const forwardedFor = await visitorAddress();
  if (forwardedFor) headers['x-forwarded-for'] = forwardedFor;
  Object.assign(headers, trustedProxyHeaders(forwardedFor));
  if (options.personal) {
    const jar = await cookies();
    const sent = PERSONAL_COOKIES.flatMap((name) => {
      const cookie = jar.get(name);
      return cookie ? [`${name}=${cookie.value}`] : [];
    });
    if (sent.length > 0) headers.cookie = sent.join('; ');
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { cache: 'no-store', headers });
  } catch {
    throw new ApiError(503, SERVICE_UNAVAILABLE);
  }
  if (!res.ok) throw new ApiError(res.status, await readErrorMessage(res));
  return (await res.json()) as T;
}

/** Parcours demandé dans l'adresse, sinon le premier parcours ouvert. */
export async function resolvePath(requested: string | undefined): Promise<PathSummary | null> {
  const paths = await apiGet<PathSummary[]>('/api/paths');
  return paths.find((path) => path.slug === requested && path.active) ?? paths.find((path) => path.active) ?? null;
}

/**
 * Parcours ouverts, et celui à afficher : celui demandé dans l'adresse, sinon la démarche choisie dans le compte,
 * sinon le premier parcours ouvert.
 */
export async function choosePath(requested: string | undefined): Promise<{ path: PathSummary | null; open: PathSummary[] }> {
  const [paths, me] = await Promise.all([apiGet<PathSummary[]>('/api/paths'), requested ? Promise.resolve(null) : getMe()]);
  const open = paths.filter((path) => path.active);
  const wanted = requested ?? me?.path?.slug;
  return { path: open.find((path) => path.slug === wanted) ?? open[0] ?? null, open };
}

/** Compte connecté, ou null pour un visiteur anonyme. */
export async function getMe(): Promise<Me | null> {
  try {
    return (await apiGet<{ user: Me | null }>('/api/auth/me', { personal: true })).user;
  } catch {
    return null;
  }
}
