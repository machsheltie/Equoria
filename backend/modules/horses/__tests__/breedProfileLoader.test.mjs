/**
 * breedProfileLoader — unit tests (Equoria-rr7)
 *
 * Tests loader functions that read breedProfiles.json from disk.
 * No DB required — reads static JSON file only.
 */

import { describe, it, expect } from '@jest/globals';
import { getBreedProfile, countLoadedBreedProfiles } from '../../modules/horses/data/breedProfileLoader.mjs';

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
// getBreedProfile — by legacy numeric ID
// ---------------------------------------------------------------------------
describe('getBreedProfile — by numeric breed ID (legacy)', () => {
  it('returns a profile for numeric ID 1 (Thoroughbred)', () => {
    const profile = getBreedProfile(1);
    expect(typeof profile).toBe('object');
    expect(profile).not.toBeNull();
  });

  it('returns a profile for numeric ID 2 (Arabian)', () => {
    const profile = getBreedProfile(2);
    expect(typeof profile).toBe('object');
  });

  it('numeric ID 1 and name "Thoroughbred" return the same profile', () => {
    const byId = getBreedProfile(1);
    const byName = getBreedProfile('Thoroughbred');
    expect(byId).toEqual(byName);
  });

  it('throws for an out-of-range numeric ID', () => {
    expect(() => getBreedProfile(999)).toThrow();
  });

  it('throws for numeric ID 0', () => {
    expect(() => getBreedProfile(0)).toThrow();
  });
});
