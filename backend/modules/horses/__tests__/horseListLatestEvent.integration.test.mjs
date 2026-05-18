/**
 * GET /api/v1/horses — latestEvent exposure on list endpoint (Equoria-55bo.5)
 *
 * NarrativeChip's deriveLatestChapter (Spec 11.3.12) wants to surface the
 * richest narrative — a recent competition result ("Won 2nd place in
 * yesterday's show") — without an N+1 per-card fetch. This test asserts the
 * list endpoint attaches a lightweight `latestEvent` summary built from the
 * horse's most-recent CompetitionResult, batched (one query for the page).
 *
 * Asserts:
 *  - a horse with a competition result returns latestEvent with
 *    type='competition', showName, discipline, placement, date.
 *  - the most RECENT result wins when a horse has multiple.
 *  - a horse with no competition history returns latestEvent: null.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

const FIXTURE_PREFIX = 'TestFixture-list-latestEvent';

let owner;
let token;
let horseWithResults;
let horseNoResults;
let createdShowIds = [];

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');

  const a = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
  });
  owner = a.user;
  token = a.token;

  horseWithResults = await createTestHorse({
    name: `${FIXTURE_PREFIX}-WithResults-${tag}`,
    userId: owner.id,
  });
  horseNoResults = await createTestHorse({
    name: `${FIXTURE_PREFIX}-NoResults-${tag}`,
    userId: owner.id,
  });

  // Older result
  const olderShow = await prisma.show.create({
    data: {
      name: `${FIXTURE_PREFIX}-OldShow-${tag}`,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 10,
      entryFee: 0,
      prize: 100,
      runDate: new Date('2026-05-01T00:00:00.000Z'),
    },
  });
  // Newer result (this one must win)
  const newerShow = await prisma.show.create({
    data: {
      name: `${FIXTURE_PREFIX}-NewShow-${tag}`,
      discipline: 'Show Jumping',
      levelMin: 1,
      levelMax: 10,
      entryFee: 0,
      prize: 200,
      runDate: new Date('2026-05-15T00:00:00.000Z'),
    },
  });
  createdShowIds = [olderShow.id, newerShow.id];

  await prisma.competitionResult.create({
    data: {
      score: 80.5,
      placement: '3rd',
      discipline: 'Dressage',
      runDate: new Date('2026-05-01T00:00:00.000Z'),
      showName: olderShow.name,
      horseId: horseWithResults.id,
      showId: olderShow.id,
    },
  });
  await prisma.competitionResult.create({
    data: {
      score: 92.0,
      placement: '1st',
      discipline: 'Show Jumping',
      runDate: new Date('2026-05-15T00:00:00.000Z'),
      showName: newerShow.name,
      horseId: horseWithResults.id,
      showId: newerShow.id,
    },
  });
}, 120000);

afterAll(async () => {
  // Scoped cleanup of the shows this suite created (CompetitionResult rows
  // cascade via the showId/horseId relations; horses + user cleaned by
  // cleanupTestData()).
  if (createdShowIds.length > 0) {
    await prisma.competitionResult.deleteMany({
      where: { showId: { in: createdShowIds } },
    });
    await prisma.show.deleteMany({ where: { id: { in: createdShowIds } } });
  }
  await cleanupTestData();
});

describe('GET /api/v1/horses — latestEvent exposure (55bo.5)', () => {
  it('returns the most-recent competition result as latestEvent', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const h = res.body.data.find(x => x.id === horseWithResults.id);
    expect(h).toBeTruthy();
    expect(h.latestEvent).toBeTruthy();
    expect(h.latestEvent.type).toBe('competition');
    // The NEWER (2026-05-15 Show Jumping 1st) result must win, not the older one.
    expect(h.latestEvent.discipline).toBe('Show Jumping');
    expect(h.latestEvent.placement).toBe('1st');
    expect(typeof h.latestEvent.showName).toBe('string');
    expect(h.latestEvent.showName).toContain('NewShow');
    expect(new Date(h.latestEvent.date).toISOString()).toBe('2026-05-15T00:00:00.000Z');
  });

  it('returns latestEvent: null for a horse with no competition history', async () => {
    const res = await request(app)
      .get(`/api/v1/horses?userId=${owner.id}&limit=200`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    const h = res.body.data.find(x => x.id === horseNoResults.id);
    expect(h).toBeTruthy();
    // Explicit null so the frontend can fall back to care-event narratives.
    expect(h.latestEvent).toBeNull();
  });
});
