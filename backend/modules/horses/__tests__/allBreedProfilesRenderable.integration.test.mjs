/**
 * allBreedProfilesRenderable.integration.test.mjs (Equoria-26qjf.4)
 *
 * Real-DB integration gate for ALL imported breed genetic profiles. NO MOCKS —
 * reads every row from the canonical breeds table and asserts the engine can
 * fully render it:
 *   - breedGeneticProfile is valid JSONB (object, not null/array/string)
 *   - generateGenotype(profile) yields a genotype covering all CORE_LOCI
 *   - calculatePhenotype(genotype, profile.shade_bias) returns a known,
 *     non-'Unknown' colorName
 *   - when the rendered colorName has a shade_bias entry, the returned shade is
 *     one the breed declared for that color (engine returns 'standard' fallback
 *     for colors absent from shade_bias — that fallback is documented, not a gap)
 *   - the foal must NOT be falsely flagged Brindle from the breed's wild-type
 *     data (the Equoria-26qjf.1/.3 case-mismatch sentinel)
 *
 * This is a SENTINEL: it fails loudly if a future breed import produces an
 * unrenderable profile (e.g. re-introduces uppercase Pearl/Brindle alleles, a
 * malformed JSONB blob, or a genotype that phenotypes as 'Unknown').
 *
 * Story: Equoria-26qjf.4
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { CORE_LOCI, generateGenotype } from '../services/genotypeGenerationService.mjs';
import { calculatePhenotype } from '../services/phenotypeCalculationService.mjs';

// JSONB type guard (CONTRIBUTING §1).
function isPlainObject(v) {
  return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
}

// Pull the set of declared shades for a color from a breed's shade_bias.
function declaredShadesFor(shadeBias, colorName) {
  if (!isPlainObject(shadeBias)) {
    return null;
  }
  const entry = shadeBias[colorName];
  if (!isPlainObject(entry)) {
    return null;
  }
  return new Set(Object.keys(entry));
}

describe('All imported breed profiles are engine-renderable (Equoria-26qjf.4)', () => {
  let breeds = [];

  beforeAll(async () => {
    breeds = await prisma.breed.findMany({
      select: { id: true, name: true, breedGeneticProfile: true },
      orderBy: { name: 'asc' },
    });
  });

  test('there is at least one breed with a genetic profile to verify', () => {
    // Guards against a silently-empty table (which would make every per-breed
    // assertion vacuously pass). After seed:breeds this is 312+.
    const withProfiles = breeds.filter(b => isPlainObject(b.breedGeneticProfile));
    expect(withProfiles.length).toBeGreaterThan(0);
  });

  test('every breed profile is valid JSONB + renders a known phenotype (no Unknown, no false Brindle)', () => {
    const failures = [];

    for (const breed of breeds) {
      const profile = breed.breedGeneticProfile;

      // A breed row may legitimately have a null profile (not yet authored).
      // Those are skipped — the gate is about profiles that EXIST being renderable.
      if (profile === null || profile === undefined) {
        continue;
      }

      if (!isPlainObject(profile)) {
        failures.push(`${breed.name}: breedGeneticProfile is not a JSON object`);
        continue;
      }

      // Generate a genotype deterministically-ish (default RNG) and assert coverage.
      let genotype;
      try {
        genotype = generateGenotype(profile);
      } catch (err) {
        failures.push(`${breed.name}: generateGenotype threw — ${err.message}`);
        continue;
      }

      for (const locus of CORE_LOCI) {
        if (typeof genotype[locus] !== 'string' || genotype[locus].length === 0) {
          failures.push(`${breed.name}: genotype missing/empty locus ${locus}`);
        }
      }

      // Render the phenotype with the breed's shade_bias.
      const shadeBias = isPlainObject(profile.shade_bias) ? profile.shade_bias : null;
      let phenotype;
      try {
        phenotype = calculatePhenotype(genotype, shadeBias);
      } catch (err) {
        failures.push(`${breed.name}: calculatePhenotype threw — ${err.message}`);
        continue;
      }

      if (!phenotype.colorName || phenotype.colorName === 'Unknown') {
        failures.push(`${breed.name}: rendered Unknown color from genotype ${JSON.stringify(genotype)}`);
      }

      // Equoria-26qjf.1/.3 case-mismatch sentinel: a breed whose Brindle locus is
      // wild-type must NOT render Brindle. (Catches a re-introduced uppercase
      // 'N/N' on BR1_Brindle1, which would satisfy `br1 !== 'n/n'`.)
      if (phenotype.isBrindle && genotype.BR1_Brindle1 === 'n/n') {
        failures.push(`${breed.name}: falsely flagged Brindle despite wild-type BR1_Brindle1=n/n`);
      }

      // When the rendered color is declared in shade_bias, the chosen shade must
      // be one of the declared shades. (Colors absent from shade_bias get the
      // documented 'standard' fallback — not asserted.)
      const declared = declaredShadesFor(shadeBias, phenotype.colorName);
      if (declared && !declared.has(phenotype.shade)) {
        failures.push(
          `${breed.name}: shade '${phenotype.shade}' not in declared shade_bias for '${phenotype.colorName}' (${[...declared].join('/')})`,
        );
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} breed profile(s) failed the renderable gate:\n  ${failures.slice(0, 50).join('\n  ')}`,
      );
    }
  });

  test('repeated generation across many samples never renders Unknown or false Brindle (statistical sentinel)', () => {
    // Single-draw coverage can miss a rare allele combination that only some RNG
    // paths reach. Sample each profile multiple times to exercise more of the
    // weighted distribution.
    const failures = [];
    const SAMPLES = 25;

    for (const breed of breeds) {
      const profile = breed.breedGeneticProfile;
      if (!isPlainObject(profile)) {
        continue;
      }
      const shadeBias = isPlainObject(profile.shade_bias) ? profile.shade_bias : null;

      for (let i = 0; i < SAMPLES; i++) {
        const genotype = generateGenotype(profile);
        const phenotype = calculatePhenotype(genotype, shadeBias);
        if (!phenotype.colorName || phenotype.colorName === 'Unknown') {
          failures.push(`${breed.name}[#${i}]: Unknown color`);
          break;
        }
        if (phenotype.isBrindle && genotype.BR1_Brindle1 === 'n/n') {
          failures.push(`${breed.name}[#${i}]: false Brindle on wild-type BR1`);
          break;
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} breed(s) produced an unrenderable sample:\n  ${failures.slice(0, 50).join('\n  ')}`,
      );
    }
  });
});
