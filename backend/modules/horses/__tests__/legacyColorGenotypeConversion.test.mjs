/**
 * legacyColorGenotypeConversion.test.mjs
 *
 * Genetics master spec slice 1 (Equoria-8xxnf): today's flat `colorGenotype`
 * strings to the phased appearance genome and back. The forward conversion
 * never invents phase or a specific variant the legacy value does not name; the
 * back conversion reports every loss instead of discarding it.
 *
 * Real code, real breed data files, no mocks.
 */

import { readFileSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  fromLegacyColorGenotype,
  toLegacyColorGenotype,
  normalizeLegacyPair,
  legacyLocusKeys,
} from '../services/legacyColorGenotypeConversion.mjs';
import { validateAppearanceGenome } from '../services/appearanceGenome.mjs';
import { registryCallRepresentation } from '../services/appearanceCallRecord.mjs';
import { getVariant } from '../services/appearanceVariantRegistry.mjs';

const breedsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../data/breeds');

/** The registry's call representation; an unknown id gets one so only its id is wrong. */
function rep(variantId) {
  return getVariant(variantId) ? registryCallRepresentation(variantId) : { assembly: 'UNMAPPED', callKind: 'SNV' };
}

function uc(variantId, dosage, extra = {}) {
  return { variantId, dosage, ...rep(variantId), ...extra };
}

function pc(variantId, phaseQuality, extra = {}) {
  return { variantId, phaseQuality, ...rep(variantId), ...extra };
}

function unphased(genome, chromosome) {
  return genome.chromosomes[chromosome]?.unphasedCalls ?? [];
}

function roundTrip(locus, pair) {
  const forward = fromLegacyColorGenotype({ [locus]: pair });
  const back = toLegacyColorGenotype(forward.genome);
  return { forward, back };
}

describe('fromLegacyColorGenotype', () => {
  test('maps exact legacy states to their molecular records with dosage', () => {
    const { genome } = fromLegacyColorGenotype({
      E_Extension: 'e/e',
      A_Agouti: 'A/a',
      Cr_Cream: 'Cr/n',
      TO_Tobiano: 'TO/to',
    });
    expect(unphased(genome, 'ECA3')).toEqual(expect.arrayContaining([uc('MC1R_e', 2), uc('KIT_TO', 1)]));
    expect(unphased(genome, 'ECA22')).toEqual([uc('ASIP_a', 1)]);
    expect(unphased(genome, 'ECA21')).toEqual([uc('SLC45A2_Cr', 1)]);
  });

  test('never invents phase: every converted chromosome is UNRESOLVED and empty-copied', () => {
    const { genome } = fromLegacyColorGenotype({ TO_Tobiano: 'TO/to', W_DominantWhite: 'W20/w' });
    const eca3 = genome.chromosomes.ECA3;
    expect(eca3.phaseResolution).toBe('UNRESOLVED');
    expect(eca3.copies.map(c => c.phasedVariants)).toEqual([[], []]);
    expect(eca3.unphasedCalls).toEqual([uc('KIT_TO', 1), uc('KIT_W20', 1)]);
  });

  test('marks the whole genome as legacy-inferred and valid', () => {
    const { genome } = fromLegacyColorGenotype({ G_Gray: 'G/g', Rn_Roan: 'Rn/rn' });
    expect(genome.migrationProvenance).toBe('legacyInferred');
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
  });

  test('wild-type legacy values produce no calls', () => {
    const { genome, unresolved } = fromLegacyColorGenotype({
      E_Extension: 'E/E',
      A_Agouti: 'A/A',
      D_Dun: 'nd2/nd2',
      W_DominantWhite: 'w/w',
      MFSD12_Mushroom: 'N/N',
      Prl_Pearl: 'n/n',
      BR1_Brindle1: 'N/N',
    });
    expect(genome.chromosomes).toEqual({});
    expect(unresolved).toEqual([]);
  });

  test('legacy roan becomes roanUnknownKit, never RN1/RN2/RN3', () => {
    const { genome } = fromLegacyColorGenotype({ Rn_Roan: 'Rn/Rn' });
    expect(unphased(genome, 'ECA3')).toEqual([uc('roanUnknownKit', 2)]);
  });

  test('legacy gray is not guessed into G2 or G3', () => {
    const { genome } = fromLegacyColorGenotype({ G_Gray: 'G/g' });
    expect(unphased(genome, 'ECA25')).toEqual([uc('stx17GrayUnknownCopyNumber', 1)]);
  });

  test('a numbered dominant white maps exactly; a bare W stays unknown', () => {
    expect(unphased(fromLegacyColorGenotype({ W_DominantWhite: 'W20/W4' }).genome, 'ECA3')).toEqual([
      uc('KIT_W20', 1),
      uc('KIT_W4', 1),
    ]);
    expect(unphased(fromLegacyColorGenotype({ W_DominantWhite: 'W/w' }).genome, 'ECA3')).toEqual([
      uc('kitWhiteUnknownLegacy', 1),
    ]);
  });

  test('numbered splash maps to its real gene; bare SW stays unplaced and unknown', () => {
    const exact = fromLegacyColorGenotype({ SW_SplashWhite: 'SW1/SW2' }).genome;
    expect(unphased(exact, 'ECA16')).toEqual([uc('MITF_SW1', 1)]);
    expect(unphased(exact, 'ECA6')).toEqual([uc('PAX3_SW2', 1)]);
    const generic = fromLegacyColorGenotype({ SW_SplashWhite: 'SW/n' }).genome;
    expect(generic.unplacedCalls).toEqual([uc('splashUnknownLegacy', 1)]);
  });

  test('dun, frame, leopard, PATN1, champagne, silver, mushroom, pearl map exactly', () => {
    const { genome } = fromLegacyColorGenotype({
      D_Dun: 'D/nd1',
      O_FrameOvero: 'O/n',
      LP_LeopardComplex: 'LP/lp',
      PATN1_Pattern1: 'PATN1/patn1',
      Ch_Champagne: 'Ch/n',
      Z_Silver: 'Z/n',
      MFSD12_Mushroom: 'M/N',
      Prl_Pearl: 'prl/prl',
    });
    expect(unphased(genome, 'ECA8')).toEqual([uc('TBX3_D', 1), uc('TBX3_nd1', 1)]);
    expect(unphased(genome, 'ECA17')).toEqual([uc('EDNRB_O', 1)]);
    expect(unphased(genome, 'ECA1')).toEqual([uc('TRPM1_LP', 1)]);
    expect(unphased(genome, 'ECA3')).toEqual([uc('RFWD3_PATN1', 1)]);
    expect(unphased(genome, 'ECA14')).toEqual([uc('SLC36A1_Ch', 1)]);
    expect(unphased(genome, 'ECA6')).toEqual([uc('PMEL_Z', 1)]);
    expect(unphased(genome, 'ECA7')).toEqual([uc('MFSD12_Mu', 1)]);
    expect(unphased(genome, 'ECA21')).toEqual([uc('SLC45A2_Prl', 2)]);
  });

  test('legacy seal brown and wild bay are kept as observations, not DNA', () => {
    const { genome, unresolved } = fromLegacyColorGenotype({ A_Agouti: 'At/a' });
    expect(unphased(genome, 'ECA22')).toEqual([uc('ASIP_a', 1)]);
    expect(genome.legacyObservations).toEqual([
      { legacyLocus: 'A_Agouti', token: 'At', count: 1, reason: 'notAMolecularAllele' },
    ]);
    expect(unresolved).toEqual([]);
  });

  test('a pearl-slot cr/prl recovers both the cream and the pearl call', () => {
    const { genome, unresolved, reconciliations } = fromLegacyColorGenotype({ Prl_Pearl: 'cr/prl' });
    expect(unphased(genome, 'ECA21')).toEqual(expect.arrayContaining([uc('SLC45A2_Cr', 1), uc('SLC45A2_Prl', 1)]));
    expect(unphased(genome, 'ECA21')).toHaveLength(2);
    expect(unresolved).toEqual([]);
    expect(reconciliations).toEqual([
      { code: 'pearlSlotCreamAdded', legacyLoci: ['Prl_Pearl', 'Cr_Cream'], creamCopies: 1 },
    ]);
  });

  test('a pearl-slot cream already counted in Cr_Cream is not counted twice', () => {
    for (const legacy of [
      { Cr_Cream: 'Cr/n', Prl_Pearl: 'cr/prl' },
      { Prl_Pearl: 'cr/prl', Cr_Cream: 'n/Cr' },
    ]) {
      const { genome, reconciliations } = fromLegacyColorGenotype(legacy);
      expect(unphased(genome, 'ECA21')).toEqual(expect.arrayContaining([uc('SLC45A2_Cr', 1), uc('SLC45A2_Prl', 1)]));
      expect(unphased(genome, 'ECA21')).toHaveLength(2);
      expect(reconciliations).toEqual([
        { code: 'pearlSlotCreamMatchesCrCream', legacyLoci: ['Prl_Pearl', 'Cr_Cream'], creamCopies: 1 },
      ]);
    }
  });

  test('both pearl-slot reconciliations round-trip exactly', () => {
    for (const legacy of [
      { Prl_Pearl: 'cr/prl' },
      { Cr_Cream: 'Cr/n', Prl_Pearl: 'cr/prl' },
      { Cr_Cream: 'Cr/Cr', Prl_Pearl: 'cr/prl' },
    ]) {
      const { genotype, loss } = toLegacyColorGenotype(fromLegacyColorGenotype(legacy).genome);
      expect(loss).toEqual([]);
      for (const locus of ['Cr_Cream', 'Prl_Pearl']) {
        expect([locus, normalizeLegacyPair(locus, genotype[locus])]).toEqual([
          locus,
          normalizeLegacyPair(locus, legacy[locus] ?? null),
        ]);
      }
    }
  });

  test('a numbered W31 maps to its KIT record', () => {
    expect(unphased(fromLegacyColorGenotype({ W_DominantWhite: 'W31/w' }).genome, 'ECA3')).toEqual([uc('KIT_W31', 1)]);
  });

  test('unknown loci and malformed values are persisted in the genome and restored', () => {
    const legacy = { Mystery_Locus: 'x/y', Cr_Cream: 'Cr', G_Gray: 7 };
    const { genome } = fromLegacyColorGenotype(legacy);
    expect(genome.legacyRawValues).toEqual([
      { legacyLocus: 'Mystery_Locus', value: 'x/y', reason: 'unknownLegacyLocus' },
      { legacyLocus: 'Cr_Cream', value: 'Cr', reason: 'malformedPair' },
      { legacyLocus: 'G_Gray', value: 7, reason: 'malformedPair' },
    ]);
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.Mystery_Locus).toBe('x/y');
    expect(genotype.Cr_Cream).toBe('Cr');
    expect(genotype.G_Gray).toBe(7);
    expect(loss).toEqual([]);
  });

  test('a pearl-slot cream is not reconciled against an unreadable Cr_Cream', () => {
    const legacy = { Cr_Cream: 'garbled', Prl_Pearl: 'cr/prl' };
    const { genome, unresolved, reconciliations } = fromLegacyColorGenotype(legacy);
    expect(unphased(genome, 'ECA21')).toEqual([uc('SLC45A2_Prl', 1)]);
    expect(reconciliations).toEqual([]);
    expect(unresolved).toContainEqual(
      expect.objectContaining({ legacyLocus: 'Prl_Pearl', reason: 'pearlSlotCreamUnreconcilable' }),
    );
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.Cr_Cream).toBe('garbled');
    expect(normalizeLegacyPair('Prl_Pearl', genotype.Prl_Pearl)).toEqual(['cr', 'prl']);
    expect(loss).toEqual([]);
  });

  test('a raw value displaced by calls in its slot is reported, not silently overwritten', () => {
    const { genome } = fromLegacyColorGenotype({ Cr_Cream: 'garbled' });
    genome.chromosomes.ECA21 = {
      copies: [
        { copyId: 'A', phasedVariants: [] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [uc('SLC45A2_Cr', 1)],
      phaseResolution: 'UNRESOLVED',
    };
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.Cr_Cream).toBe('Cr/n');
    expect(loss).toContainEqual({
      code: 'rawValueConflict',
      legacyLocus: 'Cr_Cream',
      rawValue: 'garbled',
      emitted: 'Cr/n',
    });
  });

  test('malformed and unknown values are reported, never guessed', () => {
    const { unresolved } = fromLegacyColorGenotype({
      Cr_Cream: 'Cr',
      W_DominantWhite: 'W99/w',
      Mystery_Locus: 'x/y',
      G_Gray: 7,
    });
    expect(unresolved.map(u => [u.legacyLocus, u.reason])).toEqual([
      ['Cr_Cream', 'malformedPair'],
      ['W_DominantWhite', 'unmappableWithoutGuessing'],
      ['Mystery_Locus', 'unknownLegacyLocus'],
      ['G_Gray', 'malformedPair'],
    ]);
  });

  test('rejects a non-object legacy genotype', () => {
    for (const bad of [null, [], 'E/e']) {
      expect(() => fromLegacyColorGenotype(bad)).toThrow(/object/);
    }
  });

  test('records the sex chromosomes it is given', () => {
    expect(fromLegacyColorGenotype({}, { sexChromosomes: 'XY' }).genome.sexChromosomes).toBe('XY');
    expect(fromLegacyColorGenotype({}).genome.sexChromosomes).toBe('UNKNOWN');
  });

  test('a stallion cannot carry two copies of an X-linked variant', () => {
    const { unresolved } = fromLegacyColorGenotype({ BR1_Brindle1: 'br1/br1' }, { sexChromosomes: 'XY' });
    expect(unresolved).toEqual([
      expect.objectContaining({ legacyLocus: 'BR1_Brindle1', reason: 'xDosageExceedsCopies' }),
    ]);
  });
});

describe('toLegacyColorGenotype', () => {
  test('a legacy horse round-trips in normalized meaning', () => {
    const legacy = {
      E_Extension: 'E/e',
      A_Agouti: 'A/a',
      Cr_Cream: 'n/Cr',
      D_Dun: 'D/nd2',
      G_Gray: 'G/g',
      Rn_Roan: 'Rn/rn',
      W_DominantWhite: 'W20/w',
      TO_Tobiano: 'TO/to',
      SW_SplashWhite: 'SW1/n',
      LP_LeopardComplex: 'LP/lp',
      Prl_Pearl: 'n/prl',
      MFSD12_Mushroom: 'M/N',
    };
    const { genotype, loss } = toLegacyColorGenotype(fromLegacyColorGenotype(legacy).genome);
    expect(loss).toEqual([]);
    for (const locus of legacyLocusKeys) {
      expect([locus, normalizeLegacyPair(locus, genotype[locus])]).toEqual([
        locus,
        normalizeLegacyPair(locus, legacy[locus] ?? null),
      ]);
    }
  });

  test('emits every legacy locus, filling wild type in the engine spelling', () => {
    const { genotype } = toLegacyColorGenotype(fromLegacyColorGenotype({}).genome);
    expect(genotype).toMatchObject({
      E_Extension: 'E/E',
      A_Agouti: 'A/A',
      D_Dun: 'nd2/nd2',
      G_Gray: 'g/g',
      W_DominantWhite: 'w/w',
      MFSD12_Mushroom: 'N/N',
      Prl_Pearl: 'n/n',
      BR1_Brindle1: 'n/n',
    });
  });

  test('reports a third KIT white variant it cannot fit, instead of dropping it silently', () => {
    const genome = fromLegacyColorGenotype({ W_DominantWhite: 'W20/W22' }).genome;
    genome.chromosomes.ECA3.unphasedCalls.push(uc('KIT_W4', 1));
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.W_DominantWhite).toBe('W20/W22');
    expect(loss).toContainEqual({
      code: 'legacySlotOverflow',
      legacyLocus: 'W_DominantWhite',
      dropped: ['W4'],
    });
  });

  test('reports dropped phase and dropped copy number', () => {
    const genome = fromLegacyColorGenotype({}).genome;
    genome.chromosomes.ECA3 = {
      copies: [
        {
          copyId: 'A',
          phasedVariants: [pc('KIT_W20', 'DIRECT'), pc('KIT_W22', 'DIRECT')],
        },
        { copyId: 'B', phasedVariants: [pc('KIT_TO', 'DIRECT')] },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
    };
    genome.chromosomes.ECA25 = {
      copies: [
        { copyId: 'A', phasedVariants: [pc('STX17_G3', 'DIRECT', { copyNumber: 3 })] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
    };
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.G_Gray).toBe('G/g');
    expect(loss).toContainEqual({ code: 'phaseDropped', chromosome: 'ECA3' });
    expect(loss).toContainEqual({ code: 'copyNumberDropped', variantId: 'STX17_G3' });
  });

  test('reports variants the legacy schema has no slot for', () => {
    const genome = fromLegacyColorGenotype({}).genome;
    genome.chromosomes.ECA3 = {
      copies: [
        { copyId: 'A', phasedVariants: [pc('MC1R_eA', 'DIRECT')] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
    };
    const { loss } = toLegacyColorGenotype(genome);
    expect(loss).toContainEqual({ code: 'noLegacyRepresentation', variantId: 'MC1R_eA' });
  });

  test('a resolved W17 haplotype writes back as one W17 token (spec line 376)', () => {
    const genome = fromLegacyColorGenotype({}).genome;
    genome.chromosomes.ECA3 = {
      copies: [
        {
          copyId: 'A',
          phasedVariants: [pc('KIT_W17_E667D', 'DIRECT'), pc('KIT_W17_L674P', 'DIRECT')],
        },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
    };
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.W_DominantWhite).toBe('W17/w');
    expect(loss).toEqual([]);
  });

  test('restores preserved legacy observations', () => {
    const { genotype, loss } = toLegacyColorGenotype(
      fromLegacyColorGenotype({ A_Agouti: 'At/a', Prl_Pearl: 'cr/prl' }).genome,
    );
    expect(normalizeLegacyPair('A_Agouti', genotype.A_Agouti)).toEqual(['At', 'a']);
    expect(normalizeLegacyPair('Prl_Pearl', genotype.Prl_Pearl)).toEqual(['cr', 'prl']);
    expect(loss).toEqual([]);
  });
});

describe('every allele pair in the live breed data', () => {
  const pairsByLocus = new Map();
  for (const file of readdirSync(breedsDir).filter(f => f.endsWith('.txt'))) {
    const text = readFileSync(join(breedsDir, file), 'utf8');
    const blocks = text.split('$json$').filter((_, i) => i % 2 === 1);
    for (const block of blocks) {
      const profile = JSON.parse(block);
      for (const [locus, pairs] of Object.entries(profile.allowedAlleles ?? {})) {
        for (const pair of pairs) {
          if (!pairsByLocus.has(locus)) {
            pairsByLocus.set(locus, new Set());
          }
          pairsByLocus.get(locus).add(pair);
        }
      }
    }
  }

  test('the breed data was read', () => {
    expect(pairsByLocus.size).toBeGreaterThanOrEqual(19);
  });

  test('converts and round-trips without loss or unresolved values', () => {
    const unresolvedSeen = [];
    for (const [locus, pairs] of pairsByLocus) {
      for (const pair of pairs) {
        const { forward, back } = roundTrip(locus, pair);
        unresolvedSeen.push(...forward.unresolved.map(u => `${u.legacyLocus}:${u.token}`));
        expect(validateAppearanceGenome(forward.genome)).toEqual({ valid: true, errors: [] });
        expect(back.loss).toEqual([]);
        expect([locus, pair, normalizeLegacyPair(locus, back.genotype[locus])]).toEqual([
          locus,
          pair,
          normalizeLegacyPair(locus, pair),
        ]);
      }
    }
    expect([...new Set(unresolvedSeen)]).toEqual([]);
  });
});

describe('legacy conversion (review round 2)', () => {
  test('a JSON-owned __proto__ locus is kept as an unknown raw value and written back', () => {
    const legacy = JSON.parse('{"__proto__":"x/y","E_Extension":"e/E"}');
    let forward;
    expect(() => {
      forward = fromLegacyColorGenotype(legacy);
    }).not.toThrow();
    expect(forward.unresolved).toContainEqual({
      legacyLocus: '__proto__',
      value: 'x/y',
      reason: 'unknownLegacyLocus',
    });
    const { genotype } = toLegacyColorGenotype(forward.genome);
    expect(Object.hasOwn(genotype, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(genotype, '__proto__').value).toBe('x/y');
    expect(Object.getPrototypeOf(genotype)).toBe(Object.prototype);
  });

  test('a malformed object value under __proto__ is not silently dropped on the way back', () => {
    const forward = fromLegacyColorGenotype(JSON.parse('{"__proto__":{"a":1}}'));
    const { genotype } = toLegacyColorGenotype(forward.genome);
    expect(Object.getOwnPropertyDescriptor(genotype, '__proto__').value).toEqual({ a: 1 });
  });

  test('prototype-named tokens in a known locus are unmappable, not variants', () => {
    let forward;
    expect(() => {
      forward = fromLegacyColorGenotype({ Cr_Cream: 'constructor/n' });
    }).not.toThrow();
    expect(forward.genome.chromosomes).toEqual({});
    expect(forward.unresolved).toContainEqual(
      expect.objectContaining({ token: 'constructor', reason: 'unmappableWithoutGuessing' }),
    );
    expect(normalizeLegacyPair('__proto__', 'x/y')).toEqual(['x', 'y']);
  });

  test('an unknown token in the Cream slot makes the pearl-slot cream unreconcilable', () => {
    const { genome, unresolved } = fromLegacyColorGenotype({
      Cr_Cream: 'cream/n',
      Prl_Pearl: 'cr/prl',
    });
    expect(unphased(genome, 'ECA21').map(c => c.variantId)).not.toContain('SLC45A2_Cr');
    expect(unresolved).toContainEqual(
      expect.objectContaining({
        legacyLocus: 'Prl_Pearl',
        reason: 'pearlSlotCreamUnreconcilable',
      }),
    );
  });

  test('cr/prl persists a legacy-encoded trans constraint and leaves ECA21 unresolved', () => {
    for (const legacy of [{ Prl_Pearl: 'cr/prl' }, { Cr_Cream: 'Cr/n', Prl_Pearl: 'cr/prl' }]) {
      const { genome } = fromLegacyColorGenotype(legacy);
      expect(genome.chromosomes.ECA21.phaseResolution).toBe('UNRESOLVED');
      expect(genome.chromosomes.ECA21.phaseConstraints).toEqual([
        { kind: 'TRANS', variantIds: ['SLC45A2_Cr', 'SLC45A2_Prl'], source: 'legacyEncoded' },
      ]);
      expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
      expect(toLegacyColorGenotype(genome).loss).toEqual([]);
    }
  });

  test('no trans constraint is recorded when the legacy value does not encode one', () => {
    const separate = fromLegacyColorGenotype({ Cr_Cream: 'Cr/n', Prl_Pearl: 'prl/n' }).genome;
    expect(separate.chromosomes.ECA21.phaseConstraints).toEqual([]);
    // Two creams: Prl shares a copy with one of them whatever the phase.
    const doubleCream = fromLegacyColorGenotype({ Cr_Cream: 'Cr/Cr', Prl_Pearl: 'cr/prl' }).genome;
    expect(doubleCream.chromosomes.ECA21.phaseConstraints).toEqual([]);
    expect(validateAppearanceGenome(doubleCream)).toEqual({ valid: true, errors: [] });
  });

  test('an observation on a locus the legacy shape lacks is reported, not skipped', () => {
    const { genome } = fromLegacyColorGenotype({});
    genome.legacyObservations.push({
      legacyLocus: 'Bogus_Locus',
      token: 'x',
      count: 1,
      reason: 'notAMolecularAllele',
    });
    expect(toLegacyColorGenotype(genome).loss).toContainEqual({
      code: 'noLegacyRepresentation',
      legacyLocus: 'Bogus_Locus',
      token: 'x',
    });
  });
});

describe('legacy conversion (review round 3)', () => {
  function transCrPrlGenome() {
    const { genome } = fromLegacyColorGenotype({ Prl_Pearl: 'cr/prl' });
    // As a tested genome would hold it: the calls and their trans constraint, no legacy notes.
    genome.legacyObservations = [];
    return genome;
  }

  test('a persisted trans Cr/Prl constraint writes back as cr/prl', () => {
    const genome = transCrPrlGenome();
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(loss).toEqual([]);
    expect(genotype.Prl_Pearl).toBe('cr/prl');
    expect(genotype.Cr_Cream).toBe('Cr/n');
    // Forward again: still one cream, one pearl, still in trans.
    const again = fromLegacyColorGenotype(genotype).genome;
    expect(unphased(again, 'ECA21')).toEqual(expect.arrayContaining(unphased(genome, 'ECA21')));
    expect(unphased(again, 'ECA21')).toHaveLength(unphased(genome, 'ECA21').length);
    expect(again.chromosomes.ECA21.phaseConstraints).toEqual(genome.chromosomes.ECA21.phaseConstraints);
  });

  test('a trans constraint the legacy shape cannot hold is reported as dropped phase', () => {
    const genome = transCrPrlGenome();
    genome.chromosomes.ECA21.phaseConstraints[0] = {
      kind: 'TRANS',
      variantIds: ['SLC45A2_Cr', 'SLC45A2_Sno'],
      source: 'legacyEncoded',
    };
    genome.chromosomes.ECA21.unphasedCalls = [uc('SLC45A2_Cr', 1), uc('SLC45A2_Sno', 1)];
    expect(toLegacyColorGenotype(genome).loss).toContainEqual({
      code: 'phaseDropped',
      chromosome: 'ECA21',
      variantIds: ['SLC45A2_Cr', 'SLC45A2_Sno'],
    });
  });

  test('duplicate raw records for one locus are reported, not collapsed silently', () => {
    const { genome } = fromLegacyColorGenotype({});
    genome.legacyRawValues = [
      { legacyLocus: 'Mystery', value: 'x/y', reason: 'unknownLegacyLocus' },
      { legacyLocus: 'Mystery', value: 'a/b', reason: 'unknownLegacyLocus' },
    ];
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.Mystery).toBe('x/y');
    expect(loss).toContainEqual({ code: 'duplicateRawLocus', legacyLocus: 'Mystery', dropped: ['a/b'] });
  });
});

describe('legacy conversion (review round 4)', () => {
  const TRANS = { kind: 'TRANS', variantIds: ['SLC45A2_Cr', 'SLC45A2_Prl'], source: 'legacyEncoded' };

  function resolvedEca21(copyA, copyB, phaseConstraints = []) {
    const { genome } = fromLegacyColorGenotype({});
    genome.chromosomes.ECA21 = {
      copies: [
        { copyId: 'A', phasedVariants: copyA.map(variantId => pc(variantId, 'DIRECT')) },
        { copyId: 'B', phasedVariants: copyB.map(variantId => pc(variantId, 'DIRECT')) },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
      phaseConstraints,
    };
    return genome;
  }

  test('even a repeated trans constraint writes cr into the pearl slot only once', () => {
    const { genome } = fromLegacyColorGenotype({ Prl_Pearl: 'cr/prl' });
    genome.legacyObservations = [];
    genome.chromosomes.ECA21.phaseConstraints.push({ ...TRANS });
    const { genotype } = toLegacyColorGenotype(genome);
    expect(genotype.Prl_Pearl).toBe('cr/prl');
    expect(genotype.Cr_Cream).toBe('Cr/n');
  });

  test('resolved cream and pearl on opposite copies write back as cr/prl with no loss', () => {
    for (const constraints of [[], [TRANS]]) {
      const genome = resolvedEca21(['SLC45A2_Cr'], ['SLC45A2_Prl'], constraints);
      expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
      const { genotype, loss } = toLegacyColorGenotype(genome);
      expect([constraints.length, genotype.Cr_Cream, genotype.Prl_Pearl, loss]).toEqual([
        constraints.length,
        'Cr/n',
        'cr/prl',
        [],
      ]);
      const again = fromLegacyColorGenotype(genotype).genome;
      expect(again.chromosomes.ECA21.phaseConstraints).toEqual([TRANS]);
    }
  });

  test('resolved cream and pearl on one copy cannot be spelled in legacy and drop phase', () => {
    const genome = resolvedEca21(['SLC45A2_Cr', 'SLC45A2_Prl'], []);
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.Prl_Pearl).toBe('prl/n');
    expect(loss).toContainEqual({ code: 'phaseDropped', chromosome: 'ECA21' });
  });
});

describe('legacy conversion (review round 5)', () => {
  function resolved(chromosomeId, copyA, copyB, phaseConstraints = []) {
    const { genome } = fromLegacyColorGenotype({});
    genome.chromosomes[chromosomeId] = {
      copies: [
        { copyId: 'A', phasedVariants: copyA.map(variantId => pc(variantId, 'DIRECT')) },
        { copyId: 'B', phasedVariants: copyB.map(variantId => pc(variantId, 'DIRECT')) },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
      phaseConstraints,
    };
    return genome;
  }

  test('an XY horse listed with two brindle tokens keeps its one certain copy', () => {
    for (const value of ['br1/br1', 'br1/BR1', 'BR1/br1']) {
      const { genome, unresolved } = fromLegacyColorGenotype({ BR1_Brindle1: value }, { sexChromosomes: 'XY' });
      expect([value, genome.chromosomes.ECAX.unphasedCalls]).toEqual([value, [uc('MBTPS2_BR1', 1)]]);
      expect([value, unresolved.map(u => u.reason)]).toEqual([value, ['xDosageExceedsCopies']]);
      genome.chromosomes.ECAX.copies = [{ copyId: 'X', phasedVariants: [] }];
      expect([value, validateAppearanceGenome(genome)]).toEqual([value, { valid: true, errors: [] }]);
      // The extra token is kept, so the legacy value round-trips in meaning
      // (br1 and BR1 are two spellings of one allele).
      const tokens = pair => pair.toLowerCase().split('/');
      expect([value, tokens(toLegacyColorGenotype(genome).genotype.BR1_Brindle1)]).toEqual([value, tokens(value)]);
    }
  });

  test('an unreadable pearl-slot cream later resolved as trans is not written twice', () => {
    const { genome } = fromLegacyColorGenotype({ Cr_Cream: 'Cr/zz', Prl_Pearl: 'cr/prl' });
    expect(genome.legacyObservations).toContainEqual(
      expect.objectContaining({ legacyLocus: 'Prl_Pearl', token: 'cr', reason: 'unmappableWithoutGuessing' }),
    );
    genome.chromosomes.ECA21 = {
      copies: [
        { copyId: 'A', phasedVariants: [pc('SLC45A2_Cr', 'DIRECT')] },
        { copyId: 'B', phasedVariants: [pc('SLC45A2_Prl', 'DIRECT')] },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
      phaseConstraints: [],
    };
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.Prl_Pearl).toBe('cr/prl');
    expect(loss.map(l => l.code)).not.toContain('legacySlotOverflow');
  });

  test('a resolved non-cream trans pair with a redundant constraint is reported once', () => {
    const constraint = { kind: 'TRANS', variantIds: ['SLC45A2_Cr', 'SLC45A2_Sno'], source: 'legacyEncoded' };
    const genome = resolved('ECA21', ['SLC45A2_Cr'], ['SLC45A2_Sno'], [constraint]);
    const dropped = toLegacyColorGenotype(genome).loss.filter(l => l.code === 'phaseDropped');
    expect(dropped).toHaveLength(1);
    expect(dropped[0].chromosome).toBe('ECA21');
  });

  test('alleles that can only sit in trans lose no phase', () => {
    const genome = resolved('ECA8', ['TBX3_D'], ['TBX3_nd1']);
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.D_Dun.split('/').sort()).toEqual(['D', 'nd1']);
    expect(loss).toEqual([]);
  });
});

describe('legacy conversion (review round 7)', () => {
  test('legacy W17 becomes both halves of its cis haplotype and comes back unchanged', () => {
    for (const [pair, dosage] of [
      ['W17/w', 1],
      ['W17/W17', 2],
    ]) {
      const { genome, unresolved } = fromLegacyColorGenotype({ W_DominantWhite: pair });
      expect([pair, unresolved]).toEqual([pair, []]);
      expect(unphased(genome, 'ECA3').map(c => [c.variantId, c.dosage])).toEqual([
        ['KIT_W17_E667D', dosage],
        ['KIT_W17_L674P', dosage],
      ]);
      expect(genome.legacyObservations).toEqual([]);
      expect([pair, validateAppearanceGenome(genome)]).toEqual([pair, { valid: true, errors: [] }]);
      expect([pair, toLegacyColorGenotype(genome)]).toEqual([
        pair,
        { genotype: expect.objectContaining({ W_DominantWhite: pair }), loss: [] },
      ]);
    }
  });

  test('W17 beside another dominant white keeps both', () => {
    const { genome } = fromLegacyColorGenotype({ W_DominantWhite: 'W17/W20' });
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
    const back = toLegacyColorGenotype(genome).genotype.W_DominantWhite;
    expect(back.split('/').sort()).toEqual(['W17', 'W20']);
  });

  test('converted calls carry the registry call representation', () => {
    const { genome } = fromLegacyColorGenotype({ Cr_Cream: 'Cr/n', SW_SplashWhite: 'SW/n', TO_Tobiano: 'TO/to' });
    expect(unphased(genome, 'ECA21')).toEqual([
      { variantId: 'SLC45A2_Cr', dosage: 1, assembly: 'EquCab3.0', callKind: 'SNV' },
    ]);
    expect(unphased(genome, 'ECA3')).toEqual([
      { variantId: 'KIT_TO', dosage: 1, assembly: 'EquCab3.0', callKind: 'INVERSION' },
    ]);
    expect(genome.unplacedCalls).toEqual([
      { variantId: 'splashUnknownLegacy', dosage: 1, assembly: 'UNMAPPED', callKind: 'haplotypeMarker' },
    ]);
  });

  test('back conversion refuses an observation count no legacy pair can hold', () => {
    const { genome } = fromLegacyColorGenotype({ A_Agouti: 'At/a' });
    genome.legacyObservations[0].count = 1_000_000_000_000;
    const started = Date.now();
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(genotype.A_Agouti).toBe('A/a');
    expect(loss).toContainEqual({
      code: 'invalidObservationCount',
      legacyLocus: 'A_Agouti',
      token: 'At',
      count: 1_000_000_000_000,
    });
  });
});

describe('legacy conversion (review round 8)', () => {
  test('back conversion refuses a call dosage above the two copies a pair holds', () => {
    const { genome } = fromLegacyColorGenotype({ E_Extension: 'E/e', Cr_Cream: 'Cr/n' });
    unphased(genome, 'ECA3')[0].dosage = 3;
    genome.unplacedCalls = [uc('splashUnknownLegacy', 3)];
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.E_Extension).toBe('E/E');
    expect(genotype.SW_SplashWhite).toBe('n/n');
    // The readable call still writes back.
    expect(genotype.Cr_Cream).toBe('Cr/n');
    expect(loss).toEqual(
      expect.arrayContaining([
        { code: 'invalidCallDosage', variantId: 'MC1R_e', dosage: 3 },
        { code: 'invalidCallDosage', variantId: 'splashUnknownLegacy', dosage: 3 },
      ]),
    );
  });

  test('a haplotype dosage above two writes no W17 tokens', () => {
    const { genome } = fromLegacyColorGenotype({ W_DominantWhite: 'W17/w' });
    for (const call of unphased(genome, 'ECA3')) {
      call.dosage = 3;
    }
    const { genotype, loss } = toLegacyColorGenotype(genome);
    expect(genotype.W_DominantWhite).toBe('w/w');
    expect(loss.filter(l => l.code === 'invalidCallDosage')).toHaveLength(2);
  });
});

test('a corrupt trillion-copy dosage returns at once instead of looping', () => {
  const { genome } = fromLegacyColorGenotype({ E_Extension: 'E/e', W_DominantWhite: 'W17/w' });
  for (const call of unphased(genome, 'ECA3')) {
    call.dosage = 1_000_000_000_000;
  }
  const started = Date.now();
  const { genotype, loss } = toLegacyColorGenotype(genome);
  expect(Date.now() - started).toBeLessThan(1000);
  expect(genotype.W_DominantWhite).toBe('w/w');
  expect(loss.filter(l => l.code === 'invalidCallDosage')).toHaveLength(3);
});
