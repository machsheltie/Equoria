/**
 * traitHistoryService service unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests exported async functions with real DB fixtures.
 * Horse with no trait history exercises the zero-data code paths.
 * logTraitAssignment is tested by creating a real TraitHistoryLog entry.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { logTraitAssignment } from '../services/traitHistoryService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A cleanup that silently swallows its
// delete error leaks fixtures into the canonical DB; the tracker re-throws so the
// suite goes red at the source instead of tripping a downstream sentinel later.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let user;
let horse;
// Ids of the per-test "fresh" horses created in the summary/breeding suites below,
// cleaned up scoped + fail-loud in this top-level tracker instead of a swallowed
// per-test finally delete (Equoria-1ohys).
const freshHorseIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `traithist-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `traithist${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'TraitHist',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-TraitHistHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys). FK order: traitHistoryLog (children
  // of all horses) -> fresh per-test horses -> main horse -> user (Horse.userId
  // Restrict). The traitHistoryLog delete is scoped to the main horse + any fresh
  // horse ids collected during the run.
  cleanup.add(
    () =>
      prisma.traitHistoryLog.deleteMany({
        where: { horseId: { in: [horse.id, ...freshHorseIds] } },
      }),
    'traitHistoryLog',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: freshHorseIds } } }), 'freshHorses');
  cleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── logTraitAssignment ─────────────────────────────────────────────────────────

describe('logTraitAssignment', () => {
  it('throws for non-existent horse', async () => {
    await expect(
      logTraitAssignment({
        horseId: 999999999,
        traitName: 'Brave',
        sourceType: 'groom',
        sourceId: 1,
        influenceScore: 5,
        isEpigenetic: true,
      }),
    ).rejects.toThrow();
  });

  it('creates a trait history log entry for a real horse', async () => {
    const entry = await logTraitAssignment({
      horseId: horse.id,
      traitName: 'Curious',
      sourceType: 'milestone',
      sourceId: 1,
      influenceScore: 3,
      isEpigenetic: false,
    });

    expect(entry).toBeDefined();
    expect(entry.horseId).toBe(horse.id);
    expect(entry.traitName).toBe('Curious');
    expect(entry.sourceType).toBe('milestone');
    expect(typeof entry.ageInDays).toBe('number');
  });
});
