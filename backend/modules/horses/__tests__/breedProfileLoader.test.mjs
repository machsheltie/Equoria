/**
 * breedProfileLoader — unit tests (Equoria-rr7)
 *
 * Tests loader functions that read breedProfiles.json from disk.
 * No DB required — reads static JSON file only.
 */

import { describe, it, expect } from '@jest/globals';
import { getBreedProfile, countLoadedBreedProfiles } from '../data/breedProfileLoader.mjs';

// ---------------------------------------------------------------------------
// countLoadedBreedProfiles
// ---------------------------------------------------------------------------
describe('countLoadedBreedProfiles', () => {
  it('returns a positive number of breed profiles', () => {
    const count = countLoadedBreedProfiles();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThan(0);
  });

  it('returns at least 12 profiles (canonical breeds)', () => {
    const count = countLoadedBreedProfiles();
    expect(count).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// getBreedProfile — by name
// ---------------------------------------------------------------------------
describe('getBreedProfile — by breed name', () => {
  it('returns a profile object for "Thoroughbred"', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(typeof profile).toBe('object');
    expect(profile).not.toBeNull();
  });

  it('returned profile has rating_profiles with conformation', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(profile.rating_profiles).toBeDefined();
    expect(typeof profile.rating_profiles.conformation).toBe('object');
  });

  it('returned profile has temperament_weights', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(profile.temperament_weights).toBeDefined();
  });

  it('gaited breed has is_gaited_breed true (American Saddlebred)', () => {
    const profile = getBreedProfile('American Saddlebred');
    expect(profile.rating_profiles.is_gaited_breed).toBe(true);
  });

  it('non-gaited breed has is_gaited_breed false (Thoroughbred)', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(profile.rating_profiles.is_gaited_breed).toBe(false);
  });

  it('throws for an unknown breed name', () => {
    expect(() => getBreedProfile('UnicornBreedXYZ')).toThrow();
  });

  it('throws for empty string', () => {
    expect(() => getBreedProfile('')).toThrow();
  });

  it('throws for null', () => {
    expect(() => getBreedProfile(null)).toThrow();
  });

  it('throws for undefined', () => {
    expect(() => getBreedProfile(undefined)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getBreedProfile — numeric breedId rejected (Equoria-f6xgn).
// LEGACY_ID_TO_NAME was removed when the 12-only shim became a quiet-failure
// vector for the other ~300 imported breeds. Numeric IDs throw a clear error
// pointing at the migration path (prisma.breed.findUnique → name).
// ---------------------------------------------------------------------------
describe('getBreedProfile — numeric breedId rejection (Equoria-f6xgn)', () => {
  it('throws when given a positive integer breedId', () => {
    expect(() => getBreedProfile(1)).toThrow(/no longer accepts a numeric breedId/);
  });

  it('throws when given an out-of-range positive integer', () => {
    expect(() => getBreedProfile(999)).toThrow(/no longer accepts a numeric breedId/);
  });

  it('throws when given 0', () => {
    expect(() => getBreedProfile(0)).toThrow(/no longer accepts a numeric breedId/);
  });

  it('error message includes the prisma.breed.findUnique migration hint', () => {
    expect(() => getBreedProfile(2)).toThrow(/prisma\.breed\.findUnique/);
  });
});
