/**
 * genotypeGenerationService.test.mjs
 *
 * Tests for Story 31E-1a: Genotype Generation Service + Migration.
 *
 * Coverage:
 *   - sampleWeightedAllele: deterministic weight selection, floating-point edge cases
 *   - generateGenotype: all 17 CORE_LOCI present, extra loci from profile, null-profile fallback
 *   - Allele constraint: only allowed_alleles values are selected
 *   - Statistical test: 1000-sample E_Extension frequency within expected range
 *   - Integration: POST /api/v1/horses response includes colorGenotype
 *
 * Mocking strategy (balanced):
 *   - Unit tests: no mocking (pure functions)
 *   - Integration test: real DB (prisma) + real HTTP (supertest)
 */

import {
  sampleWeightedAllele,
  generateGenotype,
  CORE_LOCI,
} from '../modules/horses/services/genotypeGenerationService.mjs';
import prisma from '../db/index.mjs';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import config from '../config/config.mjs';
import app from '../app.mjs';

// ---------------------------------------------------------------------------
// sampleWeightedAllele — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('sampleWeightedAllele', () => {
  it('returns the only allele when weights has one entry', () => {
    const weights = { 'E/E': 1.0 };
    expect(sampleWeightedAllele(weights, () => 0.5)).toBe('E/E');
  });

  it('selects allele whose cumulative threshold is first exceeded', () => {
    // E/E: 0–0.2, E/e: 0.2–0.6, e/e: 0.6–1.0
    const weights = { 'E/E': 0.2, 'E/e': 0.4, 'e/e': 0.4 };

    // roll = 0.1 → hits E/E (≤ 0.2)
    expect(sampleWeightedAllele(weights, () => 0.1)).toBe('E/E');
    // roll = 0.2 → hits E/E (≤ 0.2)
    expect(sampleWeightedAllele(weights, () => 0.2)).toBe('E/E');
    // roll = 0.3 → hits E/e (≤ 0.6)
    expect(sampleWeightedAllele(weights, () => 0.3)).toBe('E/e');
    // roll = 0.7 → hits e/e (≤ 1.0)
    expect(sampleWeightedAllele(weights, () => 0.7)).toBe('e/e');
  });

  it('returns last allele as floating-point safety when roll exceeds sum', () => {
    // Weights intentionally sum to 0.99 (floating-point scenario)
    const weights = { 'E/E': 0.49, 'e/e': 0.5 };
    // Roll exactly 1.0 — exceeds both thresholds; last entry returned
    expect(sampleWeightedAllele(weights, () => 1.0)).toBe('e/e');
  });

  it('returns null for empty weights object', () => {
    expect(sampleWeightedAllele({}, () => 0.5)).toBeNull();
  });

  it('uses Math.random by default (not deterministic, just should not throw)', () => {
    const weights = { 'E/e': 1.0 };
    expect(() => sampleWeightedAllele(weights)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// generateGenotype — pure function, no mocks needed
// ---------------------------------------------------------------------------

describe('generateGenotype', () => {
  // Minimal representative profile (subset of Arabian)
  const arabianProfile = {
    allowed_alleles: {
      E_Extension: ['e/e', 'E/e', 'E/E'],
      A_Agouti: ['A/A', 'A/a', 'a/a'],
      Cr_Cream: ['n/n', 'Cr/n', 'Cr/Cr'],
      D_Dun: ['nd2/nd2', 'nd1/nd2', 'D/nd2'],
      Z_Silver: ['n/n', 'Z/n'],
      Ch_Champagne: ['n/n', 'Ch/n'],
      G_Gray: ['g/g', 'G/g'],
      Rn_Roan: ['rn/rn', 'Rn/rn'],
      W_DominantWhite: ['w/w', 'W20/w'],
      TO_Tobiano: ['to/to'],
      O_FrameOvero: ['n/n', 'O/n'],
      SB1_Sabino1: ['n/n', 'SB1/n'],
      SW_SplashWhite: ['n/n', 'SW1/n'],
      LP_LeopardComplex: ['lp/lp', 'LP/lp'],
      PATN1_Pattern1: ['patn1/patn1', 'PATN1/patn1'],
      EDXW: ['n/n'],
      MFSD12_Mushroom: ['N/N', 'M/N'],
      Prl_Pearl: ['n/n', 'prl/n'],
      BR1_Brindle1: ['n/n'],
    },
    allele_weights: {
      E_Extension: { 'e/e': 0.4, 'E/e': 0.4, 'E/E': 0.2 },
      A_Agouti: { 'A/A': 0.3, 'A/a': 0.4, 'a/a': 0.3 },
      Cr_Cream: { 'n/n': 0.85, 'Cr/n': 0.13, 'Cr/Cr': 0.02 },
      D_Dun: { 'nd2/nd2': 0.9, 'nd1/nd2': 0.08, 'D/nd2': 0.02 },
      Z_Silver: { 'n/n': 0.95, 'Z/n': 0.05 },
      Ch_Champagne: { 'n/n': 0.97, 'Ch/n': 0.03 },
      G_Gray: { 'g/g': 0.3, 'G/g': 0.7 },
      Rn_Roan: { 'rn/rn': 0.9, 'Rn/rn': 0.1 },
      W_DominantWhite: { 'w/w': 0.98, 'W20/w': 0.02 },
      TO_Tobiano: { 'to/to': 1.0 },
      O_FrameOvero: { 'n/n': 0.95, 'O/n': 0.05 },
      SB1_Sabino1: { 'n/n': 0.7, 'SB1/n': 0.3 },
      SW_SplashWhite: { 'n/n': 0.9, 'SW1/n': 0.1 },
      LP_LeopardComplex: { 'lp/lp': 0.99, 'LP/lp': 0.01 },
      PATN1_Pattern1: { 'patn1/patn1': 0.99, 'PATN1/patn1': 0.01 },
      EDXW: { 'n/n': 1.0 },
      MFSD12_Mushroom: { 'N/N': 0.97, 'M/N': 0.03 },
      Prl_Pearl: { 'n/n': 0.97, 'prl/n': 0.03 },
      BR1_Brindle1: { 'n/n': 1.0 },
    },
  };

  it('returns an object with all 17 CORE_LOCI for a valid profile', () => {
    const genotype = generateGenotype(arabianProfile);
    for (const locus of CORE_LOCI) {
      expect(genotype).toHaveProperty(locus);
      expect(typeof genotype[locus]).toBe('string');
      expect(genotype[locus].length).toBeGreaterThan(0);
    }
  });

  it('includes extra loci present in the breed profile (Prl_Pearl, BR1_Brindle1)', () => {
    const genotype = generateGenotype(arabianProfile);
    expect(genotype).toHaveProperty('Prl_Pearl');
    expect(genotype).toHaveProperty('BR1_Brindle1');
  });

  it('selects only alleles from allowed_alleles for each locus', () => {
    // Run 50 times to catch any out-of-range selection
    for (let i = 0; i < 50; i++) {
      const genotype = generateGenotype(arabianProfile);
      for (const locus of Object.keys(arabianProfile.allowed_alleles)) {
        const allowed = arabianProfile.allowed_alleles[locus];
        expect(allowed).toContain(genotype[locus]);
      }
    }
  });

  it('uses GENERIC_DEFAULTS when breedGeneticProfile is null', () => {
    const genotype = generateGenotype(null);
    // All 17 CORE_LOCI must be present
    expect(Object.keys(genotype)).toHaveLength(CORE_LOCI.length);
    for (const locus of CORE_LOCI) {
      expect(genotype).toHaveProperty(locus);
    }
    // Known defaults
    expect(genotype.G_Gray).toBe('g/g');
    expect(genotype.Rn_Roan).toBe('rn/rn');
  });

  it('uses GENERIC_DEFAULTS when breedGeneticProfile is undefined', () => {
    const genotype = generateGenotype(undefined);
    expect(Object.keys(genotype)).toHaveLength(CORE_LOCI.length);
  });

  it('falls back to first allowed_allele when no weight is defined for a locus', () => {
    const profileWithNoWeights = {
      allowed_alleles: {
        E_Extension: ['E/E', 'E/e', 'e/e'],
      },
      allele_weights: {},
    };
    const genotype = generateGenotype(profileWithNoWeights);
    // Should pick first allowed_allele: E/E
    expect(genotype.E_Extension).toBe('E/E');
  });

  it('uses deterministic RNG for repeatable output', () => {
    // Seeded RNG: always returns 0.1
    const rng = () => 0.1;
    const g1 = generateGenotype(arabianProfile, rng);
    const g2 = generateGenotype(arabianProfile, rng);
    expect(g1).toEqual(g2);
  });

  it('CORE_LOCI array has exactly 17 entries', () => {
    expect(CORE_LOCI).toHaveLength(17);
  });
});

// ---------------------------------------------------------------------------
// Statistical test: 1000 samples of E_Extension frequency
// ---------------------------------------------------------------------------

describe('generateGenotype statistical sampling', () => {
  it('E_Extension "E/e" frequency from breed weights matches expectation (~40%, ±10%)', () => {
    // Arabian E_Extension weights: { "e/e": 0.4, "E/e": 0.4, "E/E": 0.2 }
    const weights = { 'e/e': 0.4, 'E/e': 0.4, 'E/E': 0.2 };
    const SAMPLES = 1000;
    let eeHetCount = 0;

    for (let i = 0; i < SAMPLES; i++) {
      const result = sampleWeightedAllele(weights);
      if (result === 'E/e') {
        eeHetCount++;
      }
    }

    const frequency = eeHetCount / SAMPLES;
    // Expected: 0.40, tolerance: ±0.10 (generous range)
    expect(frequency).toBeGreaterThanOrEqual(0.3);
    expect(frequency).toBeLessThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// Integration test: POST /api/v1/horses includes colorGenotype in response
// Uses real DB (prisma) + real HTTP (supertest)
// ---------------------------------------------------------------------------

describe('POST /api/v1/horses — colorGenotype integration', () => {
  let server;
  let testUserId;
  let createdHorseId;
  let arabianBreedId;
  const timestamp = Date.now();

  const testUserData = {
    username: `genotype_test_${timestamp}`,
    email: `genotype_test_${timestamp}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Genotype',
    lastName: 'Test',
  };

  beforeAll(async () => {
    server = app.listen(0);

    // findFirst + create Arabian breed — creates it if absent in the test DB (no seed required)
    const arabianBreed =
      (await prisma.breed.findFirst({ where: { name: 'Arabian' } })) ??
      (await prisma.breed.create({ data: { name: 'Arabian', description: 'Arabian breed for genotype tests' } }));
    arabianBreedId = arabianBreed.id;

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

  it('created horse includes colorGenotype with all 17 CORE_LOCI', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-skip-csrf', 'true')
      .send({
        name: `GenotypeTest_${timestamp}`,
        breedId: arabianBreedId, // Arabian — has full allele_weights profile
        age: 3,
        sex: 'mare',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    const horse = response.body.data;

    // colorGenotype must be present and non-null
    expect(horse.colorGenotype).toBeDefined();
    expect(horse.colorGenotype).not.toBeNull();
    expect(typeof horse.colorGenotype).toBe('object');

    // All 17 CORE_LOCI must be present
    for (const locus of CORE_LOCI) {
      expect(horse.colorGenotype).toHaveProperty(locus);
    }

    // Track for cleanup
    createdHorseId = horse.id;
  });
});
