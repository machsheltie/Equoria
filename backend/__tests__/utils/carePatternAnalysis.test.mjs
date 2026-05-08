/**
 * carePatternAnalysis util unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests the single exported async function analyzeCarePatterns with real DB
 * fixtures. Two code paths exercised:
 *   - newborn foal (age < 3 years) → eligible:true, patterns object
 *   - mature horse (age >= 3 years) → eligible:false, reason string
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { analyzeCarePatterns } from '../../utils/carePatternAnalysis.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let foal;
let matureHorse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `careanalysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `careanalysis${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'CareAnalysis',
      lastName: 'Tester',
      money: 1000,
    },
  });

  foal = await prisma.horse.create({
    data: {
      name: `TestFixture-CareAnalysisFoal-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  matureHorse = await prisma.horse.create({
    data: {
      name: `TestFixture-CareAnalysisMature-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: foal.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: matureHorse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── analyzeCarePatterns ───────────────────────────────────────────────────────

describe('analyzeCarePatterns', () => {
  it('throws for non-existent horse', async () => {
    await expect(analyzeCarePatterns(999999999)).rejects.toThrow();
  });

  it('returns eligible:true for newborn foal', async () => {
    const result = await analyzeCarePatterns(foal.id);

    expect(result).toBeDefined();
    expect(result.eligible).toBe(true);
    expect(result.horseId).toBe(foal.id);
    expect(typeof result.ageInDays).toBe('number');
    expect(typeof result.ageInYears).toBe('number');
    expect(result.ageInYears).toBeLessThan(3);
    expect(typeof result.currentBondScore).toBe('number');
    expect(typeof result.currentStressLevel).toBe('number');
    expect(result.patterns).toBeDefined();
    expect(result.evaluationDate).toBeInstanceOf(Date);
  });

  it('returns patterns with expected keys for eligible foal', async () => {
    const result = await analyzeCarePatterns(foal.id);
    const { patterns } = result;

    expect(patterns.consistentCare).toBeDefined();
    expect(patterns.noveltyExposure).toBeDefined();
    expect(patterns.stressManagement).toBeDefined();
    expect(patterns.bondingPatterns).toBeDefined();
    expect(patterns.neglectPatterns).toBeDefined();
    expect(patterns.environmentalFactors).toBeDefined();
  });

  it('returns eligible:false for mature horse (>= 3 years)', async () => {
    const result = await analyzeCarePatterns(matureHorse.id);

    expect(result).toBeDefined();
    expect(result.eligible).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason).toMatch(/too old/i);
    expect(result.ageInYears).toBeGreaterThanOrEqual(3);
    expect(result.patterns).toBeDefined();
  });

  it('accepts a custom evaluation date', async () => {
    const customDate = new Date();
    const result = await analyzeCarePatterns(foal.id, customDate);
    expect(result.evaluationDate).toEqual(customDate);
  });

  it('consistentCare has totalInteractions of 0 for horse with no groom interactions', async () => {
    const result = await analyzeCarePatterns(foal.id);
    expect(result.patterns.consistentCare.totalInteractions).toBe(0);
  });
});
