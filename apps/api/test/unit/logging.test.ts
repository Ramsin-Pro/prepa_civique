import { describe, expect, it } from 'vitest';
import { serializeRequest } from '../../src/app.js';

// Journaux des requêtes (pino-http) : ni recherche par email, ni code d'invitation d'une structure.

type SerializedRequest = Parameters<typeof serializeRequest>[0];

const logged = (url: string, query: Record<string, string> = {}) =>
  serializeRequest({
    id: '1',
    method: 'GET',
    url,
    query,
    params: {},
    headers: { 'user-agent': 'test' },
    remoteAddress: '127.0.0.1',
    remotePort: 1234,
  } as unknown as SerializedRequest);

describe('requêtes dans les journaux', () => {
  it('retirent les paramètres de l’adresse, et ceux déjà lus par Express', () => {
    const request = logged('/api/admin/users?q=marie.dupont%40example.fr&page=2', { q: 'marie.dupont@example.fr', page: '2' });
    expect(request.url).toBe('/api/admin/users');
    expect(request).not.toHaveProperty('query');
    expect(JSON.stringify(request)).not.toContain('marie');
  });

  it('masquent le code d’invitation d’une structure', () => {
    expect(logged('/api/organizations/join/K7P2QX').url).toBe('/api/organizations/join/***');
    expect(logged('/API/Organizations/Join/K7P2QX?source=affiche').url).toBe('/API/Organizations/Join/***');
  });

  it('gardent les autres adresses et les en-têtes (masqués ensuite par redact)', () => {
    expect(logged('/api/organizations/join').url).toBe('/api/organizations/join');
    expect(logged('/api/organizations/mine').url).toBe('/api/organizations/mine');
    expect(logged('/api/health')).toMatchObject({ method: 'GET', url: '/api/health', headers: { 'user-agent': 'test' } });
  });
});
