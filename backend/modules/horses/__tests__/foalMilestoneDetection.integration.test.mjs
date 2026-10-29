/**
 * BB.3 foal milestone DETECTION + PERSISTENCE (Equoria-oey96.18).
 *
 * This is the write/detection half of BB.3. The read half (surfacing the
 * persisted `FoalDevelopment.completedMilestones` store as
 * Array<{ id, timestamp }> on GET /foals/:id/development) shipped in
 * Equoria-oey96.17. This suite proves the detection/write path actually
 * POPULATES that store from REAL gameplay state, for both milestone
 * families, idempotently:
 *
 *   bond      — Horse.bondScore crosses 25/50/75/100
 *   first-trait — first discovered/expressed epigenetic trait
 *
 * Equoria-fr2kg. OLD CONTRACT: a fourth family, `graduation`, was recorded
 * when a foal reached age 3 game-years (21 real days) and graduateFoal ran,
 * and a bond milestone could be recorded inside the player-run enrichment
 * write path. NEW RULING (owner, 2026-10-14/15): there is no graduation and
 * no player-run enrichment, so no `graduation` milestone is ever recorded.
 *
 * Equoria-fr2kg Q5. OLD CONTRACT: a `stage` family was recorded as the foal
 * entered the named life stages (stage-weanling at 3 days, stage-yearling at
 * 7, stage-two-year-old at 14). NEW RULING (owner, 2026-10-15): the named life
 * stages are removed; owner ruling F6 (2026-10-16) keeps only the bond and
 * first-trait milestones. No stage milestone is ever recorded, at any age.
 *
 * IDEMPOTENCY is the core correctness property: re-detecting on unchanged state
 * records nothing new and never duplicates a milestone (the store is keyed by
 * milestone id — duplication is structurally impossible).
 *
 * Real DB, real model/service code, no mocks. Scoped TestFixture- cleanup.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  detectAndRecordFoalMilestones,
  detectAndRecordFoalMilestonesCore,
  computeReachedMilestones,
} from '../services/foalMilestoneService.mjs';

const ORIGIN = 'http://localhost:3000';
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// A dateOfBirth N whole days ago, anchored off-midnight UTC so the date-only
// game-year age math (Equoria-vdw5 / oey96.16) is exercised honestly.
function dobDaysAgo(days) {
  const d = new Date(Date.now() - days * MS_PER_DAY);
  d.setUTCHours(4, 0, 0, 0);
  return d;
}

const cleanup = createCleanupTracker();
const TAG = `oey9618-${randomBytes(4).toString('hex')}`;
const createdFoalIds = [];

let user;
let token;

// Create a fixture foal and register scoped cleanup for its child rows.
async function makeFoal({ suffix, days, ageYears, bondScore = 0, epigeneticModifiers }) {
  const data = {
    ...fixtureColor(),
    name: `TestFixture-${TAG}-${suffix}`,
    sex: 'Filly',
    dateOfBirth: dobDaysAgo(days),
    age: ageYears,
    bondScore,
    userId: user.id,
  };
  if (epigeneticModifiers !== undefined) {
    data.epigeneticModifiers = epigeneticModifiers;
  }
  const foal = await prisma.horse.create({ data });
  createdFoalIds.push(foal.id);
  return foal;
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `${TAG}@test.com`,
      username: TAG,
      password: 'irrelevant-hash',
      firstName: 'BB3',
      lastName: 'Detect',
      money: 5000,
    },
  });
  token = generateTestToken({ id: user.id, email: user.email, role: 'user' });

  // Child rows first, then horses, then user (FK order). All scoped to this run.
  cleanup.add(
    () => prisma.foalTrainingHistory.deleteMany({ where: { horseId: { in: createdFoalIds } } }),
    'foalTrainingHistory',
  );
  cleanup.add(() => prisma.foalActivity.deleteMany({ where: { foalId: { in: createdFoalIds } } }), 'foalActivity');
  cleanup.add(
    () => prisma.groomAssignment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
    'groomAssignment',
  );
  cleanup.add(
    () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdFoalIds } } }),
    'foalDevelopment',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdFoalIds } } }), 'horse');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ---------------------------------------------------------------------------
// PURE detection (no DB) — the boundary logic.
// ---------------------------------------------------------------------------
describe('computeReachedMilestones — pure boundary logic', () => {
  it('reports bond milestones only for crossed thresholds', () => {
    const reached = computeReachedMilestones({ ageDays: 0, bondScore: 60, hasDiscoveredTrait: false });
    expect(reached).toContain('bond-25');
    expect(reached).toContain('bond-50');
    expect(reached).not.toContain('bond-75');
    expect(reached).not.toContain('bond-100');
  });

  it('reports no milestone for age alone: no life stages, no graduation (Equoria-fr2kg Q5)', () => {
    for (const ageDays of [0, 2, 3, 7, 9, 14, 20, 21, 60]) {
      expect(computeReachedMilestones({ ageDays, bondScore: 0, hasDiscoveredTrait: false })).toEqual([]);
    }
  });

  it('reports first-trait when a trait is discovered', () => {
    expect(computeReachedMilestones({ ageDays: 0, bondScore: 0, hasDiscoveredTrait: true })).toContain('first-trait');
  });
});

// ---------------------------------------------------------------------------
// Bond milestone detection + idempotency (real DB, direct detection).
// ---------------------------------------------------------------------------
describe('bond milestone detection (real DB)', () => {
  it('records crossed bond milestones once and is idempotent on re-run', async () => {
    const foal = await makeFoal({ suffix: 'bond', days: 1, ageYears: 0, bondScore: 60 });

    const first = await detectAndRecordFoalMilestones(foal.id);
    expect(first.newMilestones).toContain('bond-25');
    expect(first.newMilestones).toContain('bond-50');
    expect(first.newMilestones).not.toContain('bond-75');

    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones['bond-25']).toBeDefined();
    expect(persisted.completedMilestones['bond-50']).toBeDefined();
    const ts25 = persisted.completedMilestones['bond-25'];

    // Idempotency: re-run detects nothing new; timestamps are preserved.
    const second = await detectAndRecordFoalMilestones(foal.id);
    expect(second.newMilestones).toEqual([]);
    const persistedAgain = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persistedAgain.completedMilestones['bond-25']).toBe(ts25);
    expect(Object.keys(persistedAgain.completedMilestones).sort()).toEqual(
      Object.keys(persisted.completedMilestones).sort(),
    );
  }, 30000);
});

// ---------------------------------------------------------------------------
// First-trait milestone detection (real DB, direct detection).
// ---------------------------------------------------------------------------
describe('first-trait milestone detection (real DB)', () => {
  it('records first-trait once a discovered epigenetic trait exists; idempotent', async () => {
    const foal = await makeFoal({
      suffix: 'trait',
      days: 1,
      ageYears: 0,
      epigeneticModifiers: { positive: ['bold'], negative: [], hidden: [] },
    });

    const first = await detectAndRecordFoalMilestones(foal.id);
    expect(first.newMilestones).toContain('first-trait');

    const second = await detectAndRecordFoalMilestones(foal.id);
    expect(second.newMilestones).not.toContain('first-trait');
    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones['first-trait']).toBe(first.completedMilestones['first-trait']);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Detection on the REAL read endpoint (GET /development).
// ---------------------------------------------------------------------------
describe('milestone detection on the /development read path (HTTP, real DB)', () => {
  it('detecting on read records + surfaces reached milestones, and no stage milestone', async () => {
    // 9 real days (game-year 1); age<=1 so /development is reachable.
    const foal = await makeFoal({ suffix: 'yearold', days: 9, ageYears: 1, bondScore: 30 });

    const res = await request(app)
      .get(`/api/v1/foals/${foal.id}/development`)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.completedMilestones.map(m => m.id);
    expect(ids).toEqual(['bond-25']);

    // Persisted for real (not just computed for the response).
    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones).toEqual({ 'bond-25': expect.any(String) });
  }, 30000);
});

// ---------------------------------------------------------------------------
// No graduation milestone at age 3 (Equoria-fr2kg).
// ---------------------------------------------------------------------------
describe('a foal past age 3 records no stage and no graduation milestone (real DB)', () => {
  it('detection on a 21-day unbonded foal records nothing; idempotent', async () => {
    // 21 real days → age 3 game-years. age=3.
    const foal = await makeFoal({ suffix: 'age3', days: 21, ageYears: 3 });

    const first = await detectAndRecordFoalMilestones(foal.id);
    expect(first.newMilestones).toEqual([]);

    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted?.completedMilestones ?? {}).toEqual({});

    const again = await detectAndRecordFoalMilestones(foal.id);
    expect(again.newMilestones).toEqual([]);
  }, 30000);
});

// ---------------------------------------------------------------------------
// Concurrent recording (Equoria-q4uem.8). The store must be merged at the
// database, existing keys winning: a key another transaction commits between
// this call's read and its write must survive with ITS timestamp.
//
// Deterministic interleaving, no sleeps-for-luck: transaction B records its
// keys and then parks on a promise barrier while holding the
// foal_development row lock. Transaction A then reads the (still empty)
// committed store and attempts its write, which must wait on B. Only once
// Postgres reports A as blocked by B's backend is B released to commit — so
// A's read is guaranteed to precede B's commit, and A's write to follow it.
// ---------------------------------------------------------------------------
const RACE_TX_OPTS = { maxWait: 10000, timeout: 20000 };

async function waitUntilBlockedBy(blockerPid) {
  const deadline = Date.now() + 10000;
  for (;;) {
    const [{ blocked }] = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity WHERE ${blockerPid}::int = ANY (pg_blocking_pids(pid))
      ) AS blocked`;
    if (blocked) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`no backend became blocked by pid ${blockerPid}`);
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
}

/**
 * Run B (optionally mutates the foal in its own transaction, records at
 * `bNow`, parks holding the row lock) and A (optionally mutates the foal in
 * its own transaction, then records at `aNow`) in the interleaving described
 * above. Resolves with both core results.
 *
 * Equoria-fr2kg Q5. OLD SETUP: B reached its own keys by looking ten days
 * ahead (the stage milestones). Those milestones are gone (owner ruling
 * 2026-10-15), so a transaction now reaches a key only through foal state.
 * B changes the foal inside its own uncommitted transaction; A reads the
 * committed foal, so the two see different state without A touching the
 * row B holds before A's read.
 */
async function raceRecordings(foalId, { bNow, aNow, aPrepare, bPrepare }) {
  let releaseB;
  const bMayCommit = new Promise(resolve => {
    releaseB = resolve;
  });
  let signalBRecorded;
  const bRecorded = new Promise(resolve => {
    signalBRecorded = resolve;
  });

  const txB = prisma.$transaction(async tx => {
    const [{ pid }] = await tx.$queryRaw`SELECT pg_backend_pid()::int AS pid`;
    if (bPrepare) {
      await bPrepare(tx);
    }
    const result = await detectAndRecordFoalMilestonesCore(tx, foalId, { now: bNow });
    signalBRecorded(pid);
    await bMayCommit;
    return result;
  }, RACE_TX_OPTS);

  let txA;
  try {
    // If B fails before signalling, surface its error instead of hanging.
    const bPid = await Promise.race([bRecorded, txB.then(() => Promise.reject(new Error('B finished early')))]);
    txA = prisma.$transaction(async tx => {
      if (aPrepare) {
        await aPrepare(tx);
      }
      return detectAndRecordFoalMilestonesCore(tx, foalId, { now: aNow });
    }, RACE_TX_OPTS);
    await waitUntilBlockedBy(bPid);
  } finally {
    releaseB();
  }
  const [b, a] = await Promise.all([txB, txA]);
  return { a, b };
}

describe('concurrent milestone recording keeps every key (real DB, Equoria-q4uem.8)', () => {
  it('a key committed by another transaction after this read survives with its own timestamp', async () => {
    // Committed state: bond 30, no trait. A, reading it, reaches bond-25 (key Y).
    const foal = await makeFoal({ suffix: 'race', days: 1, ageYears: 0, bondScore: 30 });
    await prisma.foalDevelopment.create({ data: { foalId: foal.id } });

    const aNow = new Date();
    const bNow = new Date(aNow.getTime() + 1000);

    const { a, b } = await raceRecordings(foal.id, {
      bNow,
      aNow,
      // B, in its own transaction, drops the bond and gains a revealed trait:
      // it reaches first-trait only (key X).
      bPrepare: tx =>
        tx.horse.update({
          where: { id: foal.id },
          data: { bondScore: 0, epigeneticModifiers: { positive: ['bold'], negative: [], hidden: [] } },
        }),
    });

    expect(b.newMilestones).toEqual(['first-trait']);
    expect(a.newMilestones).toEqual(['bond-25']);

    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones).toEqual({
      'first-trait': bNow.toISOString(),
      'bond-25': aNow.toISOString(),
    });
    // The returned map is what the database holds after A's statement.
    expect(a.completedMilestones).toEqual(persisted.completedMilestones);
  }, 30000);

  it('a key another transaction stored first keeps its timestamp and is not new for this call', async () => {
    // Committed state: bond 60 and a revealed trait. A reaches bond-25,
    // bond-50 and first-trait.
    const foal = await makeFoal({
      suffix: 'raceoverlap',
      days: 1,
      ageYears: 0,
      bondScore: 60,
      epigeneticModifiers: { positive: ['bold'], negative: [], hidden: [] },
    });
    await prisma.foalDevelopment.create({ data: { foalId: foal.id } });

    const bNow = new Date();
    const aNow = new Date(bNow.getTime() + 1000);

    // B lowers the bond to 30 in its own transaction: it reaches bond-25 and
    // first-trait. Both reach those two; only A also reaches bond-50.
    const { a } = await raceRecordings(foal.id, {
      bNow,
      aNow,
      bPrepare: tx => tx.horse.update({ where: { id: foal.id }, data: { bondScore: 30 } }),
    });

    expect(a.newMilestones).toEqual(['bond-50']);
    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones).toEqual({
      'bond-25': bNow.toISOString(),
      'first-trait': bNow.toISOString(),
      'bond-50': aNow.toISOString(),
    });
  }, 30000);

  it('a pre-stored key keeps its original timestamp and is not reported as new', async () => {
    const foal = await makeFoal({ suffix: 'prestored', days: 1, ageYears: 0, bondScore: 60 });
    const t0 = '2026-01-01T00:00:00.000Z';
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, completedMilestones: { 'bond-25': t0 } } });

    const now = new Date();
    const result = await detectAndRecordFoalMilestones(foal.id, { now });

    expect(result.newMilestones).toEqual(['bond-50']);
    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones).toEqual({ 'bond-25': t0, 'bond-50': now.toISOString() });
    expect(result.completedMilestones).toEqual(persisted.completedMilestones);
  }, 30000);

  it('a stored non-object value is treated as an empty store and replaced', async () => {
    const foal = await makeFoal({ suffix: 'nonobject', days: 1, ageYears: 0, bondScore: 30 });
    await prisma.foalDevelopment.create({ data: { foalId: foal.id, completedMilestones: ['legacy'] } });

    const now = new Date();
    const result = await detectAndRecordFoalMilestones(foal.id, { now });

    expect(result.newMilestones).toEqual(['bond-25']);
    const persisted = await prisma.foalDevelopment.findUnique({ where: { foalId: foal.id } });
    expect(persisted.completedMilestones).toEqual({ 'bond-25': now.toISOString() });
  }, 30000);
});
