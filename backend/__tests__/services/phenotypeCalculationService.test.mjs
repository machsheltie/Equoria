/**
 * phenotypeCalculationService — unit tests (Equoria-rr7)
 *
 * calculatePhenotype is fully deterministic — no I/O, no logger, no DB.
 * Same genotype always returns identical output.
 */

import { describe, it, expect } from '@jest/globals';
import { calculatePhenotype } from '../../modules/horses/services/phenotypeCalculationService.mjs';

// ---------------------------------------------------------------------------
// Minimal genotype builder — only the loci under test need to be specified.
// All others default to their non-expressing allele inside calculatePhenotype.
// ---------------------------------------------------------------------------
function g(overrides = {}) {
  return overrides; // calculatePhenotype uses `?? 'n/n'` defaults internally
}

// ---------------------------------------------------------------------------
// Guard / invalid input
// ---------------------------------------------------------------------------
describe('calculatePhenotype — invalid / empty genotype', () => {
  it('returns colorName "Unknown" for empty object', () => {
    expect(calculatePhenotype({}).colorName).toBe('Unknown');
  });

  it('returns full phenotype shape for empty object', () => {
    const result = calculatePhenotype({});
    expect(result).toHaveProperty('colorName');
    expect(result).toHaveProperty('shade');
    expect(result).toHaveProperty('isGray');
    expect(result).toHaveProperty('isRoan');
    expect(result).toHaveProperty('isAppaloosa');
    expect(result).toHaveProperty('isWhite');
    expect(result).toHaveProperty('hasTobiano');
    expect(result).toHaveProperty('hasFrameOvero');
    expect(result).toHaveProperty('hasSabino');
    expect(result).toHaveProperty('hasSplash');
    expect(result).toHaveProperty('isBrindle');
  });

  it('returns colorName "Unknown" for null', () => {
    expect(calculatePhenotype(null).colorName).toBe('Unknown');
  });

  it('returns colorName "Unknown" for undefined', () => {
    expect(calculatePhenotype(undefined).colorName).toBe('Unknown');
  });

  it('returns shade "standard" for empty genotype', () => {
    expect(calculatePhenotype({}).shade).toBe('standard');
  });

  it('all pattern booleans are false for empty genotype', () => {
    const r = calculatePhenotype({});
    expect(r.isGray).toBe(false);
    expect(r.isRoan).toBe(false);
    expect(r.isAppaloosa).toBe(false);
    expect(r.isWhite).toBe(false);
    expect(r.hasTobiano).toBe(false);
    expect(r.hasFrameOvero).toBe(false);
    expect(r.hasSabino).toBe(false);
    expect(r.hasSplash).toBe(false);
    expect(r.isBrindle).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Base colors
// ---------------------------------------------------------------------------
describe('calculatePhenotype — base colors', () => {
  it('e/e → Chestnut', () => {
    expect(calculatePhenotype(g({ E_Extension: 'e/e' })).colorName).toBe('Chestnut');
  });

  it('E/e + A/a → Bay', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a' })).colorName).toBe('Bay');
  });

  it('E/E + A/a → Bay', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/E', A_Agouti: 'A/a' })).colorName).toBe('Bay');
  });

  it('E/e + a/a → Black', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a' })).colorName).toBe('Black');
  });

  it('E/E + a/a → Black', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/E', A_Agouti: 'a/a' })).colorName).toBe('Black');
  });
});

// ---------------------------------------------------------------------------
// Single cream (Cr/n)
// ---------------------------------------------------------------------------
describe('calculatePhenotype — single cream dilutes', () => {
  it('chestnut + Cr/n → Palomino', () => {
    expect(calculatePhenotype(g({ E_Extension: 'e/e', Cr_Cream: 'Cr/n' })).colorName).toBe('Palomino');
  });

  it('bay + Cr/n → Buckskin', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Cr_Cream: 'Cr/n' })).colorName).toBe('Buckskin');
  });

  it('black + Cr/n → Smoky Black', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Cr_Cream: 'Cr/n' })).colorName).toBe(
      'Smoky Black',
    );
  });
});

// ---------------------------------------------------------------------------
// Double cream (Cr/Cr)
// ---------------------------------------------------------------------------
describe('calculatePhenotype — double cream dilutes', () => {
  it('chestnut + Cr/Cr → Cremello', () => {
    expect(calculatePhenotype(g({ E_Extension: 'e/e', Cr_Cream: 'Cr/Cr' })).colorName).toBe('Cremello');
  });

  it('bay + Cr/Cr → Perlino', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Cr_Cream: 'Cr/Cr' })).colorName).toBe('Perlino');
  });

  it('black + Cr/Cr → Smoky Cream', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Cr_Cream: 'Cr/Cr' })).colorName).toBe(
      'Smoky Cream',
    );
  });
});

// ---------------------------------------------------------------------------
// Dun
// ---------------------------------------------------------------------------
describe('calculatePhenotype — dun', () => {
  it('chestnut + dun → Red Dun', () => {
    expect(calculatePhenotype(g({ E_Extension: 'e/e', D_Dun: 'D/nd2' })).colorName).toBe('Red Dun');
  });

  it('bay + dun → Bay Dun', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', D_Dun: 'D/nd2' })).colorName).toBe('Bay Dun');
  });

  it('black + dun → Grulla', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', D_Dun: 'D/nd2' })).colorName).toBe('Grulla');
  });
});

// ---------------------------------------------------------------------------
// Silver
// ---------------------------------------------------------------------------
describe('calculatePhenotype — silver', () => {
  it('black + silver → Silver Black', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Z_Silver: 'Z/n' })).colorName).toBe(
      'Silver Black',
    );
  });

  it('bay + silver → Silver Bay', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Z_Silver: 'Z/n' })).colorName).toBe(
      'Silver Bay',
    );
  });
});

// ---------------------------------------------------------------------------
// Champagne
// ---------------------------------------------------------------------------
describe('calculatePhenotype — champagne', () => {
  it('chestnut + champagne → Gold Champagne', () => {
    expect(calculatePhenotype(g({ E_Extension: 'e/e', Ch_Champagne: 'Ch/n' })).colorName).toBe('Gold Champagne');
  });

  it('bay + champagne → Amber Champagne', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Ch_Champagne: 'Ch/n' })).colorName).toBe(
      'Amber Champagne',
    );
  });

  it('black + champagne → Classic Champagne', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Ch_Champagne: 'Ch/n' })).colorName).toBe(
      'Classic Champagne',
    );
  });
});

// ---------------------------------------------------------------------------
// Pearl
// ---------------------------------------------------------------------------
describe('calculatePhenotype — pearl', () => {
  it('chestnut + prl/prl → Chestnut Pearl', () => {
    expect(calculatePhenotype(g({ E_Extension: 'e/e', Prl_Pearl: 'prl/prl' })).colorName).toBe('Chestnut Pearl');
  });

  it('bay + prl/prl → Bay Pearl', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Prl_Pearl: 'prl/prl' })).colorName).toBe(
      'Bay Pearl',
    );
  });

  it('black + prl/prl → Black Pearl', () => {
    expect(calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Prl_Pearl: 'prl/prl' })).colorName).toBe(
      'Black Pearl',
    );
  });
});

// ---------------------------------------------------------------------------
// Pattern overlays
// ---------------------------------------------------------------------------
describe('calculatePhenotype — dominant white', () => {
  it('sets isWhite + colorName Dominant White', () => {
    const result = calculatePhenotype(g({ W_DominantWhite: 'W/w' }));
    expect(result.colorName).toBe('Dominant White');
    expect(result.isWhite).toBe(true);
  });

  it('W/W also produces Dominant White', () => {
    const result = calculatePhenotype(g({ W_DominantWhite: 'W/W' }));
    expect(result.colorName).toBe('Dominant White');
  });
});

describe('calculatePhenotype — gray', () => {
  it('G/g sets isGray true', () => {
    const result = calculatePhenotype(g({ G_Gray: 'G/g' }));
    expect(result.isGray).toBe(true);
  });

  it('G/G sets isGray true', () => {
    expect(calculatePhenotype(g({ G_Gray: 'G/G' })).isGray).toBe(true);
  });

  it('gray colorName is one of the known gray variants', () => {
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
    const result = calculatePhenotype(g({ G_Gray: 'G/g' }));
    expect(grayNames).toContain(result.colorName);
  });
});

describe('calculatePhenotype — roan', () => {
  it('chestnut + roan → isRoan true + Strawberry Roan', () => {
    const result = calculatePhenotype(g({ E_Extension: 'e/e', Rn_Roan: 'Rn/rn' }));
    expect(result.isRoan).toBe(true);
    expect(result.colorName).toBe('Strawberry Roan');
  });

  it('bay + roan → Red Roan', () => {
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Rn_Roan: 'Rn/rn' }));
    expect(result.colorName).toBe('Red Roan');
  });

  it('black + roan → Blue Roan', () => {
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Rn_Roan: 'Rn/rn' }));
    expect(result.colorName).toBe('Blue Roan');
  });
});

describe('calculatePhenotype — tobiano / overo / sabino / splash', () => {
  it('TO/to sets hasTobiano true', () => {
    expect(calculatePhenotype(g({ TO_Tobiano: 'TO/to' })).hasTobiano).toBe(true);
  });

  it('O/n sets hasFrameOvero true', () => {
    expect(calculatePhenotype(g({ O_FrameOvero: 'O/n' })).hasFrameOvero).toBe(true);
  });

  it('SB1/n sets hasSabino true', () => {
    expect(calculatePhenotype(g({ SB1_Sabino1: 'SB1/n' })).hasSabino).toBe(true);
  });

  it('SW allele sets hasSplash true', () => {
    expect(calculatePhenotype(g({ SW_SplashWhite: 'SW1/n' })).hasSplash).toBe(true);
  });

  it('brindle sets isBrindle true + colorName Brindle (Female)', () => {
    const result = calculatePhenotype(g({ BR1_Brindle1: 'br1/n' }));
    expect(result.isBrindle).toBe(true);
    expect(result.colorName).toBe('Brindle (Female)');
  });
});

describe('calculatePhenotype — appaloosa', () => {
  it('LP/lp sets isAppaloosa true', () => {
    expect(calculatePhenotype(g({ LP_LeopardComplex: 'LP/lp' })).isAppaloosa).toBe(true);
  });

  it('LP/LP + PATN1/patn1 produces a named appaloosa pattern', () => {
    const lpPatterns = [
      'Blanket',
      'Leopard',
      'Heavy Snowflake Leopard',
      'Light Snowflake Leopard',
      'Moderate Snowflake Leopard',
      'Heavy Frost Roan Varnish',
      'Light Frost Roan Varnish',
      'Moderate Frost Roan Varnish',
    ];
    const result = calculatePhenotype(g({ LP_LeopardComplex: 'LP/LP', PATN1_Pattern1: 'PATN1/patn1' }));
    expect(lpPatterns).toContain(result.colorName);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------
describe('calculatePhenotype — determinism', () => {
  it('same genotype always returns same colorName', () => {
    const genotype = { E_Extension: 'E/e', A_Agouti: 'A/a', Cr_Cream: 'Cr/n', D_Dun: 'D/nd2' };
    const r1 = calculatePhenotype(genotype);
    const r2 = calculatePhenotype(genotype);
    expect(r1.colorName).toBe(r2.colorName);
    expect(r1.shade).toBe(r2.shade);
  });

  it('different genotypes can produce different results', () => {
    const chestnut = calculatePhenotype(g({ E_Extension: 'e/e' }));
    const bay = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a' }));
    expect(chestnut.colorName).not.toBe(bay.colorName);
  });
});

// ---------------------------------------------------------------------------
// Shade selection via shadeBias
// ---------------------------------------------------------------------------
describe('calculatePhenotype — shade selection', () => {
  it('returns "standard" when no shadeBias provided', () => {
    const result = calculatePhenotype(g({ E_Extension: 'e/e' }));
    expect(result.shade).toBe('standard');
  });

  it('returns "standard" when shadeBias has no entry for colorName', () => {
    const result = calculatePhenotype(g({ E_Extension: 'e/e' }), { Bay: { dark: 0.5, light: 0.5 } });
    expect(result.shade).toBe('standard'); // Chestnut not in shadeBias
  });

  it('selects a shade from shadeBias when present', () => {
    const shadeBias = { Chestnut: { dark: 0.5, light: 0.5 } };
    const result = calculatePhenotype(g({ E_Extension: 'e/e' }), shadeBias);
    expect(['dark', 'light']).toContain(result.shade);
  });

  it('shade selection is deterministic with same genotype + shadeBias', () => {
    const genotype = g({ E_Extension: 'e/e' });
    const shadeBias = { Chestnut: { dark: 0.3, light: 0.4, standard: 0.3 } };
    expect(calculatePhenotype(genotype, shadeBias).shade).toBe(calculatePhenotype(genotype, shadeBias).shade);
  });
});
