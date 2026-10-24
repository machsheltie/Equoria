/**
 * Validation refusals never list the stored values a request may use
 * (Equoria-bdpvw; owner ruling 2026-10-23: players never see code names, and a
 * list of them hands out exploit hints).
 *
 * Old contract: a bad leaderboard metric answered "Metric must be one of: wins,
 * earnings, placements, average_placement", and a bad marketplace sort answered
 * "sort must be one of: <every sort key>".
 *
 * Real routes, real app.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';

describe('refusals do not enumerate stored values (Equoria-bdpvw)', () => {
  let user;
  let token;

  beforeAll(async () => {
    const a = await createTestUser({ role: 'user' });
    user = a.user;
    token = a.token;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
  });

  it('a bad leaderboard metric is refused without naming average_placement', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboards/competition?metric=bogus')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain(['average', 'placement'].join('_'));
  });

  it('a bad marketplace sort is refused without listing the sort keys', async () => {
    const res = await request(app).get('/api/v1/marketplace?sort=bogus').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/must be one of/);
    expect(JSON.stringify(res.body)).not.toMatch(/newest/);
  });
});
