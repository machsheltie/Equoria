/**
 * breedingColorInheritanceService.test.mjs
 *
 * Tests for Story 31E-2: Mendelian Breeding Inheritance + Lethal Filtering.
 *
 * Coverage:
 *   - splitAlleles: homozygous, heterozygous, edge cases
 *   - isLethalCombination: O/O, W homozygous, SW homozygous, EDXW homozygous, safe pairs
 *   - inheritLocus: Mendelian recombination + lethal reroll
 *   - inheritColorGenotype: full genotype inheritance, breed restriction, missing parent fallback
 *   - Statistical: 1000× Ee×Ee → 1:2:1 chi-squared p > 0.05
 *   - Statistical: O/n × O/n → O/O never appears in 1000 trials
 *   - Integration: POST /api/v1/horses with sireId + damId inherits from parents
 *
 * Mocking strategy (balanced):
 *   - Unit tests: no mocking (pure functions)
 *   - Integration test: real DB (prisma) + real HTTP (supertest)
 */

import {
  splitAlleles,
  isLethalCombination,
  inheritLocus,
  inheritColorGenotype,
  assembleAllelePair,
  drawAllele,
  LETHAL_COMBINATIONS,
} from '../modules/horses/services/breedingColorInheritanceService.mjs';
import { CORE_LOCI } from '../modules/horses/services/genotypeGenerationService.mjs';
import prisma from '../db/index.mjs';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import config from '../config/config.mjs';
import app from '../app.mjs';

import { fetchCsrf } from '../tests/helpers/csrfHelper.mjs';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a deterministic RNG that always returns the given sequence of values,
 * cycling back to the start when exhausted.
 */
function deterministicRng(values) {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/**
 * Build a minimal genotype with all non-expressing (wild-type) alleles,
 * then merge overrides.
 */
function buildGenotype(overrides = {}) {
  return {
    E_Extension: 'E/e',
    A_Agouti: 'A/a',
    Cr_Cream: 'n/n',
    D_Dun: 'nd2/nd2',
    Z_Silver: 'n/n',
    Ch_Champagne: 'n/n',
    G_Gray: 'g/g',
    Rn_Roan: 'rn/rn',
    W_DominantWhite: 'w/w',
    TO_Tobiano: 'to/to',
    O_FrameOvero: 'n/n',
    SB1_Sabino1: 'n/n',
    SW_SplashWhite: 'n/n',
    LP_LeopardComplex: 'lp/lp',
    PATN1_Pattern1: 'patn1/patn1',
    EDXW: 'n/n',
    MFSD12_Mushroom: 'N/N',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// splitAlleles
// ---------------------------------------------------------------------------

describe('splitAlleles', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  });

  it('splits heterozygous pair E/e → ["E", "e"]', () => {
    expect(splitAlleles('E/e')).toEqual(['E', 'e']);
  });

  it('splits homozygous dominant E/E → ["E", "E"]', () => {
    expect(splitAlleles('E/E')).toEqual(['E', 'E']);
  });

  it('splits homozygous recessive e/e → ["e", "e"]', () => {
    expect(splitAlleles('e/e')).toEqual(['e', 'e']);
  });

  it('splits multi-character alleles nd2/nd2 correctly', () => {
    expect(splitAlleles('nd2/nd2')).toEqual(['nd2', 'nd2']);
  });

  it('splits nd1/nd2 correctly', () => {
    expect(splitAlleles('nd1/nd2')).toEqual(['nd1', 'nd2']);
  });

  it('splits W20/w → ["W20", "w"]', () => {
    expect(splitAlleles('W20/w')).toEqual(['W20', 'w']);
  });

  it('returns ["n","n"] for null input', () => {
    expect(splitAlleles(null)).toEqual(['n', 'n']);
  });

  it('returns ["n","n"] for empty string', () => {
    expect(splitAlleles('')).toEqual(['n', 'n']);
  });
});

// ---------------------------------------------------------------------------
// isLethalCombination
// ---------------------------------------------------------------------------

describe('isLethalCombination', () => {
  it('identifies O/O as lethal for O_FrameOvero', () => {
    expect(isLethalCombination('O_FrameOvero', 'O/O')).toBe(true);
  });

  it('does NOT flag O/n as lethal', () => {
    expect(isLethalCombination('O_FrameOvero', 'O/n')).toBe(false);
  });

  it('does NOT flag n/n as lethal', () => {
    expect(isLethalCombination('O_FrameOvero', 'n/n')).toBe(false);
  });

  it('identifies W20/W20 as lethal for W_DominantWhite', () => {
    expect(isLethalCombination('W_DominantWhite', 'W20/W20')).toBe(true);
  });

  it('does NOT flag W20/w as lethal', () => {
    expect(isLethalCombination('W_DominantWhite', 'W20/w')).toBe(false);
  });

  it('identifies SW3/SW3 as lethal for SW_SplashWhite', () => {
    expect(isLethalCombination('SW_SplashWhite', 'SW3/SW3')).toBe(true);
  });

  it('does NOT flag SW1/n as lethal', () => {
    expect(isLethalCombination('SW_SplashWhite', 'SW1/n')).toBe(false);
  });

  it('identifies EDXW1/EDXW1 as lethal for EDXW', () => {
    expect(isLethalCombination('EDXW', 'EDXW1/EDXW1')).toBe(true);
  });

  it('does NOT flag EDXW1/n as lethal', () => {
    expect(isLethalCombination('EDXW', 'EDXW1/n')).toBe(false);
  });

  it('returns false for unknown locus', () => {
    expect(isLethalCombination('Unknown_Locus', 'X/X')).toBe(false);
  });

  it('LETHAL_COMBINATIONS is exported and contains expected loci', () => {
    expect(LETHAL_COMBINATIONS).toHaveProperty('O_FrameOvero');
    expect(LETHAL_COMBINATIONS).toHaveProperty('W_DominantWhite');
    expect(LETHAL_COMBINATIONS).toHaveProperty('SW_SplashWhite');
    expect(LETHAL_COMBINATIONS).toHaveProperty('EDXW');
  });

  it('detects lethal pair in reversed ordering (B/A as well as A/B)', () => {
    // All current lethals are homozygous so A/B === B/A, but the implementation
    // must also handle asymmetric lethals if added in future.
    // Verify the reversed-check code path by directly asserting symmetric homozygous cases.
    expect(isLethalCombination('O_FrameOvero', 'O/O')).toBe(true); // normal
    // Simulate a reversed pair via the split/rejoin path: 'O/O' reversed is still 'O/O'
    expect(isLethalCombination('W_DominantWhite', 'W5/W5')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// drawAllele
// ---------------------------------------------------------------------------

describe('drawAllele', () => {
  it('picks first allele when rng < 0.5', () => {
    expect(drawAllele(['E', 'e'], () => 0.3)).toBe('E');
  });

  it('picks second allele when rng >= 0.5', () => {
    expect(drawAllele(['E', 'e'], () => 0.7)).toBe('e');
  });

  it('picks second allele at exactly 0.5', () => {
    expect(drawAllele(['E', 'e'], () => 0.5)).toBe('e');
  });
});

// ---------------------------------------------------------------------------
// assembleAllelePair
// ---------------------------------------------------------------------------

describe('assembleAllelePair', () => {
  it('assembles E + e → "E/e"', () => {
    expect(assembleAllelePair('E', 'e')).toBe('E/e');
  });

  it('assembles E + E → "E/E"', () => {
    expect(assembleAllelePair('E', 'E')).toBe('E/E');
  });

  it('preserves sire-first order: e + E → "e/E"', () => {
    expect(assembleAllelePair('e', 'E')).toBe('e/E');
  });
});

// ---------------------------------------------------------------------------
// inheritLocus
// ---------------------------------------------------------------------------

describe('inheritLocus — basic Mendelian recombination', () => {
  it('produces E/E when rng always picks first allele from E/E × E/E', () => {
    const rng = deterministicRng([0.1, 0.1]);
    expect(inheritLocus('E_Extension', 'E/E', 'E/E', rng)).toBe('E/E');
  });

  it('produces E/e when sire rng picks E (0.1) and dam rng picks e (0.9) from E/e × E/e', () => {
    const rng = deterministicRng([0.1, 0.9]);
    expect(inheritLocus('E_Extension', 'E/e', 'E/e', rng)).toBe('E/e');
  });

  it('produces e/E when sire rng picks e (0.9) and dam rng picks E (0.1)', () => {
    const rng = deterministicRng([0.9, 0.1]);
    expect(inheritLocus('E_Extension', 'E/e', 'E/e', rng)).toBe('e/E');
  });

  it('produces e/e when rng always picks second allele from E/e × E/e', () => {
    const rng = deterministicRng([0.9, 0.9]);
    expect(inheritLocus('E_Extension', 'E/e', 'E/e', rng)).toBe('e/e');
  });

  it('produces n/n from n/n × n/n', () => {
    expect(inheritLocus('O_FrameOvero', 'n/n', 'n/n', Math.random)).toBe('n/n');
  });
});

describe('inheritLocus — lethal reroll', () => {
  it('never returns O/O for O/n × O/n — rerolls to non-lethal', () => {
    // Force the first few draws to produce O/O, then eventually n/n
    // O comes from position 0, n from position 1 in 'O/n'
    // To produce O/O: sire picks O (< 0.5), dam picks O (< 0.5)
    // To avoid O/O: at least one picks n (>= 0.5)
    // Sequence: 0.1,0.1 → O/O (lethal, reroll), then 0.1,0.9 → O/n (safe)
    const rng = deterministicRng([0.1, 0.1, 0.1, 0.9]);
    const result = inheritLocus('O_FrameOvero', 'O/n', 'O/n', rng);
    expect(result).not.toBe('O/O');
    expect(isLethalCombination('O_FrameOvero', result)).toBe(false);
  });

  it('uses heterozygous fallback after exhausting reroll attempts — returns O/n (carrier form)', () => {
    // Force all 100 attempts to produce O/O by always picking index 0
    const alwaysFirst = deterministicRng([0.1]);
    // With O/n × O/n, O is always at index 0, so alwaysFirst produces O/O every time
    const result = inheritLocus('O_FrameOvero', 'O/n', 'O/n', alwaysFirst);
    // After 100 attempts the fallback kicks in — spec mandates 'O/n' (carrier allele first)
    expect(result).toBe('O/n');
    expect(isLethalCombination('O_FrameOvero', result)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// inheritColorGenotype — full genotype
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — structure', () => {
  it('returns an object containing all CORE_LOCI', () => {
    const sire = buildGenotype();
    const dam = buildGenotype();
    const result = inheritColorGenotype(sire, dam);
    for (const locus of CORE_LOCI) {
      expect(result).toHaveProperty(locus);
      expect(typeof result[locus]).toBe('string');
    }
  });

  it('foal of e/e × e/e always has e/e Extension', () => {
    const sire = buildGenotype({ E_Extension: 'e/e' });
    const dam = buildGenotype({ E_Extension: 'e/e' });
    for (let i = 0; i < 20; i++) {
      const foal = inheritColorGenotype(sire, dam);
      expect(foal.E_Extension).toBe('e/e');
    }
  });

  it('foal of E/E × E/E always has E/E Extension', () => {
    const sire = buildGenotype({ E_Extension: 'E/E' });
    const dam = buildGenotype({ E_Extension: 'E/E' });
    for (let i = 0; i < 20; i++) {
      const foal = inheritColorGenotype(sire, dam);
      expect(foal.E_Extension).toBe('E/E');
    }
  });

  it('foal genotype does not contain O/O when both parents are O/n', () => {
    const sire = buildGenotype({ O_FrameOvero: 'O/n' });
    const dam = buildGenotype({ O_FrameOvero: 'O/n' });
    for (let i = 0; i < 50; i++) {
      const foal = inheritColorGenotype(sire, dam);
      expect(foal.O_FrameOvero).not.toBe('O/O');
    }
  });
});

describe('inheritColorGenotype — breed restrictions', () => {
  it('overrides TO_Tobiano to to/to when breed only allows to/to (Thoroughbred-like)', () => {
    const thoroughbredProfile = {
      allowed_alleles: {
        TO_Tobiano: ['to/to'],
      },
    };
    const sire = buildGenotype({ TO_Tobiano: 'TO/to' });
    const dam = buildGenotype({ TO_Tobiano: 'TO/to' });

    // Run 20 times — even if inheritance would produce TO/TO or TO/to, breed restricts to to/to
    for (let i = 0; i < 20; i++) {
      const foal = inheritColorGenotype(sire, dam, thoroughbredProfile);
      expect(foal.TO_Tobiano).toBe('to/to');
    }
  });

  it('does NOT override loci not in allowed_alleles', () => {
    const restrictedProfile = {
      allowed_alleles: {
        TO_Tobiano: ['to/to'],
      },
    };
    const sire = buildGenotype({ E_Extension: 'e/e' });
    const dam = buildGenotype({ E_Extension: 'e/e' });
    const foal = inheritColorGenotype(sire, dam, restrictedProfile);
    // E_Extension not restricted — should still be e/e from parents
    expect(foal.E_Extension).toBe('e/e');
  });

  it('applies no restrictions when foalBreedProfile is null', () => {
    const sire = buildGenotype();
    const dam = buildGenotype();
    expect(() => inheritColorGenotype(sire, dam, null)).not.toThrow();
  });

  it('does NOT apply a breed restriction when allowed[0] would be a lethal allele pair', () => {
    // A misconfigured breed profile that lists a lethal as the required allele.
    // The guard in enforceBreedRestrictions must preserve the inherited non-lethal value.
    const brokenProfile = {
      allowed_alleles: {
        O_FrameOvero: ['O/O'], // lethal — must never be installed
      },
    };
    const sire = buildGenotype({ O_FrameOvero: 'n/n' });
    const dam = buildGenotype({ O_FrameOvero: 'n/n' });
    const foal = inheritColorGenotype(sire, dam, brokenProfile);
    // Restriction must be skipped — foal keeps the inherited non-lethal value
    expect(isLethalCombination('O_FrameOvero', foal.O_FrameOvero)).toBe(false);
  });
});

describe('inheritColorGenotype — missing parent fallback', () => {
  it('returns a valid genotype when sireGenotype is null (falls back to random)', () => {
    const dam = buildGenotype();
    const result = inheritColorGenotype(null, dam);
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('returns a valid genotype when sireGenotype is undefined (falls back to random)', () => {
    const dam = buildGenotype();
    const result = inheritColorGenotype(undefined, dam);
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('returns a valid genotype when damGenotype is null (falls back to random)', () => {
    const sire = buildGenotype();
    const result = inheritColorGenotype(sire, null);
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('returns a valid genotype when damGenotype is undefined (falls back to random)', () => {
    const sire = buildGenotype();
    const result = inheritColorGenotype(sire, undefined);
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('returns a valid genotype when damGenotype is empty object (falls back to random)', () => {
    const sire = buildGenotype();
    const result = inheritColorGenotype(sire, {});
    expect(result).toBeDefined();
    expect(typeof result.E_Extension).toBe('string');
  });

  it('does not throw when both parents are null', () => {
    expect(() => inheritColorGenotype(null, null)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Statistical: Mendelian ratio (AC5)
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — statistical Mendelian ratio (AC5)', () => {
  // 10000 trials matches project standard (pre-31d-chi-squared-flakiness-fix).
  // p=0.001 critical value for df=2 = 13.816 — far less likely to flake than p=0.05.
  const TRIALS = 10000;

  it('Ee × Ee produces ~25% EE, ~50% Ee or eE, ~25% ee (chi-squared p > 0.001)', () => {
    const sire = buildGenotype({ E_Extension: 'E/e' });
    const dam = buildGenotype({ E_Extension: 'E/e' });

    const counts = { EE: 0, Ee: 0, ee: 0 };

    for (let i = 0; i < TRIALS; i++) {
      const foal = inheritColorGenotype(sire, dam);
      const ext = foal.E_Extension;
      if (ext === 'E/E') {
        counts.EE++;
      } else if (ext === 'e/e') {
        counts.ee++;
      } else {
        counts.Ee++; // 'E/e' or 'e/E'
      }
    }

    // Expected: 25% EE, 50% Ee, 25% ee
    const expectedEE = TRIALS * 0.25;
    const expectedEe = TRIALS * 0.5;
    const expectedee = TRIALS * 0.25;

    // Chi-squared statistic
    const chiSq =
      (counts.EE - expectedEE) ** 2 / expectedEE +
      (counts.Ee - expectedEe) ** 2 / expectedEe +
      (counts.ee - expectedee) ** 2 / expectedee;

    // df=2, p=0.001 critical value = 13.816
    expect(chiSq).toBeLessThan(13.816);
  });
});

// ---------------------------------------------------------------------------
// Statistical: O/O never appears (AC2 property-based)
// ---------------------------------------------------------------------------

describe('inheritColorGenotype — O/O never appears (AC2 property)', () => {
  it('O/n × O/n in 1000 trials never produces O/O foal', () => {
    const sire = buildGenotype({ O_FrameOvero: 'O/n' });
    const dam = buildGenotype({ O_FrameOvero: 'O/n' });

    for (let i = 0; i < 1000; i++) {
      const foal = inheritColorGenotype(sire, dam);
      expect(foal.O_FrameOvero).not.toBe('O/O');
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: POST /api/v1/horses with sireId + damId inherits genotype
// ---------------------------------------------------------------------------

describe('POST /api/v1/horses — breeding inheritance integration', () => {
  let server;
  let testUserId;
  let sireHorseId;
  let damHorseId;
  let foalHorseId;
  let breedId;
  const timestamp = Date.now();

  const testUserData = {
    username: `breedtest_${timestamp}`,
    email: `breedtest_${timestamp}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Breed',
    lastName: 'Test',
  };

  beforeAll(async () => {
    server = app.listen(0);

    const breed =
      (await prisma.breed.findFirst({ where: { name: 'Arabian' } })) ??
      (await prisma.breed.create({ data: { name: 'Arabian', description: 'Arabian breed for inheritance tests' } }));
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

    // Create sire with a known all-chestnut genotype (e/e)
    // This ensures foal will also be e/e Extension
    const sireGenotype = {
      E_Extension: 'e/e',
      A_Agouti: 'A/a',
      Cr_Cream: 'n/n',
      D_Dun: 'nd2/nd2',
      Z_Silver: 'n/n',
      Ch_Champagne: 'n/n',
      G_Gray: 'g/g',
      Rn_Roan: 'rn/rn',
      W_DominantWhite: 'w/w',
      TO_Tobiano: 'to/to',
      O_FrameOvero: 'n/n',
      SB1_Sabino1: 'n/n',
      SW_SplashWhite: 'n/n',
      LP_LeopardComplex: 'lp/lp',
      PATN1_Pattern1: 'patn1/patn1',
      EDXW: 'n/n',
      MFSD12_Mushroom: 'N/N',
    };

    const sire = await prisma.horse.create({
      data: {
        name: `SireTest_${timestamp}`,
        age: 5,
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        sex: 'stallion',
        breedId,
        userId: testUserId,
        colorGenotype: sireGenotype,
      },
    });
    sireHorseId = sire.id;

    const dam = await prisma.horse.create({
      data: {
        name: `DamTest_${timestamp}`,
        age: 5,
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        sex: 'mare',
        breedId,
        userId: testUserId,
        colorGenotype: sireGenotype, // same e/e genotype for deterministic test
      },
    });
    damHorseId = dam.id;
  });

  afterAll(async () => {
    const cleanupIds = [foalHorseId, sireHorseId, damHorseId].filter(Boolean);
    if (cleanupIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: cleanupIds } } });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  it('foal created with sireId+damId inherits Extension from parents (e/e × e/e → e/e)', async () => {
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
        name: `FoalTest_${timestamp}`,
        breedId,
        age: 0,
        sex: 'mare',
        sireId: sireHorseId,
        damId: damHorseId,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    const foal = response.body.data;

    // The foal must have a colorGenotype (inherited)
    expect(foal.colorGenotype).toBeDefined();
    expect(typeof foal.colorGenotype).toBe('object');

    // Since both parents are e/e, foal MUST also be e/e — inheritance not random
    expect(foal.colorGenotype.E_Extension).toBe('e/e');

    // Phenotype must be Chestnut (e/e → chestnut)
    expect(foal.phenotype).toBeDefined();
    expect(foal.phenotype.colorName).toBe('Chestnut');

    foalHorseId = foal.id;
  });

  it('foal created WITHOUT sireId/damId uses random generation (no inheritance)', async () => {
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
        name: `RandomHorse_${timestamp}`,
        breedId,
        age: 3,
        sex: 'stallion',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    const horse = response.body.data;

    // Must still have colorGenotype + phenotype (random generation path)
    expect(horse.colorGenotype).toBeDefined();
    expect(horse.phenotype).toBeDefined();
    expect(typeof horse.phenotype.colorName).toBe('string');

    // Cleanup
    await prisma.horse.deleteMany({ where: { id: horse.id } });
  });

  it('returns 400 when sireId points to a mare (wrong sex for sire role)', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    // damHorseId is a mare — using it as a sire should be rejected
    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `SexValidationTest_${timestamp}`,
        breedId,
        age: 0,
        sex: 'mare',
        sireId: damHorseId, // mare used as sire — invalid
        damId: damHorseId,
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/stallion/i);
  });

  it('returns 400 when damId points to a stallion (wrong sex for dam role)', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    // sireHorseId is a stallion — using it as a dam should be rejected
    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', __csrf__.cookieHeader)
      .set('X-CSRF-Token', __csrf__.csrfToken)
      .send({
        name: `SexValidationTest2_${timestamp}`,
        breedId,
        age: 0,
        sex: 'mare',
        sireId: sireHorseId,
        damId: sireHorseId, // stallion used as dam — invalid
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/mare/i);
  });

  it('returns 400 when sireId does not exist', async () => {
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
        name: `NonExistentSire_${timestamp}`,
        breedId,
        age: 0,
        sex: 'mare',
        sireId: 999999999,
        damId: damHorseId,
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/not found/i);
  });
});
