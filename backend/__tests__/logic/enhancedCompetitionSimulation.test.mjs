/**
 * Tests for logic/enhancedCompetitionSimulation.mjs
 *
 * Covers the pure / validation functions that do not require a live DB:
 *   - validateCompetitionEntry  (async but validates passed-in objects only)
 *   - getCompetitionEligibilitySummary  (synchronous, fully pure)
 *
 * executeEnhancedCompetition is DB-heavy and is covered by competition integration tests.
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateCompetitionEntry,
  getCompetitionEligibilitySummary,
} from '../../logic/enhancedCompetitionSimulation.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// age is stored in game-days; 7 days = 1 in-game year (checkAgeRequirements uses Math.floor(age/7))
const validHorse = {
  id: 1,
  name: 'Spirit',
  age: 35, // 5 years = 35 days
  healthStatus: 'Good',
  speed: 60,
  stamina: 60,
  intelligence: 60,
  precision: 60,
  agility: 60,
  boldness: 60,
  focus: 60,
  obedience: 60,
  epigeneticModifiers: { positive: [], negative: [] },
  disciplineScores: { Racing: 0 },
};

const validShow = {
  name: 'Spring Sprint',
  discipline: 'Racing',
  levelMin: 1,
  levelMax: 15,
  entryFee: 100,
  showType: 'ridden',
};

const validUser = { id: 'u1', money: 500 };

// ---------------------------------------------------------------------------
// validateCompetitionEntry
// ---------------------------------------------------------------------------

describe('validateCompetitionEntry', () => {
  it('returns eligible:true for a valid horse/show/user', async () => {
    const result = await validateCompetitionEntry(validHorse, validShow, validUser);
    expect(result.eligible).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a horse that is too young (age < 3 years = <21 days)', async () => {
    const youngHorse = { ...validHorse, age: 2 }; // 2 days = 0 years → ineligible; age<3 in days also catches the message
    const result = await validateCompetitionEntry(youngHorse, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /too young/i.test(e))).toBe(true);
  });

  it('rejects a horse that is too old (age > 21 years = >147 days)', async () => {
    const oldHorse = { ...validHorse, age: 154 }; // 22 years = 154 days
    const result = await validateCompetitionEntry(oldHorse, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /retired/i.test(e))).toBe(true);
  });

  it('rejects a horse whose health status is not Good or Excellent', async () => {
    const sickHorse = { ...validHorse, healthStatus: 'Poor' };
    const result = await validateCompetitionEntry(sickHorse, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /health/i.test(e))).toBe(true);
  });

  it('accepts a horse with Excellent health status', async () => {
    const excellentHorse = { ...validHorse, healthStatus: 'Excellent' };
    const result = await validateCompetitionEntry(excellentHorse, validShow, validUser);
    expect(result.eligible).toBe(true);
  });

  it('rejects user who cannot afford the entry fee', async () => {
    const brokeUser = { id: 'u2', money: 50 };
    const result = await validateCompetitionEntry(validHorse, validShow, brokeUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /insufficient funds/i.test(e))).toBe(true);
  });

  it('rejects when horse level is below levelMin', async () => {
    // A horse with all-zero stats will have level 1
    const weakHorse = {
      ...validHorse,
      speed: 0,
      stamina: 0,
      intelligence: 0,
      precision: 0,
      agility: 0,
      boldness: 0,
      focus: 0,
      obedience: 0,
    };
    const highMinShow = { ...validShow, levelMin: 10, levelMax: 15 };
    const result = await validateCompetitionEntry(weakHorse, highMinShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /level/i.test(e))).toBe(true);
  });

  it('rejects when horse level exceeds levelMax', async () => {
    const strongHorse = { ...validHorse, speed: 300, stamina: 300, intelligence: 300 };
    const lowMaxShow = { ...validShow, levelMin: 1, levelMax: 2 };
    const result = await validateCompetitionEntry(strongHorse, lowMaxShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /level/i.test(e))).toBe(true);
  });

  it('returns horseLevel and disciplineScore in result', async () => {
    const result = await validateCompetitionEntry(validHorse, validShow, validUser);
    expect(typeof result.horseLevel).toBe('number');
    expect(result.horseLevel).toBeGreaterThanOrEqual(1);
    expect(typeof result.disciplineScore).toBe('number');
  });

  it('accumulates multiple validation errors when multiple conditions fail', async () => {
    // age:1 (1 day = 0 years, < 3 raw days so too-young message fires), health:Critical, broke user
    const badHorse = { ...validHorse, age: 1, healthStatus: 'Critical' };
    const badUser = { id: 'u3', money: 0 };
    const result = await validateCompetitionEntry(badHorse, validShow, badUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('handles thrown errors gracefully and returns eligible:false', async () => {
    // Pass null as horse to trigger an error path
    const result = await validateCompetitionEntry(null, validShow, validUser);
    expect(result.eligible).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getCompetitionEligibilitySummary
// ---------------------------------------------------------------------------

describe('getCompetitionEligibilitySummary', () => {
  it('returns a summary object with required fields', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary).toHaveProperty('horseLevel');
    expect(summary).toHaveProperty('ageEligible');
    expect(summary).toHaveProperty('traitEligible');
    expect(summary).toHaveProperty('disciplineStats');
    expect(summary).toHaveProperty('currentAge');
    expect(summary).toHaveProperty('healthStatus');
    expect(summary).toHaveProperty('disciplineScore');
  });

  it('marks age-eligible for a 5-year-old horse (35 days)', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.ageEligible).toBe(true);
    expect(summary.currentAge).toBe(35); // raw day value stored on horse
  });

  it('marks age-ineligible for a 2-day-old horse (0 years)', () => {
    const youngHorse = { ...validHorse, age: 2 }; // 2 days = 0 years
    const summary = getCompetitionEligibilitySummary(youngHorse, 'Racing');
    expect(summary.ageEligible).toBe(false);
  });

  it('marks age-ineligible for a 154-day-old horse (22 years)', () => {
    const oldHorse = { ...validHorse, age: 154 }; // 22 years = 154 days
    const summary = getCompetitionEligibilitySummary(oldHorse, 'Racing');
    expect(summary.ageEligible).toBe(false);
  });

  it('returns traitEligible:true for disciplines that have no required trait', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.traitEligible).toBe(true);
  });

  it('reflects the discipline-specific stat list', () => {
    const racingSummary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(Array.isArray(racingSummary.disciplineStats)).toBe(true);
    expect(racingSummary.disciplineStats.length).toBeGreaterThan(0);

    const dressageSummary = getCompetitionEligibilitySummary(validHorse, 'Dressage');
    expect(Array.isArray(dressageSummary.disciplineStats)).toBe(true);
  });

  it('calculates horseLevel as a positive integer', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(Number.isInteger(summary.horseLevel)).toBe(true);
    expect(summary.horseLevel).toBeGreaterThanOrEqual(1);
  });

  it('returns disciplineScore from horse.disciplineScores', () => {
    const horseWithScore = { ...validHorse, disciplineScores: { Racing: 42 } };
    const summary = getCompetitionEligibilitySummary(horseWithScore, 'Racing');
    expect(summary.disciplineScore).toBe(42);
  });

  it('returns 0 disciplineScore when horse has no disciplineScores', () => {
    const horseNoScore = { ...validHorse, disciplineScores: undefined };
    const summary = getCompetitionEligibilitySummary(horseNoScore, 'Racing');
    expect(summary.disciplineScore).toBe(0);
  });

  it('returns healthStatus from horse', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.healthStatus).toBe('Good');
  });

  it('returns fallback summary on invalid horse input', () => {
    const summary = getCompetitionEligibilitySummary(null, 'Racing');
    // Fallback returns horseLevel:1 and ageEligible:false (no .eligible field on summary)
    expect(summary.horseLevel).toBe(1);
    expect(summary.ageEligible).toBe(false);
  });

  it('handles unknown discipline gracefully', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'UnknownSport');
    expect(summary).toBeDefined();
    expect(summary.horseLevel).toBeGreaterThanOrEqual(1);
  });

  it('requiredTrait is null for non-Gaited discipline (|| null branch)', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Racing');
    expect(summary.requiredTrait).toBeNull();
  });

  it('requiredTrait is "gaited" for Gaited discipline (requiresTrait branch)', () => {
    const summary = getCompetitionEligibilitySummary(validHorse, 'Gaited');
    expect(summary.requiredTrait).toBe('gaited');
  });

  it('traitEligible is false for horse without "gaited" in Gaited discipline', () => {
    const horseNoGaited = { ...validHorse, epigeneticModifiers: { positive: [], negative: [] } };
    const summary = getCompetitionEligibilitySummary(horseNoGaited, 'Gaited');
    expect(summary.traitEligible).toBe(false);
  });

  it('traitEligible is true for horse with "gaited" trait in Gaited discipline', () => {
    const horseGaited = {
      ...validHorse,
      epigeneticModifiers: { positive: ['gaited'], negative: [] },
    };
    const summary = getCompetitionEligibilitySummary(horseGaited, 'Gaited');
    expect(summary.traitEligible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateCompetitionEntry — trait-failure branch (lines 52-54) (Equoria-jkht)
// ---------------------------------------------------------------------------

describe('validateCompetitionEntry — trait-failure branch', () => {
  it('rejects horse without gaited trait entering Gaited discipline (lines 52-54)', async () => {
    const gaitedShow = {
      name: 'Gaited Classic',
      discipline: 'Gaited',
      levelMin: 1,
      levelMax: 15,
      entryFee: 0,
      showType: 'ridden',
    };
    const horseNoGaited = {
      ...validHorse,
      epigeneticModifiers: { positive: [], negative: [] },
    };
    const result = await validateCompetitionEntry(horseNoGaited, gaitedShow, validUser);
    expect(result.eligible).toBe(false);
    expect(result.errors.some(e => /gaited/i.test(e))).toBe(true);
  });

  it('accepts horse with gaited trait entering Gaited discipline', async () => {
    const gaitedShow = {
      name: 'Gaited Classic',
      discipline: 'Gaited',
      levelMin: 1,
      levelMax: 15,
      entryFee: 0,
      showType: 'ridden',
    };
    const horseGaited = {
      ...validHorse,
      epigeneticModifiers: { positive: ['gaited'], negative: [] },
    };
    const result = await validateCompetitionEntry(horseGaited, gaitedShow, validUser);
    expect(result.errors.every(e => !/gaited/i.test(e))).toBe(true);
  });
});
