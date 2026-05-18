/**
 * conformationShowRewards.unit.test.mjs — Equoria-1zpd
 *
 * PURE-HELPER UNIT TESTS for conformationShowService reward/title math.
 * Split out of conformationShowExecution.test.mjs (Equoria-1zpd) because
 * that file was mislabeled "Integration tests" while mixing these pure,
 * DB-free, harness-free helper assertions with a controller-harness
 * (buildReq/buildRes) component suite.
 *
 * These three functions are pure: integer in, table-driven value out.
 * No DB, no controller, no req/res harness, no mocks — by construction
 * this is a unit test and is named accordingly so it can never be cited
 * as integration or beta-readiness evidence.
 *
 *   resolveReward(placement)      → { ribbon, titlePoints, breedingBoostDelta }
 *   resolveTitle(points)          → title string | null
 *   applyBreedingValueBoost(b,Δ)  → capped breeding value boost
 *
 * Sibling files (Equoria-1zpd split):
 *   - conformationShowExecution.test.mjs  → controller-harness component
 *     suite (real DB, NOT HTTP — relabeled, no longer claims integration)
 *   - conformationShowRoutesHttp.integration.test.mjs → real supertest
 *     HTTP integration incl. the POST /execute pipeline
 */

import { describe, it, expect } from '@jest/globals';
import {
  resolveReward,
  resolveTitle,
  applyBreedingValueBoost,
} from '../../../services/conformationShowService.mjs';

describe('resolveReward (AC1 reward table)', () => {
  it('returns Blue ribbon + 10 pts + 5% for 1st', () => {
    expect(resolveReward(1)).toEqual({ ribbon: 'Blue', titlePoints: 10, breedingBoostDelta: 0.05 });
  });
  it('returns Red ribbon + 7 pts + 3% for 2nd', () => {
    expect(resolveReward(2)).toEqual({ ribbon: 'Red', titlePoints: 7, breedingBoostDelta: 0.03 });
  });
  it('returns Yellow ribbon + 5 pts + 1% for 3rd', () => {
    expect(resolveReward(3)).toEqual({ ribbon: 'Yellow', titlePoints: 5, breedingBoostDelta: 0.01 });
  });
  it('returns White ribbon + 2 pts + 0% for 4th', () => {
    expect(resolveReward(4)).toEqual({ ribbon: 'White', titlePoints: 2, breedingBoostDelta: 0 });
  });
  it('returns White ribbon + 2 pts + 0% for 10th', () => {
    expect(resolveReward(10)).toEqual({ ribbon: 'White', titlePoints: 2, breedingBoostDelta: 0 });
  });
});

describe('resolveTitle (AC2 thresholds)', () => {
  it('returns null for 0 points', () => {
    expect(resolveTitle(0)).toBeNull();
  });
  it('returns null for 24 points', () => {
    expect(resolveTitle(24)).toBeNull();
  });
  it('returns Noteworthy at 25 points', () => {
    expect(resolveTitle(25)).toBe('Noteworthy');
  });
  it('returns Noteworthy at 49 points', () => {
    expect(resolveTitle(49)).toBe('Noteworthy');
  });
  it('returns Distinguished at 50 points', () => {
    expect(resolveTitle(50)).toBe('Distinguished');
  });
  it('returns Distinguished at 99 points', () => {
    expect(resolveTitle(99)).toBe('Distinguished');
  });
  it('returns Champion at 100 points', () => {
    expect(resolveTitle(100)).toBe('Champion');
  });
  it('returns Champion at 199 points', () => {
    expect(resolveTitle(199)).toBe('Champion');
  });
  it('returns Grand Champion at 200 points', () => {
    expect(resolveTitle(200)).toBe('Grand Champion');
  });
  it('returns Grand Champion at 500 points', () => {
    expect(resolveTitle(500)).toBe('Grand Champion');
  });
});

describe('applyBreedingValueBoost (AC3 cap)', () => {
  it('adds 5% for 1st place (0 → 0.05)', () => {
    expect(applyBreedingValueBoost(0, 0.05)).toBeCloseTo(0.05);
  });
  it('caps at 0.15 when adding 5% to 0.14', () => {
    expect(applyBreedingValueBoost(0.14, 0.05)).toBeCloseTo(0.15);
  });
  it('stays at 0.15 when already capped and adding 5%', () => {
    expect(applyBreedingValueBoost(0.15, 0.05)).toBeCloseTo(0.15);
  });
  it('returns unchanged boost for 4th place (delta=0)', () => {
    expect(applyBreedingValueBoost(0.08, 0)).toBeCloseTo(0.08);
  });
  it('caps at 0.15 when overflow would exceed cap', () => {
    expect(applyBreedingValueBoost(0.13, 0.05)).toBeCloseTo(0.15);
  });
});
