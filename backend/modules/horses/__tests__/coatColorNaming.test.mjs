/**
 * coatColorNaming.test.mjs (Equoria-7woyj)
 *
 * The owner's 2026-10-29 coat color names (rulings q309-q316), table-driven from
 * docs/features/coat-color-names.md: every owner name the game can make comes out
 * of calculatePhenotype for its genes; the new genes (wild bay A+, snowdrop,
 * sunshine, mushroom names, dominant white W5...W35) name, order and inherit
 * correctly; and no breed can roll a new gene yet (breed odds deferred to
 * 2026-11-02, Equoria-8xxnf). Pure functions, real breed data files; no DB.
 */

import { describe, it, expect } from '@jest/globals';
import { calculatePhenotype, greyColorNames } from '../services/phenotypeCalculationService.mjs';
import { familyShadeNames, spottedDominantWhiteAlleles } from '../services/coatColorNaming.mjs';
import { canonicalAllelePair } from '../services/allelePairRules.mjs';
import { inheritColorGenotype } from '../services/breedingColorInheritanceService.mjs';
import { generateGenotype } from '../services/genotypeGenerationService.mjs';
import { loadBreedSourceProfiles } from '../../../seed/syncBreedGeneticProfiles.mjs';

const bases = {
  chestnut: { E_Extension: 'e/e', A_Agouti: 'A/a' },
  bay: { E_Extension: 'E/e', A_Agouti: 'A/a' },
  wild: { E_Extension: 'E/e', A_Agouti: 'A+/a' },
  seal: { E_Extension: 'E/e', A_Agouti: 'At/a' },
  black: { E_Extension: 'E/e', A_Agouti: 'a/a' },
};
const mods = {
  cr1: { Cr_Cream: 'Cr/n' },
  cr2: { Cr_Cream: 'Cr/Cr' },
  prl1: { Prl_Pearl: 'prl/n' },
  prl2: { Prl_Pearl: 'prl/prl' },
  dun: { D_Dun: 'D/nd2' },
  z: { Z_Silver: 'Z/n' },
  ch: { Ch_Champagne: 'Ch/n' },
  m: { MFSD12_Mushroom: 'M/N' },
  rn: { Rn_Roan: 'Rn/rn' },
  sdp1: { Sdp_Snowdrop: 'sdp/n' },
  sdp2: { Sdp_Snowdrop: 'sdp/sdp' },
  sun1: { Sun_Sunshine: 'sun/n' },
  sun2: { Sun_Sunshine: 'sun/sun' },
};
const wildType = {
  Cr_Cream: 'n/n',
  D_Dun: 'nd2/nd2',
  Z_Silver: 'n/n',
  Ch_Champagne: 'n/n',
  G_Gray: 'g/g',
  Rn_Roan: 'rn/rn',
  W_DominantWhite: 'w/w',
  LP_LeopardComplex: 'lp/lp',
  PATN1_Pattern1: 'patn1/patn1',
  EDXW: 'n/n',
  MFSD12_Mushroom: 'N/N',
  Prl_Pearl: 'n/n',
  BR1_Brindle1: 'n/n',
};

/** 'bay cr1 prl1' -> a full genotype. */
function genes(spec, extra = {}) {
  const [base, ...rest] = spec.split(' ');
  return Object.assign({ ...wildType, ...bases[base] }, ...rest.map(mod => mods[mod]), extra);
}

// Owner name -> genes. Families are in the shade table below.
const ownerNames = [
  ['Amber Champagne', 'bay ch'],
  ['Amber Champagne Dun', 'bay ch dun'],
  ['Amber Champagne Pearl', 'bay ch prl2'],
  ['Amber Cream Champagne', 'bay ch cr1'],
  ['Amber Cream Pearl Champagne', 'bay ch cr1 prl1'],
  ['Bay Dun', 'bay dun'],
  ['Bay Dun Roan', 'bay dun rn'],
  ['Bay Pearl', 'bay prl2'],
  ['Bay Pearl Dun', 'bay prl2 dun'],
  ['Bay Roan', 'bay rn'],
  ['Black Pearl', 'black prl2'],
  ['Black Pearl Dun', 'black prl2 dun'],
  ['Black Pearl Roan', 'black prl2 rn'],
  ['Blue Roan', 'black rn'],
  ['Buckskin Pearl', 'bay cr1 prl1'],
  ['Buckskin Roan', 'bay cr1 rn'],
  ['Chestnut Pearl', 'chestnut prl2'],
  ['Chestnut Pearl Dun', 'chestnut prl2 dun'],
  ['Chestnut Pearl Roan', 'chestnut prl2 rn'],
  ['Classic Champagne', 'black ch'],
  ['Classic Champagne Dun', 'black ch dun'],
  ['Classic Champagne Pearl', 'black ch prl2'],
  ['Classic Champagne Roan', 'black ch rn'],
  ['Classic Cream Champagne', 'black ch cr1'],
  ['Classic Cream Pearl Champagne', 'black ch cr1 prl1'],
  ['Cremello', 'chestnut cr2'],
  ['Cremello Dun', 'chestnut cr2 dun'],
  ['Cremello Pearl', 'chestnut cr2 prl1'],
  ['Dunskin', 'bay cr1 dun'],
  ['Dunalino', 'chestnut cr1 dun'],
  ['Gold Champagne', 'chestnut ch'],
  ['Gold Champagne Dun', 'chestnut ch dun'],
  ['Gold Champagne Pearl', 'chestnut ch prl2'],
  ['Gold Cream Champagne', 'chestnut ch cr1'],
  ['Gold Cream Pearl Champagne', 'chestnut ch cr1 prl1'],
  ['Grulla', 'black dun'],
  ['Grulla Roan', 'black dun rn'],
  ['Mushroom Amber Champagne', 'bay m ch'],
  ['Mushroom Bay', 'bay m'],
  ['Mushroom Bay Dun', 'bay m dun'],
  ['Mushroom Bay Pearl', 'bay m prl2'],
  ['Mushroom Bay Roan', 'bay m rn'],
  ['Mushroom Black', 'black m'],
  ['Mushroom Buckskin', 'bay m cr1'],
  ['Mushroom Chestnut', 'chestnut m'],
  ['Mushroom Chestnut Pearl', 'chestnut m prl2'],
  ['Mushroom Cremello Pearl', 'chestnut m cr2 prl1'],
  ['Mushroom Gold Champagne', 'chestnut m ch'],
  ['Mushroom Palomino', 'chestnut m cr1'],
  ['Mushroom Perlino Pearl', 'bay m cr2 prl1'],
  ['Mushroom Red Dun', 'chestnut m dun'],
  ['Mushroom Red Roan', 'chestnut m rn'],
  ['Mushroom Seal Brown', 'seal m'],
  ['Mushroom Smoky Black', 'black m cr1'],
  ['Palomino Pearl', 'chestnut cr1 prl1'],
  ['Palomino Roan', 'chestnut cr1 rn'],
  ['Perlino', 'bay cr2'],
  ['Perlino Dun', 'bay cr2 dun'],
  ['Perlino Pearl', 'bay cr2 prl1'],
  ['Perlino Roan', 'bay cr2 rn'],
  ['Red Dun', 'chestnut dun'],
  ['Red Dun Roan', 'chestnut dun rn'],
  ['Red Roan', 'chestnut rn'],
  ['Sable Champagne', 'seal ch'],
  ['Sable Champagne Dun', 'seal ch dun'],
  ['Sable Champagne Pearl', 'seal ch prl2'],
  ['Sable Cream Champagne', 'seal ch cr1'],
  ['Sable Cream Pearl Champagne', 'seal ch cr1 prl1'],
  ['Seal Buckskin', 'seal cr1'],
  ['Seal Dun', 'seal dun'],
  ['Seal Pearl', 'seal prl2'],
  ['Seal Pearl Dun', 'seal prl2 dun'],
  ['Seal Perlino', 'seal cr2'],
  ['Seal Perlino Pearl', 'seal cr2 prl1'],
  ['Silver Amber Champagne', 'bay z ch'],
  ['Silver Bay', 'bay z'],
  ['Silver Bay Dun', 'bay z dun'],
  ['Silver Bay Pearl', 'bay z prl2'],
  ['Silver Bay Roan', 'bay z rn'],
  ['Silver Black', 'black z'],
  ['Silver Black Pearl', 'black z prl2'],
  ['Silver Blue Roan', 'black z rn'],
  ['Silver Buckskin', 'bay z cr1'],
  ['Silver Classic Champagne', 'black z ch'],
  ['Silver Dunskin', 'bay z cr1 dun'],
  ['Silver Grulla', 'black z dun'],
  ['Silver Perlino', 'bay z cr2'],
  ['Silver Sable Champagne', 'seal z ch'],
  ['Silver Seal', 'seal z'],
  ['Silver Smoky Black', 'black z cr1'],
  ['Silver Smoky Cream', 'black z cr2'],
  ['Smoky Black', 'black cr1'],
  ['Smoky Black Pearl', 'black cr1 prl1'],
  ['Smoky Cream', 'black cr2'],
  ['Smoky Cream Dun', 'black cr2 dun'],
  ['Smoky Cream Pearl', 'black cr2 prl1'],
  ['Smoky Grulla', 'black cr1 dun'],
  ['Wild Amber Champagne', 'wild ch'],
  ['Wild Amber Champagne Pearl', 'wild ch prl2'],
  ['Wild Amber Cream Champagne Pearl', 'wild ch cr1 prl1'],
  ['Wild Bay', 'wild'],
  ['Wild Bay Pearl', 'wild prl2'],
  ['Wild Buckskin', 'wild cr1'],
  ['Wild Buckskin Pearl', 'wild cr1 prl1'],
  ['Wild Perlino', 'wild cr2'],
  ['Wild Perlino Pearl', 'wild cr2 prl1'],
];

// Snowdrop and sunshine (q313): the same 15 bodies each; snowdrop sunshine on plain colors.
const dilutionBodies = [
  ['Bay', 'bay'],
  ['Bay Pearl', 'bay prl2'],
  ['Black', 'black'],
  ['Black Pearl', 'black prl2'],
  ['Buckskin', 'bay cr1'],
  ['Chestnut', 'chestnut'],
  ['Chestnut Pearl', 'chestnut prl2'],
  ['Palomino', 'chestnut cr1'],
  ['Seal', 'seal'],
  ['Seal Buckskin', 'seal cr1'],
  ['Seal Pearl', 'seal prl2'],
  ['Smoky Black', 'black cr1'],
  ['Wild Bay', 'wild'],
  ['Wild Bay Pearl', 'wild prl2'],
  ['Wild Buckskin', 'wild cr1'],
];
for (const [body, spec] of dilutionBodies) {
  ownerNames.push([`Snowdrop ${body}`, `${spec} sdp2`], [`Sunshine ${body}`, `${spec} sun2`]);
}
for (const [body, base] of [
  ['Black', 'black'],
  ['Chestnut', 'chestnut'],
  ['Bay', 'bay'],
  ['Seal', 'seal'],
  ['Wild Bay', 'wild'],
]) {
  ownerNames.push([`Snowdrop Sunshine ${body}`, `${base} sdp1 sun1`]);
}

// Color family + shade -> owner name (portrait match q269; q311 classic palomino/buckskin).
const familyShades = [
  ['bay', 'Bay', 'standard', 'Standard Bay'],
  ['bay', 'Bay', 'dark', 'Mahogany Bay'],
  ['bay', 'Bay', 'light', 'Golden Bay'],
  ['bay', 'Bay', 'blood', 'Blood Bay'],
  ['bay', 'Bay', 'copper', 'Copper Bay'],
  ['bay', 'Bay', 'wild', 'Wild Bay'],
  ['bay', 'Bay', 'honey', 'Honey Bay'],
  ['chestnut', 'Chestnut', 'standard', 'Standard Chestnut'],
  ['chestnut', 'Chestnut', 'medium', 'Red Chestnut'],
  ['chestnut', 'Chestnut', 'light', 'Light Yellow Chestnut'],
  ['chestnut', 'Chestnut', 'golden', 'Golden Chestnut'],
  ['black', 'Black', 'standard', 'Nonfading Black'],
  ['black', 'Black', 'faded', 'Fading Black'],
  ['chestnut cr1', 'Palomino', 'standard', 'Classic Palomino'],
  ['chestnut cr1', 'Palomino', 'golden', 'Golden Palomino'],
  ['chestnut cr1', 'Palomino', 'pale', 'Light Palomino'],
  ['chestnut cr1', 'Palomino', 'copper', 'Dark Palomino'],
  ['chestnut cr1', 'Palomino', 'chocolate', 'Chocolate Palomino'],
  ['chestnut cr1', 'Palomino', 'isabella', 'Isabella Palomino'],
  ['bay cr1', 'Buckskin', 'standard', 'Classic Buckskin'],
  ['bay cr1', 'Buckskin', 'burnished', 'Classic Buckskin'],
  ['bay cr1', 'Buckskin', 'golden', 'Golden Buckskin'],
  ['bay cr1', 'Buckskin', 'cream', 'Buttermilk Buckskin'],
  ['bay cr1', 'Buckskin', 'copper', 'Copper Buckskin'],
  ['seal', 'Seal Brown', 'standard', 'Standard Seal Brown'],
  ['seal', 'Seal Brown', 'dark', 'Dark Seal Brown'],
  ['seal', 'Seal Brown', 'light', 'Light Seal Brown'],
  ['seal', 'Seal Brown', 'sealskin', 'Sealskin'],
];

describe("owner's coat color names (Equoria-7woyj)", () => {
  it.each(ownerNames)('%s', (name, spec) => {
    const phenotype = calculatePhenotype(genes(spec));
    expect(phenotype.colorName).toBe(name);
    expect(phenotype.shade).toBe('standard');
  });

  it.each(familyShades)('%s rolled %s/%s is %s', (spec, family, shade, name) => {
    const phenotype = calculatePhenotype(genes(spec), { [family]: { [shade]: 1 } });
    expect(phenotype).toMatchObject({ colorName: name, shade: 'standard' });
  });

  it('dark chestnut is Dark Chestnut or Liver Chestnut, fixed by the genes', () => {
    const seen = new Set();
    for (const to of ['to/to', 'TO/to', 'TO/TO']) {
      for (const sw of ['n/n', 'SW1/n', 'SW2/n', 'SW1/SW2']) {
        for (const sb1 of ['n/n', 'SB1/n']) {
          const genotype = genes('chestnut', { TO_Tobiano: to, SW_SplashWhite: sw, SB1_Sabino1: sb1 });
          const first = calculatePhenotype(genotype, { Chestnut: { dark: 1 } }).colorName;
          expect(calculatePhenotype(genotype, { Chestnut: { dark: 1 } }).colorName).toBe(first);
          seen.add(first);
        }
      }
    }
    expect([...seen].sort()).toEqual(['Dark Chestnut', 'Liver Chestnut']);
  });

  it('every family shade has an owner name and no family word is ever a color', () => {
    for (const [family, shades] of Object.entries(familyShadeNames)) {
      expect(shades.standard).toBeTruthy();
      expect(Object.values(shades).flat()).not.toContain(family);
    }
  });

  it('grey names are spelled grey and keep their hash slots (q311)', () => {
    expect(greyColorNames).toEqual([
      'Dapple Grey',
      'Steel Grey',
      'Rose Grey',
      'White Grey',
      'Fleabitten Grey',
      'Dapple Grey',
      'Light Dapple Grey',
      'Rose Grey',
      'Rose Grey',
    ]);
    const phenotype = calculatePhenotype(genes('bay', { G_Gray: 'G/g' }));
    expect(phenotype.isGrey).toBe(true);
    expect(phenotype).not.toHaveProperty('isGray');
    expect(greyColorNames).toContain(phenotype.colorName);
  });

  it('dominant white: plain, sabino for one spotting allele, compound for two (q315)', () => {
    expect(calculatePhenotype(genes('bay', { W_DominantWhite: 'W20/w' })).colorName).toBe('Dominant White');
    expect(calculatePhenotype(genes('bay', { W_DominantWhite: 'W3/w' })).colorName).toBe('Dominant White');
    expect(spottedDominantWhiteAlleles).toEqual(['W5', 'W10', 'W13', 'W19', 'W22', 'W31', 'W32', 'W35']);
    for (const allele of spottedDominantWhiteAlleles) {
      const phenotype = calculatePhenotype(genes('bay', { W_DominantWhite: `${allele}/w` }));
      expect(phenotype).toMatchObject({ colorName: 'Dominant White Sabino', isWhite: true });
    }
    for (const pair of ['W5/W20', 'W10/W20', 'W22/W20', 'W32/W35']) {
      const phenotype = calculatePhenotype(genes('chestnut', { W_DominantWhite: pair }));
      expect(phenotype).toMatchObject({ colorName: 'Compound Dominant White', isWhite: true });
    }
  });

  it('a new gene the owner list does not name for a combination is left out of the name', () => {
    expect(calculatePhenotype(genes('bay sdp2 dun')).colorName).toBe('Bay Dun');
    expect(calculatePhenotype(genes('bay sun2 z')).colorName).toBe('Silver Bay');
    expect(calculatePhenotype(genes('black m dun')).colorName).toBe('Grulla');
    expect(calculatePhenotype(genes('wild dun')).colorName).toBe('Bay Dun');
    expect(calculatePhenotype(genes('wild rn')).colorName).toBe('Bay Roan');
    expect(calculatePhenotype(genes('bay sdp1')).colorName).toBe('Standard Bay'); // one snowdrop copy hides
    expect(calculatePhenotype(genes('wild m')).colorName).toBe('Mushroom Bay');
  });

  it('roan still hides under grey and appaloosa', () => {
    const grey = calculatePhenotype(genes('chestnut cr1 rn', { G_Gray: 'G/g' }));
    expect(grey.isRoan).toBe(false);
    expect(greyColorNames).toContain(grey.colorName);
    expect(calculatePhenotype(genes('chestnut cr1 rn')).isRoan).toBe(true);
  });
});

describe('new alleles: dominance order and inheritance (Equoria-7woyj)', () => {
  it('writes A+ first, then the snowdrop/sunshine allele before n', () => {
    expect(canonicalAllelePair('A_Agouti', 'A/A+')).toBe('A+/A');
    expect(canonicalAllelePair('A_Agouti', 'a/A+')).toBe('A+/a');
    expect(canonicalAllelePair('Sdp_Snowdrop', 'n/sdp')).toBe('sdp/n');
    expect(canonicalAllelePair('Sun_Sunshine', 'n/sun')).toBe('sun/n');
    expect(canonicalAllelePair('W_DominantWhite', 'w/W32')).toBe('W32/w');
  });

  it('a foal inherits the new genes from its parents', () => {
    const sire = genes('wild sdp2', { Sun_Sunshine: 'sun/sun', MFSD12_Mushroom: 'M/M' });
    sire.A_Agouti = 'A+/A+';
    const foal = inheritColorGenotype(sire, { ...sire }, null, () => 0);
    expect(foal).toMatchObject({
      A_Agouti: 'A+/A+',
      Sdp_Snowdrop: 'sdp/sdp',
      Sun_Sunshine: 'sun/sun',
      MFSD12_Mushroom: 'M/M',
    });
    // Snowdrop sunshine with mushroom is not on the owner's list: mushroom names it.
    expect(calculatePhenotype(foal).colorName).toBe('Mushroom Bay');
    // A W35 carrier passes W35 on; one copy is dominant white sabino.
    const whiteFoal = inheritColorGenotype(genes('bay', { W_DominantWhite: 'W35/w' }), genes('bay'), null, () => 0);
    expect(whiteFoal.W_DominantWhite).toBe('W35/w');
    expect(calculatePhenotype(whiteFoal).colorName).toBe('Dominant White Sabino');
    // One copy from each carrier parent: snowdrop sunshine.
    const carrierSire = genes('bay sdp2');
    const carrierDam = genes('bay sun2');
    const hybrid = inheritColorGenotype(carrierSire, carrierDam, null, () => 0);
    expect(hybrid).toMatchObject({ Sdp_Snowdrop: 'sdp/n', Sun_Sunshine: 'sun/n' });
    expect(calculatePhenotype(hybrid).colorName).toBe('Snowdrop Sunshine Bay');
  });
});

describe('no breed can roll a new gene yet (q313/q315; breed odds deferred to Equoria-8xxnf)', () => {
  const newAlleles = ['A+', 'W5', 'W13', 'W19', 'W31', 'W32', 'W35', 'M', 'sdp', 'sun'];
  const carriesNew = pair => typeof pair === 'string' && pair.split('/').some(allele => newAlleles.includes(allele));

  it('no breed file allows or weights a new allele or locus', async () => {
    const profiles = await loadBreedSourceProfiles();
    expect(profiles.size).toBeGreaterThanOrEqual(312);
    for (const [name, profile] of profiles) {
      for (const section of ['allowedAlleles', 'alleleWeights']) {
        const loci = profile[section] ?? {};
        expect([name, Object.keys(loci).filter(locus => /Snowdrop|Sunshine/.test(locus))]).toEqual([name, []]);
        for (const [locus, value] of Object.entries(loci)) {
          const pairs = Array.isArray(value)
            ? value
            : Object.entries(value)
                .filter(([, weight]) => weight > 0)
                .map(([pair]) => pair);
          expect([name, locus, pairs.filter(carriesNew)]).toEqual([name, locus, []]);
        }
      }
    }
  });

  it('a generated horse of any breed never carries a new allele', async () => {
    const profiles = await loadBreedSourceProfiles();
    expect(profiles.size).toBeGreaterThanOrEqual(312);
    for (const profile of profiles.values()) {
      for (const roll of [0, 0.5, 0.999]) {
        const genotype = generateGenotype(profile, () => roll);
        expect(Object.values(genotype).filter(carriesNew)).toEqual([]);
      }
    }
  });
});
