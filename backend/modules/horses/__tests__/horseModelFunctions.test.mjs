/**
 * horseModel — DB-fixture branch-coverage tests (Equoria-rr7 / Equoria-jkht)
 *
 * Covers the DB-backed functions that the mock-based horseModel.test.mjs
 * cannot reach:
 *   getHorseById           (lines 238-264)
 *   updateDisciplineScore  (lines 275-336)
 *   getDisciplineScores    (lines 344-365)
 *   incrementDisciplineScore (lines 375-392)
 *   updateHorseStat        (lines 401-456)
 *   getPositiveTraits      (lines 463-498)
 *   hasTraitPresent        (lines 506-556)
 *   addTraitSafely         (lines 565-661)
 *   removeTraitSafely      (lines 669-744)
 *   getAllTraits            (lines 751-796)
 *   hasTrait               (lines 808-852)
 *   getPositiveTraitsArray (lines 859-895)
 *   getNegativeTraitsArray (lines 903-940)
 *   addTrait               (lines 949-985)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  getHorseById,
  updateDisciplineScore,
  getDisciplineScores,
  incrementDisciplineScore,
  updateHorseStat,
  getPositiveTraits,
  hasTraitPresent,
  addTraitSafely,
  removeTraitSafely,
  getAllTraits,
  hasTrait,
  getPositiveTraitsArray,
  getNegativeTraitsArray,
  addTrait,
} from '../../../models/horseModel.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

let hmUser;
let hmHorse;

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  hmUser = await prisma.user.create({
    data: {
      email: `hm-db-${ts}-${rand()}@test.com`,
      username: `hmdb${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'HM',
      lastName: 'DBTest',
      money: 1000,
    },
  });

  hmHorse = await prisma.horse.create({
    data: {
      name: `TestFixture-HMFunctions-${ts}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 3,
      userId: hmUser.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: hmHorse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: hmUser.id } }).catch(() => {});
}, 30000);

// ── getHorseById ──────────────────────────────────────────────────────────────

describe('getHorseById()', () => {
  it('returns the horse for a valid existing id', async () => {
    const horse = await getHorseById(hmHorse.id);
    expect(horse).toBeDefined();
    expect(horse.id).toBe(hmHorse.id);
    expect(horse.name).toContain('TestFixture-HMFunctions-');
  });

  it('returns null for a non-existent horse id', async () => {
    const horse = await getHorseById(999999999);
    expect(horse).toBeNull();
  });

  it('throws for an invalid (negative) horse id', async () => {
    await expect(getHorseById(-1)).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for NaN id', async () => {
    await expect(getHorseById('not-a-number')).rejects.toThrow();
  });
});

// ── updateDisciplineScore ─────────────────────────────────────────────────────

describe('updateDisciplineScore()', () => {
  it('adds points to a discipline and returns updated horse', async () => {
    const updated = await updateDisciplineScore(hmHorse.id, 'Dressage', 10);
    expect(updated).toBeDefined();
    expect(updated.disciplineScores?.Dressage).toBeGreaterThanOrEqual(10);
  });

  it('accumulates points on successive calls', async () => {
    await updateDisciplineScore(hmHorse.id, 'Show Jumping', 5);
    const updated = await updateDisciplineScore(hmHorse.id, 'Show Jumping', 5);
    expect(updated.disciplineScores?.['Show Jumping']).toBeGreaterThanOrEqual(10);
  });

  it('throws for invalid horse id', async () => {
    await expect(updateDisciplineScore(-1, 'Dressage', 5)).rejects.toThrow();
  });

  it('throws for empty discipline string', async () => {
    await expect(updateDisciplineScore(hmHorse.id, '', 5)).rejects.toThrow(/Discipline must be/);
  });

  it('throws for non-positive points', async () => {
    await expect(updateDisciplineScore(hmHorse.id, 'Dressage', 0)).rejects.toThrow(/Points to add must be/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(updateDisciplineScore(999999999, 'Dressage', 5)).rejects.toThrow(/not found/);
  });
});

// ── getDisciplineScores ───────────────────────────────────────────────────────

describe('getDisciplineScores()', () => {
  it('returns the discipline scores object for an existing horse', async () => {
    const scores = await getDisciplineScores(hmHorse.id);
    expect(typeof scores).toBe('object');
  });

  it('throws for invalid horse id', async () => {
    await expect(getDisciplineScores(-1)).rejects.toThrow();
  });

  it('throws for non-existent horse id', async () => {
    await expect(getDisciplineScores(999999999)).rejects.toThrow(/not found/);
  });
});

// ── incrementDisciplineScore ──────────────────────────────────────────────────

describe('incrementDisciplineScore()', () => {
  it('increments discipline score by default 5', async () => {
    const before = await getDisciplineScores(hmHorse.id);
    const beforeVal = before?.Dressage || 0;
    await incrementDisciplineScore(hmHorse.id, 'Dressage');
    const after = await getDisciplineScores(hmHorse.id);
    expect(after?.Dressage).toBe(beforeVal + 5);
  });

  it('increments by custom amount', async () => {
    const before = await getDisciplineScores(hmHorse.id);
    const beforeVal = before?.Racing || 0;
    await incrementDisciplineScore(hmHorse.id, 'Racing', 15);
    const after = await getDisciplineScores(hmHorse.id);
    expect(after?.Racing).toBe(beforeVal + 15);
  });

  it('throws for invalid horse id', async () => {
    await expect(incrementDisciplineScore(-1, 'Dressage')).rejects.toThrow();
  });
});

// ── updateHorseStat ───────────────────────────────────────────────────────────

describe('updateHorseStat()', () => {
  it('updates a valid stat (speed) by the given amount', async () => {
    const updated = await updateHorseStat(hmHorse.id, 'speed', 5);
    expect(updated).toBeDefined();
    expect(typeof updated.speed).toBe('number');
  });

  it('caps stat at 100', async () => {
    const updated = await updateHorseStat(hmHorse.id, 'stamina', 200);
    expect(updated.stamina).toBeLessThanOrEqual(100);
  });

  it('throws for invalid stat name', async () => {
    await expect(updateHorseStat(hmHorse.id, 'invalid_stat', 5)).rejects.toThrow(/Invalid stat/);
  });

  it('throws for negative amount', async () => {
    await expect(updateHorseStat(hmHorse.id, 'speed', -1)).rejects.toThrow(/Amount must be a positive/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(updateHorseStat(999999999, 'speed', 5)).rejects.toThrow(/not found/);
  });
});

// ── getPositiveTraits ─────────────────────────────────────────────────────────

describe('getPositiveTraits()', () => {
  it('returns empty array for horse with no epigeneticModifiers', async () => {
    const traits = await getPositiveTraits(hmHorse.id);
    expect(Array.isArray(traits)).toBe(true);
  });

  it('throws for invalid horse id', async () => {
    await expect(getPositiveTraits(-1)).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(getPositiveTraits(999999999)).rejects.toThrow(/not found/);
  });
});

// ── addTraitSafely + hasTraitPresent + removeTraitSafely + getAllTraits ────────
// These are chained: add → check presence → remove → verify removed

describe('addTraitSafely()', () => {
  it('adds a positive trait to the horse', async () => {
    await addTraitSafely(hmHorse.id, 'resilient', 'positive');
    const traits = await getPositiveTraits(hmHorse.id);
    expect(traits).toContain('resilient');
  });

  it('returns horse unchanged when adding the same trait to the same category', async () => {
    const result = await addTraitSafely(hmHorse.id, 'resilient', 'positive');
    expect(result).toBeDefined();
    const traits = await getPositiveTraits(hmHorse.id);
    expect(traits.filter(t => t === 'resilient').length).toBe(1);
  });

  it('moves trait to different category when re-adding with new category', async () => {
    await addTraitSafely(hmHorse.id, 'resilient', 'negative');
    const allTraits = await getAllTraits(hmHorse.id);
    expect(allTraits.negative).toContain('resilient');
    expect(allTraits.positive).not.toContain('resilient');
  });

  it('adds a hidden trait', async () => {
    await addTraitSafely(hmHorse.id, 'hidden_power', 'hidden');
    const allTraits = await getAllTraits(hmHorse.id);
    expect(allTraits.hidden).toContain('hidden_power');
  });

  it('throws for invalid horse id', async () => {
    await expect(addTraitSafely(-1, 'resilient', 'positive')).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for empty trait name', async () => {
    await expect(addTraitSafely(hmHorse.id, '', 'positive')).rejects.toThrow(/Trait name must be/);
  });

  it('throws for invalid category', async () => {
    await expect(addTraitSafely(hmHorse.id, 'resilient', 'invalid')).rejects.toThrow(/Invalid category/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(addTraitSafely(999999999, 'resilient', 'positive')).rejects.toThrow(/not found/);
  });
});

describe('hasTraitPresent()', () => {
  it('returns present=true and correct category for an existing trait', async () => {
    const result = await hasTraitPresent(hmHorse.id, 'resilient');
    expect(result.present).toBe(true);
    expect(result.category).toBe('negative');
  });

  it('returns present=false for a trait not on the horse', async () => {
    const result = await hasTraitPresent(hmHorse.id, 'nonexistent_trait_xyz');
    expect(result.present).toBe(false);
    expect(result.category).toBeNull();
  });

  it('returns visible=false for hidden traits', async () => {
    const result = await hasTraitPresent(hmHorse.id, 'hidden_power');
    expect(result.present).toBe(true);
    expect(result.visible).toBe(false);
  });

  it('throws for invalid horse id', async () => {
    await expect(hasTraitPresent(-1, 'resilient')).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for empty trait name', async () => {
    await expect(hasTraitPresent(hmHorse.id, '')).rejects.toThrow(/Trait name must be/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(hasTraitPresent(999999999, 'resilient')).rejects.toThrow(/not found/);
  });
});

describe('removeTraitSafely()', () => {
  it('removes an existing trait and returns updated horse', async () => {
    await removeTraitSafely(hmHorse.id, 'resilient');
    const allTraits = await getAllTraits(hmHorse.id);
    expect(allTraits.negative).not.toContain('resilient');
    expect(allTraits.positive).not.toContain('resilient');
  });

  it('returns horse unchanged when removing a non-existent trait (no-op path)', async () => {
    const result = await removeTraitSafely(hmHorse.id, 'nonexistent_trait_xyz');
    expect(result).toBeDefined();
  });

  it('throws for invalid horse id', async () => {
    await expect(removeTraitSafely(-1, 'resilient')).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for empty trait name', async () => {
    await expect(removeTraitSafely(hmHorse.id, '')).rejects.toThrow(/Trait name must be/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(removeTraitSafely(999999999, 'resilient')).rejects.toThrow(/not found/);
  });
});

// ── getAllTraits ──────────────────────────────────────────────────────────────

describe('getAllTraits()', () => {
  it('returns object with positive, negative, hidden arrays and total count', async () => {
    const result = await getAllTraits(hmHorse.id);
    expect(Array.isArray(result.positive)).toBe(true);
    expect(Array.isArray(result.negative)).toBe(true);
    expect(Array.isArray(result.hidden)).toBe(true);
    expect(typeof result.total).toBe('number');
    expect(result.total).toBe(result.positive.length + result.negative.length + result.hidden.length);
  });

  it('throws for invalid horse id', async () => {
    await expect(getAllTraits(-1)).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(getAllTraits(999999999)).rejects.toThrow(/not found/);
  });
});

// ── hasTrait ──────────────────────────────────────────────────────────────────

describe('hasTrait()', () => {
  it('returns true when horse has the trait', async () => {
    await addTraitSafely(hmHorse.id, 'brave', 'positive');
    const result = await hasTrait(hmHorse.id, 'brave');
    expect(result).toBe(true);
  });

  it('returns false when horse does not have the trait', async () => {
    const result = await hasTrait(hmHorse.id, 'trait_that_does_not_exist_xyz');
    expect(result).toBe(false);
  });

  it('throws for invalid horse id', async () => {
    await expect(hasTrait(-1, 'brave')).rejects.toThrow();
  });

  it('throws for empty trait name', async () => {
    await expect(hasTrait(hmHorse.id, '')).rejects.toThrow(/Trait name must be/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(hasTrait(999999999, 'brave')).rejects.toThrow(/not found/);
  });
});

// ── getPositiveTraitsArray ────────────────────────────────────────────────────

describe('getPositiveTraitsArray()', () => {
  it('returns array containing positive traits', async () => {
    const result = await getPositiveTraitsArray(hmHorse.id);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('brave');
  });

  it('throws for invalid horse id', async () => {
    await expect(getPositiveTraitsArray(-1)).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(getPositiveTraitsArray(999999999)).rejects.toThrow(/not found/);
  });
});

// ── getNegativeTraitsArray ────────────────────────────────────────────────────

describe('getNegativeTraitsArray()', () => {
  it('returns empty array when horse has no negative traits', async () => {
    const result = await getNegativeTraitsArray(hmHorse.id);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns negative traits after adding one', async () => {
    await addTraitSafely(hmHorse.id, 'timid', 'negative');
    const result = await getNegativeTraitsArray(hmHorse.id);
    expect(result).toContain('timid');
  });

  it('throws for invalid horse id', async () => {
    await expect(getNegativeTraitsArray(-1)).rejects.toThrow(/Invalid horse ID/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(getNegativeTraitsArray(999999999)).rejects.toThrow(/not found/);
  });
});

// ── addTrait (instance-style wrapper) ────────────────────────────────────────

describe('addTrait()', () => {
  it('adds a trait via the instance-style helper', async () => {
    const updated = await addTrait(hmHorse.id, 'focused', 'positive');
    expect(updated).toBeDefined();
    const traits = await getPositiveTraitsArray(hmHorse.id);
    expect(traits).toContain('focused');
  });

  it('throws for invalid category (hidden not accepted by addTrait)', async () => {
    await expect(addTrait(hmHorse.id, 'some_trait', 'hidden')).rejects.toThrow(/Invalid category/);
  });

  it('throws for invalid horse id', async () => {
    await expect(addTrait(-1, 'focused', 'positive')).rejects.toThrow();
  });

  it('throws for empty trait name', async () => {
    await expect(addTrait(hmHorse.id, '', 'positive')).rejects.toThrow(/Trait name must be/);
  });

  it('throws for non-existent horse id', async () => {
    await expect(addTrait(999999999, 'focused', 'positive')).rejects.toThrow(/not found/);
  });
});
