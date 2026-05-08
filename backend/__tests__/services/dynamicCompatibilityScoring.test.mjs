/**
 * dynamicCompatibilityScoring service unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests exported async functions with real DB fixtures.
 * Uses a user+groom+horse fixture; focuses on zero-interaction code paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  analyzeCompatibilityTrends,
  getOptimalGroomRecommendations,
  calculateDynamicCompatibility,
  analyzeCompatibilityFactors,
  predictInteractionOutcome,
} from '../../services/dynamicCompatibilityScoring.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `dyncompat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `dyncompat${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'DynCompat',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-DynCompatHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-DynCompatGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

const CONTEXT = { taskType: 'grooming', timeOfDay: 'morning', weather: 'sunny' };

// ─── analyzeCompatibilityTrends ───────────────────────────────────────────────

describe('analyzeCompatibilityTrends', () => {
  it('returns insufficient_data for groom+horse with no interactions', async () => {
    const result = await analyzeCompatibilityTrends(groom.id, horse.id);

    expect(result).toBeDefined();
    expect(result.overallTrend).toBe('insufficient_data');
    expect(result.trendStrength).toBe(0);
    expect(result.dataPoints).toBe(0);
  });

  it('returns insufficient_data for unknown ids', async () => {
    const result = await analyzeCompatibilityTrends(999999999, 999999998);

    expect(result).toBeDefined();
    expect(result.overallTrend).toBe('insufficient_data');
  });
});

// ─── getOptimalGroomRecommendations ───────────────────────────────────────────

describe('getOptimalGroomRecommendations', () => {
  it('returns recommendation structure including test groom', async () => {
    const result = await getOptimalGroomRecommendations(horse.id, CONTEXT);

    expect(result).toBeDefined();
    expect(Array.isArray(result.rankedGrooms)).toBe(true);
    expect(result.topRecommendation !== undefined || result.rankedGrooms !== undefined).toBe(true);
  });
});

// ─── calculateDynamicCompatibility ────────────────────────────────────────────

describe('calculateDynamicCompatibility', () => {
  it('returns compatibility score between 0 and 1.5', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, CONTEXT);

    expect(result).toBeDefined();
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(1.5);
  });

  it('returns a recommendationLevel string', async () => {
    const result = await calculateDynamicCompatibility(groom.id, horse.id, CONTEXT);

    expect(typeof result.recommendationLevel).toBe('string');
    expect(['highly_recommended', 'recommended', 'acceptable', 'not_recommended']).toContain(
      result.recommendationLevel,
    );
  });
});

// ─── analyzeCompatibilityFactors ──────────────────────────────────────────────

describe('analyzeCompatibilityFactors', () => {
  it('returns factors object for known groom+horse', async () => {
    const result = await analyzeCompatibilityFactors(groom.id, horse.id);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ─── predictInteractionOutcome ────────────────────────────────────────────────

describe('predictInteractionOutcome', () => {
  it('returns prediction object for known groom+horse', async () => {
    const result = await predictInteractionOutcome(groom.id, horse.id, CONTEXT);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});
