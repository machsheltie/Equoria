import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { canTrain, getCooldownTimeRemaining, formatCooldown, setCooldown } from '../../utils/trainingCooldown.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // yesterday
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // +7 days

describe('canTrain', () => {
  it('throws when horse is null', () => {
    expect(() => canTrain(null)).toThrow('Horse object is required');
  });

  it('returns true when trainingCooldown is null', () => {
    expect(canTrain({ trainingCooldown: null })).toBe(true);
  });

  it('returns true when trainingCooldown is undefined', () => {
    expect(canTrain({})).toBe(true);
  });

  it('returns true when cooldown date is in the past', () => {
    expect(canTrain({ trainingCooldown: pastDate })).toBe(true);
  });

  it('returns false when cooldown date is in the future', () => {
    expect(canTrain({ trainingCooldown: futureDate })).toBe(false);
  });
});

describe('getCooldownTimeRemaining', () => {
  it('throws when horse is null', () => {
    expect(() => getCooldownTimeRemaining(null)).toThrow('Horse object is required');
  });

  it('returns null when trainingCooldown is null', () => {
    expect(getCooldownTimeRemaining({ trainingCooldown: null })).toBeNull();
  });

  it('returns null when trainingCooldown is undefined', () => {
    expect(getCooldownTimeRemaining({})).toBeNull();
  });

  it('returns null when cooldown is in the past', () => {
    expect(getCooldownTimeRemaining({ trainingCooldown: pastDate })).toBeNull();
  });

  it('returns positive number in ms when cooldown is in the future', () => {
    const remaining = getCooldownTimeRemaining({ trainingCooldown: futureDate });
    expect(remaining).toBeGreaterThan(0);
    // Should be approximately 7 days in ms (within 5 seconds tolerance)
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(remaining).toBeLessThanOrEqual(sevenDaysMs + 5000);
    expect(remaining).toBeGreaterThanOrEqual(sevenDaysMs - 5000);
  });
});

describe('formatCooldown', () => {
  it('returns "Ready to train" for 0 ms', () => {
    expect(formatCooldown(0)).toBe('Ready to train');
  });

  it('returns "Ready to train" for null', () => {
    expect(formatCooldown(null)).toBe('Ready to train');
  });

  it('returns "Ready to train" for negative ms', () => {
    expect(formatCooldown(-1000)).toBe('Ready to train');
  });

  it('formats days and hours correctly', () => {
    const ms = (2 * 24 * 60 + 3 * 60) * 60 * 1000; // 2 days 3 hours
    expect(formatCooldown(ms)).toBe('2 day(s), 3 hour(s) remaining');
  });

  it('formats hours and minutes when less than a day', () => {
    const ms = (5 * 60 + 30) * 60 * 1000; // 5 hours 30 minutes
    expect(formatCooldown(ms)).toBe('5 hour(s), 30 minute(s) remaining');
  });

  it('formats minutes only when less than an hour', () => {
    const ms = 45 * 60 * 1000; // 45 minutes
    expect(formatCooldown(ms)).toBe('45 minute(s) remaining');
  });

  it('formats 0 minutes as "0 minute(s) remaining" for sub-minute amounts', () => {
    const ms = 30 * 1000; // 30 seconds
    expect(formatCooldown(ms)).toBe('0 minute(s) remaining');
  });
});

// ---------------------------------------------------------------------------
// setCooldown — pure validation branches (no DB — throws before Prisma call)
// ---------------------------------------------------------------------------
describe('setCooldown — pure validation branches (Equoria-jkht)', () => {
  it('throws when horseId is null (horseId===null||undefined true-branch)', async () => {
    await expect(setCooldown(null)).rejects.toThrow('Horse ID is required');
  });

  it('throws when horseId is undefined (||undefined true-branch)', async () => {
    await expect(setCooldown(undefined)).rejects.toThrow('Horse ID is required');
  });

  it('throws when horseId is a non-numeric string (isNaN true-branch)', async () => {
    await expect(setCooldown('abc')).rejects.toThrow('Horse ID must be a valid positive integer');
  });

  it('throws when horseId is 0 (id<=0 true-branch with isNaN false)', async () => {
    await expect(setCooldown(0)).rejects.toThrow('Horse ID must be a valid positive integer');
  });

  it('throws when horseId is negative (id<=0 true-branch)', async () => {
    await expect(setCooldown(-5)).rejects.toThrow('Horse ID must be a valid positive integer');
  });
});

// ---------------------------------------------------------------------------
// setCooldown — DB path (P2025 catch branch, lines 69-88)
// Uses a non-existent horse ID to enter the try block and hit the P2025 handler
// ---------------------------------------------------------------------------
describe('setCooldown — P2025 not-found catch (Equoria-jkht)', () => {
  it('throws "Horse with ID ... not found" for a non-existent positive ID (P2025 catch path)', async () => {
    await expect(setCooldown(999999999)).rejects.toThrow('Horse with ID 999999999 not found');
  });
});

// ---------------------------------------------------------------------------
// setCooldown — success path (line 84: return updatedHorse)
// Requires a real horse fixture so the update succeeds and returns the horse.
// ---------------------------------------------------------------------------
describe('setCooldown — success path (line 84) (Equoria-jkht)', () => {
  let testUser, testBreed, testHorse;

  beforeAll(async () => {
    const RUN_ID = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    testBreed = await prisma.breed.create({
      data: { name: `TCooldown_breed_${RUN_ID}` },
    });
    testUser = await prisma.user.create({
      data: {
        username: `TCooldown_${RUN_ID}`.slice(0, 50),
        email: `tcooldown_${RUN_ID}@test.invalid`,
        password: 'x',
        firstName: 'TC',
        lastName: 'Test',
      },
    });
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    testHorse = await prisma.horse.create({
      data: {
        name: `TCooldown_horse_${RUN_ID}`,
        breed: { connect: { id: testBreed.id } },
        user: { connect: { id: testUser.id } },
        age: 5,
        sex: 'Stallion',
        dateOfBirth: fiveYearsAgo,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TCooldown_horse' } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { username: { startsWith: 'TCooldown_' } } }).catch(() => {});
    await prisma.breed.deleteMany({ where: { name: { startsWith: 'TCooldown_breed' } } }).catch(() => {});
  }, 30000);

  it('returns the updated horse when called with a real existing horseId (covers line 84)', async () => {
    const result = await setCooldown(testHorse.id);
    expect(result).toBeDefined();
    expect(result.id).toBe(testHorse.id);
    // trainingCooldown should now be set to a future date (~7 days from now)
    expect(result.trainingCooldown).not.toBeNull();
    expect(new Date(result.trainingCooldown) > new Date()).toBe(true);
  });
});
