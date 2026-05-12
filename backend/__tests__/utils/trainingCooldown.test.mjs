import { describe, it, expect } from '@jest/globals';
import { canTrain, getCooldownTimeRemaining, formatCooldown, setCooldown } from '../../utils/trainingCooldown.mjs';

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
