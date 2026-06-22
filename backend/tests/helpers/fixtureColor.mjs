/**
 * fixtureColor.mjs (Equoria-g9sa)
 *
 * Test-fixture helper that produces a valid { colorGenotype, phenotype } pair
 * for raw `prisma.horse.create()` calls in test suites.
 *
 * WHY THIS EXISTS:
 *   Several test suites create fixture horses via raw `prisma.horse.create()`
 *   instead of the `createHorse()` model fn. `createHorse()` (Equoria-ennm)
 *   auto-generates colorGenotype + phenotype; raw create does not. That left
 *   fixtures born with NULL phenotype, which — when cleanup leaked rows —
 *   tripped the canonical-DB invariant asserted by
 *   backend/__tests__/horseColorNullSentinel.test.mjs (Equoria-lfj5).
 *
 *   Routing every such fixture through the full `createHorse()` pipeline is
 *   invasive (it requires breedId, runs genotype/trait generation, conformation
 *   + gait validation, and changes test semantics). This helper instead
 *   reuses the SAME generation services `createHorse()` and the backfill
 *   script use, so fixtures satisfy the sentinel invariant even transiently —
 *   without changing the behaviour the suites assert on.
 *
 * Usage:
 *   import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
 *   await prisma.horse.create({ data: { ...base, ...fixtureColor(), ... } });
 */

import {
  generateGenotype,
  calculatePhenotype,
  generateMarkings,
} from '../../modules/horses/index.mjs';

/**
 * Generate a valid colorGenotype + phenotype pair for a fixture horse.
 *
 * @param {object|null} breedGeneticProfile Optional breed genetic profile.
 *   Defaults to null (generic), matching the backfill script's null-profile path.
 * @returns {{ colorGenotype: object, phenotype: object }}
 */
export function fixtureColor(breedGeneticProfile = null) {
  const colorGenotype = generateGenotype(breedGeneticProfile);
  const baseColor = calculatePhenotype(colorGenotype, breedGeneticProfile?.shade_bias ?? null);
  const markings = generateMarkings(breedGeneticProfile, baseColor.colorName);
  const phenotype = { ...baseColor, ...markings };
  return { colorGenotype, phenotype };
}

export default fixtureColor;
