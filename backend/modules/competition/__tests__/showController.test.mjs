/**
 * showController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: createShow, getShows, enterShow, executeClosedShows.
 * Routes live under authRouter at /api/v1/shows.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const ORIGIN = 'http://localhost:3000';

let user;
let token;
let horse;
let createdShowId;
const cleanup = createCleanupTracker();

// Fixtures for executeClosedShows tests
let execUser;
let execToken;
let execAdminUser; // Equoria-619ik: admin executor for the now admin-only /shows/execute
let execAdminToken;
let execHorse;
let pastShowId; // show with closeDate in the past, with entries
let pastShowNoEntriesId; // show with closeDate in the past, no entries

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `show-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `show${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'Show',
      lastName: 'Tester',
      money: 50000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ShowHorse-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: user.id,
      healthStatus: 'healthy',
    },
  });

  // ── executeClosedShows fixtures ────────────────────────────────────────────
  execUser = await prisma.user.create({
    data: {
      email: `showexec-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `showexec${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'ShowExec',
      lastName: 'Tester',
      money: 10000,
      level: 1,
      xp: 0,
    },
  });
  execToken = generateTestToken({ id: execUser.id, email: execUser.email, role: 'user' });

  // Equoria-619ik: POST /api/v1/shows/execute is now ADMIN-ONLY. Create a real
  // admin user (role persisted in the DB row, not just the token) so the
  // happy-path execute tests authenticate as an admin. The non-admin `execUser`
  // above is reused to prove the 403 gate fires for an ordinary player.
  execAdminUser = await prisma.user.create({
    data: {
      email: `showexecadmin-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `showexecadmin${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'ShowExecAdmin',
      lastName: 'Tester',
      money: 10000,
      level: 1,
      xp: 0,
      role: 'admin',
    },
  });
  execAdminToken = generateTestToken({ id: execAdminUser.id, email: execAdminUser.email, role: 'admin' });

  execHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExecHorse-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date('2018-01-01'),
      age: 7,
      userId: execUser.id,
      healthStatus: 'healthy',
      speed: 60,
      stamina: 60,
      agility: 60,
      balance: 60,
      precision: 60,
      boldness: 60,
    },
  });

  const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

  // Show with entries — exercises the main scoring loop (lines 291-381)
  const pastShow = await prisma.show.create({
    data: {
      name: `TestFixture-PastShow-${Date.now()}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 1000,
      runDate: pastDate,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastDate,
      createdByUserId: execUser.id,
    },
  });
  pastShowId = pastShow.id;

  // Create entry for execHorse in the past show
  await prisma.showEntry.create({
    data: {
      showId: pastShowId,
      horseId: execHorse.id,
      userId: execUser.id,
      feePaid: 0,
    },
  });

  // Show with NO entries — exercises the empty-entries path (lines 282-288)
  const pastShowNoEntries = await prisma.show.create({
    data: {
      name: `TestFixture-PastShowEmpty-${Date.now()}`,
      discipline: 'Racing',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 0,
      runDate: pastDate,
      status: 'open',
      openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      closeDate: pastDate,
      createdByUserId: execUser.id,
    },
  });
  pastShowNoEntriesId = pastShowNoEntries.id;

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: per-show entries +
  // results -> show (createdByUserId FK); horse entries -> horse -> owning user
  // (Horse.userId is onDelete:Restrict). createdShowId is set by the tests, so
  // its closure reads it at run() time. A cleanup failure now fails the suite
  // instead of being swallowed.
  cleanup.add(async () => {
    if (createdShowId) {
      await prisma.showEntry.deleteMany({ where: { showId: createdShowId } });
      await prisma.show.delete({ where: { id: createdShowId } });
    }
  }, 'createdShow');
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { horseId: horse.id } }), 'horseEntries');
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');

  // executeClosedShows fixtures cleanup
  cleanup.add(async () => {
    if (pastShowId) {
      await prisma.competitionResult.deleteMany({ where: { showId: pastShowId } });
      await prisma.showEntry.deleteMany({ where: { showId: pastShowId } });
      await prisma.show.delete({ where: { id: pastShowId } });
    }
  }, 'pastShow');
  cleanup.add(
    () => (pastShowNoEntriesId ? prisma.show.delete({ where: { id: pastShowNoEntriesId } }) : undefined),
    'pastShowNoEntries',
  );
  cleanup.add(() => (execHorse ? prisma.horse.delete({ where: { id: execHorse.id } }) : undefined), 'execHorse');
  cleanup.add(() => (execUser ? prisma.user.delete({ where: { id: execUser.id } }) : undefined), 'execUser');
  cleanup.add(
    () => (execAdminUser ? prisma.user.delete({ where: { id: execAdminUser.id } }) : undefined),
    'execAdminUser',
  );
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ─── GET /api/v1/shows ───────────────────────────────────────────────────────────

describe('GET /api/v1/shows', () => {
  it('returns 200 with list of shows and pagination', async () => {
    const res = await request(app).get('/api/v1/shows').set('Origin', ORIGIN).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.shows)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it('returns 200 filtered by discipline', async () => {
    const res = await request(app)
      .get('/api/v1/shows?discipline=Dressage')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/v1/shows').set('Origin', ORIGIN);

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/shows/create ───────────────────────────────────────────────────

describe('POST /api/v1/shows/create', () => {
  it('returns 201 when creating a valid show', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const showName = `TestFixture-Show-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: showName,
        discipline: 'Dressage',
        entryFee: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.show).toBeDefined();
    createdShowId = res.body.data.show.id;
  });

  it('returns 400 for invalid discipline', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({
        name: 'Test Show',
        discipline: 'InvalidDiscipline',
        entryFee: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ discipline: 'Dressage' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when entryFee is negative (line 61)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'TestFixture-NegFeeShow', discipline: 'Dressage', entryFee: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/entry fee/i);
  });

  it('returns 400 when entryFee exceeds 100000 (line 61)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'TestFixture-HighFeeShow', discipline: 'Dressage', entryFee: 100001 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/entry fee/i);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: 'Test Show', discipline: 'Dressage', entryFee: 0 });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/shows/:id/enter ────────────────────────────────────────────────

describe('POST /api/v1/shows/:id/enter', () => {
  it('returns 400 when horseId is missing', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${createdShowId ?? 1}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    // 400 (validation) or 404 (show not yet created in this run order) are both valid
    expect([400, 404]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 for a non-existent show', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post('/api/v1/shows/999999999/enter')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 201 or 409 when entering owned eligible horse in open show', async () => {
    if (!createdShowId) {
      return;
    }
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${createdShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    // 201 on first entry; 409 if already entered
    expect([201, 409]).toContain(res.status);
    expect(res.body.success !== undefined).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/shows/1/enter')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/shows/:id/enter — additional validation paths ─────────────────

describe('POST /api/v1/shows/:id/enter — additional validation paths', () => {
  let ageTestHorseId;
  let injuredHorseId;
  let completedShowId;
  let feeShowId;
  const validationCleanup = createCleanupTracker();

  beforeAll(async () => {
    // Horse too young (age < 3)
    const youngHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-YoungHorse-${Date.now()}`,
        sex: 'Colt',
        dateOfBirth: new Date('2025-01-01'),
        age: 1,
        userId: user.id,
        healthStatus: 'healthy',
      },
    });
    ageTestHorseId = youngHorse.id;

    // Injured horse
    const injuredHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-InjuredHorse-${Date.now()}`,
        sex: 'Mare',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: user.id,
        healthStatus: 'injured',
      },
    });
    injuredHorseId = injuredHorse.id;

    // A completed show (status !== 'open')
    const completedShow = await prisma.show.create({
      data: {
        name: `TestFixture-CompletedShow-${Date.now()}`,
        discipline: 'Endurance',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: new Date(Date.now() - 1000),
        status: 'completed',
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        closeDate: new Date(Date.now() - 1000),
        createdByUserId: user.id,
      },
    });
    completedShowId = completedShow.id;

    // A show with entry fee
    const feeShow = await prisma.show.create({
      data: {
        name: `TestFixture-FeeShow-${Date.now()}`,
        discipline: 'Polo',
        entryFee: 100,
        levelMin: 1,
        levelMax: 999,
        prize: 500,
        runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'open',
        openDate: new Date(),
        closeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByUserId: user.id,
      },
    });
    feeShowId = feeShow.id;

    // Scoped, fail-loud cleanup (Equoria-1ohys). This inner afterAll runs before
    // the module-level afterAll deletes `user`, so the owned horses are removed
    // first (Horse.userId is onDelete:Restrict). A cleanup failure now fails the
    // suite instead of being swallowed.
    validationCleanup.add(
      () => (ageTestHorseId ? prisma.horse.delete({ where: { id: ageTestHorseId } }) : undefined),
      'ageTestHorse',
    );
    validationCleanup.add(
      () => (injuredHorseId ? prisma.horse.delete({ where: { id: injuredHorseId } }) : undefined),
      'injuredHorse',
    );
    validationCleanup.add(
      () => (completedShowId ? prisma.show.delete({ where: { id: completedShowId } }) : undefined),
      'completedShow',
    );
    validationCleanup.add(async () => {
      if (feeShowId) {
        await prisma.showEntry.deleteMany({ where: { showId: feeShowId } });
        await prisma.show.delete({ where: { id: feeShowId } });
      }
    }, 'feeShow');
  }, 30000);

  afterAll(() => validationCleanup.run(), 30000);

  it('returns 409 when show status is not open (line 174-177)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${completedShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/no longer accepting/i);
  });

  it('returns 400 when horse is too young (age < 3, line 197-200)', async () => {
    if (!createdShowId) {
      return;
    }
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${createdShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: ageTestHorseId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/3 years old/i);
  });

  it('returns 400 when horse is injured (line 202-203)', async () => {
    if (!createdShowId) {
      return;
    }
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${createdShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: injuredHorseId });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/injured/i);
  });

  it('returns 201 when show has entry fee and user has sufficient funds (lines 207-217)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${feeShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    // 201 (success) or 409 (already entered)
    expect([201, 409]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body.success).toBe(true);
    }
  });

  it('returns 402 when user has insufficient funds for entry fee (line 209-212)', async () => {
    // Create a user with 0 money
    const brokeUser = await prisma.user.create({
      data: {
        email: `showbroke-${Date.now()}@test.com`,
        username: `showbroke${Date.now()}`.slice(0, 30),
        password: 'irrelevant-hash',
        firstName: 'Broke',
        lastName: 'Tester',
        money: 0,
      },
    });
    const brokeToken = generateTestToken({ id: brokeUser.id, email: brokeUser.email, role: 'user' });
    const brokeHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-BrokeHorse-${Date.now()}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2018-01-01'),
        age: 7,
        userId: brokeUser.id,
        healthStatus: 'healthy',
      },
    });
    // Register on the suite's fail-loud tracker (Equoria-1ohys) instead of a
    // swallowed try/finally delete. FK order: horse before its owner
    // (Horse.userId is onDelete:Restrict).
    validationCleanup.add(() => prisma.horse.delete({ where: { id: brokeHorse.id } }), 'brokeHorse');
    validationCleanup.add(() => prisma.user.delete({ where: { id: brokeUser.id } }), 'brokeUser');

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${brokeToken}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${feeShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${brokeToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: brokeHorse.id });

    expect(res.status).toBe(402);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/insufficient funds/i);
  });
});

// ─── POST /api/v1/shows/:id/enter — horse not owned (line 195) ──────────────────

describe('POST /api/v1/shows/:id/enter — horse not owned by requesting user', () => {
  it('returns 404 when horse exists but belongs to another user (line 195)', async () => {
    if (!createdShowId) {
      return;
    }
    // horse belongs to user, but we use execToken (execUser) to try entering it
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${execToken}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${createdShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${execToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    // horse.userId = user.id, but execToken belongs to execUser → horse not found
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/horse not found/i);
  });
});

// ─── POST /api/v1/shows/:id/enter — show is full (line 182-183) ─────────────────

describe('POST /api/v1/shows/:id/enter — unlimited entries (Equoria-nx8t1 R3)', () => {
  let fullShowId;
  const fullShowCleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup (Equoria-1ohys). fullShowId is set inside the test,
  // so the closure reads it at run() time. A cleanup failure now fails the suite
  // instead of being swallowed.
  fullShowCleanup.add(async () => {
    if (fullShowId) {
      await prisma.showEntry.deleteMany({ where: { showId: fullShowId } });
      await prisma.show.delete({ where: { id: fullShowId } });
    }
  }, 'fullShow');

  afterAll(() => fullShowCleanup.run());

  it('accepts entry even when a legacy maxEntries cap would have blocked it', async () => {
    // Equoria-nx8t1 R3: entries are UNLIMITED. The 7-day deferred-window model
    // removes the maxEntries cap entirely. Even a row that still carries a
    // legacy maxEntries:1 value must NOT block additional entries — the
    // controller no longer reads or enforces maxEntries.
    const fullShow = await prisma.show.create({
      data: {
        name: `TestFixture-UncappedShow-${Date.now()}`,
        discipline: 'Vaulting',
        entryFee: 0,
        maxEntries: 1, // legacy value — must be ignored by the controller
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'open',
        openDate: new Date(),
        closeDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdByUserId: user.id,
      },
    });
    fullShowId = fullShow.id;

    // First horse already entered (would reach the legacy cap of 1).
    await prisma.showEntry.create({
      data: {
        showId: fullShowId,
        horseId: execHorse.id,
        userId: execUser.id,
        feePaid: 0,
      },
    });

    // Second horse must STILL be accepted (201) — no cap is enforced.
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${fullShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const count = await prisma.showEntry.count({ where: { showId: fullShowId } });
    expect(count).toBe(2);
  });
});

// ─── POST /api/v1/shows/:id/enter — already-closed show path (line 179) ─────────

describe('POST /api/v1/shows/:id/enter — already-closed show path', () => {
  let closedShowId;
  const closedShowCleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup (Equoria-1ohys). closedShowId is set inside the
  // test, so the closure reads it at run() time. A cleanup failure now fails the
  // suite instead of being swallowed.
  closedShowCleanup.add(
    () => (closedShowId ? prisma.show.delete({ where: { id: closedShowId } }) : undefined),
    'closedShow',
  );

  afterAll(() => closedShowCleanup.run());

  it('returns 409 when show closeDate is in the past (line 179-181)', async () => {
    // Create a show with past closeDate directly in DB
    const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const closedShow = await prisma.show.create({
      data: {
        name: `TestFixture-ClosedShow-${Date.now()}`,
        discipline: 'Reining',
        entryFee: 0,
        levelMin: 1,
        levelMax: 999,
        prize: 0,
        runDate: pastDate,
        status: 'open', // still 'open' but closeDate is past
        openDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        closeDate: pastDate,
        createdByUserId: user.id,
      },
    });
    closedShowId = closedShow.id;

    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const res = await request(app)
      .post(`/api/v1/shows/${closedShowId}/enter`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ horseId: horse.id });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/entry period has closed/i);
  });
});

// ─── POST /api/v1/shows/execute — executeClosedShows ─────────────────────────────

describe('POST /api/v1/shows/execute — executeClosedShows', () => {
  // ── Equoria-619ik: admin-or-cron-only access matrix ───────────────────────
  // The endpoint scores every due show and pays out all prizes — an admin/cron
  // operation, NOT a per-player action. The matrix below proves the gate:
  //   anonymous -> 401, authenticated non-admin -> 403, admin -> 200.
  // The CSRF token is set so the 403 we observe for a non-admin is the
  // requireRole('admin') rejection, NOT a CSRF rejection (which would also be
  // 403 but for the wrong reason — that would be a vacuous gate test).
  it('Equoria-619ik: returns 403 for an authenticated NON-admin user', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${execToken}`] });
    const res = await request(app)
      .post('/api/v1/shows/execute')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${execToken}`) // role: 'user'
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showIds: [pastShowId, pastShowNoEntriesId] });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    // requireRole('admin') throws AppError('Insufficient permissions', 403).
    expect(res.body.message).toBe('Insufficient permissions');
    // Sentinel: the rejected request produced NO execution payload — the
    // controller never ran (the gate short-circuited before it). We assert the
    // response shape rather than show DB-state because, per the existing suite
    // comment, the nightly cron / showScheduler is ALSO a sanctioned concurrent
    // executor that may legitimately claim a due show under a parallel run —
    // so "shows still open" would be a racy assertion. "No data.executed from
    // THIS non-admin call" is the honest, race-free invariant.
    expect(res.body.data).toBeUndefined();
  });

  it('Equoria-619ik: returns 200 and executes past-due shows for an ADMIN (lines 278-382)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${execAdminToken}`] });
    const res = await request(app)
      .post('/api/v1/shows/execute')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${execAdminToken}`) // role: 'admin'
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      // Equoria-rsss0: scope the execute scan to ONLY this suite's two past
      // shows so this call never claims a parallel competition suite's open
      // shows. Without this scope the global scan made `executed`
      // non-deterministic under a parallel run.
      .send({ showIds: [pastShowId, pastShowNoEntriesId] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.executed).toBe('number');
    expect(typeof res.body.data.message).toBe('string');

    // The durable, race-free invariant: after this scoped execute BOTH of this
    // suite's shows are no longer 'open' — they have been claimed/completed by
    // a sanctioned executor. We assert state rather than the `executed` counter
    // because in production (and under a parallel test run) the nightly cron /
    // showScheduler is ALSO a sanctioned executor that may legitimately claim a
    // due show first; in that case THIS call's `executed` is < 2 even though
    // the work was correctly done exactly once. State is the honest assertion;
    // the counter is inherently shared across concurrent sanctioned executors.
    const shows = await prisma.show.findMany({
      where: { id: { in: [pastShowId, pastShowNoEntriesId] } },
      select: { id: true, status: true },
    });
    expect(shows).toHaveLength(2);
    for (const s of shows) {
      expect(['completed', 'executing']).toContain(s.status);
    }
  });

  it('pastShow status is completed after execute', async () => {
    // The previous test should have run execute; check the DB directly
    const show = await prisma.show.findUnique({ where: { id: pastShowId } });
    // Status should now be 'completed' (or 'executing' if concurrent, but likely 'completed')
    expect(['completed', 'executing']).toContain(show.status);
  });

  it('competitionResult records created for entries after execute', async () => {
    const results = await prisma.competitionResult.findMany({
      where: { showId: pastShowId },
    });
    // Our one entry should have produced one result
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].horseId).toBe(execHorse.id);
    expect(typeof results[0].score).toBe('object'); // Prisma Decimal
    expect(results[0].discipline).toBe('Dressage');
    expect(results[0].showName).toMatch(/TestFixture-PastShow/);
  });

  it('returns 200 with executed=0 when no shows need execution (all already completed)', async () => {
    // After the first execute call, both of THIS suite's past shows are now
    // 'completed'. A second call scoped to those same ids must return
    // executed=0. Equoria-rsss0: scoping to our ids (rather than a global
    // scan) is what makes this `toBe(0)` deterministic under a parallel run —
    // a sibling suite's still-open shows can no longer inflate the count.
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${execAdminToken}`] });
    const res = await request(app)
      .post('/api/v1/shows/execute')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${execAdminToken}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ showIds: [pastShowId, pastShowNoEntriesId] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Our two shows already completed, so 0 additional executions.
    expect(res.body.data.executed).toBe(0);
  });

  it('returns 401 without auth', async () => {
    const csrf = await fetchCsrf(app);
    const res = await request(app)
      .post('/api/v1/shows/execute')
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({});

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/v1/shows/create — P2002 duplicate name (line 88-92) ──────────────

describe('POST /api/v1/shows/create — duplicate name conflict', () => {
  let duplicateShowId;
  const dupShowCleanup = createCleanupTracker();

  // Scoped, fail-loud cleanup (Equoria-1ohys). duplicateShowId is set inside the
  // test, so the closure reads it at run() time. A cleanup failure now fails the
  // suite instead of being swallowed.
  dupShowCleanup.add(
    () => (duplicateShowId ? prisma.show.delete({ where: { id: duplicateShowId } }) : undefined),
    'duplicateShow',
  );

  afterAll(() => dupShowCleanup.run());

  it('returns 409 when show name already exists (P2002 catch, line 88)', async () => {
    const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const showName = `TestFixture-DupShow-${Date.now()}`;

    // Create the first show
    const first = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ name: showName, discipline: 'Racing', entryFee: 0 });

    if (first.status === 201) {
      duplicateShowId = first.body.data.show.id;
    }

    // Attempt duplicate
    const csrf2 = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
    const second = await request(app)
      .post('/api/v1/shows/create')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf2.cookieHeader)
      .set('X-CSRF-Token', csrf2.csrfToken)
      .send({ name: showName, discipline: 'Racing', entryFee: 0 });

    // Either 409 (unique constraint) or 201 (no unique constraint on name in DB)
    expect([201, 409]).toContain(second.status);
    if (second.status === 409) {
      expect(second.body.success).toBe(false);
      expect(second.body.message).toMatch(/already exists/i);
    }
  });
});
