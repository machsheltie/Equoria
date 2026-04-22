/**
 * markingGenerationService.test.mjs
 *
 * Tests for Story 31E-3: Marking System.
 *
 * Coverage:
 *   - sampleWeightedFromMap: weighted random selection
 *   - generateFaceMarking: breed bias weights, default fallback
 *   - generateLegMarkings: general probability, type selection, max_legs_marked cap
 *   - generateAdvancedMarkings: base probability × multiplier
 *   - generateBooleanModifiers: base probabilities, flaxen chestnut-only guard
 *   - generateMarkings: full markings object structure
 *   - inheritMarkings: 40/40/20 sire/dam/reroll paths
 *   - Statistical: face marking distribution chi-squared p > 0.001
 *   - Integration: POST /api/v1/horses includes marking fields in phenotype
 *
 * Mocking strategy (balanced):
 *   - Unit tests: no mocking (pure functions)
 *   - Integration test: real DB (prisma) + real HTTP (supertest)
 */

import {
  sampleWeightedFromMap,
  generateFaceMarking,
  generateLegMarkings,
  generateAdvancedMarkings,
  generateBooleanModifiers,
  generateMarkings,
  inheritMarkings,
} from '../modules/horses/services/markingGenerationService.mjs';
import prisma from '../db/index.mjs';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import config from '../config/config.mjs';
import app from '../app.mjs';

import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
// ---------------------------------------------------------------------------
// Deterministic RNG helper
// ---------------------------------------------------------------------------

function alwaysReturn(val) {
  return () => val;
}

// ---------------------------------------------------------------------------
// sampleWeightedFromMap
// ---------------------------------------------------------------------------

let __csrf__;
beforeAll(async () => {
  __csrf__ = await fetchCsrf(app);
});

describe('sampleWeightedFromMap', () => {
  it('returns a key from the weight map', () => {
    const map = { none: 0.6, star: 0.2, blaze: 0.2 };
    const result = sampleWeightedFromMap(map, Math.random);
    expect(['none', 'star', 'blaze']).toContain(result);
  });

  it('returns first key when rng() returns 0', () => {
    const map = { none: 0.6, star: 0.2, blaze: 0.2 };
    // rng=0 → cumulative 0.6 >= 0 → returns first key
    expect(sampleWeightedFromMap(map, alwaysReturn(0))).toBe('none');
  });

  it('returns last key when rng() returns value above all but last', () => {
    const map = { none: 0.6, star: 0.2, blaze: 0.2 };
    // rng=0.99 → all cumulative < 0.99 except last → returns 'blaze'
    expect(sampleWeightedFromMap(map, alwaysReturn(0.99))).toBe('blaze');
  });

  it('returns first key of fallback when map is empty', () => {
    // Empty map — should return null or a fallback gracefully (not throw)
    expect(() => sampleWeightedFromMap({}, Math.random)).not.toThrow();
  });

  it('returns null for null input', () => {
    expect(sampleWeightedFromMap(null, Math.random)).toBeNull();
  });

  it('D-2: normalises sub-1.0 weight map — proportions are preserved', () => {
    // Weights sum to 0.2 (not 1.0). After normalisation, coronet should still
    // dominate when the proportion calls for it.
    const map = { coronet: 0.12, pastern: 0.08 }; // total = 0.2
    // rng=0 → always picks first key regardless of total
    expect(sampleWeightedFromMap(map, alwaysReturn(0))).toBe('coronet');
    // rng=0.99 (scaled: 0.99 * 0.2 = 0.198) → above coronet's 0.12 cumulative → pastern
    expect(sampleWeightedFromMap(map, alwaysReturn(0.99))).toBe('pastern');
  });
});

// ---------------------------------------------------------------------------
// generateFaceMarking
// ---------------------------------------------------------------------------

describe('generateFaceMarking', () => {
  const validFaceMarkings = ['none', 'star', 'strip', 'blaze', 'snip'];

  it('returns a valid face marking when no breed bias', () => {
    const result = generateFaceMarking(null, Math.random);
    expect(validFaceMarkings).toContain(result);
  });

  it('returns a valid face marking with breed bias', () => {
    const bias = { face: { none: 0.7, star: 0.1, strip: 0.1, blaze: 0.05, snip: 0.05 } };
    const result = generateFaceMarking(bias, Math.random);
    expect(validFaceMarkings).toContain(result);
  });

  it('returns "none" when rng is 0 and breed none weight is highest', () => {
    const bias = { face: { none: 0.7, star: 0.1, strip: 0.1, blaze: 0.05, snip: 0.05 } };
    expect(generateFaceMarking(bias, alwaysReturn(0))).toBe('none');
  });

  it('respects breed face weights — high star weight produces more stars', () => {
    const starHeavy = { face: { none: 0.0, star: 1.0, strip: 0.0, blaze: 0.0, snip: 0.0 } };
    // Always picks star when weight=1.0
    for (let i = 0; i < 10; i++) {
      expect(generateFaceMarking(starHeavy, Math.random)).toBe('star');
    }
  });
});

// ---------------------------------------------------------------------------
// generateLegMarkings
// ---------------------------------------------------------------------------

describe('generateLegMarkings', () => {
  const validLegTypes = ['none', 'coronet', 'pastern', 'sock', 'stocking'];

  it('returns an object with 4 named legs', () => {
    const result = generateLegMarkings(null, Math.random);
    expect(result).toHaveProperty('frontLeft');
    expect(result).toHaveProperty('frontRight');
    expect(result).toHaveProperty('hindLeft');
    expect(result).toHaveProperty('hindRight');
  });

  it('each leg value is a valid marking type', () => {
    const result = generateLegMarkings(null, Math.random);
    for (const leg of Object.values(result)) {
      expect(validLegTypes).toContain(leg);
    }
  });

  it('all legs are "none" when general probability is 0', () => {
    const bias = {
      legs_general_probability: 0,
      leg_specific_probabilities: { coronet: 0.4, pastern: 0.3, sock: 0.2, stocking: 0.1 },
    };
    const result = generateLegMarkings(bias, Math.random);
    expect(Object.values(result).every(v => v === 'none')).toBe(true);
  });

  it('all legs are marked (non-none) when general probability is 1', () => {
    const bias = {
      legs_general_probability: 1,
      leg_specific_probabilities: { coronet: 0.4, pastern: 0.3, sock: 0.2, stocking: 0.1 },
    };
    const result = generateLegMarkings(bias, Math.random);
    expect(Object.values(result).every(v => v !== 'none')).toBe(true);
  });

  it('respects max_legs_marked cap — at most N legs are non-none', () => {
    const bias = {
      legs_general_probability: 1, // all 4 would mark without cap
      leg_specific_probabilities: { coronet: 1.0, pastern: 0.0, sock: 0.0, stocking: 0.0 },
      max_legs_marked: 2,
    };
    const result = generateLegMarkings(bias, Math.random);
    const markedCount = Object.values(result).filter(v => v !== 'none').length;
    expect(markedCount).toBeLessThanOrEqual(2);
  });

  it('max_legs_marked=0 → all legs none', () => {
    const bias = {
      legs_general_probability: 1,
      leg_specific_probabilities: { coronet: 1.0, pastern: 0.0, sock: 0.0, stocking: 0.0 },
      max_legs_marked: 0,
    };
    const result = generateLegMarkings(bias, Math.random);
    expect(Object.values(result).every(v => v === 'none')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateAdvancedMarkings
// ---------------------------------------------------------------------------

describe('generateAdvancedMarkings', () => {
  it('returns an object with the three advanced marking flags', () => {
    const result = generateAdvancedMarkings(null, Math.random);
    expect(result).toHaveProperty('bloodyShoulderPresent');
    expect(result).toHaveProperty('snowflakePresent');
    expect(result).toHaveProperty('frostPresent');
    expect(typeof result.bloodyShoulderPresent).toBe('boolean');
  });

  it('all false when multiplier is 0', () => {
    const bias = {
      bloody_shoulder_probability_multiplier: 0,
      snowflake_probability_multiplier: 0,
      frost_probability_multiplier: 0,
    };
    const result = generateAdvancedMarkings(bias, Math.random);
    expect(result.bloodyShoulderPresent).toBe(false);
    expect(result.snowflakePresent).toBe(false);
    expect(result.frostPresent).toBe(false);
  });

  it('all true when rng always returns 0 (below any positive probability)', () => {
    // With default multiplier=1, base rates are 0.02/0.03/0.03 — rng=0 always passes
    const result = generateAdvancedMarkings(null, alwaysReturn(0));
    expect(result.bloodyShoulderPresent).toBe(true);
    expect(result.snowflakePresent).toBe(true);
    expect(result.frostPresent).toBe(true);
  });

  it('all false when rng always returns 1 (above any probability)', () => {
    const result = generateAdvancedMarkings(null, alwaysReturn(1));
    expect(result.bloodyShoulderPresent).toBe(false);
    expect(result.snowflakePresent).toBe(false);
    expect(result.frostPresent).toBe(false);
  });

  it('D-1: negative multiplier clamps to 0 probability — all flags false', () => {
    const bias = {
      bloody_shoulder_probability_multiplier: -10,
      snowflake_probability_multiplier: -10,
      frost_probability_multiplier: -10,
    };
    const result = generateAdvancedMarkings(bias, alwaysReturn(0));
    expect(result.bloodyShoulderPresent).toBe(false);
    expect(result.snowflakePresent).toBe(false);
    expect(result.frostPresent).toBe(false);
  });

  it('multiplier amplifies base rate — multiplier=10 with rng=0.15 passes bloody shoulder', () => {
    // base rate = 0.02, multiplier=10 → effective = 0.2, rng=0.15 < 0.2 → true
    const bias = {
      bloody_shoulder_probability_multiplier: 10,
      snowflake_probability_multiplier: 1,
      frost_probability_multiplier: 1,
    };
    const result = generateAdvancedMarkings(bias, alwaysReturn(0.15));
    expect(result.bloodyShoulderPresent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateBooleanModifiers
// ---------------------------------------------------------------------------

describe('generateBooleanModifiers', () => {
  it('returns the 4 modifier flags', () => {
    const result = generateBooleanModifiers(null, 'Bay', Math.random);
    expect(result).toHaveProperty('isSooty');
    expect(result).toHaveProperty('isFlaxen');
    expect(result).toHaveProperty('hasPangare');
    expect(result).toHaveProperty('isRabicano');
  });

  it('isFlaxen is always false for non-chestnut colors', () => {
    const colorNames = ['Bay', 'Black', 'Palomino', 'Buckskin', 'Grulla', 'Gold Champagne'];
    for (const colorName of colorNames) {
      const result = generateBooleanModifiers(null, colorName, alwaysReturn(0));
      expect(result.isFlaxen).toBe(false);
    }
  });

  it('isFlaxen can be true for Chestnut', () => {
    // rng=0 → below flaxen default probability (0.1), so isFlaxen=true
    const result = generateBooleanModifiers(null, 'Chestnut', alwaysReturn(0));
    expect(result.isFlaxen).toBe(true);
  });

  it('isFlaxen is false for Gold Champagne (not a true chestnut)', () => {
    const result = generateBooleanModifiers(null, 'Gold Champagne', alwaysReturn(0));
    expect(result.isFlaxen).toBe(false);
  });

  it('isFlaxen is true for "Dark Chestnut"', () => {
    const result = generateBooleanModifiers(null, 'Dark Chestnut', alwaysReturn(0));
    expect(result.isFlaxen).toBe(true);
  });

  it('breed prevalence overrides defaults — sooty=0 means never sooty', () => {
    const prevalence = { sooty: 0, flaxen: 0, pangare: 0, rabicano: 0 };
    const result = generateBooleanModifiers(prevalence, 'Chestnut', Math.random);
    expect(result.isSooty).toBe(false);
    expect(result.isFlaxen).toBe(false);
    expect(result.hasPangare).toBe(false);
    expect(result.isRabicano).toBe(false);
  });

  it('breed prevalence=1 means always all modifiers (except flaxen on non-chestnut)', () => {
    const prevalence = { sooty: 1, flaxen: 1, pangare: 1, rabicano: 1 };
    const result = generateBooleanModifiers(prevalence, 'Chestnut', Math.random);
    expect(result.isSooty).toBe(true);
    expect(result.isFlaxen).toBe(true);
    expect(result.hasPangare).toBe(true);
    expect(result.isRabicano).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateMarkings — full object
// ---------------------------------------------------------------------------

describe('generateMarkings', () => {
  it('returns all required marking fields', () => {
    const result = generateMarkings(null, 'Bay', Math.random);
    expect(result).toHaveProperty('faceMarking');
    expect(result).toHaveProperty('legMarkings');
    expect(result).toHaveProperty('advancedMarkings');
    expect(result).toHaveProperty('modifiers');
  });

  it('does not throw with null breed profile', () => {
    expect(() => generateMarkings(null, 'Bay', Math.random)).not.toThrow();
  });

  it('does not throw with undefined colorName', () => {
    expect(() => generateMarkings(null, undefined, Math.random)).not.toThrow();
  });

  it('does not throw with full breed profile', () => {
    const profile = {
      marking_bias: {
        face: { none: 0.7, star: 0.1, strip: 0.1, blaze: 0.05, snip: 0.05 },
        legs_general_probability: 0.2,
        leg_specific_probabilities: { coronet: 0.4, pastern: 0.3, sock: 0.2, stocking: 0.1 },
        max_legs_marked: 2,
      },
      boolean_modifiers_prevalence: { sooty: 0.5, flaxen: 0.0, pangare: 0.2, rabicano: 0.0 },
      advanced_markings_bias: {
        bloody_shoulder_probability_multiplier: 1.0,
        snowflake_probability_multiplier: 1.0,
        frost_probability_multiplier: 1.0,
      },
    };
    expect(() => generateMarkings(profile, 'Bay', Math.random)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// inheritMarkings
// ---------------------------------------------------------------------------

describe('inheritMarkings', () => {
  const mockSireMarkings = {
    faceMarking: 'blaze',
    legMarkings: { frontLeft: 'sock', frontRight: 'none', hindLeft: 'none', hindRight: 'none' },
    advancedMarkings: { bloodyShoulderPresent: false, snowflakePresent: false, frostPresent: false },
    modifiers: { isSooty: true, isFlaxen: false, hasPangare: false, isRabicano: false },
  };

  const mockDamMarkings = {
    faceMarking: 'star',
    legMarkings: { frontLeft: 'none', frontRight: 'pastern', hindLeft: 'none', hindRight: 'none' },
    advancedMarkings: { bloodyShoulderPresent: false, snowflakePresent: false, frostPresent: false },
    modifiers: { isSooty: false, isFlaxen: false, hasPangare: true, isRabicano: false },
  };

  it('returns all required marking fields', () => {
    const result = inheritMarkings(mockSireMarkings, mockDamMarkings, null, 'Bay', Math.random);
    expect(result).toHaveProperty('faceMarking');
    expect(result).toHaveProperty('legMarkings');
    expect(result).toHaveProperty('advancedMarkings');
    expect(result).toHaveProperty('modifiers');
  });

  it('inherits sire face marking when rng < 0.4', () => {
    const result = inheritMarkings(mockSireMarkings, mockDamMarkings, null, 'Bay', alwaysReturn(0.1));
    expect(result.faceMarking).toBe('blaze');
  });

  it('inherits dam face marking when 0.4 <= rng < 0.8', () => {
    const result = inheritMarkings(mockSireMarkings, mockDamMarkings, null, 'Bay', alwaysReturn(0.5));
    expect(result.faceMarking).toBe('star');
  });

  it('generates random face marking when rng >= 0.8 (20% reroll zone)', () => {
    // rng >= 0.8 → reroll path: calls generateFaceMarking with defaults
    // With alwaysReturn(0.85), the reroll itself uses the same rng so it picks first weighted key
    const result = inheritMarkings(mockSireMarkings, mockDamMarkings, null, 'Bay', alwaysReturn(0.85));
    const valid = ['none', 'star', 'strip', 'blaze', 'snip'];
    expect(valid).toContain(result.faceMarking);
  });

  it('P-1: non-chestnut foal cannot inherit isFlaxen=true from chestnut parent', () => {
    const chestnutSire = {
      ...mockSireMarkings,
      modifiers: { isSooty: false, isFlaxen: true, hasPangare: false, isRabicano: false },
    };
    // rng < 0.4 → sire path — but foal color is 'Bay' (not chestnut)
    const result = inheritMarkings(chestnutSire, mockDamMarkings, null, 'Bay', alwaysReturn(0.1));
    expect(result.modifiers.isFlaxen).toBe(false);
  });

  it('P-1: chestnut foal can inherit isFlaxen=true from chestnut parent', () => {
    const chestnutSire = {
      ...mockSireMarkings,
      modifiers: { isSooty: false, isFlaxen: true, hasPangare: false, isRabicano: false },
    };
    // rng < 0.4 → sire path, foal color is 'Chestnut'
    const result = inheritMarkings(chestnutSire, mockDamMarkings, null, 'Chestnut', alwaysReturn(0.1));
    expect(result.modifiers.isFlaxen).toBe(true);
  });

  it('does not throw when sire markings are null (fallback to random)', () => {
    expect(() => inheritMarkings(null, mockDamMarkings, null, 'Bay', Math.random)).not.toThrow();
  });

  it('does not throw when both parent markings are null', () => {
    expect(() => inheritMarkings(null, null, null, 'Bay', Math.random)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Statistical: face marking chi-squared (AC1 — default weight distribution)
// ---------------------------------------------------------------------------

describe('generateFaceMarking — statistical distribution (chi-squared)', () => {
  const TRIALS = 10000;

  it('generates face markings matching breed bias distribution (chi-squared p > 0.001)', () => {
    const bias = {
      face: { none: 0.6, star: 0.15, strip: 0.12, blaze: 0.08, snip: 0.05 },
    };

    const counts = { none: 0, star: 0, strip: 0, blaze: 0, snip: 0 };
    for (let i = 0; i < TRIALS; i++) {
      const marking = generateFaceMarking(bias, Math.random);
      counts[marking]++;
    }

    const expected = { none: 0.6, star: 0.15, strip: 0.12, blaze: 0.08, snip: 0.05 };
    let chiSq = 0;
    for (const [key, expectedProb] of Object.entries(expected)) {
      const e = TRIALS * expectedProb;
      chiSq += (counts[key] - e) ** 2 / e;
    }

    // df=4 (5 categories - 1), p=0.001 critical = 18.467
    expect(chiSq).toBeLessThan(18.467);
  });
});

// ---------------------------------------------------------------------------
// Integration: POST /api/v1/horses includes marking fields
// ---------------------------------------------------------------------------

describe('POST /api/v1/horses — markings integration', () => {
  let server;
  let testUserId;
  let createdHorseId;
  let breedId;
  const timestamp = Date.now();

  const testUserData = {
    username: `marktest_${timestamp}`,
    email: `marktest_${timestamp}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Mark',
    lastName: 'Test',
  };

  beforeAll(async () => {
    server = app.listen(0);

    const breed =
      (await prisma.breed.findFirst({ where: { name: 'Arabian' } })) ??
      (await prisma.breed.create({ data: { name: 'Arabian', description: 'Arabian for marking tests' } }));
    breedId = breed.id;

    const hashedPassword = await bcrypt.hash(testUserData.password, 10);
    const user = await prisma.user.create({
      data: {
        username: testUserData.username,
        email: testUserData.email,
        password: hashedPassword,
        firstName: testUserData.firstName,
        lastName: testUserData.lastName,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (createdHorseId) {
      await prisma.horse.deleteMany({ where: { id: createdHorseId } });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('created horse phenotype includes faceMarking, legMarkings, advancedMarkings, modifiers', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `MarkingTestHorse_${timestamp}`,
        breedId,
        age: 3,
        sex: 'stallion',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    const horse = response.body.data;
    const phenotype = horse.phenotype;

    expect(phenotype).toBeDefined();
    expect(typeof phenotype.colorName).toBe('string');

    // Marking fields must be present
    expect(phenotype).toHaveProperty('faceMarking');
    expect(['none', 'star', 'strip', 'blaze', 'snip']).toContain(phenotype.faceMarking);

    expect(phenotype).toHaveProperty('legMarkings');
    expect(phenotype.legMarkings).toHaveProperty('frontLeft');
    expect(phenotype.legMarkings).toHaveProperty('frontRight');
    expect(phenotype.legMarkings).toHaveProperty('hindLeft');
    expect(phenotype.legMarkings).toHaveProperty('hindRight');

    expect(phenotype).toHaveProperty('advancedMarkings');
    expect(typeof phenotype.advancedMarkings.bloodyShoulderPresent).toBe('boolean');
    expect(typeof phenotype.advancedMarkings.snowflakePresent).toBe('boolean');
    expect(typeof phenotype.advancedMarkings.frostPresent).toBe('boolean');

    expect(phenotype).toHaveProperty('modifiers');
    expect(typeof phenotype.modifiers.isSooty).toBe('boolean');
    expect(typeof phenotype.modifiers.isFlaxen).toBe('boolean');
    expect(typeof phenotype.modifiers.hasPangare).toBe('boolean');
    expect(typeof phenotype.modifiers.isRabicano).toBe('boolean');

    createdHorseId = horse.id;
  });
});
