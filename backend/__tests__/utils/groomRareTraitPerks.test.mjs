/**
 * groomRareTraitPerks — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Targets applyRareTraitBoosterEffects — the only exported pure function that
 * doesn't require DB access.  All branches exercised via plain-object groomData.
 *
 * Branch map:
 *   groomPerks empty                    → no iterations, return unchanged chance
 *   perkDef undefined (bad key)         → no match, skip
 *   perkDef.targetTrait !== trait       → no match, skip
 *   baseChance = 0                      → base bonus skipped
 *   baseChance > 0                      → base bonus applied
 *   conditionCount < 2                  → stacked bonus skipped
 *   conditionCount >= 2                 → stacked bonus applied
 *   !perkData.revealed + not-yet-2 triggers → revealed stays false
 *   !perkData.revealed + 2+ triggers    → revealed flipped to true
 *   perkData.revealed = true already    → re-reveal block skipped
 *   modifiedChance > 1.0                → capped at 1.0
 *   revealCondition 'after_2_successful_triggers'   → triggerCount >= 2
 *   revealCondition 'lineage_analysis_or_2_triggers' → same logic
 *   catch path                          → fallback object returned
 *
 * DB-requiring functions (assignRareTraitBoosterPerks, getRevealedPerks) and
 * the private evaluatePerkEligibility are out of scope.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  applyRareTraitBoosterEffects,
  assignRareTraitBoosterPerks,
  getRevealedPerks,
  RARE_TRAIT_BOOSTER_PERKS,
} from '../../utils/groomRareTraitPerks.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

// Convenience: build groomData with a specific perk pre-installed
function groomWith(perkKey, perkOverrides = {}) {
  return {
    id: 1,
    rareTraitPerks: {
      [perkKey]: {
        ...RARE_TRAIT_BOOSTER_PERKS[perkKey],
        triggerCount: 0,
        revealed: false,
        ...perkOverrides,
      },
    },
  };
}

// phoenix-born-booster targets 'phoenix-born' (after_2_successful_triggers)
const PHOENIX_PERK = 'phoenix-born-booster';
const PHOENIX_TRAIT = 'phoenix-born';

// fey-touched targets 'fey-kissed' (lineage_analysis_or_2_triggers)
const FEY_PERK = 'fey-touched';
const FEY_TRAIT = 'fey-kissed';

describe('applyRareTraitBoosterEffects', () => {
  // ── groomPerks is empty (no rareTraitPerks) ──────────────────────────────

  it('returns original chance unchanged when groomData has no rareTraitPerks', () => {
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, { id: 1 });
    expect(result.modifiedChance).toBe(0.1);
    expect(result.appliedPerks).toEqual([]);
    expect(result.perkBonus).toBe(0);
  });

  it('returns original chance unchanged when rareTraitPerks is empty object', () => {
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, { id: 1, rareTraitPerks: {} });
    expect(result.modifiedChance).toBe(0.1);
  });

  // ── perk key doesn't exist in RARE_TRAIT_BOOSTER_PERKS ───────────────────

  it('skips perks with unrecognised key (perkDef undefined)', () => {
    const groomData = { id: 1, rareTraitPerks: { 'mystery-perk': { triggerCount: 0, revealed: false } } };
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData);
    expect(result.appliedPerks).toEqual([]);
    expect(result.modifiedChance).toBe(0.1);
  });

  // ── perkDef exists but targetTrait doesn't match ─────────────────────────

  it('skips perk when trait name does not match perkDef.targetTrait', () => {
    const groomData = groomWith(PHOENIX_PERK);
    const result = applyRareTraitBoosterEffects('iron-willed', 0.1, groomData);
    expect(result.appliedPerks).toEqual([]);
    expect(result.modifiedChance).toBe(0.1);
  });

  // ── trait name normalisation ──────────────────────────────────────────────

  it('normalises trait name (uppercase + spaces → lowercase with hyphens)', () => {
    const groomData = groomWith(PHOENIX_PERK);
    // 'Phoenix Born' should normalise to 'phoenix-born'
    const result = applyRareTraitBoosterEffects('Phoenix Born', 0.1, groomData);
    expect(result.appliedPerks.length).toBeGreaterThan(0);
  });

  // ── baseChance = 0 → base bonus skipped ──────────────────────────────────

  it('does not add base bonus when baseChance is 0', () => {
    const groomData = groomWith(PHOENIX_PERK);
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0, groomData);
    const baseBonus = result.appliedPerks.find(p => p.type === 'base_bonus');
    expect(baseBonus).toBeUndefined();
  });

  // ── baseChance > 0 → base bonus applied ──────────────────────────────────

  it('adds base bonus when baseChance > 0', () => {
    const groomData = groomWith(PHOENIX_PERK);
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData);
    const baseBonus = result.appliedPerks.find(p => p.type === 'base_bonus');
    expect(baseBonus).toBeDefined();
    expect(baseBonus.bonus).toBe(RARE_TRAIT_BOOSTER_PERKS[PHOENIX_PERK].baseBonus);
    expect(result.modifiedChance).toBeCloseTo(0.1 + RARE_TRAIT_BOOSTER_PERKS[PHOENIX_PERK].baseBonus);
  });

  // ── conditionCount < 2 → stacked bonus skipped ───────────────────────────

  it('does not add stacked bonus when fewer than 2 conditions are truthy', () => {
    const groomData = groomWith(PHOENIX_PERK);
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData, { a: true });
    const stackedBonus = result.appliedPerks.find(p => p.type === 'stacked_bonus');
    expect(stackedBonus).toBeUndefined();
  });

  it('does not add stacked bonus with zero conditions', () => {
    const groomData = groomWith(PHOENIX_PERK);
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData, {});
    const stackedBonus = result.appliedPerks.find(p => p.type === 'stacked_bonus');
    expect(stackedBonus).toBeUndefined();
  });

  // ── conditionCount >= 2 → stacked bonus applied ──────────────────────────

  it('adds stacked bonus when 2 truthy conditions are present', () => {
    const groomData = groomWith(PHOENIX_PERK);
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData, { adversity: true, recovery: true });
    const stackedBonus = result.appliedPerks.find(p => p.type === 'stacked_bonus');
    expect(stackedBonus).toBeDefined();
    expect(stackedBonus.bonus).toBe(RARE_TRAIT_BOOSTER_PERKS[PHOENIX_PERK].stackedBonus);
  });

  it('counts only truthy values toward conditionCount (falsy values ignored)', () => {
    const groomData = groomWith(PHOENIX_PERK);
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData, { a: true, b: false, c: true });
    const stackedBonus = result.appliedPerks.find(p => p.type === 'stacked_bonus');
    expect(stackedBonus).toBeDefined(); // 2 truthy out of 3 → stacked
  });

  // ── perk reveal — triggerCount < 2, revealed stays false ─────────────────

  it('does not reveal perk when triggerCount has not yet reached 2 (after_2_successful_triggers)', () => {
    const groomData = groomWith(PHOENIX_PERK, { triggerCount: 0, revealed: false });
    applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData);
    // triggerCount was 0, now 1 after this call → still not revealed
    expect(groomData.rareTraitPerks[PHOENIX_PERK].revealed).toBe(false);
  });

  // ── perk reveal — triggerCount reaches 2 → revealed flipped to true ──────

  it('reveals perk when triggerCount reaches 2 (after_2_successful_triggers)', () => {
    const groomData = groomWith(PHOENIX_PERK, { triggerCount: 1, revealed: false });
    applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData);
    // triggerCount was 1, incremented to 2 inside → shouldRevealPerk returns true
    expect(groomData.rareTraitPerks[PHOENIX_PERK].revealed).toBe(true);
  });

  // ── perk already revealed → re-reveal block skipped ──────────────────────

  it('does not re-process reveal when perk is already revealed', () => {
    const groomData = groomWith(PHOENIX_PERK, { triggerCount: 5, revealed: true });
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData);
    // Still applies bonuses, but revelation block is skipped
    expect(result.appliedPerks.length).toBeGreaterThan(0);
    expect(groomData.rareTraitPerks[PHOENIX_PERK].revealed).toBe(true);
  });

  // ── revealCondition: 'lineage_analysis_or_2_triggers' (fey-touched perk) ─

  it('reveals fey-touched perk (lineage_analysis_or_2_triggers) when triggerCount reaches 2', () => {
    const groomData = groomWith(FEY_PERK, { triggerCount: 1, revealed: false });
    applyRareTraitBoosterEffects(FEY_TRAIT, 0.05, groomData);
    expect(groomData.rareTraitPerks[FEY_PERK].revealed).toBe(true);
  });

  it('does not reveal fey-touched perk when triggerCount is still 0', () => {
    const groomData = groomWith(FEY_PERK, { triggerCount: 0, revealed: false });
    applyRareTraitBoosterEffects(FEY_TRAIT, 0.05, groomData);
    expect(groomData.rareTraitPerks[FEY_PERK].revealed).toBe(false);
  });

  // ── modifiedChance capped at 1.0 ─────────────────────────────────────────

  it('caps modifiedChance at 1.0 when base + bonuses would exceed 100%', () => {
    const groomData = groomWith(PHOENIX_PERK, { triggerCount: 5, revealed: true });
    const result = applyRareTraitBoosterEffects(
      PHOENIX_TRAIT,
      0.9,
      groomData,
      { a: true, b: true }, // stacked bonus also applied
    );
    expect(result.modifiedChance).toBeLessThanOrEqual(1.0);
  });

  // ─── assignRareTraitBoosterPerks — covers loop + evaluatePerkEligibility + catch ─────

  describe('assignRareTraitBoosterPerks() — covers loop, evaluatePerkEligibility, catch path', () => {
    // Prisma 6 PrismaClientKnownRequestError (P2025) doesn't match Jest's .toThrow() matcher,
    // so we use explicit try/catch to assert the function rejects.

    it('rejects when groom ID does not exist (covers loop + evaluatePerkEligibility + catch)', async () => {
      const groomData = {
        experience: 999,
        personality: { tags: ['intuitive', 'patient'] },
        bonusTraitMap: { 'phoenix-born': 1, 'shadow-follower': 1 },
      };
      let thrown = false;
      try {
        await assignRareTraitBoosterPerks(-1, groomData);
      } catch {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });

    it('exercises any-with-3-rare-bonuses branch (experience >= 12, bonusTraitMap empty)', async () => {
      const groomData = {
        experience: 999,
        personality: { tags: [] },
        bonusTraitMap: {},
      };
      let thrown = false;
      try {
        await assignRareTraitBoosterPerks(-1, groomData);
      } catch {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });

    it('exercises low-experience early-return in evaluatePerkEligibility', async () => {
      const groomData = {
        experience: 0,
        personality: { tags: [] },
        bonusTraitMap: {},
      };
      let thrown = false;
      try {
        await assignRareTraitBoosterPerks(-1, groomData);
      } catch {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });

    it('rejects when groomData is null — covers catch + re-throw (lines 155–157)', async () => {
      // TypeError from null.experience is caught, logged, and re-thrown
      await expect(assignRareTraitBoosterPerks(-1, null)).rejects.toThrow();
    });

    it('hits isEligible=true block (lines 135-142) when tags match phoenix-born-booster', async () => {
      // phoenix-born-booster requiredTags: ['mindful','guardian'], requiredExperience: 5
      // With experience=10 and matching tags, evaluatePerkEligibility returns true → lines 135-142 execute
      // DB update for id=-1 then throws P2025 (as expected)
      const groomData = {
        experience: 10,
        personality: { tags: ['mindful', 'guardian'] },
        bonusTraitMap: {},
      };
      let thrown = false;
      try {
        await assignRareTraitBoosterPerks(-1, groomData);
      } catch {
        thrown = true;
      }
      expect(thrown).toBe(true);
    });
  });

  // ─── getRevealedPerks — not-found path (lines 295-334) ───────────────────────

  describe('getRevealedPerks() — non-existent groom returns empty array', () => {
    it('returns [] when groom ID -1 does not exist in DB', async () => {
      const result = await getRevealedPerks(-1);
      expect(result).toEqual([]);
    });

    it('returns [] consistently on repeated calls for non-existent groom', async () => {
      const r1 = await getRevealedPerks(-1);
      const r2 = await getRevealedPerks(-2);
      expect(r1).toEqual([]);
      expect(r2).toEqual([]);
    });
  });
  // ── catch path → fallback object ─────────────────────────────────────────

  it('returns fallback {originalChance, modifiedChance, appliedPerks:[], perkBonus:0} on error', () => {
    const evil = {
      get rareTraitPerks() {
        throw new Error('property bomb');
      },
    };
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.2, evil);
    expect(result).toEqual({
      originalChance: 0.2,
      modifiedChance: 0.2,
      appliedPerks: [],
      perkBonus: 0,
    });
  });

  // ── return shape ──────────────────────────────────────────────────────────

  it('always returns an object with originalChance, modifiedChance, appliedPerks, perkBonus', () => {
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, { id: 1, rareTraitPerks: {} });
    expect(result).toHaveProperty('originalChance', 0.1);
    expect(result).toHaveProperty('modifiedChance');
    expect(result).toHaveProperty('appliedPerks');
    expect(result).toHaveProperty('perkBonus');
  });

  it('perkBonus equals modifiedChance minus originalChance', () => {
    const groomData = groomWith(PHOENIX_PERK, { triggerCount: 5, revealed: true });
    const result = applyRareTraitBoosterEffects(PHOENIX_TRAIT, 0.1, groomData);
    expect(result.perkBonus).toBeCloseTo(result.modifiedChance - result.originalChance, 10);
  });

  // ── shouldRevealPerk — default: case (line 295) ───────────────────────────────
  // RARE_TRAIT_BOOSTER_PERKS is a non-frozen exported const object; property
  // mutation in beforeAll/afterAll is safe and isolated to this describe block.

  describe('shouldRevealPerk — default revealCondition (line 295)', () => {
    const SYNTHETIC_KEY = 'test-unknown-reveal-perk-jkht';
    const SYNTHETIC_TRAIT = 'test-unknown-trait-jkht';

    beforeAll(() => {
      RARE_TRAIT_BOOSTER_PERKS[SYNTHETIC_KEY] = {
        name: 'Test Unknown Reveal Perk',
        description: 'Synthetic perk for branch coverage',
        targetTrait: SYNTHETIC_TRAIT,
        baseBonus: 0.05,
        stackedBonus: 0.02,
        requiredTags: [],
        requiredExperience: 0,
        revealCondition: 'unrecognised_condition',
      };
    });

    afterAll(() => {
      delete RARE_TRAIT_BOOSTER_PERKS[SYNTHETIC_KEY];
    });

    it('default: case returns revealed=true when triggerCount reaches 2', () => {
      const groomData = {
        id: 1,
        rareTraitPerks: {
          [SYNTHETIC_KEY]: {
            ...RARE_TRAIT_BOOSTER_PERKS[SYNTHETIC_KEY],
            triggerCount: 1,
            revealed: false,
          },
        },
      };
      applyRareTraitBoosterEffects(SYNTHETIC_TRAIT, 0.1, groomData);
      // triggerCount 1 → incremented to 2 → default: 2 >= 2 → true → revealed flips
      expect(groomData.rareTraitPerks[SYNTHETIC_KEY].revealed).toBe(true);
    });

    it('default: case returns revealed=false when triggerCount has not reached 2', () => {
      const groomData = {
        id: 1,
        rareTraitPerks: {
          [SYNTHETIC_KEY]: {
            ...RARE_TRAIT_BOOSTER_PERKS[SYNTHETIC_KEY],
            triggerCount: 0,
            revealed: false,
          },
        },
      };
      applyRareTraitBoosterEffects(SYNTHETIC_TRAIT, 0.1, groomData);
      // triggerCount 0 → incremented to 1 → default: 1 >= 2 → false → revealed stays false
      expect(groomData.rareTraitPerks[SYNTHETIC_KEY].revealed).toBe(false);
    });
  });

  // ── getRevealedPerks — body when groom exists with revealed perks (lines 315-334) ─

  describe('getRevealedPerks — groom with revealed perks (lines 315-334)', () => {
    let groomId;

    beforeAll(async () => {
      const groom = await prisma.groom.create({
        data: {
          name: `TestFixture-RareTraitPerks-${Date.now()}`,
          speciality: 'Foal Care',
          personality: 'patient',
          rareTraitPerks: {
            'phoenix-born-booster': {
              ...RARE_TRAIT_BOOSTER_PERKS['phoenix-born-booster'],
              triggerCount: 5,
              revealed: true,
              assignedAt: new Date().toISOString(),
            },
            'twin-harmonizer': {
              ...RARE_TRAIT_BOOSTER_PERKS['twin-harmonizer'],
              triggerCount: 1,
              revealed: false,
              assignedAt: new Date().toISOString(),
            },
          },
        },
      });
      groomId = groom.id;
    }, 30000);

    afterAll(async () => {
      await prisma.groom.delete({ where: { id: groomId } }).catch(() => {});
    }, 30000);

    it('returns non-empty array with perk shape when groom has revealed perks', async () => {
      const result = await getRevealedPerks(groomId);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('key', 'phoenix-born-booster');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('targetTrait');
      expect(result[0]).toHaveProperty('triggerCount');
    });

    it('excludes unrevealed perks — false branch of if(perkData.revealed)', async () => {
      const result = await getRevealedPerks(groomId);
      // twin-harmonizer has revealed:false — must NOT appear in results
      const keys = result.map(p => p.key);
      expect(keys).not.toContain('twin-harmonizer');
    });

    it('returns [] from catch block when groomId type is invalid (triggers Prisma validation error)', async () => {
      // Passing a non-integer string where Int is expected → PrismaClientValidationError → catch
      const result = await getRevealedPerks('not-a-valid-integer');
      expect(result).toEqual([]);
    });
  });

  // ── assignRareTraitBoosterPerks — success return path (line 154) ─────────────

  describe('assignRareTraitBoosterPerks — success return (line 154)', () => {
    let groomId;

    beforeAll(async () => {
      const groom = await prisma.groom.create({
        data: {
          name: `TestFixture-AssignPerks-${Date.now()}`,
          speciality: 'Foal Care',
          personality: 'patient',
        },
      });
      groomId = groom.id;
    }, 30000);

    afterAll(async () => {
      await prisma.groom.delete({ where: { id: groomId } }).catch(() => {});
    }, 30000);

    it('returns assignedPerks object (line 154) for eligible groom in DB', async () => {
      // phoenix-born-booster: requiredTags ['mindful','guardian'], requiredExperience 5
      const groomData = {
        experience: 10,
        personality: { tags: ['mindful', 'guardian'] },
        bonusTraitMap: {},
      };
      const result = await assignRareTraitBoosterPerks(groomId, groomData);
      expect(typeof result).toBe('object');
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('phoenix-born-booster');
    });

    it('covers lines 174 (personality?.tags || []) and 179 (bonusTraitMap || {})', async () => {
      // No personality and no bonusTraitMap → both || fallbacks fire.
      // experience:15 passes all 4 perks' experience gates.
      // fey-touched has any-with-3-rare-bonuses → reaches line 179.
      const groomData = { experience: 15 };
      const result = await assignRareTraitBoosterPerks(groomId, groomData);
      // No tags → no perk eligibility → empty assignedPerks
      expect(typeof result).toBe('object');
    });
  });
});
