import { SERVICE_UNAVAILABLE } from './errors';

// Appels à l'API depuis le navigateur (composants client), avec des erreurs lisibles par champ.

export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
    /** Messages d'erreur par champ du formulaire (validation de l'API). */
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type ErrorBody = { error?: { code?: unknown; message?: unknown; details?: { path: string; message: string }[] } };

export async function send<T = unknown>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new RequestError(0, null, SERVICE_UNAVAILABLE);
  }
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (data as ErrorBody | null)?.error;
    const fields = Object.fromEntries((error?.details ?? []).map((detail) => [detail.path, detail.message]));
    // Pour une erreur de saisie, le message du premier champ est plus utile que « La requête est invalide ».
    const message = Object.values(fields)[0] ?? (typeof error?.message === 'string' ? error.message : SERVICE_UNAVAILABLE);
    throw new RequestError(res.status, typeof error?.code === 'string' ? error.code : null, message, fields);
  }
  return data as T;
}

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : SERVICE_UNAVAILABLE);
