/**
 * Every coat color a horse in Equoria can have (Equoria-merxy).
 *
 * Owner ruling 2026-10-28 (q190): the Marketplace color filter is a dropdown of
 * every coat color in the game. Every horse's color comes from calculatePhenotype,
 * so the list is derived from it rather than typed out a second time: each
 * dilution combination on each base color, each with and without roan, plus the
 * hash-chosen gray and appaloosa names and the dominant white and brindle
 * overrides. 'Unknown' (no color genetics) is not a coat color and is left out.
 */
import {
  appaloosaMinimalNames,
  appaloosaPatternNames,
  calculatePhenotype,
  grayColorNames,
} from './phenotypeCalculationService.mjs';

// One allele pair per state each locus can be in, as calculatePhenotype reads them.
const bases = [
  { E_Extension: 'e/e', A_Agouti: 'A/a' },
  { E_Extension: 'E/e', A_Agouti: 'A/a' },
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
  const names = new Set([...grayColorNames, ...appaloosaPatternNames, ...appaloosaMinimalNames]);
  for (const genotype of genotypes()) {
    names.add(calculatePhenotype(genotype).colorName);
  }
  names.add(calculatePhenotype({ ...bases[1], W_DominantWhite: 'W20/w' }).colorName);
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
