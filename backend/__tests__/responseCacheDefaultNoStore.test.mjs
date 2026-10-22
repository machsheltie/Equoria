/**
 * HTTP response caching is opt-in; the default is no-store (Equoria-cmw85.28).
 *
 * Defect: the global responseOptimization middleware stamped
 * `Cache-Control: public, max-age=300, stale-while-revalidate=60` on every
 * successful GET that had not set its own header — balances, horse lists,
 * rosters included — with no Vary. Only the frontend's `cache: 'no-store'`
 * stood between that and serving one player's state to another through any
 * cache. Now a response is cacheable only when its handler opts in through
 * `res.locals.cacheable`; opted-in responses carry Vary: Authorization, Cookie.
 * The opt-in list is genuinely public reference data: breeds and trait
 * definitions.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import app from '../app.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { responseOptimization } from '../middleware/responseOptimization.mjs';
import { generateTestToken } from '../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';
const PUBLIC_REFERENCE_POLICY = 'public, max-age=300, stale-while-revalidate=60';

function expectVaryOnIdentity(res) {
  const vary = String(res.headers.vary ?? '').toLowerCase();
  expect(vary).toContain('authorization');
  expect(vary).toContain('cookie');
}

describe('response cache default (Equoria-cmw85.28)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;

  beforeAll(async () => {
    const tag = randomBytes(5).toString('hex');
    user = await prisma.user.create({
      data: {
        email: `cmw85-${tag}@test.local`,
        username: `cmw85${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Cache',
        lastName: 'Default',
        money: 0,
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  });

  afterAll(() => cleanup.run(), 60000);

  const authedGet = path => request(app).get(path).set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

  it.each([['/api/v1/horses'], [() => `/api/v1/grooms/user/${user.id}`]])(
    'an authenticated player-state GET (%s) is no-store',
    async pathOrFn => {
      const res = await authedGet(typeof pathOrFn === 'function' ? pathOrFn() : pathOrFn);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
    },
  );

  it.each([['/api/v1/breeds'], ['/api/v1/traits/definitions']])(
    'opted-in public reference data (%s) keeps its cache policy and varies on identity',
    async path => {
      const res = await authedGet(path);
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe(PUBLIC_REFERENCE_POLICY);
      expectVaryOnIdentity(res);
    },
  );
});

describe('responseOptimization opt-in contract (Equoria-cmw85.28)', () => {
  function probeApp() {
    const probe = express();
    probe.use(responseOptimization());
    // A route nobody put on the allow-list: the sentinel for "new route".
    probe.get('/unlisted', (_req, res) => res.json({ success: true, data: { secret: 'player-state' } }));
    probe.get('/opted-in', (_req, res) => {
      res.locals.cacheable = { maxAge: 300 };
      res.json({ success: true, data: { name: 'Thoroughbred' } });
    });
    probe.get('/handler-set', (_req, res) => {
      res.setHeader('Cache-Control', 'private, max-age=5');
      res.json({ success: true });
    });
    return probe;
  }

  it('a new, unlisted GET route defaults to no-store', async () => {
    const res = await request(probeApp()).get('/unlisted');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('an opted-in route gets the public policy, Vary and a working 304', async () => {
    const probe = probeApp();
    const first = await request(probe).get('/opted-in');
    expect(first.headers['cache-control']).toBe(PUBLIC_REFERENCE_POLICY);
    expectVaryOnIdentity(first);
    expect(first.headers.etag).toBeDefined();

    const second = await request(probe).get('/opted-in').set('If-None-Match', first.headers.etag);
    expect(second.status).toBe(304);
  });

  it('a handler-set Cache-Control is honoured verbatim', async () => {
    const res = await request(probeApp()).get('/handler-set');
    expect(res.headers['cache-control']).toBe('private, max-age=5');
  });
});
