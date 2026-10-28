/**
 * PII Exposure Sentinel — Leaderboard endpoints (Equoria-2gfor, CWE-200/CWE-359)
 *
 * Asserts that no leaderboard or user-rank-summary endpoint exposes a fixture
 * user's real firstName or lastName values in any response field.  Instead,
 * every user-facing name / ownerName / userName field must carry the user's
 * public `username` handle.
 *
 * Endpoints under test:
 *   GET /api/v1/leaderboards/boards/playerXp      (player board — ownerName)
 *   GET /api/v1/leaderboards/boards/horseEarnings (horse board — ownerName)
 *   GET /api/v1/leaderboards/user-summary/:userId (getUserRankSummary — userName)
 *
 * Equoria-a7f1p (owner ruling 2026-10-28, q151): the first two cases read
 * GET /leaderboards/players/xp and /horses/earnings, duplicate lists removed in
 * favour of the page boards the Leaderboards page reads. Old contract: those two
 * URLs; new: the same guarantee on the boards that replaced them. The player
 * board ranks User.xp, so the fixture's xp is set high enough to make page one.
 *
 * Test structure (EDGE_CASE_FIX_DISCIPLINE §1):
 *   1. Run BEFORE the fix → confirm FAIL (real names in responses).
 *   2. Apply fix.
 *   3. Run AFTER the fix → confirm PASS (username in responses, no real names).
 *
 * Rules:
 *   - Real DB — no mocks of controllers / services / DB (CLAUDE.md)
 *   - No bypass headers (no x-test-*, no CSRF bypass) (CLAUDE.md)
 *   - Scoped cleanup: all TestFixture- records deleted by id (CLAUDE.md §2)
 *   - fixtureColor() spread to avoid NULL-phenotype sentinel (Equoria-odjt)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';
// Equoria-1ohys: fail-loud, scoped cleanup. The horse/user deletes used silent
// no-op catch arms that hid a failed delete, leaking the fixture user/horse
// into the canonical DB (CLAUDE.md §2). The tracker fails afterAll loudly.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

const cleanup = createCleanupTracker();

// ─── Fixture data with deliberately distinct first/last/username values ──────
// Using values that are clearly distinguishable so we can assert each one
// independently in the response bodies.
const RNG = randomBytes(6).toString('hex');
const FIXTURE_FIRST = `PIIFirstSentinel${RNG}`;
const FIXTURE_LAST = `PIILastSentinel${RNG}`;
const FIXTURE_USERNAME = `pii_username_${RNG}`;

let fixtureUser;
let token;
let fixtureHorse;
const createdHorseIds = [];

beforeAll(async () => {
  // Create fixture user with distinct first/last/username so the sentinel can
  // detect whether the response carries real names vs the username handle.
  fixtureUser = await prisma.user.create({
    data: {
      email: `pii-sentinel-${RNG}@testfixture.invalid`,
      username: FIXTURE_USERNAME,
      password: 'irrelevant-hash',
      firstName: FIXTURE_FIRST,
      lastName: FIXTURE_LAST,
      money: 0,
      level: 99, // high level so they appear at the top of the level leaderboard
      xp: 9999999, // top xp so they appear on the first page of the playerXp board
    },
  });

  token = generateTestToken({ id: fixtureUser.id, email: fixtureUser.email, role: 'user' });

  // Create a fixture horse owned by the fixture user with positive earnings
  // so it appears on the horseEarnings board.
  const breed = await prisma.breed.findFirst();
  fixtureHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-PIISentinel-${RNG}`,
      userId: fixtureUser.id,
      breedId: breed?.id ?? null,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      age: 4,
      totalEarnings: 9999999, // top earnings so it appears on the leaderboard
    },
  });
  createdHorseIds.push(fixtureHorse.id);

  // Add an XP event so the user appears on the XP leaderboard
  await prisma.xpEvent.create({
    data: {
      userId: fixtureUser.id,
      amount: 9999999,
      reason: `TestFixture-PIISentinel-${RNG}`,
    },
  });

  // Bust any stale in-process leaderboard cache so fixtures are visible
  await invalidateCachePattern('leaderboard:*');

  // Equoria-1ohys: scoped, FK-ordered, fail-loud cleanup — only our TestFixture
  // records (CLAUDE.md §2). Order: xpEvent (child of user) -> horse (id-IN, child
  // of user; Horse.userId is Restrict) -> user. The tracker runs all three even
  // if one throws, then fails afterAll loudly if any did.
  cleanup.add(
    () =>
      prisma.xpEvent.deleteMany({
        where: { userId: fixtureUser.id, reason: { startsWith: 'TestFixture-PIISentinel-' } },
      }),
    'xpEvent',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: fixtureUser.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Serialise a response body to a flat string for substring scanning.
 * We deliberately stringify the entire body so nested fields are covered.
 */
function bodyString(res) {
  return JSON.stringify(res.body);
}

/**
 * Assert that neither the real firstName nor the real lastName appears anywhere
 * in the serialised response body, and that the fixture username DOES appear.
 */
function assertPiiNotExposed(res) {
  const body = bodyString(res);
  // firstName must NOT appear anywhere in the response
  expect(body).not.toContain(FIXTURE_FIRST);
  // lastName must NOT appear anywhere in the response
  expect(body).not.toContain(FIXTURE_LAST);
  // username MUST appear somewhere in the response
  expect(body).toContain(FIXTURE_USERNAME);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PII exposure sentinel — leaderboard endpoints (Equoria-2gfor)', () => {
  // Bust cache before every test so fixture data is always fresh
  beforeAll(async () => {
    await invalidateCachePattern('leaderboard:*');
  });

  it('GET /api/v1/leaderboards/boards/playerXp — does NOT expose firstName/lastName, shows username as ownerName', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboards/boards/playerXp?limit=100')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const entries = res.body.data?.entries ?? [];
    const fixtureEntry = entries.find(e => e.ownerId === fixtureUser.id);
    expect(fixtureEntry).toBeDefined();

    assertPiiNotExposed(res);

    expect(fixtureEntry.ownerName).toBe(FIXTURE_USERNAME);
  });

  it('GET /api/v1/leaderboards/boards/horseEarnings — does NOT expose firstName/lastName in ownerName', async () => {
    const res = await request(app)
      .get('/api/v1/leaderboards/boards/horseEarnings?limit=100')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const entries = res.body.data?.entries ?? [];
    const fixtureEntry = entries.find(e => e.horseId === fixtureHorse.id);
    expect(fixtureEntry).toBeDefined();

    assertPiiNotExposed(res);

    expect(fixtureEntry.ownerName).toBe(FIXTURE_USERNAME);
  });

  it('GET /api/v1/leaderboards/user-summary/:userId — does NOT expose firstName/lastName in userName', async () => {
    const res = await request(app)
      .get(`/api/v1/leaderboards/user-summary/${fixtureUser.id}`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    assertPiiNotExposed(res);

    // The top-level `userName` field must be the username handle
    expect(res.body.userName).toBe(FIXTURE_USERNAME);
  });
});
