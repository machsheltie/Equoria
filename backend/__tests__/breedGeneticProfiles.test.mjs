// Tests for breed genetic profile data structure and population script.
// Validates all 12 breed profiles match PRD specifications.

import {
  CANONICAL_BREEDS,
  BREED_GENETIC_PROFILES,
  TEMPERAMENT_TYPES,
} from '../modules/horses/data/breedGeneticProfiles.mjs';

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
      expect(conformation[region].std_dev).toBe(8);
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

  test('conformation means match PRD-02 §3.1 for Arabian (ID 2)', () => {
    const c = BREED_GENETIC_PROFILES[2].rating_profiles.conformation;
    expect(c.head.mean).toBe(85);
    expect(c.neck.mean).toBe(82);
    expect(c.shoulders.mean).toBe(70);
    expect(c.back.mean).toBe(68);
    expect(c.hindquarters.mean).toBe(72);
    expect(c.legs.mean).toBe(70);
    expect(c.hooves.mean).toBe(75);
  });

  test('conformation means match PRD-02 §3.1 for Paint Horse (ID 12)', () => {
    const c = BREED_GENETIC_PROFILES[12].rating_profiles.conformation;
    expect(c.head.mean).toBe(75);
    expect(c.neck.mean).toBe(76);
    expect(c.shoulders.mean).toBe(75);
    expect(c.back.mean).toBe(74);
    expect(c.hindquarters.mean).toBe(78);
    expect(c.legs.mean).toBe(73);
    expect(c.hooves.mean).toBe(73);
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
        expect(gaits[gaitName].std_dev).toBe(9);
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

  test('gait means match PRD-02 §3.2 for American Saddlebred (ID 3)', () => {
    const g = BREED_GENETIC_PROFILES[3].rating_profiles.gaits;
    expect(g.walk.mean).toBe(70);
    expect(g.trot.mean).toBe(75);
    expect(g.canter.mean).toBe(70);
    expect(g.gallop.mean).toBe(65);
    expect(g.gaiting.mean).toBe(85);
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

  test('American Saddlebred and NSH have Slow Gait and Rack', () => {
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

  test('Paint Horse (ID 12) Aggressive weight is 0 (valid per PRD)', () => {
    expect(BREED_GENETIC_PROFILES[12].temperament_weights.Aggressive).toBe(0);
  });
});

describe('Breed Genetic Profiles - Lusitano TBD Handling', () => {
  test('Lusitano (ID 11) has temperament weights', () => {
    const w = BREED_GENETIC_PROFILES[11].temperament_weights;
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  test('Lusitano (ID 11) has conformation ratings (TBD placeholders)', () => {
    const c = BREED_GENETIC_PROFILES[11].rating_profiles.conformation;
    for (const region of CONFORMATION_REGIONS) {
      expect(c[region]).toBeDefined();
      expect(c[region].mean).toBeGreaterThan(0);
      expect(c[region].std_dev).toBe(8);
    }
  });

  test('Lusitano (ID 11) has gait ratings (TBD placeholders)', () => {
    const g = BREED_GENETIC_PROFILES[11].rating_profiles.gaits;
    expect(g.walk.mean).toBeGreaterThan(0);
    expect(g.trot.mean).toBeGreaterThan(0);
    expect(g.gaiting).toBeNull();
  });

  test('Lusitano (ID 11) is non-gaited', () => {
    expect(BREED_GENETIC_PROFILES[11].rating_profiles.is_gaited_breed).toBe(false);
    expect(BREED_GENETIC_PROFILES[11].rating_profiles.gaited_gait_registry).toBeNull();
  });
});
