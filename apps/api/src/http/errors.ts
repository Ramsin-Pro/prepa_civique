/** Erreur métier renvoyée telle quelle au client : le message est affichable à l'utilisateur. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (message = 'Ressource introuvable.') => new HttpError(404, 'not_found', message);
