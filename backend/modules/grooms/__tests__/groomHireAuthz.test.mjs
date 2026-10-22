/**
 * POST /grooms/hire authenticates in its own middleware chain (Equoria-qyyj7).
 *
 * Every other mutation in groomRoutes.mjs (assign, ensure-default, interact,
 * bonus-traits) declares `authenticateToken` in its route chain. The hire route
 * did not: it relied on the authRouter mount and, below that, on the
 * controller's `req.user?.id` null-check. If the router were ever mounted
 * elsewhere, the only thing between an anonymous caller and the hire handler
 * would be that null-check.
 *
 * The decisive case mounts the real groom router on a bare Express app (no
 * authRouter in front), so the only auth that can answer is the route's own:
 * the middleware's 'Access token is required' 401, never the controller's
 * 'Authentication required'. The second case confirms the real app's mount
 * still rejects an anonymous hire at the middleware layer.
 */

import { describe, it, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import app from '../../../app.mjs';
import groomRoutes from '../routes/groomRoutes.mjs';

const ORIGIN = 'http://localhost:3000';
// A body that passes the route's validators, so a missing auth layer would
// reach the controller instead of stopping at validation.
const validHireBody = {
  name: 'TestFixture-qyyj7-groom',
  speciality: 'general',
  skill_level: 'novice',
  personality: 'gentle',
};

describe('POST /grooms/hire route-level authentication (Equoria-qyyj7)', () => {
  it('rejects an anonymous hire at the route middleware even without the authRouter mount', async () => {
    const bare = express();
    bare.use(express.json());
    bare.use('/grooms', groomRoutes);

    const res = await request(bare).post('/grooms/hire').send(validHireBody);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Access token is required');
  });

  it('rejects an anonymous hire on the real app at the middleware layer', async () => {
    const res = await request(app).post('/api/v1/grooms/hire').set('Origin', ORIGIN).send(validHireBody);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Access token is required');
  });
});
