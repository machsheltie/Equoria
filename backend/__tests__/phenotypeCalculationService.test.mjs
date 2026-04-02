/**
 * phenotypeCalculationService.test.mjs
 *
 * Tests for Story 31E-1b: Phenotype Calculation Engine.
 *
 * Coverage:
 *   - Base color determination (Extension + Agouti)
 *   - Each dilution: Cream (single/double), Dun, Silver, Champagne, Pearl, Mushroom
 *   - Pattern overlays: Gray, Roan, Appaloosa, Dominant White, Tobiano, Frame Overo, Sabino, Splash, Brindle
 *   - Shade selection: deterministic hash, 'standard' fallback
 *   - Determinism: same genotype always produces same result
 *   - Null/empty genotype fallback
 *   - Integration: POST /api/v1/horses response includes phenotype fields
 *
 * Mocking strategy (balanced):
 *   - Unit tests: no mocking (pure functions)
 *   - Integration test: real DB (prisma) + real HTTP (supertest)
 */

import { calculatePhenotype } from '../modules/horses/services/phenotypeCalculationService.mjs';
import prisma from '../db/index.mjs';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import config from '../config/config.mjs';
import app from '../app.mjs';

// ---------------------------------------------------------------------------
// Helpers: minimal genotype builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal genotype with all non-expressing (wild-type) alleles.
 * Then merge overrides for the loci under test.
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
    Prl_Pearl: 'n/n',
    BR1_Brindle1: 'n/n',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Base color determination
// ---------------------------------------------------------------------------

describe('calculatePhenotype — base color', () => {
  it('returns Chestnut for e/e Extension regardless of Agouti', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', A_Agouti: 'A/A' })).colorName).toBe('Chestnut');
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', A_Agouti: 'a/a' })).colorName).toBe('Chestnut');
  });

  it('returns Bay for E/e + A/a (dominant agouti)', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'A/a' })).colorName).toBe('Bay');
  });

  it('returns Bay for E/E + A/A', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'E/E', A_Agouti: 'A/A' })).colorName).toBe('Bay');
  });

  it('returns Black for E/e + a/a (recessive agouti)', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a' })).colorName).toBe('Black');
  });

  it('returns Black for E/E + a/a', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'E/E', A_Agouti: 'a/a' })).colorName).toBe('Black');
  });
});

// ---------------------------------------------------------------------------
// Cream dilutions
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Cream dilutions', () => {
  it('Chestnut + Cr/n → Palomino', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', Cr_Cream: 'Cr/n' })).colorName).toBe('Palomino');
  });

  it('Bay + Cr/n → Buckskin', () => {
    expect(calculatePhenotype(buildGenotype({ Cr_Cream: 'Cr/n' })).colorName).toBe('Buckskin');
  });

  it('Black + Cr/n → Smoky Black', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', Cr_Cream: 'Cr/n' })).colorName).toBe(
      'Smoky Black',
    );
  });

  it('Chestnut + Cr/Cr → Cremello', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', Cr_Cream: 'Cr/Cr' })).colorName).toBe('Cremello');
  });

  it('Bay + Cr/Cr → Perlino', () => {
    expect(calculatePhenotype(buildGenotype({ Cr_Cream: 'Cr/Cr' })).colorName).toBe('Perlino');
  });

  it('Black + Cr/Cr → Smoky Cream', () => {
    expect(
      calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', Cr_Cream: 'Cr/Cr' })).colorName,
    ).toBe('Smoky Cream');
  });
});

// ---------------------------------------------------------------------------
// Dun dilutions
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Dun dilutions', () => {
  it('Chestnut + D/nd2 → Red Dun', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', D_Dun: 'D/nd2' })).colorName).toBe('Red Dun');
  });

  it('Bay + D/nd2 → Bay Dun', () => {
    expect(calculatePhenotype(buildGenotype({ D_Dun: 'D/nd2' })).colorName).toBe('Bay Dun');
  });

  it('Black + D/nd2 → Grulla', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', D_Dun: 'D/nd2' })).colorName).toBe(
      'Grulla',
    );
  });

  it('nd2/nd2 (non-dun) does not produce dun color', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', D_Dun: 'nd2/nd2' })).colorName).toBe('Chestnut');
  });

  it('nd1/nd2 pseudo-dun on Bay → Bay Dun (P-5)', () => {
    expect(calculatePhenotype(buildGenotype({ D_Dun: 'nd1/nd2' })).colorName).toBe('Bay Dun');
  });

  it('nd1/nd2 pseudo-dun + Cr/n on Bay → Bay Dun (P-5)', () => {
    expect(calculatePhenotype(buildGenotype({ D_Dun: 'nd1/nd2', Cr_Cream: 'Cr/n' })).colorName).toBe('Bay Dun');
  });
});

// ---------------------------------------------------------------------------
// Silver dilutions
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Silver dilutions', () => {
  it('Black + Z/n → Silver Black', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', Z_Silver: 'Z/n' })).colorName).toBe(
      'Silver Black',
    );
  });

  it('Bay + Z/n → Silver Bay', () => {
    expect(calculatePhenotype(buildGenotype({ Z_Silver: 'Z/n' })).colorName).toBe('Silver Bay');
  });

  it('Chestnut + Z/n → Chestnut (silver has no effect on chestnut)', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', Z_Silver: 'Z/n' })).colorName).toBe('Chestnut');
  });

  it('Black + Dun + Silver → Silver Grulla', () => {
    expect(
      calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', D_Dun: 'D/nd2', Z_Silver: 'Z/n' }))
        .colorName,
    ).toBe('Silver Grulla');
  });
});

// ---------------------------------------------------------------------------
// Champagne dilutions
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Champagne dilutions', () => {
  it('Chestnut + Ch/n → Gold Champagne', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', Ch_Champagne: 'Ch/n' })).colorName).toBe(
      'Gold Champagne',
    );
  });

  it('Bay + Ch/n → Amber Champagne', () => {
    expect(calculatePhenotype(buildGenotype({ Ch_Champagne: 'Ch/n' })).colorName).toBe('Amber Champagne');
  });

  it('Black + Ch/n → Classic Champagne', () => {
    expect(
      calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', Ch_Champagne: 'Ch/n' })).colorName,
    ).toBe('Classic Champagne');
  });

  it('Chestnut + Ch/n + Cr/n → Gold Cream Champagne', () => {
    expect(
      calculatePhenotype(buildGenotype({ E_Extension: 'e/e', Ch_Champagne: 'Ch/n', Cr_Cream: 'Cr/n' })).colorName,
    ).toBe('Gold Cream Champagne');
  });

  it('Bay + Ch/n + Dun → Amber Dun Champagne', () => {
    expect(calculatePhenotype(buildGenotype({ Ch_Champagne: 'Ch/n', D_Dun: 'D/nd2' })).colorName).toBe(
      'Amber Dun Champagne',
    );
  });
});

// ---------------------------------------------------------------------------
// Pearl dilutions
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Pearl dilutions', () => {
  it('Chestnut + prl/prl → Chestnut Pearl', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', Prl_Pearl: 'prl/prl' })).colorName).toBe(
      'Chestnut Pearl',
    );
  });

  it('Bay + prl/prl → Bay Pearl', () => {
    expect(calculatePhenotype(buildGenotype({ Prl_Pearl: 'prl/prl' })).colorName).toBe('Bay Pearl');
  });

  it('Black + prl/prl → Black Pearl', () => {
    expect(
      calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', Prl_Pearl: 'prl/prl' })).colorName,
    ).toBe('Black Pearl');
  });

  it('Chestnut + prl/n + Cr/n (pseudo-double-dilute) → Palomino Pearl', () => {
    expect(
      calculatePhenotype(buildGenotype({ E_Extension: 'e/e', Prl_Pearl: 'prl/n', Cr_Cream: 'Cr/n' })).colorName,
    ).toBe('Palomino Pearl');
  });

  it('Bay + prl/n + Cr/n → Buckskin Pearl', () => {
    expect(calculatePhenotype(buildGenotype({ Prl_Pearl: 'prl/n', Cr_Cream: 'Cr/n' })).colorName).toBe(
      'Buckskin Pearl',
    );
  });

  it('Black + prl/n + Cr/n → Smoky Black Pearl', () => {
    expect(
      calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', Prl_Pearl: 'prl/n', Cr_Cream: 'Cr/n' }))
        .colorName,
    ).toBe('Smoky Black Pearl');
  });
});

// ---------------------------------------------------------------------------
// Mushroom
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Mushroom', () => {
  it('Chestnut + M/N → Mushroom Chestnut', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e', MFSD12_Mushroom: 'M/N' })).colorName).toBe(
      'Mushroom Chestnut',
    );
  });

  it('Bay + M/N → Bay (no effect)', () => {
    expect(calculatePhenotype(buildGenotype({ MFSD12_Mushroom: 'M/N' })).colorName).toBe('Bay');
  });

  it('Black + M/N → Black (no effect)', () => {
    expect(
      calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', MFSD12_Mushroom: 'M/N' })).colorName,
    ).toBe('Black');
  });
});

// ---------------------------------------------------------------------------
// Gray pattern
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Gray pattern', () => {
  it('G/g sets isGray = true', () => {
    const result = calculatePhenotype(buildGenotype({ G_Gray: 'G/g' }));
    expect(result.isGray).toBe(true);
  });

  it('Gray overrides base color name with a gray stage name', () => {
    const result = calculatePhenotype(buildGenotype({ G_Gray: 'G/g' }));
    const grayNames = [
      'Steel Gray',
      'Rose Gray',
      'White Gray',
      'Fleabitten Gray',
      'Steel Dark Dapple Gray',
      'Steel Light Dapple Gray',
      'Rose Dark Dapple Gray',
      'Rose Light Dapple Gray',
    ];
    expect(grayNames).toContain(result.colorName);
  });

  it('g/g leaves isGray = false', () => {
    expect(calculatePhenotype(buildGenotype()).isGray).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Roan pattern
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Roan pattern', () => {
  it('Chestnut + Rn/rn → Strawberry Roan', () => {
    const result = calculatePhenotype(buildGenotype({ E_Extension: 'e/e', Rn_Roan: 'Rn/rn' }));
    expect(result.colorName).toBe('Strawberry Roan');
    expect(result.isRoan).toBe(true);
  });

  it('Bay + Rn/rn → Red Roan', () => {
    const result = calculatePhenotype(buildGenotype({ Rn_Roan: 'Rn/rn' }));
    expect(result.colorName).toBe('Red Roan');
    expect(result.isRoan).toBe(true);
  });

  it('Black + Rn/rn → Blue Roan', () => {
    const result = calculatePhenotype(buildGenotype({ E_Extension: 'E/e', A_Agouti: 'a/a', Rn_Roan: 'Rn/rn' }));
    expect(result.colorName).toBe('Blue Roan');
    expect(result.isRoan).toBe(true);
  });

  it('rn/rn leaves isRoan = false', () => {
    expect(calculatePhenotype(buildGenotype()).isRoan).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Appaloosa (LP + PATN1)
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Appaloosa patterns', () => {
  const LP_ONLY = { LP_LeopardComplex: 'LP/lp', PATN1_Pattern1: 'patn1/patn1' };
  const LP_PATN1 = { LP_LeopardComplex: 'LP/lp', PATN1_Pattern1: 'PATN1/patn1' };

  it('LP/lp without PATN1 sets isAppaloosa = true and uses minimal pattern names', () => {
    const result = calculatePhenotype(buildGenotype(LP_ONLY));
    expect(result.isAppaloosa).toBe(true);
    expect(['Varnish Roan', 'Fewspot Leopard', 'Snowcap']).toContain(result.colorName);
  });

  it('LP/lp + PATN1/patn1 sets isAppaloosa = true and uses full pattern names', () => {
    const result = calculatePhenotype(buildGenotype(LP_PATN1));
    expect(result.isAppaloosa).toBe(true);
    const fullPatterns = [
      'Blanket',
      'Leopard',
      'Heavy Snowflake Leopard',
      'Light Snowflake Leopard',
      'Moderate Snowflake Leopard',
      'Heavy Frost Roan Varnish',
      'Light Frost Roan Varnish',
      'Moderate Frost Roan Varnish',
    ];
    expect(fullPatterns).toContain(result.colorName);
  });

  it('lp/lp leaves isAppaloosa = false', () => {
    expect(calculatePhenotype(buildGenotype()).isAppaloosa).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Dominant White
// ---------------------------------------------------------------------------

describe('calculatePhenotype — Dominant White', () => {
  it('W20/w → Dominant White, isWhite = true', () => {
    const result = calculatePhenotype(buildGenotype({ W_DominantWhite: 'W20/w' }));
    expect(result.colorName).toBe('Dominant White');
    expect(result.isWhite).toBe(true);
  });

  it('w/w → isWhite = false', () => {
    expect(calculatePhenotype(buildGenotype()).isWhite).toBe(false);
  });

  it('Dominant White overrides all other patterns', () => {
    // Even with gray + appaloosa + roan — white wins
    const result = calculatePhenotype(
      buildGenotype({
        W_DominantWhite: 'W20/w',
        G_Gray: 'G/g',
        LP_LeopardComplex: 'LP/lp',
        Rn_Roan: 'Rn/rn',
      }),
    );
    expect(result.colorName).toBe('Dominant White');
    expect(result.isGray).toBe(false);
    expect(result.isAppaloosa).toBe(false);
    expect(result.isRoan).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pinto and other pattern flags
// ---------------------------------------------------------------------------

describe('calculatePhenotype — pinto/pattern flags', () => {
  it('TO/to sets hasTobiano = true without changing colorName', () => {
    const result = calculatePhenotype(buildGenotype({ TO_Tobiano: 'TO/to' }));
    expect(result.hasTobiano).toBe(true);
    expect(result.colorName).toBe('Bay'); // color unchanged
  });

  it('O/n sets hasFrameOvero = true', () => {
    expect(calculatePhenotype(buildGenotype({ O_FrameOvero: 'O/n' })).hasFrameOvero).toBe(true);
  });

  it('SB1/n sets hasSabino = true', () => {
    expect(calculatePhenotype(buildGenotype({ SB1_Sabino1: 'SB1/n' })).hasSabino).toBe(true);
  });

  it('SW1/n sets hasSplash = true', () => {
    expect(calculatePhenotype(buildGenotype({ SW_SplashWhite: 'SW1/n' })).hasSplash).toBe(true);
  });

  it('BR1/n sets isBrindle = true and colorName = "Brindle (Female)"', () => {
    const result = calculatePhenotype(buildGenotype({ BR1_Brindle1: 'BR1/n' }));
    expect(result.isBrindle).toBe(true);
    expect(result.colorName).toBe('Brindle (Female)');
  });

  it('n/n alleles produce all-false pattern flags', () => {
    const result = calculatePhenotype(buildGenotype());
    expect(result.hasTobiano).toBe(false);
    expect(result.hasFrameOvero).toBe(false);
    expect(result.hasSabino).toBe(false);
    expect(result.hasSplash).toBe(false);
    expect(result.isBrindle).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shade selection
// ---------------------------------------------------------------------------

describe('calculatePhenotype — shade selection', () => {
  const shadeBias = {
    Bay: { dark: 0.3, light: 0.3, standard: 0.4 },
    Buckskin: { light: 0.5, standard: 0.5 },
  };

  it('returns shade from shadeBias when colorName matches', () => {
    const result = calculatePhenotype(buildGenotype(), shadeBias);
    expect(['dark', 'light', 'standard']).toContain(result.shade);
  });

  it('returns "standard" when shadeBias is null', () => {
    expect(calculatePhenotype(buildGenotype(), null).shade).toBe('standard');
  });

  it('returns "standard" when colorName not in shadeBias', () => {
    expect(calculatePhenotype(buildGenotype({ E_Extension: 'e/e' }), shadeBias).shade).toBe('standard');
  });

  it('shade is deterministic — two calls with same genotype return same shade', () => {
    const g = buildGenotype();
    const r1 = calculatePhenotype(g, shadeBias);
    const r2 = calculatePhenotype(g, shadeBias);
    expect(r1.shade).toBe(r2.shade);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('calculatePhenotype — determinism', () => {
  it('same genotype always returns identical phenotype object', () => {
    const g = buildGenotype({ E_Extension: 'e/e', G_Gray: 'G/g', TO_Tobiano: 'TO/to' });
    const r1 = calculatePhenotype(g);
    const r2 = calculatePhenotype(g);
    expect(r1).toEqual(r2);
  });

  it('different genotypes may return different colorNames', () => {
    const bay = calculatePhenotype(buildGenotype());
    const chestnut = calculatePhenotype(buildGenotype({ E_Extension: 'e/e' }));
    expect(bay.colorName).not.toBe(chestnut.colorName);
  });

  it('same key-values with different property insertion order produce identical output (P-4)', () => {
    // Build two genotypes with identical alleles but different key ordering
    const g1 = buildGenotype({ E_Extension: 'e/e', Cr_Cream: 'Cr/n', D_Dun: 'D/nd2' });
    // Create g2 by re-inserting keys in reverse alphabetical order
    const g2 = Object.fromEntries(Object.entries(g1).reverse());
    expect(calculatePhenotype(g1)).toEqual(calculatePhenotype(g2));
  });
});

// ---------------------------------------------------------------------------
// Null / empty genotype fallback
// ---------------------------------------------------------------------------

describe('calculatePhenotype — null/empty fallback', () => {
  it('returns Unknown colorName for null genotype', () => {
    const result = calculatePhenotype(null);
    expect(result.colorName).toBe('Unknown');
    expect(result.shade).toBe('standard');
    expect(result.isGray).toBe(false);
  });

  it('returns Unknown colorName for empty object', () => {
    const result = calculatePhenotype({});
    expect(result.colorName).toBe('Unknown');
  });

  it('does not throw for undefined genotype', () => {
    expect(() => calculatePhenotype(undefined)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Integration test: POST /api/v1/horses includes phenotype in response
// ---------------------------------------------------------------------------

describe('POST /api/v1/horses — phenotype integration', () => {
  let server;
  let testUserId;
  let createdHorseId;
  let arabianBreedId;
  const timestamp = Date.now();

  const testUserData = {
    username: `phenotype_test_${timestamp}`,
    email: `phenotype_test_${timestamp}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Phenotype',
    lastName: 'Test',
  };

  beforeAll(async () => {
    server = app.listen(0);

    const arabianBreed = await prisma.breed.upsert({
      where: { name: 'Arabian' },
      update: {},
      create: { name: 'Arabian', description: 'Arabian breed for phenotype tests' },
    });
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

  it('created horse includes phenotype with colorName string and all boolean pattern flags', async () => {
    const token = jwt.sign({ id: testUserId, email: testUserData.email, role: 'user' }, config.jwtSecret, {
      expiresIn: '1h',
    });

    const response = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${token}`)
      .set('x-test-skip-csrf', 'true')
      .send({
        name: `PhenotypeTest_${timestamp}`,
        breedId: arabianBreedId,
        age: 3,
        sex: 'mare',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    const horse = response.body.data;

    // phenotype must be present
    expect(horse.phenotype).toBeDefined();
    expect(horse.phenotype).not.toBeNull();
    expect(typeof horse.phenotype).toBe('object');

    // Required string fields
    expect(typeof horse.phenotype.colorName).toBe('string');
    expect(horse.phenotype.colorName.length).toBeGreaterThan(0);
    expect(typeof horse.phenotype.shade).toBe('string');

    // Required boolean pattern flags
    expect(typeof horse.phenotype.isGray).toBe('boolean');
    expect(typeof horse.phenotype.isRoan).toBe('boolean');
    expect(typeof horse.phenotype.isAppaloosa).toBe('boolean');
    expect(typeof horse.phenotype.isWhite).toBe('boolean');
    expect(typeof horse.phenotype.hasTobiano).toBe('boolean');
    expect(typeof horse.phenotype.hasFrameOvero).toBe('boolean');
    expect(typeof horse.phenotype.hasSabino).toBe('boolean');
    expect(typeof horse.phenotype.hasSplash).toBe('boolean');
    expect(typeof horse.phenotype.isBrindle).toBe('boolean');

    createdHorseId = horse.id;
  });
});
