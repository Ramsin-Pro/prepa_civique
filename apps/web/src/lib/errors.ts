export const SERVICE_UNAVAILABLE = 'Le service ne répond pas pour le moment. Réessayez dans un instant.';

/** Message lisible renvoyé par l'API ({ error: { message } }), ou un message générique. */
export async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    const message = (body as { error?: { message?: unknown } })?.error?.message;
    if (typeof message === 'string') return message;
  } catch {
    // corps absent ou illisible
  }
  return SERVICE_UNAVAILABLE;
}
