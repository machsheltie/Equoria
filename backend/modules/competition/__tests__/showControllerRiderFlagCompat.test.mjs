/**
 * Rider flag-compatibility integration test for showController.executeClosedShows
 * (Equoria-grys6 — adjacent to simulateCompetition.mjs yzqhj.6).
 *
 * showController.executeClosedShows is the SECOND live competition scoring
 * engine (distinct from logic/simulateCompetition.mjs). yzqhj.6 wired
 * `calculateRiderFlagCompatibility` into simulateCompetition but NOT here, so a
 * hired rider's effectiveness was NOT modulated by the horse's behavioral
 * epigenetic flags in player-created shows. grys6 closes that gap by applying
 * the SAME conservative (+-2%/flag, +-10% cap), rider-only modifier in
 * executeClosedShows before applyRiderModifiers.
 *
 * This is a real-DB test (CLAUDE.md "no mocks ever") with TestFixture-scoped
 * cleanup. The ONLY mock is Math.random — pinned to 0.5 so the +-9% luck term
 * (luck = (random - 0.5) * 18) is exactly 0. With luck pinned, the per-entry
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
import { executeClosedShows } from '../shows/showController.mjs';
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

// Stats chosen so base = (speed+stamina+agility+precision+boldness)/5 = 100.
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
  // Pin luck to its midpoint: luck = (0.5 - 0.5) * 18 = 0. Scores deterministic.
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
  const show = await prisma.show.create({
    data: {
      name: `TestFixture-${TAG}-Show-${randomBytes(4).toString('hex')}`,
      discipline: 'Dressage',
      entryFee: 0,
      levelMin: 1,
      levelMax: 999,
      prize: 0,
      runDate: closeDate,
      status: 'open',
      openDate,
      closeDate,
      createdByUserId: user.id,
    },
  });
  createdShowIds.push(show.id);

  await prisma.showEntry.createMany({
    data: horseIds.map(horseId => ({ showId: show.id, horseId, userId: user.id, feePaid: 0 })),
  });

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

    // base = 100, luck = 0 -> subtotal = 100. Rider bonus = 0.090, penalty = 0.
    // No-flag: applyRiderModifiers(100, 0.090, 0) = 100 * 1.090 = 109.0 -> round 109
    // Flagged (+4 net -> factor 1.08): bonus 0.090 * 1.08 = 0.0972 ->
    //   100 * 1.0972 = 109.72 -> round 110
    expect(noFlagScore).toBe(109);
    expect(flaggedScore).toBe(110);

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
    // base 100, luck 0, no rider -> 100 exactly for BOTH.
    expect(noFlagNoRider).toBe(100);
    expect(flaggedNoRider).toBe(100);
    expect(flaggedNoRider).toBe(noFlagNoRider);
  }, 60000);
});
