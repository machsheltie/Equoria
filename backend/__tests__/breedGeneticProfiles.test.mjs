// Tests for breed genetic profile data structure and population script.
// Validates all 12 breed profiles match PRD specifications.

import {
  CANONICAL_BREEDS,
  BREED_GENETIC_PROFILES,
  TEMPERAMENT_TYPES,
} from '../modules/horses/data/breedGeneticProfiles.mjs';
import { validateProfile } from '../seed/populateBreedGeneticProfiles.mjs';

const CONFORMATION_REGIONS = ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline'];
const STANDARD_GAITS = ['walk', 'trot', 'canter', 'gallop', 'gaiting'];
const GAITED_BREED_IDS = [3, 4, 7, 10];
const NON_GAITED_BREED_IDS = [1, 2, 5, 6, 8, 9, 11, 12];
const ALL_BREED_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe('Breed Genetic Profiles - Data Structure Validation', () => {
  test('all 12 canonical breeds are defined', () => {
    expect(CANONICAL_BREEDS).toHaveLength(12);
    for (const id of ALL_BREED_IDS) {
      expect(CANONICAL_BREEDS.find(b => b.id === id)).toBeDefined();
    }
  });

  test('all 12 breeds have genetic profiles', () => {
    for (const id of ALL_BREED_IDS) {
      expect(BREED_GENETIC_PROFILES[id]).toBeDefined();
    }
  });

  test('exactly 11 temperament types are defined', () => {
    expect(TEMPERAMENT_TYPES).toHaveLength(11);
    expect(TEMPERAMENT_TYPES).toContain('Spirited');
    expect(TEMPERAMENT_TYPES).toContain('Aggressive');
  });
});

describe('Breed Genetic Profiles - Conformation Ratings', () => {
  test.each(ALL_BREED_IDS)('breed %i has 8 conformation regions with mean and std_dev', breedId => {
    const conformation = BREED_GENETIC_PROFILES[breedId].rating_profiles.conformation;
    for (const region of CONFORMATION_REGIONS) {
      expect(conformation[region]).toBeDefined();
      expect(conformation[region].mean).toBeGreaterThanOrEqual(0);
      expect(conformation[region].mean).toBeLessThanOrEqual(100);
      expect(conformation[region].std_dev).toBeGreaterThan(0);
      expect(conformation[region].std_dev).toBeLessThanOrEqual(15);
    }
  });

  test('conformation means match PRD-02 §3.1 for Thoroughbred (ID 1)', () => {
    const c = BREED_GENETIC_PROFILES[1].rating_profiles.conformation;
    expect(c.head.mean).toBe(78);
    expect(c.neck.mean).toBe(75);
    expect(c.shoulders.mean).toBe(72);
    expect(c.back.mean).toBe(70);
    expect(c.hindquarters.mean).toBe(76);
    expect(c.legs.mean).toBe(74);
    expect(c.hooves.mean).toBe(70);
  });

  test('conformation means match BreedData/Arabian.txt for Arabian (ID 2)', () => {
    const c = BREED_GENETIC_PROFILES[2].rating_profiles.conformation;
    expect(c.head.mean).toBe(95);
    expect(c.neck.mean).toBe(90);
    expect(c.shoulders.mean).toBe(85);
    expect(c.back.mean).toBe(88);
    expect(c.hindquarters.mean).toBe(84);
    expect(c.legs.mean).toBe(88);
    expect(c.hooves.mean).toBe(90);
  });

  test('conformation means match BreedData/American Paint Horse.txt for Paint Horse (ID 12)', () => {
    const c = BREED_GENETIC_PROFILES[12].rating_profiles.conformation;
    expect(c.head.mean).toBe(80);
    expect(c.neck.mean).toBe(78);
    expect(c.shoulders.mean).toBe(85);
    expect(c.back.mean).toBe(82);
    expect(c.hindquarters.mean).toBe(90);
    expect(c.legs.mean).toBe(82);
    expect(c.hooves.mean).toBe(80);
  });
});

describe('Breed Genetic Profiles - Gait Ratings', () => {
  test.each(ALL_BREED_IDS)('breed %i has 5 gait entries with correct std_dev', breedId => {
    const gaits = BREED_GENETIC_PROFILES[breedId].rating_profiles.gaits;
    for (const gaitName of STANDARD_GAITS) {
      expect(gaits).toHaveProperty(gaitName);
      if (gaits[gaitName] !== null) {
        expect(gaits[gaitName].mean).toBeGreaterThanOrEqual(0);
        expect(gaits[gaitName].mean).toBeLessThanOrEqual(100);
        expect(gaits[gaitName].std_dev).toBeGreaterThan(0);
        expect(gaits[gaitName].std_dev).toBeLessThanOrEqual(15);
      }
    }
  });

  test('gait means match PRD-02 §3.2 for Thoroughbred (ID 1)', () => {
    const g = BREED_GENETIC_PROFILES[1].rating_profiles.gaits;
    expect(g.walk.mean).toBe(65);
    expect(g.trot.mean).toBe(75);
    expect(g.canter.mean).toBe(80);
    expect(g.gallop.mean).toBe(90);
    expect(g.gaiting).toBeNull();
  });

  test('gait means match BreedData/American Saddlebred.txt for American Saddlebred (ID 3)', () => {
    const g = BREED_GENETIC_PROFILES[3].rating_profiles.gaits;
    expect(g.walk.mean).toBe(82);
    expect(g.trot.mean).toBe(88);
    expect(g.canter.mean).toBe(90);
    expect(g.gallop.mean).toBe(70);
    expect(g.gaiting.mean).toBe(92);
  });

  test('gait means match PRD-02 §3.2 for Tennessee Walking Horse (ID 7)', () => {
    const g = BREED_GENETIC_PROFILES[7].rating_profiles.gaits;
    expect(g.walk.mean).toBe(72);
    expect(g.trot.mean).toBe(65);
    expect(g.canter.mean).toBe(70);
    expect(g.gallop.mean).toBe(65);
    expect(g.gaiting.mean).toBe(85);
  });
});

describe('Breed Genetic Profiles - Gaited Breed Configuration', () => {
  test.each(GAITED_BREED_IDS)('gaited breed %i has is_gaited_breed true and non-null registry', breedId => {
    const rp = BREED_GENETIC_PROFILES[breedId].rating_profiles;
    expect(rp.is_gaited_breed).toBe(true);
    expect(rp.gaited_gait_registry).not.toBeNull();
    expect(Array.isArray(rp.gaited_gait_registry)).toBe(true);
    expect(rp.gaited_gait_registry.length).toBeGreaterThan(0);
    expect(rp.gaits.gaiting).not.toBeNull();
    expect(rp.gaits.gaiting.mean).toBeGreaterThan(0);
  });

  test.each(NON_GAITED_BREED_IDS)('non-gaited breed %i has is_gaited_breed false and null registry', breedId => {
    const rp = BREED_GENETIC_PROFILES[breedId].rating_profiles;
    expect(rp.is_gaited_breed).toBe(false);
    expect(rp.gaited_gait_registry).toBeNull();
    expect(rp.gaits.gaiting).toBeNull();
  });

  test('American Saddlebred and National Show Horse have Slow Gait and Rack', () => {
    expect(BREED_GENETIC_PROFILES[3].rating_profiles.gaited_gait_registry).toEqual(['Slow Gait', 'Rack']);
    expect(BREED_GENETIC_PROFILES[4].rating_profiles.gaited_gait_registry).toEqual(['Slow Gait', 'Rack']);
  });

  test('Tennessee Walking Horse has Flat Walk and Running Walk', () => {
    expect(BREED_GENETIC_PROFILES[7].rating_profiles.gaited_gait_registry).toEqual(['Flat Walk', 'Running Walk']);
  });

  test('Walkaloosa has Indian Shuffle', () => {
    expect(BREED_GENETIC_PROFILES[10].rating_profiles.gaited_gait_registry).toEqual(['Indian Shuffle']);
  });
});

describe('Breed Genetic Profiles - Exact Value Assertions (Remaining Breeds)', () => {
  test('National Show Horse (ID 4) conformation and gait means match source data', () => {
    const c = BREED_GENETIC_PROFILES[4].rating_profiles.conformation;
    expect(c.head.mean).toBe(82);
    expect(c.neck.mean).toBe(80);
    expect(c.shoulders.mean).toBe(71);
    expect(c.back.mean).toBe(69);
    expect(c.hindquarters.mean).toBe(73);
    const g = BREED_GENETIC_PROFILES[4].rating_profiles.gaits;
    expect(g.walk.mean).toBe(70);
    expect(g.trot.mean).toBe(76);
    expect(g.gaiting.mean).toBe(82);
  });

  test('Pony Of The Americas (ID 5) conformation and gait means match source data', () => {
    const c = BREED_GENETIC_PROFILES[5].rating_profiles.conformation;
    expect(c.head.mean).toBe(75);
    expect(c.neck.mean).toBe(70);
    expect(c.hindquarters.mean).toBe(70);
    const g = BREED_GENETIC_PROFILES[5].rating_profiles.gaits;
    expect(g.walk.mean).toBe(65);
    expect(g.gallop.mean).toBe(72);
    expect(g.gaiting).toBeNull();
  });

  test('Appaloosa (ID 6) conformation and gait means match BreedData', () => {
    const c = BREED_GENETIC_PROFILES[6].rating_profiles.conformation;
    expect(c.head.mean).toBe(82);
    expect(c.hindquarters.mean).toBe(88);
    const g = BREED_GENETIC_PROFILES[6].rating_profiles.gaits;
    expect(g.gallop.mean).toBe(85);
    expect(g.gaiting).toBeNull();
  });

  test('Andalusian (ID 8) conformation and gait means match BreedData', () => {
    const c = BREED_GENETIC_PROFILES[8].rating_profiles.conformation;
    expect(c.head.mean).toBe(85);
    expect(c.neck.mean).toBe(92);
    expect(c.hindquarters.mean).toBe(85);
    const g = BREED_GENETIC_PROFILES[8].rating_profiles.gaits;
    expect(g.trot.mean).toBe(85);
    expect(g.canter.mean).toBe(92);
  });

  test('American Quarter Horse (ID 9) conformation and gait means match BreedData', () => {
    const c = BREED_GENETIC_PROFILES[9].rating_profiles.conformation;
    expect(c.hindquarters.mean).toBe(92);
    expect(c.shoulders.mean).toBe(85);
    const g = BREED_GENETIC_PROFILES[9].rating_profiles.gaits;
    expect(g.gallop.mean).toBe(95);
    expect(g.canter.mean).toBe(75);
  });

  test('Walkaloosa (ID 10) conformation and gait means match source data', () => {
    const c = BREED_GENETIC_PROFILES[10].rating_profiles.conformation;
    expect(c.head.mean).toBe(74);
    expect(c.hindquarters.mean).toBe(75);
    const g = BREED_GENETIC_PROFILES[10].rating_profiles.gaits;
    expect(g.gaiting.mean).toBe(85);
    expect(g.gallop.mean).toBe(72);
  });
});

describe('Breed Genetic Profiles - Breed Name Validation', () => {
  test('Pony Of The Americas has correct capitalization (ID 5)', () => {
    const breed = CANONICAL_BREEDS.find(b => b.id === 5);
    expect(breed.name).toBe('Pony Of The Americas');
  });

  test('Andalusian is the canonical name for ID 8', () => {
    const breed = CANONICAL_BREEDS.find(b => b.id === 8);
    expect(breed.name).toBe('Andalusian');
  });

  test('American Quarter Horse is the full name for ID 9', () => {
    const breed = CANONICAL_BREEDS.find(b => b.id === 9);
    expect(breed.name).toBe('American Quarter Horse');
  });
});

describe('Breed Genetic Profiles - Temperament Weights', () => {
  test.each(ALL_BREED_IDS)('breed %i temperament weights sum to 100', breedId => {
    const weights = BREED_GENETIC_PROFILES[breedId].temperament_weights;
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  test.each(ALL_BREED_IDS)('breed %i has all 11 temperament types', breedId => {
    const weights = BREED_GENETIC_PROFILES[breedId].temperament_weights;
    for (const type of TEMPERAMENT_TYPES) {
      expect(weights).toHaveProperty(type);
      expect(typeof weights[type]).toBe('number');
      expect(weights[type]).toBeGreaterThanOrEqual(0);
    }
  });

  test('temperament weights match PRD-03 §7.3 for Thoroughbred (ID 1)', () => {
    const w = BREED_GENETIC_PROFILES[1].temperament_weights;
    expect(w.Spirited).toBe(30);
    expect(w.Nervous).toBe(15);
    expect(w.Calm).toBe(3);
    expect(w.Bold).toBe(15);
    expect(w.Steady).toBe(5);
    expect(w.Independent).toBe(5);
    expect(w.Reactive).toBe(15);
    expect(w.Stubborn).toBe(3);
    expect(w.Playful).toBe(5);
    expect(w.Lazy).toBe(3);
    expect(w.Aggressive).toBe(1);
  });

  test('temperament weights match PRD-03 §7.3 for Tennessee Walking Horse (ID 7)', () => {
    const w = BREED_GENETIC_PROFILES[7].temperament_weights;
    expect(w.Spirited).toBe(5);
    expect(w.Calm).toBe(41);
    expect(w.Steady).toBe(30);
    expect(w.Aggressive).toBe(1);
  });

  test('Paint Horse (ID 12) Aggressive weight is 1 (per BreedData)', () => {
    expect(BREED_GENETIC_PROFILES[12].temperament_weights.Aggressive).toBe(1);
  });
});

describe('Breed Genetic Profiles - Lusitano (ID 11)', () => {
  test('Lusitano conformation means match source data', () => {
    const c = BREED_GENETIC_PROFILES[11].rating_profiles.conformation;
    expect(c.head.mean).toBe(84);
    expect(c.neck.mean).toBe(90);
    expect(c.shoulders.mean).toBe(82);
    expect(c.back.mean).toBe(84);
    expect(c.hindquarters.mean).toBe(88);
    expect(c.legs.mean).toBe(82);
    expect(c.hooves.mean).toBe(80);
    expect(c.topline.mean).toBe(83);
  });

  test('Lusitano conformation has per-region std_dev values', () => {
    const c = BREED_GENETIC_PROFILES[11].rating_profiles.conformation;
    expect(c.head.std_dev).toBe(6);
    expect(c.neck.std_dev).toBe(5);
    expect(c.shoulders.std_dev).toBe(7);
    expect(c.back.std_dev).toBe(6);
    expect(c.hindquarters.std_dev).toBe(6);
    expect(c.legs.std_dev).toBe(7);
    expect(c.hooves.std_dev).toBe(7);
    expect(c.topline.std_dev).toBe(6);
  });

  test('Lusitano gait means match source data', () => {
    const g = BREED_GENETIC_PROFILES[11].rating_profiles.gaits;
    expect(g.walk.mean).toBe(78);
    expect(g.trot.mean).toBe(85);
    expect(g.canter.mean).toBe(92);
    expect(g.gallop.mean).toBe(72);
    expect(g.gaiting).toBeNull();
  });

  test('Lusitano gaits have per-gait std_dev values', () => {
    const g = BREED_GENETIC_PROFILES[11].rating_profiles.gaits;
    expect(g.walk.std_dev).toBe(7);
    expect(g.trot.std_dev).toBe(6);
    expect(g.canter.std_dev).toBe(5);
    expect(g.gallop.std_dev).toBe(8);
  });

  test('Lusitano is non-gaited', () => {
    expect(BREED_GENETIC_PROFILES[11].rating_profiles.is_gaited_breed).toBe(false);
    expect(BREED_GENETIC_PROFILES[11].rating_profiles.gaited_gait_registry).toBeNull();
  });

  test('Lusitano temperament weights match source data and sum to 100', () => {
    const w = BREED_GENETIC_PROFILES[11].temperament_weights;
    expect(w.Spirited).toBe(25);
    expect(w.Nervous).toBe(5);
    expect(w.Calm).toBe(10);
    expect(w.Bold).toBe(20);
    expect(w.Steady).toBe(15);
    expect(w.Independent).toBe(5);
    expect(w.Reactive).toBe(10);
    expect(w.Stubborn).toBe(5);
    expect(w.Playful).toBe(4);
    expect(w.Lazy).toBe(0);
    expect(w.Aggressive).toBe(1);
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});

describe('validateProfile - Runtime Validation', () => {
  test('valid profile returns empty error array', () => {
    const errors = validateProfile(1, BREED_GENETIC_PROFILES[1]);
    expect(errors).toEqual([]);
  });

  test('all 12 canonical profiles pass validation', () => {
    for (const id of ALL_BREED_IDS) {
      const errors = validateProfile(id, BREED_GENETIC_PROFILES[id]);
      expect(errors).toEqual([]);
    }
  });

  test('rejects profile with missing rating_profiles', () => {
    const errors = validateProfile(1, { temperament_weights: {} });
    expect(errors).toContain('missing rating_profiles');
  });

  test('rejects profile with missing conformation region', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    delete badProfile.rating_profiles.conformation.head;
    const errors = validateProfile(1, badProfile);
    expect(errors).toContain('missing conformation region: head');
  });

  test('rejects profile with conformation mean out of range', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.rating_profiles.conformation.head.mean = 150;
    const errors = validateProfile(1, badProfile);
    expect(errors.some(e => e.includes('conformation.head.mean out of range'))).toBe(true);
  });

  test('rejects profile with missing gait entry', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    delete badProfile.rating_profiles.gaits.walk;
    const errors = validateProfile(1, badProfile);
    expect(errors).toContain('missing gait: walk');
  });

  test('rejects temperament weights that do not sum to 100', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.temperament_weights.Spirited = 99;
    const errors = validateProfile(1, badProfile);
    expect(errors.some(e => e.includes('temperament weights sum to'))).toBe(true);
  });

  test('rejects gaited breed with null gaiting score', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[3]));
    badProfile.rating_profiles.gaits.gaiting = null;
    const errors = validateProfile(3, badProfile);
    expect(errors).toContain('gaited breed must have non-null gaiting score');
  });

  test('rejects non-gaited breed with non-null gaiting score', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.rating_profiles.gaits.gaiting = { mean: 50, std_dev: 9 };
    const errors = validateProfile(1, badProfile);
    expect(errors).toContain('non-gaited breed must have null gaiting score');
  });

  test('rejects gaited breed with empty registry', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[3]));
    badProfile.rating_profiles.gaited_gait_registry = [];
    const errors = validateProfile(3, badProfile);
    expect(errors).toContain('gaited breed must have non-empty gaited_gait_registry');
  });

  // EC-1: null/undefined profile
  test('rejects null profile without crashing', () => {
    const errors = validateProfile(1, null);
    expect(errors).toContain('profile is null, undefined, or not an object');
  });

  test('rejects undefined profile without crashing', () => {
    const errors = validateProfile(1, undefined);
    expect(errors).toContain('profile is null, undefined, or not an object');
  });

  // EC-2/EC-3: NaN conformation mean/std_dev
  test('rejects NaN conformation mean', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.rating_profiles.conformation.head.mean = NaN;
    const errors = validateProfile(1, badProfile);
    expect(errors.some(e => e.includes('conformation.head.mean is not a finite number'))).toBe(true);
  });

  test('rejects undefined conformation std_dev', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.rating_profiles.conformation.neck.std_dev = undefined;
    const errors = validateProfile(1, badProfile);
    expect(errors.some(e => e.includes('conformation.neck.std_dev is not a finite number'))).toBe(true);
  });

  // EC-4: NaN gait mean
  test('rejects NaN gait mean', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.rating_profiles.gaits.walk.mean = NaN;
    const errors = validateProfile(1, badProfile);
    expect(errors.some(e => e.includes('gaits.walk.mean is not a finite number'))).toBe(true);
  });

  // EC-5: extra temperament keys
  test('rejects extra temperament keys', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.temperament_weights.ExtraType = 0;
    const errors = validateProfile(1, badProfile);
    expect(errors.some(e => e.includes('temperament_weights has 12 keys, expected 11'))).toBe(true);
  });

  // EC-6: extra conformation regions
  test('rejects extra conformation regions', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.rating_profiles.conformation.extraRegion = { mean: 50, std_dev: 8 };
    const errors = validateProfile(1, badProfile);
    expect(errors.some(e => e.includes('conformation has 9 regions, expected 8'))).toBe(true);
  });

  // EC-7: non-integer temperament weights
  test('rejects non-integer temperament weights', () => {
    const badProfile = JSON.parse(JSON.stringify(BREED_GENETIC_PROFILES[1]));
    badProfile.temperament_weights.Spirited = 30.5;
    badProfile.temperament_weights.Nervous = 14.5;
    const errors = validateProfile(1, badProfile);
    expect(errors.some(e => e.includes('is not an integer'))).toBe(true);
  });
});
