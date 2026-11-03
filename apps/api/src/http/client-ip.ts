import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../config.js';

// Le site (Vercel) relaie les appels du navigateur et fait ses propres appels pendant le rendu : sans précaution,
// l'API verrait l'adresse de Vercel pour tout le monde, et les limites d'essais seraient partagées par tous les
// visiteurs. Le site joint donc un secret et l'adresse du visiteur. Sans le bon secret (appel direct à l'API),
// l'adresse vient du proxy de l'hébergeur (TRUST_PROXY), qu'on ne peut pas falsifier.
export const PROXY_SECRET_HEADER = 'x-repere-proxy';
export const CLIENT_IP_HEADER = 'x-repere-client-ip';

const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

function sameSecret(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const clientIpFromTrustedProxy: RequestHandler = (req, _res, next) => {
  const secret = config.proxySecret;
  const received = req.get(PROXY_SECRET_HEADER);
  const ip = req.get(CLIENT_IP_HEADER)?.trim();
  if (secret && received && ip && IP_PATTERN.test(ip) && sameSecret(received, secret)) {
    // req.ip est un accesseur d'Express : une propriété propre à la requête le remplace pour les limiteurs.
    Object.defineProperty(req, 'ip', { value: ip, configurable: true });
  }
  next();
};
