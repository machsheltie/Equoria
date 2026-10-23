/**
 * Rider flag-compatibility integration test for showExecutionService.executeClosedShows
 * (Equoria-grys6 — adjacent to simulateCompetition.mjs yzqhj.6).
 *
 * showExecutionService.executeClosedShows is the SECOND live competition scoring
 * engine (distinct from logic/simulateCompetition.mjs). yzqhj.6 wired
 * `calculateRiderFlagCompatibility` into simulateCompetition but NOT here, so a
 * hired rider's effectiveness was NOT modulated by the horse's behavioral
 * epigenetic flags in player-created shows. grys6 closes that gap by applying
 * the SAME conservative (+-2%/flag, +-10% cap), rider-only modifier in
 * executeClosedShows before applyRiderModifiers.
 *
 * This is a real-DB test (CLAUDE.md "no mocks ever") with TestFixture-scoped
 * cleanup. The ONLY mock is Math.random — pinned to 0.5 so the luck term is
 * fixed: +6% under owner rulings C1/C2 (Equoria-576c0 B5; luck = 1 +
 * floor(0.5 * 10) whole percent, summed with the rider percent and applied
 * once). Old contract: luck = (random - 0.5) * 18 = 0 points, then the rider
 * multiplier. With luck pinned, the per-entry
 * score is fully deterministic, so the score delta between two identical-stat,
 * identical-rider horses that differ ONLY in epigeneticFlags is attributable
 * SOLELY to the rider flag-compatibility modifier (sentinel isolation).
 *
 * Failing-test-first (EDGE_CASE_FIX_DISCIPLINE §1): before the showController
 * edit, the flagged and no-flag horses produce IDENTICAL scores here (flags
 * never touch this engine), so the exact-score + strict-inequality assertions
 * fail. After the edit they diverge by the predicted amount.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeClosedShows } from '../shows/showExecutionService.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const TAG = `RiderFlagCompat-${randomBytes(4).toString('hex')}`;

const cleanup = createCleanupTracker();

let user;
// Riders attached to horses (positive vs no-flag) — identical rider config so
// the only difference is the horse's epigeneticFlags.
let riderForFlagged;
let riderForNoFlag;
let riderForNoFlagControl;
// Horses
let horseFlaggedWithRider; // positive flags + rider
let horseNoFlagWithRider; // no flags + identical rider
let horseFlaggedNoRider; // positive flags + NO rider (regression-safe check)
let horseNoFlagNoRider; // no flags + NO rider (regression-safe check)

const createdShowIds = [];
const createdRiderIds = [];
const createdHorseIds = [];

// Stats chosen so base = 100. Owner ruling R8 (Equoria-576c0 B4a): the base is
// the discipline's 50/30/20 (Dressage: precision, focus, obedience). Old
// contract: the flat average of speed/stamina/agility/precision/boldness, so
// focus and obedience were never set; every stat is now 100, base still 100.
// A base of 100 gives the integer Math.round enough headroom that the
// rider-compat delta crosses a rounding boundary deterministically.
const STAT_BASE = {
  ...fixtureColor(),
  sex: 'Mare',
  dateOfBirth: new Date('2018-01-01'),
  age: 7,
  healthStatus: 'healthy',
  speed: 100,
  stamina: 100,
  agility: 100,
  balance: 100,
  precision: 100,
  boldness: 100,
  intelligence: 100,
  flexibility: 100,
  obedience: 100,
  focus: 100,
};

// Rider config producing an EXACT bonus of 0.090 (below the 0.10 BONUS_CAP so
// the positive-flag factor of 1.08 has headroom and does not clamp):
//   experienced            -> +0.030
//   level 10 (level-1)*0.004-> +0.036
//   prestige 60 *0.0004     -> +0.024   (total 0.090)
//   personality 'gentle' has NO Dressage affinity -> +0.000
const RIDER_CONFIG = {
  firstName: 'TestFixture',
  personality: 'gentle',
  skillLevel: 'experienced',
  speciality: 'Dressage',
  level: 10,
  prestige: 60,
};

const POSITIVE_FLAGS = ['brave', 'confident', 'affectionate', 'resilient']; // net +4 -> factor 1.08

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `${TAG}@test.local`,
      username: `${TAG}-u`.slice(0, 30),
      password: 'irrelevant-hash',
      firstName: 'FlagCompat',
      lastName: 'Test',
      money: 0,
    },
  });

  horseFlaggedWithRider = await prisma.horse.create({
    data: { ...STAT_BASE, userId: user.id, name: `TestFixture-${TAG}-FlaggedRider`, epigeneticFlags: POSITIVE_FLAGS },
  });
  horseNoFlagWithRider = await prisma.horse.create({
    data: { ...STAT_BASE, userId: user.id, name: `TestFixture-${TAG}-NoFlagRider`, epigeneticFlags: [] },
  });
  horseFlaggedNoRider = await prisma.horse.create({
    data: { ...STAT_BASE, userId: user.id, name: `TestFixture-${TAG}-FlaggedNoRider`, epigeneticFlags: POSITIVE_FLAGS },
  });
  horseNoFlagNoRider = await prisma.horse.create({
    data: { ...STAT_BASE, userId: user.id, name: `TestFixture-${TAG}-NoFlagNoRider`, epigeneticFlags: [] },
  });
  createdHorseIds.push(
    horseFlaggedWithRider.id,
    horseNoFlagWithRider.id,
    horseFlaggedNoRider.id,
    horseNoFlagNoRider.id,
  );

  riderForFlagged = await prisma.rider.create({
    data: { ...RIDER_CONFIG, lastName: `${TAG}-RiderA`, userId: user.id },
  });
  riderForNoFlag = await prisma.rider.create({
    data: { ...RIDER_CONFIG, lastName: `${TAG}-RiderB`, userId: user.id },
  });
  riderForNoFlagControl = await prisma.rider.create({
    data: { ...RIDER_CONFIG, lastName: `${TAG}-RiderC`, userId: user.id },
  });
  createdRiderIds.push(riderForFlagged.id, riderForNoFlag.id, riderForNoFlagControl.id);

  await prisma.riderAssignment.createMany({
    data: [
      { riderId: riderForFlagged.id, horseId: horseFlaggedWithRider.id, userId: user.id, isActive: true },
      { riderId: riderForNoFlag.id, horseId: horseNoFlagWithRider.id, userId: user.id, isActive: true },
    ],
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). createdShowIds is populated by
  // runScopedShow during the tests, so the closures read the id arrays at run()
  // time. FK order: results + entries -> shows; riderAssignments -> riders +
  // horses; horses -> user (Horse.userId is onDelete:Restrict). A cleanup
  // failure now fails the suite instead of being swallowed.
  cleanup.add(
    () => prisma.competitionResult.deleteMany({ where: { showId: { in: createdShowIds } } }),
    'competitionResult',
  );
  cleanup.add(() => prisma.showEntry.deleteMany({ where: { showId: { in: createdShowIds } } }), 'showEntry');
  cleanup.add(() => prisma.show.deleteMany({ where: { id: { in: createdShowIds } } }), 'show');
  cleanup.add(
    () => prisma.riderAssignment.deleteMany({ where: { horseId: { in: createdHorseIds } } }),
    'riderAssignment',
  );
  cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: createdRiderIds } } }), 'rider');
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horse');
  cleanup.add(() => (user ? prisma.user.delete({ where: { id: user.id } }) : undefined), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

beforeEach(() => {
  // Pin luck: 1 + floor(0.5 * 10) = +6% (C1, B5). Scores deterministic.
  jest.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Create one TestFixture-scoped, already-closed show with the given horse ids
 * entered, execute it scoped to ONLY that show, and return a Map of
 * horseId -> score (first/lowest-id result per horse, robust to any concurrent
 * re-scoring on the shared canonical DB).
 */
async function runScopedShow(horseIds) {
  const openDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const closeDate = new Date(Date.now() - 60 * 60 * 1000);
  // Equoria-2a095: created NOT yet due, made due once its entries exist, so an
  // executor scanning globally (a sibling suite, the cron path's tests) cannot
  // settle it entry-less in the gap between the two inserts.
  const notYetDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-${TAG}-Show-${randomBytes(4).toString('hex')}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 0,
      runDate: notYetDue,
      status: 'open',
      openDate,
      closeDate: notYetDue,
      createdByUserId: user.id,
    },
  });
  createdShowIds.push(show.id);

  await prisma.showEntry.createMany({
    data: horseIds.map(horseId => ({ showId: show.id, horseId, userId: user.id, feePaid: 0 })),
  });
  await prisma.show.update({ where: { id: show.id }, data: { closeDate, runDate: closeDate } });

  await executeClosedShows({ body: { showIds: [show.id] } }, null);

  const results = await prisma.competitionResult.findMany({
    where: { showId: show.id },
    select: { id: true, horseId: true, score: true },
    orderBy: { id: 'asc' },
  });
  const byHorse = new Map();
  for (const r of results) {
    if (!byHorse.has(r.horseId)) {
      byHorse.set(r.horseId, Number(r.score));
    }
  }
  return byHorse;
}

describe('executeClosedShows — rider flag-compatibility (Equoria-grys6)', () => {
  it('EXACT sentinel: positive-flag rider horse scores the flag-attributable amount above the identical no-flag rider horse', async () => {
    const scores = await runScopedShow([horseFlaggedWithRider.id, horseNoFlagWithRider.id]);

    const flaggedScore = scores.get(horseFlaggedWithRider.id);
    const noFlagScore = scores.get(horseNoFlagWithRider.id);
    expect(flaggedScore).toBeDefined();
    expect(noFlagScore).toBeDefined();

    // C1/C2 (B5): base = 100, luck = +6%, rider bonus = 0.090, penalty = 0.
    // No-flag: 100 * (1 + 0.06 + 0.090) = 115.0 -> 115
    // Flagged (+4 net -> factor 1.08): bonus 0.090 * 1.08 = 0.0972 ->
    //   100 * (1 + 0.06 + 0.0972) = 115.72 -> 116
    // (Old contract: luck 0, then x (1 + bonus): 109 and 110.)
    expect(noFlagScore).toBe(115);
    expect(flaggedScore).toBe(116);

    // And the strict relationship — the flagged horse is strictly higher, and
    // the gap is the rider-compat term, not any base-path effect.
    expect(flaggedScore).toBeGreaterThan(noFlagScore);
  }, 60000);

  it('REGRESSION-SAFE: no-rider horses are UNAFFECTED by flags (flagged == no-flag)', async () => {
    const scores = await runScopedShow([horseFlaggedNoRider.id, horseNoFlagNoRider.id]);

    const flaggedNoRider = scores.get(horseFlaggedNoRider.id);
    const noFlagNoRider = scores.get(horseNoFlagNoRider.id);
    expect(flaggedNoRider).toBeDefined();
    expect(noFlagNoRider).toBeDefined();

    // With NO rider, computeRiderModifiers returns 0/0; the compat guard only
    // runs when assignment?.rider is present, so flags never touch the score.
    // base 100, luck +6% (C1, B5), no rider -> 106 exactly for BOTH (old: luck 0 -> 100).
    expect(noFlagNoRider).toBe(106);
    expect(flaggedNoRider).toBe(106);
    expect(flaggedNoRider).toBe(noFlagNoRider);
  }, 60000);
});
