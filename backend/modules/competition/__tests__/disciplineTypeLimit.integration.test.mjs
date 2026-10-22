/**
 * disciplineTypeLimit.integration.test.mjs (Equoria-576c0 B10)
 *
 * Owner entry rule (2026-10-15) and ruling C13 (2026-10-16): a horse may have
 * shows of at most 3 discipline TYPES active at once; a 4th type only once
 * every show of one active type has run; any number of shows within the
 * active types. Conformation and parade each count as one type.
 *
 * "Active" = the horse has an entry in a show whose status is not
 * 'completed' (open or executing: entered, not yet run and settled).
 * A ridden show's type is its discipline; a conformation show's type is
 * 'Conformation' whatever its cosmetic discipline column says.
 *
 * Counted inside the entry transaction after locking the owner's User row and
 * the horse row (User -> Horse order), so two concurrent entries for new types
 * cannot both pass. Real HTTP + real DB; free shows (no escrow touched).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma, { PrismaClient } from '../../../../packages/database/prismaClient.mjs';
import { buildDatabaseUrl } from '../../../../packages/database/dbPoolConfig.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { competitionDateOfBirth, giveEligibleRider } from '../../../__tests__/helpers/eligibleCompetitor.mjs';
import { enterShowDeferredTx } from '../services/competitionRouteQueries.mjs';
import { EntryRefusalError } from '../services/entryEligibility.mjs';

const ORIGIN = 'http://localhost:3000';
const rand = () => randomBytes(5).toString('hex');
const cleanup = createCleanupTracker();
const showIds = [];
const horseIds = [];
const riderIds = [];
let user;
let token;

// A dedicated client so the barrier transaction never competes with the app pool.
const barrierClient = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl(process.env.DATABASE_URL, process.env) } },
  log: [],
  errorFormat: 'minimal',
});

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `b10-${rand()}@test.local`,
      username: `b10${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'Type',
      lastName: 'Limit',
      money: 0,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: showIds } } }), 'entries');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: showIds } } }), 'shows');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: riderIds } } }), 'riders');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
  cleanup.add(() => barrierClient.$disconnect(), 'barrierClient');
}, 60000);

afterAll(() => cleanup.run(), 60000);

async function makeShow(discipline, { showType = 'ridden', undated = false } = {}) {
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-b10-${rand()}`,
      discipline,
      showType,
      entryFee: 0,
      prize: 0,
      levelMin: 1,
      levelMax: 999,
      runDate: future,
      closeDate: undated ? null : future,
      openDate: new Date(Date.now() - 60 * 1000),
      status: 'open',
      createdByUserId: user.id,
    },
  });
  showIds.push(show.id);
  return show;
}

async function makeHorse() {
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-b10-${rand()}`,
      sex: 'Mare',
      age: 7,
      dateOfBirth: competitionDateOfBirth(7),
      healthStatus: 'Excellent',
      lastFedDate: new Date(), // fed today: not in bad health (Equoria-0d4wa)
      userId: user.id,
    },
    horseIds,
  );
  await giveEligibleRider(prisma, { horseId: horse.id, userId: user.id }, riderIds);
  return horse;
}

async function enter(showId, horseId) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post(`/api/v1/shows/${showId}/enter`)
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId });
}

async function enterViaCompetition(showId, horseId) {
  const csrf = await fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });
  return request(app)
    .post('/api/v1/competition/enter')
    .set('Origin', ORIGIN)
    .set('Authorization', `Bearer ${token}`)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send({ horseId, showId });
}

async function enterAll(horse, disciplines) {
  const shows = {};
  for (const d of disciplines) {
    shows[d] = await makeShow(d);
    expect((await enter(shows[d].id, horse.id)).status).toBe(201);
  }
  return shows;
}

function expectTypeLimit(res, activeTypes) {
  expect(res.status).toBe(400);
  expect(res.body.code).toBe('DISCIPLINE_TYPE_LIMIT');
  for (const t of activeTypes) {
    expect(res.body.message).toContain(t);
  }
}

describe('at most 3 discipline types active at once (B10, C13)', () => {
  it('accepts three types and refuses a fourth, naming the active types', async () => {
    const horse = await makeHorse();
    await enterAll(horse, ['Dressage', 'Racing', 'Show Jumping']);
    const fourth = await makeShow('Western Pleasure');
    const res = await enter(fourth.id, horse.id);
    expectTypeLimit(res, ['Dressage', 'Racing', 'Show Jumping']);
    expect(await prisma.showEntry.count({ where: { showId: fourth.id, horseId: horse.id } })).toBe(0);
  });

  it('allows any number of shows within an active type', async () => {
    const horse = await makeHorse();
    await enterAll(horse, ['Dressage', 'Racing', 'Show Jumping']);
    const moreDressage = await makeShow('Dressage');
    expect((await enter(moreDressage.id, horse.id)).status).toBe(201);
  });

  it('allows a fourth type only once every show of one active type has run', async () => {
    const horse = await makeHorse();
    const shows = await enterAll(horse, ['Dressage', 'Racing', 'Show Jumping']);
    const secondRacing = await makeShow('Racing');
    expect((await enter(secondRacing.id, horse.id)).status).toBe(201);
    const fourth = await makeShow('Western Pleasure');

    // One Racing show has run: Racing is still active (its other show has not).
    await prisma.show.update({ where: { id: shows.Racing.id }, data: { status: 'completed' } });
    expectTypeLimit(await enter(fourth.id, horse.id), ['Dressage', 'Racing', 'Show Jumping']);

    // Every Racing show has run: Racing is no longer active, so a new type fits.
    await prisma.show.update({ where: { id: secondRacing.id }, data: { status: 'completed' } });
    expect((await enter(fourth.id, horse.id)).status).toBe(201);
  });

  it('counts a conformation entry as one type (C13)', async () => {
    const horse = await makeHorse();
    const conformation = await makeShow('Dressage', { showType: 'conformation' });
    await prisma.showEntry.create({
      data: { showId: conformation.id, horseId: horse.id, userId: user.id, feePaid: 0 },
    });
    await enterAll(horse, ['Dressage', 'Racing']);
    const res = await enter((await makeShow('Show Jumping')).id, horse.id);
    expectTypeLimit(res, ['Conformation', 'Dressage', 'Racing']);
  });

  it('refuses a conformation entry as a new fourth type on the conformation path (C13)', async () => {
    const horse = await makeHorse();
    await enterAll(horse, ['Dressage', 'Racing', 'Show Jumping']);
    const conformation = await makeShow('Dressage', { showType: 'conformation' });
    const attempt = enterShowDeferredTx({
      show: { ...conformation },
      showId: conformation.id,
      horseId: horse.id,
      userId: user.id,
    });
    await expect(attempt).rejects.toBeInstanceOf(EntryRefusalError);
    await expect(attempt).rejects.toMatchObject({ code: 'DISCIPLINE_TYPE_LIMIT' });
    expect(await prisma.showEntry.count({ where: { showId: conformation.id } })).toBe(0);
  });

  it('two concurrent entries for new types cannot both pass (held-lock race)', async () => {
    const horse = await makeHorse();
    await enterAll(horse, ['Dressage', 'Racing']);
    const third = await makeShow('Show Jumping');
    const fourth = await makeShow('Western Pleasure');

    const barrier = await openUserRowBarrier(user.id);
    const racing = [enter(third.id, horse.id), enter(fourth.id, horse.id)];
    await waitForBlockedSessions(barrier.pid, 2);
    await barrier.release();
    const results = await Promise.all(racing);

    const statuses = results.map(r => r.status).sort();
    expect(statuses).toEqual([201, 400]);
    expect(results.find(r => r.status === 400).body.code).toBe('DISCIPLINE_TYPE_LIMIT');
    const entered = await prisma.showEntry.count({
      where: { horseId: horse.id, showId: { in: [third.id, fourth.id] } },
    });
    expect(entered).toBe(1);
  }, 60000);
});

// Owner ruling (2026-10-05/07/12): undated shows refuse entry. The executor only
// runs a ridden show whose closeDate has passed, so an undated ridden show never
// runs; an entry in one would keep its type active forever.
describe('undated ridden shows (B10 review)', () => {
  it('refuses entry into a ridden show with no closing date, on both paths', async () => {
    const horse = await makeHorse();
    const undated = await makeShow('Dressage', { undated: true });
    for (const res of [await enter(undated.id, horse.id), await enterViaCompetition(undated.id, horse.id)]) {
      expect({ status: res.status, code: res.body.code, message: res.body.message }).toEqual({
        status: 409,
        code: 'SHOW_UNDATED',
        message: 'This show has no closing date and is not taking entries',
      });
    }
    expect(await prisma.showEntry.count({ where: { showId: undated.id } })).toBe(0);
  });

  it('legacy entries in undated ridden shows do not count toward the 3-type limit', async () => {
    const horse = await makeHorse();
    for (const discipline of ['Racing', 'Show Jumping', 'Western Pleasure']) {
      const legacy = await makeShow(discipline, { undated: true });
      await prisma.showEntry.create({
        data: { showId: legacy.id, horseId: horse.id, userId: user.id, feePaid: 0 },
      });
    }
    const dated = await makeShow('Dressage');
    expect((await enter(dated.id, horse.id)).status).toBe(201);
  });
});

/**
 * Holds FOR UPDATE on the owner's User row in a transaction on the barrier
 * client until release(); returns the holding session's backend pid.
 */
async function openUserRowBarrier(userId) {
  let release;
  let ready;
  const released = new Promise(r => {
    release = r;
  });
  const armed = new Promise(r => {
    ready = r;
  });
  let pid;
  let barrierFailure = null;
  const held = barrierClient
    .$transaction(
      async tx => {
        const rows = await tx.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
        pid = Number(rows[0].pid);
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        ready();
        await released;
      },
      { maxWait: 20000, timeout: 120000 },
    )
    .catch(err => {
      barrierFailure = err;
    });
  await Promise.race([
    armed,
    held.then(() => {
      throw barrierFailure ?? new Error('barrier transaction ended before it was armed');
    }),
  ]);
  return {
    pid,
    async release() {
      release();
      await held;
      if (barrierFailure) {
        throw barrierFailure;
      }
    },
  };
}

/** Resolves once `count` sessions are transitively blocked by the barrier (a real lock observation). */
async function waitForBlockedSessions(barrierPid, count, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const rows = await barrierClient.$queryRaw`
      WITH RECURSIVE chain AS (
        SELECT pid FROM pg_stat_activity WHERE pid = ${barrierPid}
        UNION
        SELECT a.pid
        FROM pg_stat_activity a
        JOIN chain c ON c.pid = ANY (pg_blocking_pids(a.pid))
      )
      SELECT (count(*) - 1)::int AS blocked FROM chain`;
    const seen = Number(rows[0].blocked);
    if (seen >= count) {
      return seen;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${count} session(s) blocked by pid ${barrierPid}; saw ${seen}`);
    }
    await new Promise(r => setTimeout(r, 20));
  }
}
