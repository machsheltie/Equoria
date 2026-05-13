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

  it('returns "standard" when shadeBias entry for colorName is an empty object (line 547)', () => {
    // expandShadesToArray({}) → [] → shadeArray.length === 0 → 'standard'
    const result = calculatePhenotype(g({ E_Extension: 'e/e' }), { Chestnut: {} });
    expect(result.shade).toBe('standard');
  });
});

// ---------------------------------------------------------------------------
// isDunActive falsy-input guard (line 61)
// ---------------------------------------------------------------------------
describe('calculatePhenotype — isDunActive falsy guard', () => {
  it('empty-string D_Dun falls back to no-dun (covers !dunAllele return false branch)', () => {
    // D_Dun: '' is NOT null/undefined so ?? does not substitute the default.
    // isDunActive('') → !dunAllele = true → returns false (line 61).
    // Result: bay (default E/e + A/a) with no dun → 'Bay'.
    const result = calculatePhenotype({ D_Dun: '' });
    expect(result.colorName).toBe('Bay');
  });
});

// ---------------------------------------------------------------------------
// Combined cream + dun/silver interactions (lines 263, 267, 286-288)
// ---------------------------------------------------------------------------
describe('calculatePhenotype — single cream + dun + silver combinations', () => {
  it('black + cream + dun (no silver) → Grulla (line 263 false arm)', () => {
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Cr_Cream: 'Cr/n', D_Dun: 'D/nd2' }));
    expect(result.colorName).toBe('Grulla');
  });

  it('black + cream + dun + silver → Silver Grulla (line 263 true arm)', () => {
    const result = calculatePhenotype(
      g({ E_Extension: 'E/e', A_Agouti: 'a/a', Cr_Cream: 'Cr/n', D_Dun: 'D/nd2', Z_Silver: 'Z/n' }),
    );
    expect(result.colorName).toBe('Silver Grulla');
  });

  it('black + cream + silver (no dun) → Silver Black (line 267)', () => {
    // hasCreamSingle=true, hasDun=false, hasSilver=true, black → Silver Black
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Cr_Cream: 'Cr/n', Z_Silver: 'Z/n' }));
    expect(result.colorName).toBe('Silver Black');
  });

  it('bay + silver + dun (no cream) → Silver Bay (line 286)', () => {
    // hasSilver=true, hasDun=true, bay → case bay: return Silver Bay
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Z_Silver: 'Z/n', D_Dun: 'D/nd2' }));
    expect(result.colorName).toBe('Silver Bay');
  });

  it('chestnut + silver + dun → Red Dun (silver has no visible effect on chestnut, lines 287-288)', () => {
    // silver+dun switch on chestnut: break → falls to dun-only path → Red Dun
    const result = calculatePhenotype(g({ E_Extension: 'e/e', Z_Silver: 'Z/n', D_Dun: 'D/nd2' }));
    expect(result.colorName).toBe('Red Dun');
  });
});

// ---------------------------------------------------------------------------
// Champagne + silver/dun combinations (lines 354, 359)
// ---------------------------------------------------------------------------
describe('calculatePhenotype — champagne + silver + dun combinations', () => {
  it('bay + silver + dun + champagne (no cream) → Silver Amber Dun Champagne (line 354 false arm)', () => {
    const result = calculatePhenotype(
      g({
        E_Extension: 'E/e',
        A_Agouti: 'A/a',
        Z_Silver: 'Z/n',
        D_Dun: 'D/nd2',
        Ch_Champagne: 'Ch/n',
      }),
    );
    expect(result.colorName).toBe('Silver Amber Dun Champagne');
  });

  it('bay + silver + dun + champagne + cream → Silver Amber Cream Dun Champagne (line 354 true arm)', () => {
    const result = calculatePhenotype(
      g({
        E_Extension: 'E/e',
        A_Agouti: 'A/a',
        Z_Silver: 'Z/n',
        D_Dun: 'D/nd2',
        Ch_Champagne: 'Ch/n',
        Cr_Cream: 'Cr/n',
      }),
    );
    expect(result.colorName).toBe('Silver Amber Cream Dun Champagne');
  });

  it('bay + silver + champagne (no dun, no cream) → Silver Amber Champagne (line 359 false arm)', () => {
    const result = calculatePhenotype(
      g({ E_Extension: 'E/e', A_Agouti: 'A/a', Z_Silver: 'Z/n', Ch_Champagne: 'Ch/n' }),
    );
    expect(result.colorName).toBe('Silver Amber Champagne');
  });

  it('bay + silver + champagne + cream (no dun) → Silver Amber Cream Champagne (line 359 true arm)', () => {
    const result = calculatePhenotype(
      g({ E_Extension: 'E/e', A_Agouti: 'A/a', Z_Silver: 'Z/n', Ch_Champagne: 'Ch/n', Cr_Cream: 'Cr/n' }),
    );
    expect(result.colorName).toBe('Silver Amber Cream Champagne');
  });
});

// ---------------------------------------------------------------------------
// Roan — Varnish Roan and default fall-through (lines 480-484)
// ---------------------------------------------------------------------------
describe('calculatePhenotype — roan Varnish Roan and default', () => {
  it('silver bay + roan → Varnish Roan (lines 480-481)', () => {
    // colorAfterDilutions = Silver Bay → case Silver Bay in roan switch → Varnish Roan
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Z_Silver: 'Z/n', Rn_Roan: 'Rn/rn' }));
    expect(result.colorName).toBe('Varnish Roan');
    expect(result.isRoan).toBe(true);
  });

  it('champagne color + roan → colorName unchanged, isRoan=true (default break, lines 482-484)', () => {
    // Gold Champagne is not in the explicit roan switch cases → default: break
    // colorName stays Gold Champagne but isRoan flag is set
    const result = calculatePhenotype(g({ E_Extension: 'e/e', Ch_Champagne: 'Ch/n', Rn_Roan: 'Rn/rn' }));
    expect(result.colorName).toBe('Gold Champagne');
    expect(result.isRoan).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Branch-coverage additions (Equoria-rr7)
// ---------------------------------------------------------------------------

describe('calculatePhenotype — nd1/nd2 compound dun line 70 (Equoria-rr7)', () => {
  it('nd1/nd2 D_Dun compound → isDunActive=true (line 70), bay base → Bay Dun', () => {
    // parts=['nd1','nd2'] → parts.includes('nd1') && parts.includes('nd2') → line 70 return true
    const result = calculatePhenotype(g({ D_Dun: 'nd1/nd2' }));
    expect(result.colorName).toBe('Bay Dun');
  });
});

describe('calculatePhenotype — pearl pseudo-dilute (prl/n + Cr/n) lines 234-240 (Equoria-rr7)', () => {
  it('chestnut + prl/n + Cr/n → Palomino Pearl (line 236)', () => {
    // hasPseudoDilute=true, !hasCreamDouble=true → switch chestnut → line 236
    const result = calculatePhenotype(g({ E_Extension: 'e/e', Prl_Pearl: 'prl/n', Cr_Cream: 'Cr/n' }));
    expect(result.colorName).toBe('Palomino Pearl');
  });

  it('bay + prl/n + Cr/n → Buckskin Pearl (line 238)', () => {
    // hasPseudoDilute=true, !hasCreamDouble=true → switch bay → line 238
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'A/a', Prl_Pearl: 'prl/n', Cr_Cream: 'Cr/n' }));
    expect(result.colorName).toBe('Buckskin Pearl');
  });

  it('black + prl/n + Cr/n → Smoky Black Pearl (line 240)', () => {
    // hasPseudoDilute=true, !hasCreamDouble=true → switch black → line 240
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Prl_Pearl: 'prl/n', Cr_Cream: 'Cr/n' }));
    expect(result.colorName).toBe('Smoky Black Pearl');
  });
});

describe('calculatePhenotype — cream + dun + silver lines 259 and 284 (Equoria-rr7)', () => {
  it('chestnut + Cr/n + dun → Palomino (line 259, cream takes priority over dun naming)', () => {
    // hasCreamSingle=true, hasDun=true, chestnut → case chestnut → line 259 return Palomino
    const result = calculatePhenotype(g({ E_Extension: 'e/e', Cr_Cream: 'Cr/n', D_Dun: 'D/nd2' }));
    expect(result.colorName).toBe('Palomino');
  });

  it('black + silver + dun (no cream) → Silver Grulla (line 284)', () => {
    // hasSilver=true, hasDun=true, black, !hasCreamSingle → silver section line 284
    const result = calculatePhenotype(g({ E_Extension: 'E/e', A_Agouti: 'a/a', Z_Silver: 'Z/n', D_Dun: 'D/nd2' }));
    expect(result.colorName).toBe('Silver Grulla');
  });
});

describe('calculatePhenotype — Mushroom Chestnut line 315 (Equoria-rr7)', () => {
  it('chestnut + MFSD12_Mushroom M/N → Mushroom Chestnut (line 315)', () => {
    // hasMushroom=true, baseColor=chestnut, no other dilutes → line 315
    const result = calculatePhenotype(g({ E_Extension: 'e/e', MFSD12_Mushroom: 'M/N' }));
    expect(result.colorName).toBe('Mushroom Chestnut');
  });
});

describe('calculatePhenotype — champagne + dun lines 364 and 370 (Equoria-rr7)', () => {
  it('chestnut + dun + champagne (no silver, no cream) → Gold Dun Champagne (line 364 false arm)', () => {
    // resolveChampagneColor: hasSilver=false, hasDun=true, hasAnyCream=false → line 364 false
    const result = calculatePhenotype(g({ E_Extension: 'e/e', D_Dun: 'D/nd2', Ch_Champagne: 'Ch/n' }));
    expect(result.colorName).toBe('Gold Dun Champagne');
  });

  it('chestnut + dun + champagne + cream (no silver) → Gold Cream Dun Champagne (line 364 true arm)', () => {
    // resolveChampagneColor: hasSilver=false, hasDun=true, hasAnyCream=true → line 364 true
    const result = calculatePhenotype(
      g({ E_Extension: 'e/e', D_Dun: 'D/nd2', Ch_Champagne: 'Ch/n', Cr_Cream: 'Cr/n' }),
    );
    expect(result.colorName).toBe('Gold Cream Dun Champagne');
  });

  it('chestnut + champagne + cream (no dun, no silver) → Gold Cream Champagne (line 370)', () => {
    // resolveChampagneColor: no silver, no dun, hasAnyCream=true → parts.push(Cream) line 370
    const result = calculatePhenotype(g({ E_Extension: 'e/e', Ch_Champagne: 'Ch/n', Cr_Cream: 'Cr/n' }));
    expect(result.colorName).toBe('Gold Cream Champagne');
  });
});
