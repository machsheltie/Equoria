/**
 * Every coat color a horse in Equoria can have (Equoria-merxy).
 *
 * Owner ruling 2026-10-28 (q190): the Marketplace color filter is a dropdown of
 * every coat color in the game. Every horse's color comes from calculatePhenotype,
 * so the list is derived from it rather than typed out a second time: each
 * dilution combination on each base color, each with and without roan, plus the
 * hash-chosen grey and appaloosa names and the dominant white and brindle
 * overrides. A color family (Bay, Chestnut...) is listed as each of its owner
 * names (Standard Bay, Mahogany Bay...), never as the family word (Equoria-7woyj).
 * 'Unknown' (no color genetics) is not a coat color and is left out.
 */
import { familyShadeNames } from './coatColorNaming.mjs';
import {
  appaloosaMinimalNames,
  appaloosaPatternNames,
  calculatePhenotype,
  greyColorNames,
} from './phenotypeCalculationService.mjs';

// One allele pair per state each locus can be in, as calculatePhenotype reads them.
const bases = [
  { E_Extension: 'e/e', A_Agouti: 'A/a' },
  { E_Extension: 'E/e', A_Agouti: 'A/a' },
  { E_Extension: 'E/e', A_Agouti: 'A+/a' },
  { E_Extension: 'E/e', A_Agouti: 'At/a' },
  { E_Extension: 'E/e', A_Agouti: 'a/a' },
];
const dilutionLoci = {
  Cr_Cream: ['n/n', 'Cr/n', 'Cr/Cr'],
  D_Dun: ['nd2/nd2', 'D/nd2'],
  Z_Silver: ['n/n', 'Z/n'],
  Ch_Champagne: ['n/n', 'Ch/n'],
  Prl_Pearl: ['n/n', 'prl/n', 'prl/prl'],
  MFSD12_Mushroom: ['N/N', 'M/N'],
  Sdp_Snowdrop: ['n/n', 'sdp/n', 'sdp/sdp'],
  Sun_Sunshine: ['n/n', 'sun/n', 'sun/sun'],
  Rn_Roan: ['rn/rn', 'Rn/rn'],
};

function* genotypes() {
  let combos = bases.map(base => ({ ...base }));
  for (const [locus, alleles] of Object.entries(dilutionLoci)) {
    combos = combos.flatMap(combo => alleles.map(allele => ({ ...combo, [locus]: allele })));
  }
  yield* combos;
}

function buildCoatColorNames() {
  const names = new Set([...greyColorNames, ...appaloosaPatternNames, ...appaloosaMinimalNames]);
  for (const genotype of genotypes()) {
    names.add(calculatePhenotype(genotype).colorName);
  }
  for (const shades of Object.values(familyShadeNames)) {
    for (const named of Object.values(shades)) {
      for (const name of [named].flat()) {
        names.add(name);
      }
    }
  }
  for (const white of ['W20/w', 'W22/w', 'W20/W22']) {
    names.add(calculatePhenotype({ ...bases[1], W_DominantWhite: white }).colorName);
  }
  names.add(calculatePhenotype({ ...bases[1], BR1_Brindle1: 'BR1/n' }).colorName);
  names.delete('Unknown');
  return Object.freeze([...names].sort((a, b) => a.localeCompare(b, 'en')));
}

/** Every coat color name, alphabetical. */
export const coatColorNames = buildCoatColorNames();

const byLowerCase = new Map(coatColorNames.map(name => [name.toLowerCase(), name]));

/** The coat color's own spelling for `value` (any case), or undefined when it is not one. */
export function canonicalCoatColorName(value) {
  return typeof value === 'string' ? byLowerCase.get(value.trim().toLowerCase()) : undefined;
}
