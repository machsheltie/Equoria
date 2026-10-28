import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getAssignedHandler } from '../services/groomHandlerService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// Owner ruling 2026-10-28 q154 (Equoria-4fa7s): a show handler is the horse's
// groom and any groom may handle in any class. Old contract: the handler bonus
// tables, calculateHandlerBonus and validateHandlerEligibility judged a groom per
// conformation class and priced per-discipline handler bonuses; they were
// removed with that ruling, and so were their tests here.

// Owner ruling 2026-10-21 (Equoria-dea06): grooms are fixed NPCs and earn no
// XP. Old contract: calculateGroomExperienceGain priced a handler's XP by
// placement/field/skill and recordHandlerPerformance wrote it to the groom.
// Both functions were removed with that ruling, and so were their tests here.

// ── DB-fixture branch coverage (Equoria-rr7) ─────────────────────────────────
// Covers getAssignedHandler.

describe('groomHandlerService — DB fixture branch coverage (Equoria-rr7)', () => {
  let ghsUser;
  let ghsGroom;
  let ghsHorse;
  const ghsCleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    ghsUser = await prisma.user.create({
      data: {
        email: `ghs-${ts}-${rand()}@test.com`,
        username: `ghs${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GHS',
        lastName: 'Branch',
        money: 1000,
      },
    });

    ghsGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GHS-Groom-${ts}`,
        speciality: 'showHandling',
        personality: 'gentle',
        skillLevel: 'novice',
        isActive: true,
        userId: ghsUser.id,
      },
    });

    ghsHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GHS-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: ghsUser.id,
      },
    });

    await prisma.groomAssignment.create({
      data: {
        groomId: ghsGroom.id,
        foalId: ghsHorse.id,
        userId: ghsUser.id,
        isActive: true,
      },
    });
  }, 30000);

  afterAll(async () => {
    // Equoria-1ohys: fail-loud, scoped cleanup. Each delete is scoped (by
    // userId or TestFixture- name-prefix) and registered on the tracker so a
    // cleanup failure REDS the suite instead of leaking rows into the canonical
    // DB (CLAUDE.md §2). FK order: groomAssignment (child) before groom/horse
    // before user (Horse.userId / Groom.userId Restrict).
    ghsCleanup.add(() => prisma.groomAssignment.deleteMany({ where: { userId: ghsUser?.id } }), 'assignments');
    ghsCleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GHS-' } } }), 'grooms');
    ghsCleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GHS-' } } }), 'horses');
    ghsCleanup.add(() => prisma.user.delete({ where: { id: ghsUser?.id } }), 'ghsUser');
    await ghsCleanup.run();
  }, 30000);

  it('getAssignedHandler: no assignment → hasHandler:false (lines 201-208)', async () => {
    const result = await getAssignedHandler(999999999, ghsUser.id);
    expect(result.hasHandler).toBe(false);
    expect(result.assignment).toBeNull();
    expect(result.groom).toBeNull();
  });

  it('getAssignedHandler: assignment found → hasHandler:true with groom (lines 210-215)', async () => {
    const result = await getAssignedHandler(ghsHorse.id, ghsUser.id);
    expect(result.hasHandler).toBe(true);
    expect(result.groom.name).toBe(ghsGroom.name);
    expect(result.horse).toBeDefined();
  });
});
