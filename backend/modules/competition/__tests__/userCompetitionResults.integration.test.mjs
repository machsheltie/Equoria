/**
 * userCompetitionResults.integration.test.mjs
 *
 * Real-DB integration coverage for the user-scoped competition results
 * endpoint that CompetitionResultsPage.tsx renders through
 * useUserCompetitionResults.
 *
 * Context (Equoria-oey96.5):
 *   Prior to this fix, the frontend My Results list never fetched.
 *   The CompetitionResultsList prop userId was explicitly discarded
 *   (userId: _userId) and the page hardcoded isLoading=false + error=null.
 *   The list rendered a permanent empty state for every player. There
 *   was also no server-side endpoint that returned all-of-my-results
 *   across all of my horses - only per-horse and per-show endpoints
 *   existed.
 *
 * Asserts (fail-first, pass after fix):
 *   1. GET /api/v1/competition/user-results returns the users results
 *      ordered by runDate DESC (newest first).
 *   2. Ownership scoping (IDOR guard): user2 gets none of user1s results.
 *   3. Endpoint resolves owner from req.user.id, NOT ?userId= param.
 *   4. Unauthenticated request returns 401.
 *
 * Doctrine: Real Express app, real JWT, real DB. No mocks, no bypasses.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, createTestShow, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';

const SUITE = 'TestFixture-userResults';

let user1;
let user1Token;
let user2;
let user2Token;
let horse1a;
let horse1b;
let horse2a;
let show1;
let show2;
let show3;

async function seedResult({ horseId, showId, score, placement, discipline, runDate, showName, prizeWon }) {
  return prisma.competitionResult.create({
    data: { horseId, showId, score, placement, discipline, runDate, showName, prizeWon },
  });
}

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const created1 = await createTestUser({
    username: `${SUITE}-user1-${tag}`,
    email: `${SUITE}-user1-${tag}@example.com`,
  });
  user1 = created1.user;
  user1Token = created1.token;

  const created2 = await createTestUser({
    username: `${SUITE}-user2-${tag}`,
    email: `${SUITE}-user2-${tag}@example.com`,
  });
  user2 = created2.user;
  user2Token = created2.token;

  horse1a = await createTestHorse({ name: `${SUITE}-H1a-${tag}`, userId: user1.id });
  horse1b = await createTestHorse({ name: `${SUITE}-H1b-${tag}`, userId: user1.id });
  horse2a = await createTestHorse({ name: `${SUITE}-H2a-${tag}`, userId: user2.id });

  show1 = await createTestShow({ name: `${SUITE}-Show1-${tag}`, discipline: 'Dressage', prize: 1000 });
  show2 = await createTestShow({ name: `${SUITE}-Show2-${tag}`, discipline: 'Show Jumping', prize: 500 });
  show3 = await createTestShow({ name: `${SUITE}-Show3-${tag}`, discipline: 'Cross Country', prize: 2000 });

  await seedResult({
    horseId: horse1a.id,
    showId: show1.id,
    score: 85.5,
    placement: '1st',
    discipline: 'Dressage',
    runDate: new Date('2026-06-01T10:00:00Z'),
    showName: show1.name,
    prizeWon: 500,
  });
  await seedResult({
    horseId: horse1b.id,
    showId: show2.id,
    score: 72.0,
    placement: '3rd',
    discipline: 'Show Jumping',
    runDate: new Date('2026-06-15T10:00:00Z'),
    showName: show2.name,
    prizeWon: 100,
  });

  await seedResult({
    horseId: horse2a.id,
    showId: show3.id,
    score: 90.0,
    placement: '1st',
    discipline: 'Cross Country',
    runDate: new Date('2026-06-20T10:00:00Z'),
    showName: show3.name,
    prizeWon: 1000,
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('GET /api/v1/competition/user-results (Equoria-oey96.5)', () => {
  it('returns the authenticated users competition results, newest first', async () => {
    const res = await request(app)
      .get('/api/v1/competition/user-results')
      .set('Authorization', `Bearer ${user1Token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.results)).toBe(true);

    const myResults = res.body.results.filter(
      r => typeof r.competitionName === 'string' && r.competitionName.startsWith(SUITE),
    );
    expect(myResults).toHaveLength(2);

    // Newest first: show2 (2026-06-15) before show1 (2026-06-01).
    expect(myResults[0].competitionId).toBe(show2.id);
    expect(myResults[1].competitionId).toBe(show1.id);

    const first = myResults[0];
    expect(first).toMatchObject({
      competitionId: show2.id,
      competitionName: show2.name,
      discipline: 'Show Jumping',
    });
    expect(typeof first.date).toBe('string');
    expect(Array.isArray(first.userResults)).toBe(true);
    expect(first.userResults.length).toBeGreaterThanOrEqual(1);
    expect(first.userResults[0]).toMatchObject({
      horseId: horse1b.id,
      score: 72,
      prizeWon: 100,
    });
    expect(typeof first.userResults[0].rank).toBe('number');
    expect(first.userResults[0].rank).toBe(3);
  });

  it('does not leak another users results (ownership scoping - IDOR guard)', async () => {
    const res = await request(app)
      .get('/api/v1/competition/user-results')
      .set('Authorization', `Bearer ${user2Token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    const myResults = res.body.results.filter(
      r => typeof r.competitionName === 'string' && r.competitionName.startsWith(SUITE),
    );
    expect(myResults).toHaveLength(1);
    expect(myResults[0].competitionId).toBe(show3.id);

    const showIds = myResults.map(r => r.competitionId);
    expect(showIds).not.toContain(show1.id);
    expect(showIds).not.toContain(show2.id);
  });

  it('ignores a spoofed userId query parameter - owner is req.user.id', async () => {
    const res = await request(app)
      .get(`/api/v1/competition/user-results?userId=${encodeURIComponent(user1.id)}`)
      .set('Authorization', `Bearer ${user2Token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    const myResults = res.body.results.filter(
      r => typeof r.competitionName === 'string' && r.competitionName.startsWith(SUITE),
    );
    const showIds = myResults.map(r => r.competitionId);
    expect(showIds).not.toContain(show1.id);
    expect(showIds).not.toContain(show2.id);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/competition/user-results').set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(401);
  });
});
