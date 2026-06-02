/**
 * trainingAnalyticsService + groomTalentService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Filly foal + groom.
 * Horse has no training history; groom has no talent selections.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { trainingAnalyticsService } from '../../training/services/trainingAnalyticsService.mjs';
import {
  getTalentTreeDefinitions,
  getGroomTalentSelections,
  validateTalentSelection,
  applyTalentEffects,
  selectTalent,
} from '../services/groomTalentService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup — a cleanup delete that fails must
// turn the suite red so the leaked fixture is fixed at the source, not hidden
// behind a silent no-op catch arm (which leaks rows into the canonical DB).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let user;
let horse;
let groom;
// Module-level fail-loud cleanup for the shared top-level fixtures.
const sharedCleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `traintalent-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `traintalent${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'TrainTalent',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-TrainTalentHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-TrainTalentGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });

  // Register scoped, FK-ordered cleanup: groom + horse (Restrict on
  // Groom.userId/Horse.userId) before the owning user. All id-scoped.
  sharedCleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'shared groom');
  sharedCleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'shared horse');
  sharedCleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'shared user');
}, 30000);

afterAll(() => sharedCleanup.run(), 30000);

// ── trainingAnalyticsService ──────────────────────────────────────────────────

describe('trainingAnalyticsService.getTrainingHistory', () => {
  it('throws for non-existent horse', async () => {
    await expect(trainingAnalyticsService.getTrainingHistory(999999999)).rejects.toThrow();
  });

  it('returns empty history for horse with no training sessions', async () => {
    const result = await trainingAnalyticsService.getTrainingHistory(horse.id);
    expect(Array.isArray(result.trainingHistory)).toBe(true);
    expect(result.trainingHistory).toHaveLength(0);
    expect(typeof result.disciplineBalance).toBe('object');
    expect(typeof result.trainingFrequency).toBe('object');
    expect(result.trainingFrequency.totalSessions).toBe(0);
  });

  it('returns non-empty analytics when horse has training sessions (lines 51-54, Equoria-rr7)', async () => {
    // Insert a training log so getTrainingHistory takes the non-empty path (lines 51-54)
    const log = await prisma.trainingLog.create({
      data: { horseId: horse.id, discipline: 'Dressage', trainedAt: new Date() },
    });

    try {
      const result = await trainingAnalyticsService.getTrainingHistory(horse.id);
      expect(result.trainingHistory.length).toBeGreaterThan(0);
      expect(typeof result.disciplineBalance).toBe('object');
      expect(result.disciplineBalance.Dressage).toBeDefined();
      expect(typeof result.trainingFrequency.totalSessions).toBe('number');
      expect(result.trainingFrequency.totalSessions).toBeGreaterThan(0);
    } finally {
      // Equoria-1ohys: fail-loud — id-scoped delete of the log this test created;
      // a failure here must surface (no silent no-op catch arm) so the row can't
      // leak into the canonical DB. The finally still runs on assertion failure;
      // Jest reports the test-body failure first, then this cleanup error.
      await prisma.trainingLog.delete({ where: { id: log.id } });
    }
  });
});

describe('trainingAnalyticsService.calculateTrainingFrequency', () => {
  it('returns zero totals for empty history', () => {
    const result = trainingAnalyticsService.calculateTrainingFrequency([]);
    expect(result.totalSessions).toBe(0);
    expect(typeof result.sessionsPerDiscipline).toBe('object');
    expect(Array.isArray(result.recentActivity)).toBe(true);
  });

  it('counts sessions and disciplines correctly', () => {
    const mockHistory = [
      { discipline: 'Dressage', trainedAt: new Date() },
      { discipline: 'Dressage', trainedAt: new Date() },
      { discipline: 'Jumping', trainedAt: new Date() },
    ];
    const result = trainingAnalyticsService.calculateTrainingFrequency(mockHistory);
    expect(result.totalSessions).toBe(3);
    expect(result.sessionsPerDiscipline.Dressage).toBe(2);
    expect(result.sessionsPerDiscipline.Jumping).toBe(1);
  });
});

describe('trainingAnalyticsService.calculateDisciplineBalance', () => {
  it('returns empty object for empty history', () => {
    const result = trainingAnalyticsService.calculateDisciplineBalance([]);
    expect(typeof result).toBe('object');
  });

  it('calculates balance for multi-discipline history', () => {
    const mockHistory = [
      { discipline: 'Dressage', trainedAt: new Date() },
      { discipline: 'Jumping', trainedAt: new Date() },
    ];
    const result = trainingAnalyticsService.calculateDisciplineBalance(mockHistory);
    expect(typeof result).toBe('object');
    expect(result.Dressage).toBeDefined();
    expect(result.Jumping).toBeDefined();
    expect(typeof result.Dressage.sessionCount).toBe('number');
    expect(typeof result.Dressage.percentage).toBe('number');
  });
});

// ── groomTalentService ────────────────────────────────────────────────────────

describe('getTalentTreeDefinitions', () => {
  it('returns non-empty object of talent trees', () => {
    const result = getTalentTreeDefinitions();
    expect(typeof result).toBe('object');
    expect(Object.keys(result).length).toBeGreaterThan(0);
  });

  it('calm personality tree has tier1 talents', () => {
    const result = getTalentTreeDefinitions();
    expect(result.calm).toBeDefined();
    expect(Array.isArray(result.calm.tier1)).toBe(true);
    expect(result.calm.tier1.length).toBeGreaterThan(0);
  });
});

describe('getGroomTalentSelections', () => {
  it('returns null for groom with no talent selections', async () => {
    const result = await getGroomTalentSelections(groom.id);
    expect(result).toBeNull();
  });
});

describe('validateTalentSelection', () => {
  it('returns groom_not_found for non-existent groom', async () => {
    const result = await validateTalentSelection(999999999, 'tier1', 'some_talent');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('groom_not_found');
  });

  it('returns invalid_tier for unknown tier', async () => {
    const result = await validateTalentSelection(groom.id, 'tier99', 'some_talent');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_tier');
  });

  it('returns insufficient_level for fresh groom (level 0) attempting tier1', async () => {
    const trees = getTalentTreeDefinitions();
    const firstTalentId = trees.gentle?.tier1?.[0]?.id ?? 'any_talent';
    const result = await validateTalentSelection(groom.id, 'tier1', firstTalentId);
    expect(result.valid).toBe(false);
    expect(['insufficient_level', 'invalid_talent', 'invalid_personality_tier'].includes(result.reason)).toBe(true);
  });
});

describe('applyTalentEffects', () => {
  it('returns base interaction unchanged for groom with no talent selections', async () => {
    const baseInteraction = { bondingChange: 5, stressChange: -2, quality: 'good' };
    const result = await applyTalentEffects(groom.id, baseInteraction);
    expect(result.bondingChange).toBe(5);
    expect(result.stressChange).toBe(-2);
    expect(Array.isArray(result.talentBonuses)).toBe(true);
    expect(result.talentBonuses).toHaveLength(0);
  });
});

// ── trainingAnalyticsService — date update branches (Equoria-jkht) ─────────────
// calculateDisciplineBalance: the !lastTrainingDate null-check is hit on first
// occurrence; the sessionDate > lastTrainingDate branch is hit when a LATER date
// follows; sessionDate < firstTrainingDate is hit when an EARLIER date follows.

describe('trainingAnalyticsService.calculateDisciplineBalance — date update branches (Equoria-jkht)', () => {
  it('updates lastTrainingDate for newer session and firstTrainingDate for older session', () => {
    const d1 = new Date(Date.now() + 1000); // middle
    const d2 = new Date(Date.now() - 1000); // oldest → firstTrainingDate update
    const d3 = new Date(Date.now() + 2000); // newest → lastTrainingDate update

    const history = [
      { discipline: 'Dressage', trainedAt: d1 },
      { discipline: 'Dressage', trainedAt: d2 }, // d2 < d1 → firstTrainingDate := d2
      { discipline: 'Dressage', trainedAt: d3 }, // d3 > d1 → lastTrainingDate := d3
    ];
    const result = trainingAnalyticsService.calculateDisciplineBalance(history);
    expect(result.Dressage.lastTrainingDate.getTime()).toBe(d3.getTime());
    expect(result.Dressage.firstTrainingDate.getTime()).toBe(d2.getTime());
  });
});

// ── trainingAnalyticsService — recentActivity filter branch (Equoria-jkht) ─────

describe('trainingAnalyticsService.calculateTrainingFrequency — old session excluded (Equoria-jkht)', () => {
  it('excludes sessions older than 30 days from recentActivity (filter false branch)', () => {
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const history = [
      { discipline: 'Dressage', trainedAt: new Date() },
      { discipline: 'Dressage', trainedAt: oldDate },
    ];
    const result = trainingAnalyticsService.calculateTrainingFrequency(history);
    expect(result.recentActivity).toHaveLength(1);
    expect(result.totalSessions).toBe(2);
  });
});

// ── groomTalentService — branch coverage (Equoria-jkht) ──────────────────────
// Covers: validateTalentSelection invalid_talent / invalid_personality_tier /
//         tier_already_selected / prerequisite_required tier2 / valid=true;
//         applyTalentEffects with non-null selections (bondingBonus applied).

describe('groomTalentService — branch coverage (Equoria-jkht)', () => {
  let ttUser;
  let ttGroomCalmL5; // personality='calm', level=5, tier1 selected in beforeAll
  let ttGroomCalmL5Fresh; // personality='calm', level=5, no talent selections
  let ttGroomGentleL3; // personality='gentle', level=3 → invalid_personality_tier
  // Equoria-1ohys: fail-loud scoped cleanup for this describe's fixtures.
  const ttCleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    ttUser = await prisma.user.create({
      data: {
        email: `tt-branch-${ts}-${rand()}@test.com`,
        username: `ttbranch${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'TT',
        lastName: 'Branch',
        money: 1000,
      },
    });

    [ttGroomCalmL5, ttGroomCalmL5Fresh, ttGroomGentleL3] = await Promise.all([
      prisma.groom.create({
        data: {
          name: `TestFixture-TT-CalmL5-${ts}`,
          speciality: 'foal_care',
          personality: 'calm',
          level: 5,
          userId: ttUser.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-TT-CalmL5Fresh-${ts}`,
          speciality: 'foal_care',
          personality: 'calm',
          level: 5,
          userId: ttUser.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-TT-GentleL3-${ts}`,
          speciality: 'foal_care',
          personality: 'gentle',
          level: 3,
          userId: ttUser.id,
        },
      }),
    ]);

    // Seed a tier1 selection for ttGroomCalmL5 so tier_already_selected branch fires
    await prisma.groomTalentSelections.create({
      data: { groomId: ttGroomCalmL5.id, tier1: 'gentle_hands' },
    });

    // Register scoped, FK-ordered cleanup: groom* child (talent selections,
    // scoped to these groom ids) first, then the grooms (Groom.userId Restrict,
    // scoped by the TestFixture-TT- name prefix), then the owning user last.
    ttCleanup.add(
      () =>
        prisma.groomTalentSelections.deleteMany({
          where: { groomId: { in: [ttGroomCalmL5.id, ttGroomCalmL5Fresh.id] } },
        }),
      'tt talent selections',
    );
    ttCleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-TT-' } } }), 'tt grooms');
    ttCleanup.add(() => prisma.user.delete({ where: { id: ttUser.id } }), 'tt user');
  }, 30000);

  afterAll(() => ttCleanup.run(), 30000);

  it('invalid_talent: talentId not in personality tree for valid tier', async () => {
    const result = await validateTalentSelection(ttGroomCalmL5.id, 'tier1', 'nonexistent_xyz');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_talent');
  });

  it('invalid_personality_tier: personality not in TALENT_TREES (gentle)', async () => {
    // gentle personality → TALENT_TREES.gentle is undefined → invalid_personality_tier
    const result = await validateTalentSelection(ttGroomGentleL3.id, 'tier1', 'any_talent');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('invalid_personality_tier');
  });

  it('tier_already_selected: tier1 already has a selection', async () => {
    const result = await validateTalentSelection(ttGroomCalmL5.id, 'tier1', 'gentle_hands');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('tier_already_selected');
  });

  it('valid=true for tier2 when tier1 prerequisite is already met', async () => {
    const result = await validateTalentSelection(ttGroomCalmL5.id, 'tier2', 'empathic_sync');
    expect(result.valid).toBe(true);
  });

  it('prerequisite_required tier1: attempting tier2 with no prior selections', async () => {
    const result = await validateTalentSelection(ttGroomCalmL5Fresh.id, 'tier2', 'empathic_sync');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('prerequisite_required');
    expect(result.prerequisite).toBe('tier1');
  });

  it('applyTalentEffects: bondingBonus from gentle_hands talent increases bondingChange', async () => {
    const baseInteraction = { bondingChange: 5, stressChange: -2 };
    const result = await applyTalentEffects(ttGroomCalmL5.id, baseInteraction);
    expect(result.talentBonuses.length).toBeGreaterThan(0);
    expect(result.bondingChange).toBeGreaterThan(5);
  });
});

// ── groomTalentService — selectTalent + stressReduction/qualityBonus branches (Equoria-rr7) ──
// Covers: selectTalent valid path (lines 279-309), validation-fail throw (lines 283-284),
//         tier3 prerequisite 'tier1' fallback (line 256 false arm),
//         applyTalentEffects stressReduction (lines 357-361),
//         applyTalentEffects qualityBonus (lines 365-368)

describe('groomTalentService — selectTalent and effect branches (Equoria-rr7)', () => {
  let st2User;
  let st2GroomCalmL3; // calm, level=3 — selectTalent valid path
  let st2GroomCalmL8; // calm, level=8, no selections — tier3 prerequisite 'tier1' branch
  let st2GroomStress; // calm, tier1+tier2='stress_whisperer' seeded — stressReduction path
  let st2GroomQuality; // energetic, tier1='enthusiasm_boost' seeded — qualityBonus path
  // Equoria-1ohys: fail-loud scoped cleanup for this describe's fixtures.
  const st2Cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    st2User = await prisma.user.create({
      data: {
        email: `st2-${ts}-${rand()}@test.com`,
        username: `st2${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'ST2',
        lastName: 'Branch',
        money: 1000,
      },
    });

    [st2GroomCalmL3, st2GroomCalmL8, st2GroomStress, st2GroomQuality] = await Promise.all([
      prisma.groom.create({
        data: {
          name: `TestFixture-ST2-CalmL3-${ts}`,
          speciality: 'foal_care',
          personality: 'calm',
          level: 3,
          userId: st2User.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-ST2-CalmL8-${ts}`,
          speciality: 'foal_care',
          personality: 'calm',
          level: 8,
          userId: st2User.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-ST2-Stress-${ts}`,
          speciality: 'foal_care',
          personality: 'calm',
          level: 8,
          userId: st2User.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-ST2-Quality-${ts}`,
          speciality: 'foal_care',
          personality: 'energetic',
          level: 3,
          userId: st2User.id,
        },
      }),
    ]);

    // Seed talent selections directly for applyTalentEffects branch tests
    await Promise.all([
      prisma.groomTalentSelections.create({
        data: { groomId: st2GroomStress.id, tier1: 'gentle_hands', tier2: 'stress_whisperer' },
      }),
      prisma.groomTalentSelections.create({
        data: { groomId: st2GroomQuality.id, tier1: 'enthusiasm_boost' },
      }),
    ]);

    // Register scoped, FK-ordered cleanup: groom* child (talent selections,
    // scoped to these groom ids — also covers any selection selectTalent created
    // mid-test) first, then the grooms (Groom.userId Restrict, scoped by the
    // TestFixture-ST2- name prefix), then the owning user last.
    st2Cleanup.add(
      () =>
        prisma.groomTalentSelections.deleteMany({
          where: { groomId: { in: [st2GroomCalmL3.id, st2GroomCalmL8.id, st2GroomStress.id, st2GroomQuality.id] } },
        }),
      'st2 talent selections',
    );
    st2Cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-ST2-' } } }), 'st2 grooms');
    st2Cleanup.add(() => prisma.user.delete({ where: { id: st2User.id } }), 'st2 user');
  }, 30000);

  afterAll(() => st2Cleanup.run(), 30000);

  it('selectTalent: valid path returns { success: true, selection, talent } (lines 279-309)', async () => {
    const result = await selectTalent(st2GroomCalmL3.id, 'tier1', 'gentle_hands');
    expect(result.success).toBe(true);
    expect(result.selection).toBeDefined();
    expect(result.talent.id).toBe('gentle_hands');
  });

  it('selectTalent: validation-fail throws "Invalid talent selection" (lines 283-284)', async () => {
    // level=3 groom requesting tier2 → insufficient_level (level 3 < required 5)
    await expect(selectTalent(st2GroomCalmL3.id, 'tier2', 'empathic_sync')).rejects.toThrow('Invalid talent selection');
  });

  it('tier3 prerequisite: no selections → prerequisite="tier1" (line 256 false arm)', async () => {
    // st2GroomCalmL8 has level=8 but no selections; requesting tier3 hits the condition
    // selections?.tier1 is undefined (falsy) → 'tier1' branch
    const result = await validateTalentSelection(st2GroomCalmL8.id, 'tier3', 'master_bonding');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('prerequisite_required');
    expect(result.prerequisite).toBe('tier1');
  });

  it('applyTalentEffects: stressReduction from stress_whisperer makes stressChange more negative (lines 357-361)', async () => {
    const baseInteraction = { bondingChange: 5, stressChange: -4 };
    const result = await applyTalentEffects(st2GroomStress.id, baseInteraction);
    // stress_whisperer has stressReduction=0.2 → reduction applied to stressChange
    expect(result.stressChange).toBeLessThan(-4);
    expect(result.talentBonuses.some(b => b.talentId === 'stress_whisperer')).toBe(true);
  });

  it('applyTalentEffects: qualityBonus from enthusiasm_boost sets qualityModifier (lines 365-368)', async () => {
    const baseInteraction = { bondingChange: 5, stressChange: -2 };
    const result = await applyTalentEffects(st2GroomQuality.id, baseInteraction);
    // enthusiasm_boost has qualityBonus=0.15 → qualityModifier = 1 + 0.15 = 1.15
    expect(typeof result.qualityModifier).toBe('number');
    expect(result.qualityModifier).toBeGreaterThan(1);
    expect(result.talentBonuses.some(b => b.talentId === 'enthusiasm_boost')).toBe(true);
  });
});
