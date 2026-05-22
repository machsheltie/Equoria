/**
 * Tests: types/traits live surface
 *
 * Equoria-q3u77: this file previously tested ~15 helper functions
 * (getTierStyle, getBestDisciplines, calculateTotalImpact, checkSynergy, …)
 * that operated on the tier-based EpigeneticTrait type. That type and those
 * helpers were dead code (used only by the now-removed orphaned
 * components/traits set) and were deleted. The tests for them were removed
 * with them — keeping tests-of-deleted-code would be dead test weight.
 *
 * What remains is the LIVE surface: TraitDiscoveryStatus +
 * calculateDiscoveryProgress, consumed by HiddenTraitIndicator and mapped from
 * the real /api/v1/traits/discovery-status/:horseId endpoint.
 */

import { describe, it, expect } from 'vitest';
import type { TraitDiscoveryStatus } from '../traits';
import { calculateDiscoveryProgress } from '../traits';

describe('calculateDiscoveryProgress', () => {
  it('should calculate percentage correctly', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 3,
      partiallyDiscoveredTraits: 1,
      hiddenTraits: 6,
      discoveryProgress: 0, // Will be calculated
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(35); // (3 + 0.5*1) / 10 * 100
  });

  it('should handle 0% discovery', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 0,
      partiallyDiscoveredTraits: 0,
      hiddenTraits: 10,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(0);
  });

  it('should handle 100% discovery', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 10,
      partiallyDiscoveredTraits: 0,
      hiddenTraits: 0,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(100);
  });

  it('should handle partial discoveries correctly', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 10,
      discoveredTraits: 5,
      partiallyDiscoveredTraits: 4,
      hiddenTraits: 1,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(70); // (5 + 0.5*4) / 10 * 100
  });

  it('should round to nearest integer', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 3,
      discoveredTraits: 1,
      partiallyDiscoveredTraits: 1,
      hiddenTraits: 1,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(50); // (1 + 0.5*1) / 3 * 100 = 50
  });

  it('should handle zero total traits', () => {
    const status: TraitDiscoveryStatus = {
      horseId: 1,
      totalTraits: 0,
      discoveredTraits: 0,
      partiallyDiscoveredTraits: 0,
      hiddenTraits: 0,
      discoveryProgress: 0,
    };
    const progress = calculateDiscoveryProgress(status);
    expect(progress).toBe(0);
  });
});
