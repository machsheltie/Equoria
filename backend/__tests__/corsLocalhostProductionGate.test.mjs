/**
 * Credentialed localhost CORS origins only outside production
 * (Equoria-xb9oc; owner decision 2026-07-07).
 *
 * Defect: the static localhost / 127.0.0.1 allow-list was reflected with
 * `credentials: true` in every environment, production included, so a page on
 * the victim's own loopback could make credentialed calls to the live API.
 * Decision: in production the allow-list comes from ALLOWED_ORIGINS alone;
 * local development, test and the beta-readiness profile keep the built-in
 * localhost origins.
 *
 * Each case runs the real `cors` middleware with the real policy delegate.
 * Host is set to the API's own host so the same-origin shortcut never applies.
 */

import { describe, it, expect } from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import { createCorsOptionsDelegate } from '../config/corsPolicy.mjs';

const apiHost = 'api.equoria.example';

function appFor({ nodeEnv, allowedOrigins = [] }) {
  const app = express();
  app.use(cors(createCorsOptionsDelegate({ nodeEnv, allowedOrigins })));
  app.get('/probe', (_req, res) => res.json({ ok: true }));
  // cors() hands a rejected origin to next(err); answer it plainly.
  app.use((err, _req, res, _next) => res.status(403).json({ message: err.message }));
  return app;
}

const probe = (app, origin) => request(app).get('/probe').set('Host', apiHost).set('Origin', origin);

describe('CORS localhost origins by environment (Equoria-xb9oc)', () => {
  it.each([['production']])('%s: a localhost origin is not reflected with credentials', async nodeEnv => {
    for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3001']) {
      const res = await probe(appFor({ nodeEnv }), origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      expect(res.status).toBe(403);
    }
  });

  it.each([['development'], ['test'], ['beta-readiness']])(
    '%s: a localhost origin is reflected with credentials',
    async nodeEnv => {
      const res = await probe(appFor({ nodeEnv }), 'http://localhost:3000');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    },
  );

  it('production: an origin listed in ALLOWED_ORIGINS is still reflected with credentials', async () => {
    const app = appFor({ nodeEnv: 'production', allowedOrigins: ['https://play.equoria.example'] });
    const res = await probe(app, 'https://play.equoria.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://play.equoria.example');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('production: an explicitly configured localhost origin is honoured (operator opt-in)', async () => {
    const app = appFor({ nodeEnv: 'production', allowedOrigins: ['http://localhost:3000'] });
    const res = await probe(app, 'http://localhost:3000');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
