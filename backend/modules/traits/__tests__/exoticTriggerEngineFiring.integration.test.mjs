/**
 * exoticTriggerEngine — FIRING integration tests (Equoria-oey96.9)
 *
 * Sentinel-positive coverage for the five EXOTIC traits whose evaluators
 * previously read NONEXISTENT relations (horse.dailyCareLogs / horse.groomTaskLogs
 * / horse.siblings) or the nonexistent flag.flagName property, and therefore
 * could NEVER fire:
 *   - Shadow-Follower  (dailyCareLogs)
 *   - Ghostwalker      (dailyCareLogs + flag.flagName)
 *   - Soulbonded       (dailyCareLogs.map → throw → catch → false)
 *   - Fey-Kissed       (dailyCareLogs + groomTaskLogs)
 *   - Dreamtwin        (horse.siblings + dailyCareLogs + groomTaskLogs + flag.flagName)
 *
 * Each trait has a POSITIVE arm (seed real qualifying data → trait FIRES) and a
 * NEGATIVE arm (one condition unmet → trait does NOT fire). Before the fix the
 * positive arms fail (the evaluators read undefined relations → never trigger).
 *
 * The 3 "unrepresentable" conditions were reworked to snapshot form per the
 * ratified DECISION 2026-07-06 (NO new schema):
 *   - Soulbonded.perfectCareHistory  → horse.daysGroomedInARow
 *   - Fey-Kissed.perfectGrooming     → foal-stage groomInteractions quality
 *   - Dreamtwin.raisedTogether       → groomInteractions count parity
 *
 * Real DB, no mocks. All fixtures use the TestFixture- prefix. Cleanup is scoped
 * and fail-loud (Equoria-0y9f5).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { evaluateExoticUnlocks } from '../../../utils/ultraRareTriggerEngine.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const cleanup = createCleanupTracker();
const DAY = 24 * 60 * 60 * 1000;

let user;
let groom;
let groom2;

// Shadow-Follower
let shadowHorse;
let shadowNegHorse;
// Ghostwalker
let ghostHorse;
let ghostNegHorse;
// Soulbonded
let soulHorse;
let soulNegHorse;
// Fey-Kissed
let sireUR;
let damUR;
let damPlain;
let feyHorse;
let feyNegHorse;
// Dreamtwin
let twinSire;
let twinDam;
let twinA;
let twinB;
let dreamNegHorse;

async function addFoalGrooms(horseId, groomId, count, baseTs, qualityScore) {
  for (let i = 0; i < count; i++) {
    await prisma.groomInteraction.create({
      data: {
        foalId: horseId,
        groomId,
        interactionType: 'grooming',
        duration: 30,
        taskType: 'grooming',
        qualityScore,
        timestamp: new Date(baseTs + i * DAY),
      },
    });
  }
}

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  user = await prisma.user.create({
    data: {
      email: `exfire-${ts}-${rand()}@test.com`,
      username: `exfire${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'ExFire',
      lastName: 'Tester',
      money: 1000,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-ExFire-Groom-${ts}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
  groom2 = await prisma.groom.create({
    data: {
      name: `TestFixture-ExFire-Groom2-${ts}`,
      speciality: 'foal_care',
      personality: 'strict',
      userId: user.id,
    },
  });

  // ── Shadow-Follower (POSITIVE): 2 failed socialization milestones + late bond ─
  shadowHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-Shadow-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(ts - 900 * DAY),
      age: 2,
      userId: user.id,
    },
  });
  for (const day of [40, 80]) {
    await prisma.milestoneTraitLog.create({
      data: {
        horseId: shadowHorse.id,
        milestoneType: 'socialization',
        score: 20, // < 50 → failed/missed socialization
        ageInDays: day,
      },
    });
  }
  // late bond: early (age<730) low, late (age>=730) high — via traitHistoryLogs
  await prisma.traitHistoryLog.create({
    data: {
      horseId: shadowHorse.id,
      traitName: 'insecure',
      sourceType: 'milestone',
      bondScore: 20,
      ageInDays: 200,
    },
  });
  await prisma.traitHistoryLog.create({
    data: {
      horseId: shadowHorse.id,
      traitName: 'attached',
      sourceType: 'groom',
      bondScore: 80,
      ageInDays: 800,
    },
  });

  // ── Shadow-Follower (NEGATIVE): only 1 failed socialization (needs 2) ────────
  shadowNegHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-ShadowNeg-${ts}`,
      sex: 'Colt',
      dateOfBirth: new Date(ts - 900 * DAY),
      age: 2,
      userId: user.id,
    },
  });
  await prisma.milestoneTraitLog.create({
    data: {
      horseId: shadowNegHorse.id,
      milestoneType: 'socialization',
      score: 20,
      ageInDays: 40,
    },
  });
  await prisma.traitHistoryLog.create({
    data: {
      horseId: shadowNegHorse.id,
      traitName: 'insecure',
      sourceType: 'milestone',
      bondScore: 20,
      ageInDays: 200,
    },
  });
  await prisma.traitHistoryLog.create({
    data: {
      horseId: shadowNegHorse.id,
      traitName: 'attached',
      sourceType: 'groom',
      bondScore: 80,
      ageInDays: 800,
    },
  });

  // ── Ghostwalker (POSITIVE): low bond throughout youth + resilient flag +
  //    emotional detachment ─────────────────────────────────────────────────
  ghostHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-Ghost-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(ts - 1200 * DAY),
      age: 3,
      userId: user.id,
      bondScore: 10, // snapshot < 30
      epigeneticFlags: ['resilient'],
    },
  });
  await prisma.traitHistoryLog.create({
    data: {
      horseId: ghostHorse.id,
      traitName: 'wary',
      sourceType: 'milestone',
      bondScore: 15, // youth (age < 1095) max bond < 30
      ageInDays: 200,
    },
  });
  await prisma.milestoneTraitLog.create({
    data: {
      horseId: ghostHorse.id,
      milestoneType: 'trust_handling',
      score: 30,
      reasoning: 'horse remained withdrawn and isolated during handling',
      ageInDays: 300,
    },
  });

  // ── Ghostwalker (NEGATIVE): no resilient flag ───────────────────────────────
  ghostNegHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-GhostNeg-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(ts - 1200 * DAY),
      age: 3,
      userId: user.id,
      bondScore: 10,
      epigeneticFlags: [], // no resilient/survivor flag
    },
  });
  await prisma.traitHistoryLog.create({
    data: {
      horseId: ghostNegHorse.id,
      traitName: 'wary',
      sourceType: 'milestone',
      bondScore: 15,
      ageInDays: 200,
    },
  });
  await prisma.milestoneTraitLog.create({
    data: {
      horseId: ghostNegHorse.id,
      milestoneType: 'trust_handling',
      score: 30,
      reasoning: 'horse remained withdrawn and isolated during handling',
      ageInDays: 300,
    },
  });

  // ── Soulbonded (POSITIVE): same groom all 4 milestones + >90 bond each +
  //    perfect care streak (snapshot) ─────────────────────────────────────────
  soulHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-Soul-${ts}`,
      sex: 'Stallion',
      dateOfBirth: new Date(ts - 1000 * DAY),
      age: 2,
      userId: user.id,
      daysGroomedInARow: 10, // >= 7 → perfectCareHistory snapshot TRUE
    },
  });
  for (let i = 0; i < 4; i++) {
    await prisma.milestoneTraitLog.create({
      data: {
        horseId: soulHorse.id,
        groomId: groom.id, // same groom for all 4
        milestoneType: 'socialization',
        score: 5,
        bondScore: 95, // > 90 each
        ageInDays: i * 20 + 10,
      },
    });
  }

  // ── Soulbonded (NEGATIVE): same groom + high bond BUT no care streak ─────────
  soulNegHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-SoulNeg-${ts}`,
      sex: 'Stallion',
      dateOfBirth: new Date(ts - 1000 * DAY),
      age: 2,
      userId: user.id,
      daysGroomedInARow: 0, // < 7 → perfectCareHistory snapshot FALSE
    },
  });
  for (let i = 0; i < 4; i++) {
    await prisma.milestoneTraitLog.create({
      data: {
        horseId: soulNegHorse.id,
        groomId: groom.id,
        milestoneType: 'socialization',
        score: 5,
        bondScore: 95,
        ageInDays: i * 20 + 10,
      },
    });
  }

  // ── Fey-Kissed (POSITIVE): both parents ultra-rare + perfect foal grooming ──
  sireUR = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-SireUR-${ts}`,
      sex: 'Stallion',
      dateOfBirth: new Date(ts - 5 * 365 * DAY),
      age: 5,
      userId: user.id,
      ultraRareTraits: { ultraRare: [{ name: 'Phoenix-Born' }], exotic: [] },
    },
  });
  damUR = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-DamUR-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(ts - 4 * 365 * DAY),
      age: 4,
      userId: user.id,
      ultraRareTraits: { ultraRare: [{ name: 'Iron-Willed' }], exotic: [] },
    },
  });
  damPlain = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-DamPlain-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(ts - 4 * 365 * DAY),
      age: 4,
      userId: user.id,
      ultraRareTraits: { ultraRare: [], exotic: [] },
    },
  });
  feyHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-Fey-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(ts - 30 * DAY), // young foal
      age: 0,
      userId: user.id,
      sireId: sireUR.id,
      damId: damUR.id,
    },
  });
  await addFoalGrooms(feyHorse.id, groom.id, 12, ts - 28 * DAY, 0.9); // perfect foal grooming

  // ── Fey-Kissed (NEGATIVE): only ONE parent ultra-rare ───────────────────────
  feyNegHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-FeyNeg-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(ts - 30 * DAY),
      age: 0,
      userId: user.id,
      sireId: sireUR.id,
      damId: damPlain.id, // dam NOT ultra-rare
    },
  });
  await addFoalGrooms(feyNegHorse.id, groom.id, 12, ts - 28 * DAY, 0.9);

  // ── Dreamtwin (POSITIVE): full-sibling twin, same day, same groom, matching flags ─
  twinSire = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-TwinSire-${ts}`,
      sex: 'Stallion',
      dateOfBirth: new Date(ts - 5 * 365 * DAY),
      age: 5,
      userId: user.id,
    },
  });
  twinDam = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-TwinDam-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(ts - 4 * 365 * DAY),
      age: 4,
      userId: user.id,
    },
  });
  const twinDob = new Date(ts - 200 * DAY);
  twinA = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-TwinA-${ts}`,
      sex: 'Filly',
      dateOfBirth: twinDob,
      age: 0,
      userId: user.id,
      sireId: twinSire.id,
      damId: twinDam.id,
      epigeneticFlags: ['brave', 'affectionate'],
    },
  });
  twinB = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-TwinB-${ts}`,
      sex: 'Colt',
      dateOfBirth: twinDob, // same day
      age: 0,
      userId: user.id,
      sireId: twinSire.id,
      damId: twinDam.id,
      epigeneticFlags: ['brave', 'affectionate', 'bold'], // superset of A's flags
    },
  });
  // same single groom for both twins, similar interaction counts (raised together)
  await addFoalGrooms(twinA.id, groom.id, 8, ts - 150 * DAY, 0.8);
  await addFoalGrooms(twinB.id, groom.id, 8, ts - 150 * DAY, 0.8);

  // ── Dreamtwin (NEGATIVE): no full-sibling twin. Has a sire but no recorded
  //    dam, so the "shares BOTH sireId AND damId" full-sibling query returns
  //    nothing → twinBirth FALSE. ───────────────────────────────────────────
  dreamNegHorse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-ExFire-DreamNeg-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(ts - 200 * DAY),
      age: 0,
      userId: user.id,
      sireId: twinSire.id,
      damId: null, // no dam → no full-sibling twin possible
      epigeneticFlags: ['brave'],
    },
  });

  // Cleanup: children (with sire/dam FKs) before parents. Interactions +
  // milestone + trait logs cascade with their horse. Then grooms, then user.
  const childIds = [
    shadowHorse.id,
    shadowNegHorse.id,
    ghostHorse.id,
    ghostNegHorse.id,
    soulHorse.id,
    soulNegHorse.id,
    feyHorse.id,
    feyNegHorse.id,
    twinA.id,
    twinB.id,
    dreamNegHorse.id,
  ];
  for (const id of childIds) {
    cleanup.add(() => prisma.horse.delete({ where: { id } }), `child-horse:${id}`);
  }
  const parentIds = [sireUR.id, damUR.id, damPlain.id, twinSire.id, twinDam.id];
  for (const id of parentIds) {
    cleanup.add(() => prisma.horse.delete({ where: { id } }), `parent-horse:${id}`);
  }
  cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.groom.delete({ where: { id: groom2.id } }), 'groom2');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 90000);

afterAll(() => cleanup.run(), 30000);

describe('Shadow-Follower — fires on real qualifying data (Equoria-oey96.9)', () => {
  it('FIRES: 2 failed socialization milestones + late bond formation', async () => {
    const result = await evaluateExoticUnlocks(shadowHorse.id);
    expect(result.map(t => t.name)).toContain('Shadow-Follower');
  }, 20000);

  it('does NOT fire with only 1 missed socialization (negative arm)', async () => {
    const result = await evaluateExoticUnlocks(shadowNegHorse.id);
    expect(result.map(t => t.name)).not.toContain('Shadow-Follower');
  }, 20000);
});

describe('Ghostwalker — fires on real qualifying data (Equoria-oey96.9)', () => {
  it('FIRES: low youth bond + resilient flag (String[]) + emotional detachment', async () => {
    const result = await evaluateExoticUnlocks(ghostHorse.id);
    expect(result.map(t => t.name)).toContain('Ghostwalker');
  }, 20000);

  it('does NOT fire without the resilient flag (negative arm)', async () => {
    const result = await evaluateExoticUnlocks(ghostNegHorse.id);
    expect(result.map(t => t.name)).not.toContain('Ghostwalker');
  }, 20000);
});

describe('Soulbonded — fires on real qualifying data (Equoria-oey96.9)', () => {
  it('FIRES: same groom all 4 milestones + >90 bond each + care streak snapshot', async () => {
    const result = await evaluateExoticUnlocks(soulHorse.id);
    expect(result.map(t => t.name)).toContain('Soulbonded');
  }, 20000);

  it('does NOT fire without the perfect-care streak snapshot (negative arm)', async () => {
    const result = await evaluateExoticUnlocks(soulNegHorse.id);
    expect(result.map(t => t.name)).not.toContain('Soulbonded');
  }, 20000);
});

describe('Fey-Kissed — fires on real qualifying data (Equoria-oey96.9)', () => {
  it('FIRES: both parents ultra-rare + perfect foal grooming (snapshot)', async () => {
    const result = await evaluateExoticUnlocks(feyHorse.id);
    expect(result.map(t => t.name)).toContain('Fey-Kissed');
  }, 20000);

  it('does NOT fire when only one parent is ultra-rare (negative arm)', async () => {
    const result = await evaluateExoticUnlocks(feyNegHorse.id);
    expect(result.map(t => t.name)).not.toContain('Fey-Kissed');
  }, 20000);
});

describe('Dreamtwin — fires on real qualifying data (Equoria-oey96.9)', () => {
  it('FIRES: same-day full-sibling twin + same groom + matching flags (String[])', async () => {
    const result = await evaluateExoticUnlocks(twinA.id);
    expect(result.map(t => t.name)).toContain('Dreamtwin');
  }, 20000);

  it('does NOT fire without a twin sibling (negative arm)', async () => {
    const result = await evaluateExoticUnlocks(dreamNegHorse.id);
    expect(result.map(t => t.name)).not.toContain('Dreamtwin');
  }, 20000);
});
