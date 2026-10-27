/**
 * The old sale and stud browse routes are removed (Equoria-ppuos).
 *
 * Old contract: GET /api/v1/marketplace listed horses for sale and
 * GET /api/v1/marketplace/studs listed stallions at stud, each with its own
 * filters, sorts and keyset paging. Ruling (owner, 2026-10-27 q104): the
 * all-horses search GET /api/v1/marketplace/search replaced both, and the
 * frontend no longer calls them. Each now answers the app's JSON
 * "Route not found" 404 for a signed-in player, and the search still answers.
 * On the old code both removed routes answered 200 with a listing.
 *
 * Real app, real auth. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';

describe('the old marketplace browse routes are removed (Equoria-ppuos)', () => {
  let user;
  let token;

  beforeAll(async () => {
    const created = await createTestUser({ role: 'user' });
    user = created.user;
    token = created.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  const get = path => request(app).get(path).set('Authorization', `Bearer ${token}`);

  it.each([
    ['GET /marketplace', '/api/v1/marketplace'],
    ['GET /marketplace with filters', '/api/v1/marketplace?name=a&sort=price_asc&limit=5'],
    ['GET /marketplace/studs', '/api/v1/marketplace/studs'],
    ['GET /marketplace/studs with filters', '/api/v1/marketplace/studs?mode=public&sort=fee_asc'],
  ])('%s answers the JSON route-not-found 404', async (_label, path) => {
    const res = await get(path);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: 'Route not found' });
  });

  it('the all-horses search that replaced them still answers', async () => {
    const res = await get('/api/v1/marketplace/search?forSale=true&atStud=true&limit=1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
