/**
 * A request from a disallowed CORS origin is refused with 403, not answered
 * as a server fault (Equoria-vsgi5).
 *
 * Defect: createCorsOptionsDelegate ended with callback(new Error('Not allowed
 * by CORS')) and nothing mapped it, so the real app answered HTTP 500 — which
 * reads as an outage in logs and alerts. A refused origin is a client error.
 *
 * Runs the real app (real cors middleware, real policy delegate, real
 * errorHandler). Host is the supertest ephemeral host, so the same-origin
 * shortcut does not apply to the foreign Origin used here.
 */

import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../app.mjs';

describe('disallowed CORS origin (Equoria-vsgi5)', () => {
  it('answers 403 ORIGIN_NOT_ALLOWED with no CORS grant', async () => {
    const res = await request(app).get('/ping').set('Origin', 'https://not-allowed.example');

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      message: 'This origin is not allowed to use the Equoria API.',
      code: 'ORIGIN_NOT_ALLOWED',
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('refuses a preflight from a disallowed origin the same way', async () => {
    const res = await request(app)
      .options('/ping')
      .set('Origin', 'https://not-allowed.example')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('still serves a request with no Origin header', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).not.toBe(403);
    expect(res.status).toBeLessThan(500);
  });
});
