import type { RequestHandler } from 'express';
import { config } from '../config.js';
import { HttpError } from './errors.js';

// Protection contre les requêtes envoyées depuis un autre site (CSRF) : en plus des cookies SameSite=Lax,
// toute requête qui modifie quelque chose doit venir du site lui-même. Le navigateur l'indique par l'en-tête Origin,
// sinon par Sec-Fetch-Site. Une requête sans aucun des deux vient d'un client qui n'est pas un navigateur
// (appel de serveur à serveur, notification du prestataire de paiement) : elle passe.
const allowedOrigin = new URL(config.publicUrl).origin;
const isLocalDevOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
// « same-origin » : le site lui-même ; « none » : action directe de la personne (adresse tapée, favori).
// « same-site » (un sous-domaine voisin) et « cross-site » sont refusés.
const ALLOWED_FETCH_SITES = ['same-origin', 'none'];

export const sameOrigin: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');
  const allowed = origin
    ? origin === allowedOrigin || (!config.production && isLocalDevOrigin(origin))
    : fetchSite === undefined || ALLOWED_FETCH_SITES.includes(fetchSite);
  if (!allowed) throw new HttpError(403, 'forbidden_origin', 'Requête refusée.');
  next();
};
