/**
 * Swagger "Try it out" targets the mounted /api/v1 surface (Equoria-713fu, ARCH-02).
 *
 * Before: loadSwaggerSpec replaced the spec's servers with `${API_BASE_URL}/api`,
 * a base path Equoria-4bs3s stopped mounting, so every "Try it out" call (for
 * example /api/auth/csrf-token) answered the 404 "Route not found". The raw
 * swagger.yaml still listed that legacy /api server beside the /api/v1 ones, so
 * the served JSON and the raw YAML disagreed.
 *
 * Real app through supertest: the served spec's server base path joined to a
 * documented path must reach a mounted route.
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import YAML from 'yamljs';
import app from '../app.mjs';

const ORIGIN = 'http://localhost:3000';

describe('Swagger server base path (Equoria-713fu)', () => {
  it('serves /api/v1 as the server for the JSON spec', async () => {
    const res = await request(app).get('/api-docs/swagger.json').set('Origin', ORIGIN).expect(200);

    expect(res.body.servers.length).toBeGreaterThan(0);
    for (const server of res.body.servers) {
      expect(new URL(server.url).pathname).toBe('/api/v1');
    }
  });

  it('a documented path under the served server reaches a mounted route', async () => {
    const spec = (await request(app).get('/api-docs/swagger.json').set('Origin', ORIGIN).expect(200)).body;
    expect(spec.paths).toHaveProperty('/auth/csrf-token');

    const basePath = new URL(spec.servers[0].url).pathname;
    const res = await request(app).get(`${basePath}/auth/csrf-token`).set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.message).not.toBe('Route not found');
  });

  it('Try it out on the documented /health reaches the mounted root /health (Equoria-ygn9w)', async () => {
    const spec = (await request(app).get('/api-docs/swagger.json').set('Origin', ORIGIN).expect(200)).body;
    const pathItem = spec.paths['/health'];
    expect(pathItem).toBeDefined();

    // A path-level servers list overrides the document's; Swagger UI resolves a
    // relative server URL against the address the spec was served from.
    const servers = pathItem.servers ?? spec.servers;
    const basePath = new URL(servers[0].url, ORIGIN).pathname.replace(/\/$/, '');
    const res = await request(app).get(`${basePath}/health`).set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.message).not.toBe('Route not found');
  });

  it('the raw YAML lists no legacy /api server', async () => {
    const res = await request(app).get('/api-docs/swagger.yaml').set('Origin', ORIGIN).expect(200);
    const raw = YAML.parse(res.text);

    expect(raw.servers.length).toBeGreaterThan(0);
    for (const server of raw.servers) {
      expect(new URL(server.url).pathname).toBe('/api/v1');
    }
  });
});
