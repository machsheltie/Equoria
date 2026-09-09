/**
 * starterHorseBreedFailClosed.integration.test.mjs (Equoria-2wjp7 / Equoria-qsp1b.1)
 *
 * INVARIANT: onboarding must never create a horse without a breed.
 *
 * Equoria-b9zgr made the registration starter horse resolve the canonical
 * default breed, but left the write FAIL-OPEN: the breedId was spread in
 * conditionally —
 *
 *     ...(defaultBreedId !== null && { breedId: defaultBreedId }),
 *
 * — so when the default breed row could not be resolved, the horse was created
 * ANYWAY with a NULL breedId. That is the source of the breedless-mare
 * population (Equoria-qsp1b.1): the breeding fix now correctly refuses
 * conception when the dam has no breed, nothing filters a breedless mare out of
 * the breeding selector, and no surface can set a breed — so the player meets a
 * dead end. Deleting the rows without closing this path just lets them return.
 *
 * Fail-closed contract: if the starter breed cannot be resolved, NO horse is
 * created. Registration itself still succeeds (starter-horse creation has always
 * been non-fatal); the onboarding breed-selection step (advanceOnboarding, which
 * already validates the breed and refuses a missing one) creates the horse with
 * the player's chosen breed via its no-existing-starter-horse branch.
 *
 * NO MOCKS. The breed lookup runs for real against the real database — the test
 * asks for a breed NAME that genuinely does not exist in the `breeds` table, so
 * `prisma.breed.findUnique` really returns null. That is why
 * createStarterHorseForNewUser takes an explicit `breedName`: it is the seam that
 * makes the fail-closed path provable without mocking an Equoria-owned Prisma
 * path (CLAUDE.md forbids that).
 *
 * Scoped cleanup — deletes only the ids this suite created, in dependency order.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createStarterHorseForNewUser } from '../services/onboardingService.mjs';
import { DEFAULT_TEMPERAMENT_BREED } from '../../horses/index.mjs';

const SERVICE_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../services/onboardingService.mjs'),
  'utf8',
);

function uniq(prefix) {
  return `${prefix}${randomBytes(6).toString('hex')}`;
}

describe('INTEGRATION: onboarding starter horse is fail-closed on breed (Equoria-2wjp7)', () => {
  const createdUserIds = [];
  const cleanup = createCleanupTracker();

  // Dependency order: horses owned by the fixture users first (Horse.userId is
  // ON DELETE RESTRICT — the user delete would refuse otherwise), then the
  // user-owned children, then the users. Scoped to this suite's ids only.
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: createdUserIds } } }), 'horse');
  cleanup.add(() => prisma.refreshToken.deleteMany({ where: { userId: { in: createdUserIds } } }), 'refreshToken');
  cleanup.add(() => prisma.auditLog.deleteMany({ where: { userId: { in: createdUserIds } } }), 'auditLog');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'user');

  async function makeFixtureUser() {
    const username = uniq('TestFixture-BreedFailClosed-');
    const user = await prisma.user.create({
      data: {
        username,
        email: `${username}@test.com`,
        // Fixture only — never authenticated with. Registration is covered by
        // starterHorseBreedId.integration.test.mjs; this suite drives the
        // service directly so the breed-resolution branch is reachable.
        password: 'not-a-real-hash-fixture-only',
        firstName: 'Breed',
        lastName: 'FailClosed',
      },
      select: { id: true, username: true },
    });
    createdUserIds.push(user.id);
    return user;
  }

  let missingBreedName;

  beforeAll(async () => {
    // A breed name that genuinely does not exist. Asserted, not assumed.
    missingBreedName = `__equoria_absent_breed_${randomBytes(8).toString('hex')}__`;
    const collision = await prisma.breed.findUnique({
      where: { name: missingBreedName },
      select: { id: true },
    });
    expect(collision).toBeNull();
  }, 60000);

  afterAll(() => cleanup.run(), 60000);

  it('creates NO horse when the starter breed cannot be resolved', async () => {
    const user = await makeFixtureUser();

    await createStarterHorseForNewUser(user, { breedName: missingBreedName });

    const horses = await prisma.horse.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, breedId: true },
    });

    // SENTINEL: pre-fix this array held one horse with breedId === null.
    expect(horses).toEqual([]);
  }, 60000);

  it('still creates the starter horse with a breedId when the breed resolves', async () => {
    const defaultBreed = await prisma.breed.findUnique({
      where: { name: DEFAULT_TEMPERAMENT_BREED },
      select: { id: true },
    });
    // Guard: a missing canonical default breed is a seeding problem, not the
    // bug under test — say so rather than passing vacuously.
    expect(defaultBreed).not.toBeNull();

    const user = await makeFixtureUser();

    await createStarterHorseForNewUser(user);

    const horses = await prisma.horse.findMany({
      where: { userId: user.id },
      select: { id: true, breedId: true },
    });
    expect(horses).toHaveLength(1);
    expect(horses[0].breedId).toBe(defaultBreed.id);
  }, 60000);

  it('has no fail-open conditional breedId spread left in the create call', () => {
    // Equoria team lesson: prove the guard, not the intention. This is the exact
    // defect shape that produced the breedless population — a conditional spread
    // that silently omits breedId instead of refusing to write.
    expect(SERVICE_SRC).not.toMatch(/\.\.\.\(\s*defaultBreedId\s*!==\s*null\s*&&/);
    expect(SERVICE_SRC).not.toMatch(/\.\.\.\(\s*\w*[Bb]reedId\s*(!==|!=)\s*null\s*&&\s*\{\s*breedId/);
  });
});
