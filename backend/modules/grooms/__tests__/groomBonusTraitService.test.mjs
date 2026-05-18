/**
 * groomBonusTraitService — branch-coverage tests (Equoria-jkht)
 *
 * Covers all major uncovered branches in services/groomBonusTraitService.mjs:
 *   - validateBonusTraits: pure sync — null, >3 traits, empty name, NaN, range errors, valid paths
 *   - getBonusTraits: not-found throw (line 89), null bonusTraitMap || {} (line 96), map returned
 *   - assignBonusTraits: validation-fail throw (lines 43-45), success path (lines 48-63)
 *   - checkBonusEligibility: horse not found (line 173), interactions.length===0 FALSE arm
 *     (line 219), interactions.length>0 TRUE arm, bond-too-low (line 240), coverage-too-low
 *     (line 242), assignment.endDate null → new Date() (FALSE arm line 197),
 *     assignment.endDate set → new Date(endDate) (TRUE arm line 197), eligible=true (line 243)
 *   - getUserGroomsWithBonusTraits: null bonusTraitMap || {} (line 283), set bonusTraitMap,
 *     hasBonusTraits true/false (line 284)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  validateBonusTraits,
  getBonusTraits,
  assignBonusTraits,
  checkBonusEligibility,
  getUserGroomsWithBonusTraits,
} from '../../../services/groomBonusTraitService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const RUN_ID = Date.now();
const PREFIX = `GBTSvc${RUN_ID}`;

let user, horse;
let groomWithMap; // bonusTraitMap: { BraveTrait: 0.15 }
let groomNullMap; // no bonusTraitMap → null in DB → covers || {} fallback AND bond-too-low
let groomCovLow; // has interaction (bond=65) but NO assignment → coverage=0 → coverage-too-low
let groomEndNull; // assignment with no endDate (null) → covers FALSE branch of endDate ternary
let groomEndSet; // assignment with endDate explicitly set → covers TRUE branch of endDate ternary
let groomForAssign; // isolated groom used only for assignBonusTraits mutation tests

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `${PREFIX}@test.invalid`,
      username: PREFIX.slice(0, 50),
      password: 'x',
      firstName: 'GBTS',
      lastName: 'Test',
    },
  });

  // Horse born 30 days ago → milestoneWindowDays = Math.min(30, 30) = 30
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${PREFIX}_horse`,
      sex: 'Filly',
      dateOfBirth: thirtyDaysAgo,
      age: 0,
      userId: user.id,
    },
  });

  groomWithMap = await prisma.groom.create({
    data: {
      name: `${PREFIX}_withmap`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
      bonusTraitMap: { BraveTrait: 0.15 },
    },
  });

  groomNullMap = await prisma.groom.create({
    data: {
      name: `${PREFIX}_nullmap`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
      // bonusTraitMap omitted → null in DB
    },
  });
  // groomNullMap has NO assignments, NO interactions:
  //   → interactions.length === 0 (FALSE arm of ternary) → totalBondingChange = 0
  //   → bond = 50 + 0 = 50 < 60 → not eligible, reason = 'Bond score too low'

  groomCovLow = await prisma.groom.create({
    data: {
      name: `${PREFIX}_covlow`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
  // groomCovLow has an interaction (bond=65>=60) but NO assignment (coverage=0<0.75)
  //   → interactions.length > 0 (TRUE arm) → reduce fires
  //   → eligible=false, reason = 'Insufficient assignment coverage'
  await prisma.groomInteraction.create({
    data: {
      foalId: horse.id,
      groomId: groomCovLow.id,
      interactionType: 'grooming',
      duration: 30,
      bondingChange: 15,
      timestamp: oneDayAgo,
    },
  });

  groomEndNull = await prisma.groom.create({
    data: {
      name: `${PREFIX}_endnull`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
  // groomEndNull: assignment with NO endDate (null) → covers FALSE arm of `assignment.endDate ? ...`
  //   Coverage: 29/30 = 0.967 >= 0.75 ✓;  Bond: 50+10=60>=60 ✓ → eligible=true
  await prisma.groomAssignment.create({
    data: {
      foalId: horse.id,
      groomId: groomEndNull.id,
      startDate: twentyNineDaysAgo,
      isActive: true,
      // endDate not provided → null
    },
  });
  await prisma.groomInteraction.create({
    data: {
      foalId: horse.id,
      groomId: groomEndNull.id,
      interactionType: 'grooming',
      duration: 30,
      bondingChange: 10,
      timestamp: oneDayAgo,
    },
  });

  groomEndSet = await prisma.groom.create({
    data: {
      name: `${PREFIX}_endset`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
  // groomEndSet: assignment with endDate explicitly set → covers TRUE arm of `assignment.endDate ? ...`
  //   Coverage: 29/30 = 0.967 >= 0.75 ✓;  Bond: 50+10=60>=60 ✓ → eligible=true
  await prisma.groomAssignment.create({
    data: {
      foalId: horse.id,
      groomId: groomEndSet.id,
      startDate: twentyNineDaysAgo,
      endDate: new Date(), // explicitly set — triggers `new Date(assignment.endDate)` arm
      isActive: false,
    },
  });
  await prisma.groomInteraction.create({
    data: {
      foalId: horse.id,
      groomId: groomEndSet.id,
      interactionType: 'grooming',
      duration: 30,
      bondingChange: 10,
      timestamp: oneDayAgo,
    },
  });

  groomForAssign = await prisma.groom.create({
    data: {
      name: `${PREFIX}_assign`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
      // no bonusTraitMap — will be set by assignBonusTraits test
    },
  });
}, 60000);

afterAll(async () => {
  await prisma.groomInteraction.deleteMany({ where: { foalId: horse.id } }).catch(() => {});
  await prisma.groomAssignment.deleteMany({ where: { foalId: horse.id } }).catch(() => {});
  await prisma.groom.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 60000);

// ── validateBonusTraits (pure sync — no DB) ───────────────────────────────────

describe('validateBonusTraits — null/non-object input (line 114)', () => {
  it('returns valid=false with object-error for null input', () => {
    const result = validateBonusTraits(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Bonus traits must be an object');
  });

  it('returns valid=false with object-error for string input (typeof !== object)', () => {
    const result = validateBonusTraits('not-an-object');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Bonus traits must be an object');
  });

  it('returns valid=false for undefined input', () => {
    const result = validateBonusTraits(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('validateBonusTraits — max traits exceeded (line 122)', () => {
  it('returns error when 4 bonus traits given (>3 cap)', () => {
    const result = validateBonusTraits({ A: 0.1, B: 0.1, C: 0.1, D: 0.1 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Maximum'))).toBe(true);
  });
});

describe('validateBonusTraits — invalid trait name (line 129) — fires continue, skips bonus checks', () => {
  it('returns error for empty string trait name (!traitName TRUE)', () => {
    const result = validateBonusTraits({ '': 0.1 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('non-empty'))).toBe(true);
  });

  it("returns error for whitespace-only trait name (traitName.trim()==='' TRUE)", () => {
    const result = validateBonusTraits({ '   ': 0.1 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('non-empty'))).toBe(true);
  });
});

describe('validateBonusTraits — non-numeric bonus (line 135) — fires continue, skips range check', () => {
  it('returns error for string bonus (typeof bonus !== "number" TRUE)', () => {
    const result = validateBonusTraits({ Brave: 'high' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must be a number'))).toBe(true);
  });

  it('returns error for NaN bonus (isNaN(bonus) TRUE — typeof is "number" but isNaN)', () => {
    const result = validateBonusTraits({ Brave: NaN });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('must be a number'))).toBe(true);
  });
});

describe('validateBonusTraits — bonus out of range (line 141) — traitName + type valid, range fails', () => {
  it('returns error for bonus < 0 (bonus<0 TRUE)', () => {
    const result = validateBonusTraits({ Brave: -0.1 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('between 0'))).toBe(true);
  });

  it('returns error for bonus > 0.3 (bonus>MAX_TRAIT_BONUS TRUE)', () => {
    const result = validateBonusTraits({ Brave: 0.5 });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('between 0'))).toBe(true);
  });
});

describe('validateBonusTraits — valid inputs (lines 148-151) — errors.length===0 TRUE', () => {
  it('returns valid=true for single trait at boundary bonus (0.3)', () => {
    const result = validateBonusTraits({ Brave: 0.3 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=true for exactly 3 traits (boundary check, not >3)', () => {
    const result = validateBonusTraits({ A: 0.1, B: 0.2, C: 0.3 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=true for empty object (0 traits — loop never runs, no errors)', () => {
    const result = validateBonusTraits({});
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ── getBonusTraits (lines 77-103) ─────────────────────────────────────────────

describe('getBonusTraits — groom not found throws (lines 88-90)', () => {
  it('throws "Groom with ID ... not found" for non-existent groomId', async () => {
    await expect(getBonusTraits(999999999)).rejects.toThrow('Groom with ID 999999999 not found');
  });
});

describe('getBonusTraits — null bonusTraitMap || {} fallback (line 96)', () => {
  it('returns empty object {} when groom bonusTraitMap is null', async () => {
    const result = await getBonusTraits(groomNullMap.id);
    expect(result).toEqual({});
  });
});

describe('getBonusTraits — bonusTraitMap returned (line 96)', () => {
  it('returns the stored bonusTraitMap when set on the groom', async () => {
    const result = await getBonusTraits(groomWithMap.id);
    expect(result).toMatchObject({ BraveTrait: 0.15 });
  });
});

// ── assignBonusTraits (lines 35-70) ──────────────────────────────────────────

describe('assignBonusTraits — validation-fail throw (lines 43-45)', () => {
  it('throws with "Bonus trait constraints violated" when bonusTraits is null', async () => {
    await expect(assignBonusTraits(groomWithMap.id, null)).rejects.toThrow('Bonus trait constraints violated');
  });

  it('throws when >3 traits given (validation.valid=false before any DB call)', async () => {
    await expect(assignBonusTraits(groomWithMap.id, { A: 0.1, B: 0.1, C: 0.1, D: 0.1 })).rejects.toThrow(
      'Bonus trait constraints violated',
    );
  });
});

describe('assignBonusTraits — success path (lines 48-63)', () => {
  it('updates groom bonusTraitMap and returns { success: true, groomId, groomName, bonusTraits }', async () => {
    const newTraits = { GroomAssignTrait: 0.2 };
    const result = await assignBonusTraits(groomForAssign.id, newTraits);

    expect(result.success).toBe(true);
    expect(result.groomId).toBe(groomForAssign.id);
    expect(typeof result.groomName).toBe('string');
    expect(result.bonusTraits).toMatchObject(newTraits);
  });
});

// ── checkBonusEligibility (lines 160-251) ────────────────────────────────────

describe('checkBonusEligibility — horse not found throws (line 173)', () => {
  it('throws "Horse with ID ... not found" for non-existent horseId', async () => {
    await expect(checkBonusEligibility(999999999, groomNullMap.id)).rejects.toThrow(
      'Horse with ID 999999999 not found',
    );
  });
});

describe('checkBonusEligibility — interactions.length===0 FALSE arm (line 219)', () => {
  it('sets totalBondingChange=0 when no interactions exist (bond=50 < 60 → not eligible)', async () => {
    // groomNullMap: no interactions, no assignment
    const result = await checkBonusEligibility(horse.id, groomNullMap.id);
    expect(result.eligible).toBe(false);
    expect(result.interactionCount).toBe(0);
    expect(result.averageBondScore).toBe(50); // 50 + 0
    expect(result.reason).toBe('Bond score too low');
  });
});

describe('checkBonusEligibility — interactions.length>0 TRUE arm + coverage-too-low (lines 219, 242)', () => {
  it('uses reduce path when interactions exist; coverage=0 → Insufficient assignment coverage', async () => {
    // groomCovLow: bondingChange=15 → bond=65>=60; no assignment → coverage=0
    const result = await checkBonusEligibility(horse.id, groomCovLow.id);
    expect(result.eligible).toBe(false);
    expect(result.interactionCount).toBeGreaterThan(0);
    expect(result.averageBondScore).toBe(65); // 50 + 15
    expect(result.coveragePercentage).toBe(0);
    expect(result.reason).toBe('Insufficient assignment coverage');
  });
});

describe('checkBonusEligibility — assignment.endDate null → FALSE arm of endDate ternary (line 197)', () => {
  it('uses new Date() as endDate when endDate is null; eligible=true', async () => {
    // groomEndNull: assignment.endDate = null → `new Date()` branch fires
    // Coverage: 29/30 = 0.967; Bond: 60; → eligible=true
    const result = await checkBonusEligibility(horse.id, groomEndNull.id);
    expect(result.eligible).toBe(true);
    expect(result.totalCoverageDays).toBeGreaterThanOrEqual(28);
    expect(result.averageBondScore).toBe(60);
    expect(result.reason).toBe('Eligible for bonus');
  });
});

describe('checkBonusEligibility — assignment.endDate set → TRUE arm of endDate ternary (line 197)', () => {
  it('uses new Date(assignment.endDate) when endDate is set; eligible=true', async () => {
    // groomEndSet: assignment.endDate = new Date() → `new Date(assignment.endDate)` branch fires
    // Coverage: 29/30 = 0.967; Bond: 60; → eligible=true
    const result = await checkBonusEligibility(horse.id, groomEndSet.id);
    expect(result.eligible).toBe(true);
    expect(result.totalCoverageDays).toBeGreaterThanOrEqual(28);
    expect(result.averageBondScore).toBe(60);
    expect(result.reason).toBe('Eligible for bonus');
  });
});

// ── getUserGroomsWithBonusTraits (lines 258-292) ──────────────────────────────

describe('getUserGroomsWithBonusTraits — null bonusTraitMap || {} + hasBonusTraits branches (lines 283-284)', () => {
  it('maps null bonusTraitMap to bonusTraits={} and hasBonusTraits=false', async () => {
    const grooms = await getUserGroomsWithBonusTraits(user.id);
    const found = grooms.find(g => g.id === groomNullMap.id);
    expect(found).toBeDefined();
    expect(found.bonusTraits).toEqual({});
    expect(found.hasBonusTraits).toBe(false);
  });

  it('maps set bonusTraitMap to bonusTraits={...} and hasBonusTraits=true', async () => {
    const grooms = await getUserGroomsWithBonusTraits(user.id);
    const found = grooms.find(g => g.id === groomWithMap.id);
    expect(found).toBeDefined();
    expect(Object.keys(found.bonusTraits).length).toBeGreaterThan(0);
    expect(found.hasBonusTraits).toBe(true);
  });

  it('returns all grooms for the user sorted by name', async () => {
    const grooms = await getUserGroomsWithBonusTraits(user.id);
    expect(Array.isArray(grooms)).toBe(true);
    // All 6 fixtures belong to user
    expect(grooms.length).toBeGreaterThanOrEqual(6);
    // Verify sorted ascending by name
    const names = grooms.map(g => g.name);
    expect(names).toEqual([...names].sort());
  });
});
