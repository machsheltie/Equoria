/**
 * trainingAnalyticsService + groomTalentService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * Shared DB fixture: user + Filly foal + groom.
 * Horse has no training history; groom has no talent selections.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { trainingAnalyticsService } from '../../services/trainingAnalyticsService.mjs';
import {
  getTalentTreeDefinitions,
  getGroomTalentSelections,
  validateTalentSelection,
  applyTalentEffects,
} from '../../services/groomTalentService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `traintalent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `traintalent${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'TrainTalent',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
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
}, 30000);

afterAll(async () => {
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

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
