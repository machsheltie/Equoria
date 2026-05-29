/**
 * Sentinel test (Equoria-9o63c): executeEnhancedCompetition fires a DISTINCT
 * 'competition_placement' Notification on ANY top-3 finish, even when the
 * horse gains NO stat that run.
 *
 * This is the sibling of Equoria-pi4nk (enterAndRunShow in
 * competitionController.mjs). The SECOND competition-execution path,
 * logic/enhancedCompetitionSimulation.mjs#executeEnhancedCompetition (the
 * sanctioned nightly `executeClosedShows` cron executor), previously fired
 * its only competition notification inside `if (statGain)`, so a top-3 horse
 * with no stat gain produced ZERO notifications here too.
 *
 * Why this is sentinel-positive and RNG-independent:
 *   - A single valid horse entered into a show always places '1st' (it's the
 *     only scorer), so the placement is deterministic.
 *   - statGain is a 3-10% RNG roll (calculateStatGain, default Math.random),
 *     so on the vast majority of runs a 1st-place single entry gains NO stat.
 *   - BEFORE the fix, the only competition notification was inside
 *     `if (statGain)`, so this placing-but-no-stat-gain horse produced ZERO
 *     notifications. Run this test against the pre-fix logic and the
 *     'competition_placement' assertion fails (no such row, no such type).
 *   - AFTER the fix, a 'competition_placement' row is written on every top-3
 *     finish regardless of statGain — RNG-independent, so the assertion is
 *     deterministic.
 *
 * Real DB, no mocks, scoped TestFixture- fixtures, scoped cleanup.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { executeEnhancedCompetition } from '../../../logic/enhancedCompetitionSimulation.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const PREFIX = 'TestFixture-EnhPlaceNotif-';
const rand = () => randomBytes(4).toString('hex');

let user;
let horse;
let show;

beforeAll(async () => {
  const tag = rand();

  user = await prisma.user.create({
    data: {
      email: `enhplacenotif-${tag}@test.com`,
      username: `enhplacenotif${tag}`,
      password: 'irrelevant-hash',
      firstName: 'EnhPlace',
      lastName: 'Notif',
      money: 10000,
    },
  });

  // Single valid Racing horse — it's the only scorer, so it deterministically
  // places 1st. Racing weights speed+stamina+intelligence.
  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}Horse-${tag}`,
      sex: 'Colt',
      dateOfBirth: new Date('2019-01-01'),
      age: 35,
      userId: user.id,
      healthStatus: 'Good',
      speed: 80,
      stamina: 80,
      intelligence: 80,
    },
  });

  show = await prisma.show.create({
    data: {
      name: `${PREFIX}Show-${tag}`,
      discipline: 'Racing',
      levelMin: 1,
      levelMax: 20,
      entryFee: 50,
      prize: 500,
      runDate: new Date(),
      showType: 'ridden',
      status: 'open',
    },
  });
}, 60000);

afterAll(async () => {
  // Scoped cleanup — only this suite's rows (never bare deleteMany).
  if (user) {
    await prisma.notification.deleteMany({ where: { userId: user.id } }).catch(() => {});
    await prisma.xpEvent.deleteMany({ where: { userId: user.id } }).catch(() => {});
  }
  if (horse) {
    await prisma.competitionResult.deleteMany({ where: { horseId: horse.id } }).catch(() => {});
    await prisma.horseXpEvent.deleteMany({ where: { horseId: horse.id } }).catch(() => {});
  }
  if (show) {
    await prisma.show.delete({ where: { id: show.id } }).catch(() => {});
  }
  if (horse) {
    await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  }
  if (user) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}, 30000);

describe('SENTINEL: executeEnhancedCompetition → competition_placement notification on top-3 (Equoria-9o63c)', () => {
  it('creates a competition_placement notification on a 1st-place finish regardless of stat gain', async () => {
    const result = await executeEnhancedCompetition(show, [{ horse, user }]);

    // Sanity: the sole valid horse placed (deterministically 1st).
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].placement).toBe(1);

    // Core sentinel: a DISTINCT competition_placement row exists.
    // This fails against the pre-fix logic (no such type was ever written
    // unless statGain was non-null — and statGain is a 3-10% RNG roll).
    const placementRows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'competition_placement' },
    });

    expect(placementRows.length).toBeGreaterThanOrEqual(1);

    const row = placementRows[0];
    expect(row.payload).toHaveProperty('horseName', horse.name);
    expect(row.payload).toHaveProperty('placement', '1st');
    expect(row.payload).toHaveProperty('discipline', 'Racing');
    expect(row.payload).toHaveProperty('showName', show.name);
    expect(row.payload).toHaveProperty('prizeWon');
  }, 30000);

  it('does not break the stat_gain path: when a stat is gained, a competition_stat_gain row co-exists with placement', async () => {
    // Read whatever was written by the run above. statGain is RNG-driven, so
    // a competition_stat_gain row MAY or MAY NOT exist on any given run. We
    // assert the invariant that holds either way:
    //   - placement notification ALWAYS exists (proven above)
    //   - IF a stat_gain notification exists, its payload is well-formed AND
    //     it co-exists with the placement notification (i.e. the placement fix
    //     did not replace or suppress the stat-gain path).
    const statGainRows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'competition_stat_gain' },
    });
    const placementRows = await prisma.notification.findMany({
      where: { userId: user.id, type: 'competition_placement' },
    });

    // The placement path must still be intact.
    expect(placementRows.length).toBeGreaterThanOrEqual(1);

    if (statGainRows.length > 0) {
      const sg = statGainRows[0];
      expect(sg.payload).toHaveProperty('horseName', horse.name);
      expect(sg.payload).toHaveProperty('stat');
      expect(sg.payload).toHaveProperty('amount');
      expect(sg.payload).toHaveProperty('placement', '1st');
      expect(sg.payload).toHaveProperty('discipline', 'Racing');
      // Both events fire independently — neither suppresses the other.
      expect(placementRows.length).toBeGreaterThanOrEqual(1);
    }
  }, 30000);
});
