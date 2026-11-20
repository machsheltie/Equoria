/**
 * appearanceGenome.test.mjs
 *
 * Genetics master spec slice 1 (Equoria-8xxnf): the phased chromosome-copy
 * state, its validator, and the explicitly named no-crossover transmission.
 * Pure functions, real code, seeded RNG, no mocks.
 */

import {
  preservePhaseNoCrossover,
  createEmptyAppearanceGenome,
  validateAppearanceGenome,
  transmitChromosomeCopy,
} from '../services/appearanceGenome.mjs';
import { registryCallRepresentation } from '../services/appearanceCallRecord.mjs';
import { getVariant } from '../services/appearanceVariantRegistry.mjs';
import { seededRng } from '../../../__tests__/helpers/seededRng.mjs';

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

function call(variantId) {
  return { variantId, phaseQuality: 'DIRECT', ...rep(variantId) };
}

function genomeWithEca3(copyA, copyB) {
  const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
  genome.chromosomes.ECA3 = {
    copies: [
      { copyId: 'A', phasedVariants: copyA.map(call) },
      { copyId: 'B', phasedVariants: copyB.map(call) },
    ],
    unphasedCalls: [],
    phaseResolution: 'RESOLVED',
  };
  return genome;
}

function codes(result) {
  return result.errors.map(e => e.code);
}

describe('createEmptyAppearanceGenome', () => {
  test('starts at schema version 2 with no chromosomes and no provenance', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XY' });
    expect(genome).toEqual({
      schemaVersion: 2,
      sexChromosomes: 'XY',
      chromosomes: {},
      unplacedCalls: [],
      legacyObservations: [],
      legacyRawValues: [],
      migrationProvenance: null,
    });
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
  });

  test('rejects an invalid sex chromosome value', () => {
    expect(() => createEmptyAppearanceGenome({ sexChromosomes: 'XXY' })).toThrow(/sexChromosomes/);
  });
});

describe('validateAppearanceGenome', () => {
  test('accepts the documented W20+W22 cis haplotype opposite tobiano', () => {
    const genome = genomeWithEca3(['KIT_W20', 'KIT_W22'], ['KIT_TO']);
    expect(validateAppearanceGenome(genome).valid).toBe(true);
  });

  test('accepts more than two KIT variants on one horse', () => {
    const genome = genomeWithEca3(['KIT_W20', 'KIT_W22', 'KIT_SB1'], ['KIT_TO', 'KIT_W20']);
    expect(validateAppearanceGenome(genome).valid).toBe(true);
  });

  test('rejects an unknown variant id', () => {
    const genome = genomeWithEca3(['KIT_W99'], []);
    expect(codes(validateAppearanceGenome(genome))).toContain('unknownVariant');
  });

  test('rejects a variant stored on the wrong chromosome', () => {
    const genome = genomeWithEca3(['SLC45A2_Cr'], []);
    expect(codes(validateAppearanceGenome(genome))).toContain('wrongChromosome');
  });

  test('rejects two overlapping sites on one copy', () => {
    const genome = genomeWithEca3(['KIT_W15', 'KIT_W22'], []);
    expect(codes(validateAppearanceGenome(genome))).toContain('cisIncompatible');
  });

  test('allows the same overlapping pair in trans', () => {
    const genome = genomeWithEca3(['KIT_W15'], ['KIT_W22']);
    expect(validateAppearanceGenome(genome).valid).toBe(true);
  });

  test('rejects the same variant twice on one copy', () => {
    const genome = genomeWithEca3(['KIT_TO', 'KIT_TO'], []);
    expect(codes(validateAppearanceGenome(genome))).toContain('duplicateCallOnCopy');
  });

  test('rejects a copy count other than two on an autosome', () => {
    const genome = genomeWithEca3([], []);
    genome.chromosomes.ECA3.copies.pop();
    expect(codes(validateAppearanceGenome(genome))).toContain('wrongCopyCount');
  });

  test('rejects unphased dosage above the copy count', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.chromosomes.ECA3 = {
      copies: [
        { copyId: 'A', phasedVariants: [] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [uc('KIT_TO', 3)],
      phaseResolution: 'UNRESOLVED',
    };
    expect(codes(validateAppearanceGenome(genome))).toContain('dosageExceedsCopies');
  });

  test('rejects RESOLVED phase while unphased calls remain', () => {
    const genome = genomeWithEca3([], []);
    genome.chromosomes.ECA3.unphasedCalls = [uc('KIT_TO', 1)];
    expect(codes(validateAppearanceGenome(genome))).toContain('phaseStateMismatch');
  });

  test('limits an XY horse to one X copy', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XY' });
    genome.chromosomes.ECAX = {
      copies: [{ copyId: 'X', phasedVariants: [] }],
      unphasedCalls: [uc('MBTPS2_BR1', 2)],
      phaseResolution: 'UNRESOLVED',
    };
    expect(codes(validateAppearanceGenome(genome))).toContain('dosageExceedsCopies');
  });

  test('only chromosome-less sentinels may sit in unplacedCalls', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.unplacedCalls = [uc('splashUnknownLegacy', 1)];
    expect(validateAppearanceGenome(genome).valid).toBe(true);
    genome.unplacedCalls = [uc('KIT_TO', 1)];
    expect(codes(validateAppearanceGenome(genome))).toContain('placedVariantUnplaced');
  });

  test('rejects a non-object genome', () => {
    for (const bad of [null, [], 'genome', 7]) {
      expect(codes(validateAppearanceGenome(bad))).toEqual(['notAnObject']);
    }
  });
});

describe('transmitChromosomeCopy (preservePhaseNoCrossover)', () => {
  test('requires the no-crossover mode to be named explicitly', () => {
    const genome = genomeWithEca3(['KIT_TO'], []);
    expect(() => transmitChromosomeCopy(genome, 'ECA3', seededRng(1))).toThrow(/mode/);
    expect(() => transmitChromosomeCopy(genome, 'ECA3', seededRng(1), { mode: 'phasedMap' })).toThrow(/mode/);
  });

  test('transmits a multi-variant KIT haplotype as one unit', () => {
    const genome = genomeWithEca3(['KIT_W20', 'KIT_W22'], ['KIT_TO']);
    const rng = seededRng(42);
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const copy = transmitChromosomeCopy(genome, 'ECA3', rng, { mode: preservePhaseNoCrossover });
      seen.add(copy.phasedVariants.map(v => v.variantId).join('+'));
    }
    expect([...seen].sort()).toEqual(['KIT_TO', 'KIT_W20+KIT_W22']);
  });

  test('draws each parental copy roughly half the time', () => {
    const genome = genomeWithEca3(['KIT_TO'], []);
    const rng = seededRng(7);
    let to = 0;
    for (let i = 0; i < 2000; i++) {
      const copy = transmitChromosomeCopy(genome, 'ECA3', rng, { mode: preservePhaseNoCrossover });
      if (copy.phasedVariants.length) {
        to++;
      }
    }
    expect(to).toBeGreaterThan(900);
    expect(to).toBeLessThan(1100);
  });

  test('returns a copy the caller cannot use to mutate the parent', () => {
    const genome = genomeWithEca3(['KIT_TO'], ['KIT_TO']);
    const copy = transmitChromosomeCopy(genome, 'ECA3', seededRng(3), {
      mode: preservePhaseNoCrossover,
    });
    copy.phasedVariants.push(call('KIT_SB1'));
    expect(genome.chromosomes.ECA3.copies[0].phasedVariants).toHaveLength(1);
    expect(genome.chromosomes.ECA3.copies[1].phasedVariants).toHaveLength(1);
  });

  test('refuses a chromosome whose phase is unresolved', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.chromosomes.ECA3 = {
      copies: [
        { copyId: 'A', phasedVariants: [] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [uc('KIT_TO', 1), uc('KIT_W20', 1)],
      phaseResolution: 'UNRESOLVED',
    };
    expect(() => transmitChromosomeCopy(genome, 'ECA3', seededRng(1), { mode: preservePhaseNoCrossover })).toThrow(
      /unresolved/i,
    );
  });

  test('refuses the sex chromosomes in this slice', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.chromosomes.ECAX = {
      copies: [
        { copyId: 'A', phasedVariants: [] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
    };
    expect(() => transmitChromosomeCopy(genome, 'ECAX', seededRng(1), { mode: preservePhaseNoCrossover })).toThrow(
      /sex chromosome/i,
    );
  });

  test('transmits a wild-type copy when the chromosome is absent from the genome', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    const copy = transmitChromosomeCopy(genome, 'ECA3', seededRng(1), {
      mode: preservePhaseNoCrossover,
    });
    expect(copy.phasedVariants).toEqual([]);
  });
});

describe('validateAppearanceGenome joint site capacity (review round 1)', () => {
  function genomeWithEca25(copyA, copyB, unphasedCalls, phaseResolution) {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.chromosomes.ECA25 = {
      copies: [
        { copyId: 'A', phasedVariants: copyA },
        { copyId: 'B', phasedVariants: copyB },
      ],
      unphasedCalls,
      phaseResolution,
    };
    return genome;
  }

  test('rejects mutually exclusive unphased states that need more than two copies', () => {
    const genome = genomeWithEca25([], [], [uc('STX17_G2', 2), uc('STX17_G3', 2)], 'UNRESOLVED');
    expect(codes(validateAppearanceGenome(genome))).toContain('jointSiteCapacityExceeded');
  });

  test('accepts one G2 and one G3 unphased', () => {
    const genome = genomeWithEca25([], [], [uc('STX17_G2', 1), uc('STX17_G3', 1)], 'UNRESOLVED');
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
  });

  test('counts a three-way exclusive group (G2, G3, unknown gray) together', () => {
    const genome = genomeWithEca25(
      [],
      [],
      [uc('STX17_G2', 1), uc('STX17_G3', 1), uc('stx17GrayUnknownCopyNumber', 1)],
      'UNRESOLVED',
    );
    expect(codes(validateAppearanceGenome(genome))).toContain('jointSiteCapacityExceeded');
  });

  test('rejects a call whose copyNumber contradicts its registry record', () => {
    const wrong = genomeWithEca25([pc('STX17_G3', 'DIRECT', { copyNumber: 2 })], [], [], 'RESOLVED');
    expect(codes(validateAppearanceGenome(wrong))).toContain('copyNumberMismatch');
    const right = genomeWithEca25([pc('STX17_G3', 'DIRECT', { copyNumber: 3 })], [], [], 'RESOLVED');
    expect(validateAppearanceGenome(right).valid).toBe(true);
  });

  test('rejects copyNumber on a variant that is not a copy-number state', () => {
    const genome = genomeWithEca3([], []);
    genome.chromosomes.ECA3.copies[0].phasedVariants = [pc('KIT_TO', 'DIRECT', { copyNumber: 1 })];
    expect(codes(validateAppearanceGenome(genome))).toContain('copyNumberMismatch');
  });
});

describe('validateAppearanceGenome required haplotypes (review round 1)', () => {
  test('accepts W17 as one cis haplotype', () => {
    const genome = genomeWithEca3(['KIT_W17_E667D', 'KIT_W17_L674P'], []);
    expect(validateAppearanceGenome(genome).valid).toBe(true);
  });

  test('rejects a partial W17 haplotype', () => {
    const genome = genomeWithEca3(['KIT_W17_L674P'], []);
    expect(codes(validateAppearanceGenome(genome))).toContain('partialRequiredHaplotype');
  });

  test('rejects the W17 calls split across copies', () => {
    const genome = genomeWithEca3(['KIT_W17_E667D'], ['KIT_W17_L674P']);
    expect(codes(validateAppearanceGenome(genome))).toContain('partialRequiredHaplotype');
  });

  test('rejects unequal unphased W17 dosages', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.chromosomes.ECA3 = {
      copies: [
        { copyId: 'A', phasedVariants: [] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [uc('KIT_W17_E667D', 2), uc('KIT_W17_L674P', 1)],
      phaseResolution: 'UNRESOLVED',
    };
    expect(codes(validateAppearanceGenome(genome))).toContain('partialRequiredHaplotype');
  });
});

describe('validateAppearanceGenome malformed input (review round 1)', () => {
  function valid() {
    return genomeWithEca3(['KIT_TO'], []);
  }

  const cases = [
    ['chromosomes is a string', g => (g.chromosomes = 'lost')],
    ['unplacedCalls is a string', g => (g.unplacedCalls = 'lost')],
    ['legacyObservations is missing', g => delete g.legacyObservations],
    ['legacyRawValues is not an array', g => (g.legacyRawValues = {})],
    ['migrationProvenance is unknown', g => (g.migrationProvenance = 'GUESSED')],
    ['a phased call is null', g => (g.chromosomes.ECA3.copies[0].phasedVariants = [null])],
    ['a phased call has no variantId', g => (g.chromosomes.ECA3.copies[0].phasedVariants = [{}])],
    ['a copy is null', g => (g.chromosomes.ECA3.copies[1] = null)],
    ['a copy has no copyId', g => delete g.chromosomes.ECA3.copies[0].copyId],
    ['copy ids repeat', g => (g.chromosomes.ECA3.copies[1].copyId = 'A')],
    ['phasedVariants is a string', g => (g.chromosomes.ECA3.copies[0].phasedVariants = 'x')],
    ['unphasedCalls is a string', g => (g.chromosomes.ECA3.unphasedCalls = 'x')],
    ['an unphased call is null', g => (g.chromosomes.ECA3.unphasedCalls = [null])],
    ['an unplaced call is null', g => (g.unplacedCalls = [null])],
    ['a legacy observation is malformed', g => (g.legacyObservations = [{ token: 'At' }])],
  ];

  test.each(cases)('reports, without throwing, when %s', (_label, corrupt) => {
    const genome = valid();
    corrupt(genome);
    let result;
    expect(() => {
      result = validateAppearanceGenome(genome);
    }).not.toThrow();
    expect(result.valid).toBe(false);
    expect(codes(result)).toContain('invalidField');
  });
});

describe('validateAppearanceGenome (review round 2)', () => {
  function partlyPhased(chromosomeId, copyA, copyB, unphasedCalls, extra = {}) {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.chromosomes[chromosomeId] = {
      copies: [
        { copyId: 'A', phasedVariants: copyA.map(call) },
        { copyId: 'B', phasedVariants: copyB.map(call) },
      ],
      unphasedCalls,
      phaseResolution: 'UNRESOLVED',
      ...extra,
    };
    return genome;
  }

  const transCrPrl = {
    kind: 'TRANS',
    variantIds: ['SLC45A2_Cr', 'SLC45A2_Prl'],
    source: 'legacyEncoded',
  };

  test('checks copyNumber on unphased calls too', () => {
    const wrongGray = partlyPhased('ECA25', [], [], [uc('STX17_G3', 1, { copyNumber: 2 })]);
    expect(codes(validateAppearanceGenome(wrongGray))).toContain('copyNumberMismatch');
    const tobianoWithCopies = partlyPhased('ECA3', [], [], [uc('KIT_TO', 1, { copyNumber: 99 })]);
    expect(codes(validateAppearanceGenome(tobianoWithCopies))).toContain('copyNumberMismatch');
    const rightGray = partlyPhased('ECA25', [], [], [uc('STX17_G3', 1, { copyNumber: 3 })]);
    expect(validateAppearanceGenome(rightGray)).toEqual({ valid: true, errors: [] });
  });

  test('unplaced sentinels never carry a copyNumber', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.unplacedCalls = [uc('splashUnknownLegacy', 1, { copyNumber: 2 })];
    expect(codes(validateAppearanceGenome(genome))).toContain('copyNumberMismatch');
  });

  test('rejects an unphased call that overlaps the variants already on both copies', () => {
    // W22 overlaps W15 and W4; W15 and W4 could share a copy, but here they hold one copy each.
    const genome = partlyPhased('ECA3', ['KIT_W15'], ['KIT_W4'], [uc('KIT_W22', 1)]);
    expect(codes(validateAppearanceGenome(genome))).toContain('jointSiteCapacityExceeded');
  });

  test('accepts unphased calls that have a legal placement around phased ones', () => {
    const genome = partlyPhased('ECA3', ['KIT_W15'], [], [uc('KIT_W4', 1), uc('KIT_W22', 1)]);
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
  });

  test('places a required cis pair together, away from the variant it overlaps', () => {
    const genome = partlyPhased('ECA3', ['KIT_W30'], [], [uc('KIT_W17_L674P', 1), uc('KIT_W17_E667D', 1)]);
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
  });

  test('rejects chromosome ids outside the equine chromosome vocabulary', () => {
    const emptyPair = () => ({
      copies: [
        { copyId: 'A', phasedVariants: [] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [],
      phaseResolution: 'RESOLVED',
    });
    const typo = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    typo.chromosomes.ECA99 = emptyPair();
    expect(codes(validateAppearanceGenome(typo))).toContain('unknownChromosome');

    const polluted = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    polluted.chromosomes = JSON.parse('{"__proto__":{"copies":[],"unphasedCalls":[]}}');
    let result;
    expect(() => {
      result = validateAppearanceGenome(polluted);
    }).not.toThrow();
    expect(codes(result)).toContain('unknownChromosome');

    const last = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    last.chromosomes.ECA31 = emptyPair();
    expect(validateAppearanceGenome(last)).toEqual({ valid: true, errors: [] });
  });

  test('accepts a legacy-encoded trans constraint over unphased Cr and Prl', () => {
    const genome = partlyPhased('ECA21', [], [], [uc('SLC45A2_Cr', 1), uc('SLC45A2_Prl', 1)], {
      phaseConstraints: [transCrPrl],
    });
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
  });

  test('rejects phased cis Cr+Prl when the chromosome records them in trans', () => {
    const genome = partlyPhased('ECA21', ['SLC45A2_Cr', 'SLC45A2_Prl'], [], [], {
      phaseConstraints: [transCrPrl],
    });
    expect(codes(validateAppearanceGenome(genome))).toContain('transConstraintViolated');
    const withoutConstraint = partlyPhased('ECA21', ['SLC45A2_Cr', 'SLC45A2_Prl'], [], []);
    expect(validateAppearanceGenome(withoutConstraint)).toEqual({ valid: true, errors: [] });
  });

  test('an unphased call must honor a trans constraint against phased copies', () => {
    const genome = partlyPhased('ECA21', ['SLC45A2_Cr'], ['SLC45A2_Cr'], [uc('SLC45A2_Prl', 1)], {
      phaseConstraints: [transCrPrl],
    });
    expect(codes(validateAppearanceGenome(genome))).toContain('jointSiteCapacityExceeded');
  });

  test('rejects malformed phase constraints with structured errors', () => {
    const cases = [
      'not an array',
      [null],
      [{ ...transCrPrl, kind: 'CIS' }],
      [{ ...transCrPrl, source: 'GUESSED' }],
      [{ ...transCrPrl, variantIds: ['SLC45A2_Cr'] }],
      [{ ...transCrPrl, variantIds: ['SLC45A2_Cr', 'SLC45A2_Cr'] }],
      [{ ...transCrPrl, variantIds: ['SLC45A2_Cr', 'SLC45A2_Sno'] }],
      [{ ...transCrPrl, variantIds: ['SLC45A2_Cr', 'KIT_TO'] }],
    ];
    for (const phaseConstraints of cases) {
      const genome = partlyPhased('ECA21', [], [], [uc('SLC45A2_Cr', 1), uc('SLC45A2_Prl', 1)], { phaseConstraints });
      let result;
      expect(() => {
        result = validateAppearanceGenome(genome);
      }).not.toThrow();
      expect([phaseConstraints, result.valid]).toEqual([phaseConstraints, false]);
    }
  });
});

describe('validateAppearanceGenome (review round 3)', () => {
  function chromosome(copies, unphasedCalls) {
    return {
      copies: copies.map((ids, i) => ({ copyId: String.fromCharCode(65 + i), phasedVariants: ids.map(call) })),
      unphasedCalls,
      phaseResolution: unphasedCalls.length > 0 ? 'UNRESOLVED' : 'RESOLVED',
    };
  }

  test('a phased W17 half completed by an unphased partner is a legal placement', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.chromosomes.ECA3 = chromosome([['KIT_W17_E667D'], []], [uc('KIT_W17_L674P', 1)]);
    expect(validateAppearanceGenome(genome)).toEqual({ valid: true, errors: [] });
  });

  test('a phased W17 half whose partner cannot join it is still partial', () => {
    // L674P overlaps W30, so it cannot join E667D on copy A.
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.chromosomes.ECA3 = chromosome([['KIT_W17_E667D', 'KIT_W30'], []], [uc('KIT_W17_L674P', 1)]);
    expect(codes(validateAppearanceGenome(genome))).toContain('partialRequiredHaplotype');
  });

  test('with unknown sex, X capacity is the stored copy count', () => {
    const oneCopy = createEmptyAppearanceGenome({ sexChromosomes: 'UNKNOWN' });
    oneCopy.chromosomes.ECAX = chromosome([[]], [uc('MBTPS2_BR1', 2)]);
    expect(codes(validateAppearanceGenome(oneCopy))).toContain('dosageExceedsCopies');

    const twoCopies = createEmptyAppearanceGenome({ sexChromosomes: 'UNKNOWN' });
    twoCopies.chromosomes.ECAX = chromosome([[], []], [uc('MBTPS2_BR1', 2)]);
    expect(validateAppearanceGenome(twoCopies)).toEqual({ valid: true, errors: [] });
  });

  test('rejects two raw legacy records for the same locus', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.legacyRawValues = [
      { legacyLocus: 'Mystery', value: 'x/y', reason: 'unknownLegacyLocus' },
      { legacyLocus: 'Mystery', value: 'a/b', reason: 'unknownLegacyLocus' },
    ];
    expect(codes(validateAppearanceGenome(genome))).toContain('invalidField');
  });
});

describe('validateAppearanceGenome (review round 4)', () => {
  const TRANS = { kind: 'TRANS', variantIds: ['SLC45A2_Cr', 'SLC45A2_Prl'], source: 'legacyEncoded' };

  test('an unknown-sex X must store one or two copies', () => {
    for (const copies of [[], [0, 1, 2].map(i => ({ copyId: `C${i}`, phasedVariants: [] }))]) {
      const genome = createEmptyAppearanceGenome({ sexChromosomes: 'UNKNOWN' });
      genome.chromosomes.ECAX = { copies, unphasedCalls: [], phaseResolution: 'RESOLVED' };
      expect([copies.length, codes(validateAppearanceGenome(genome))]).toEqual([
        copies.length,
        expect.arrayContaining(['wrongCopyCount']),
      ]);
    }
  });

  test('rejects a duplicate or reversed trans constraint', () => {
    const reversed = { ...TRANS, variantIds: ['SLC45A2_Prl', 'SLC45A2_Cr'] };
    for (const phaseConstraints of [
      [TRANS, TRANS],
      [TRANS, reversed],
    ]) {
      const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
      genome.chromosomes.ECA21 = {
        copies: [
          { copyId: 'A', phasedVariants: [] },
          { copyId: 'B', phasedVariants: [] },
        ],
        unphasedCalls: [uc('SLC45A2_Cr', 1), uc('SLC45A2_Prl', 1)],
        phaseResolution: 'UNRESOLVED',
        phaseConstraints,
      };
      expect(codes(validateAppearanceGenome(genome))).toContain('invalidField');
    }
  });
});

describe('appearance genome (review round 5)', () => {
  test('unplaced dosage is summed per variant, so two two-copy records are rejected', () => {
    const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    genome.unplacedCalls = [uc('splashUnknownLegacy', 2), uc('splashUnknownLegacy', 2)];
    expect(codes(validateAppearanceGenome(genome))).toContain('invalidDosage');

    const split = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    split.unplacedCalls = [uc('splashUnknownLegacy', 1), uc('splashUnknownLegacy', 1)];
    expect(validateAppearanceGenome(split)).toEqual({ valid: true, errors: [] });
  });

  test('transmission refuses a chromosome id outside the vocabulary', () => {
    const genome = genomeWithEca3(['KIT_W20'], []);
    expect(() => transmitChromosomeCopy(genome, 'ECA33', seededRng(1), { mode: preservePhaseNoCrossover })).toThrow(
      /ECA33/,
    );
    // A known autosome the horse simply has no calls on is still wild type.
    expect(transmitChromosomeCopy(genome, 'ECA5', seededRng(1), { mode: preservePhaseNoCrossover })).toEqual({
      copyId: 'GAMETE',
      phasedVariants: [],
    });
  });
});

describe('appearance genome (review round 6)', () => {
  test('an assayId, when present, must be a non-empty string', () => {
    for (const assayId of [{ provider: 'forged' }, '', 42, null]) {
      const genome = genomeWithEca3(['KIT_W20'], []);
      genome.chromosomes.ECA3.copies[0].phasedVariants[0].assayId = assayId;
      expect([assayId, codes(validateAppearanceGenome(genome))]).toEqual([
        assayId,
        expect.arrayContaining(['invalidField']),
      ]);
    }
    const tested = genomeWithEca3(['KIT_W20'], []);
    tested.chromosomes.ECA3.copies[0].phasedVariants[0].assayId = 'kitW20Assay2026';
    expect(validateAppearanceGenome(tested)).toEqual({ valid: true, errors: [] });
  });
});

describe('appearance genome (review round 7)', () => {
  test('every call records the assembly and call kind it was observed in (spec §3)', () => {
    const missing = genomeWithEca3(['KIT_W20'], []);
    delete missing.chromosomes.ECA3.copies[0].phasedVariants[0].assembly;
    delete missing.chromosomes.ECA3.copies[0].phasedVariants[0].callKind;
    expect(validateAppearanceGenome(missing).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalidField',
          path: 'chromosomes.ECA3.copies[0].phasedVariants[0].assembly',
        }),
        expect.objectContaining({
          code: 'invalidField',
          path: 'chromosomes.ECA3.copies[0].phasedVariants[0].callKind',
        }),
      ]),
    );

    const unknownBuild = genomeWithEca3(['KIT_W20'], []);
    Object.assign(unknownBuild.chromosomes.ECA3.copies[0].phasedVariants[0], {
      assembly: 'EquCab4.0',
      callKind: 'SNP',
    });
    expect(validateAppearanceGenome(unknownBuild).errors.filter(e => e.code === 'invalidField')).toHaveLength(2);

    const bareUnphased = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
    bareUnphased.chromosomes.ECA3 = {
      copies: [
        { copyId: 'A', phasedVariants: [] },
        { copyId: 'B', phasedVariants: [] },
      ],
      unphasedCalls: [{ variantId: 'KIT_W20', dosage: 1 }],
      phaseResolution: 'UNRESOLVED',
    };
    bareUnphased.unplacedCalls = [{ variantId: 'splashUnknownLegacy', dosage: 1 }];
    expect(validateAppearanceGenome(bareUnphased).errors.map(e => e.path)).toEqual(
      expect.arrayContaining([
        'chromosomes.ECA3.unphasedCalls[0].assembly',
        'chromosomes.ECA3.unphasedCalls[0].callKind',
        'unplacedCalls[0].assembly',
        'unplacedCalls[0].callKind',
      ]),
    );

    // An EquCab2 assay result keeps the build it was reported in.
    const equCab2 = genomeWithEca3(['KIT_TO'], []);
    Object.assign(equCab2.chromosomes.ECA3.copies[0].phasedVariants[0], {
      assembly: 'EquCab2.0',
      callKind: 'haplotypeMarker',
      assayId: 'tobianoMarker2019',
    });
    expect(validateAppearanceGenome(equCab2)).toEqual({ valid: true, errors: [] });
  });

  test('the registry gives each variant its default call representation', () => {
    expect(registryCallRepresentation('SLC45A2_Cr')).toEqual({ assembly: 'EquCab3.0', callKind: 'SNV' });
    expect(registryCallRepresentation('KIT_TO')).toEqual({ assembly: 'EquCab3.0', callKind: 'INVERSION' });
    expect(registryCallRepresentation('STX17_G3')).toEqual({ assembly: 'EquCab3.0', callKind: 'CNV' });
    // A sentinel has no coordinates in any build.
    expect(registryCallRepresentation('splashUnknownLegacy')).toEqual({
      assembly: 'UNMAPPED',
      callKind: 'haplotypeMarker',
    });
    expect(() => registryCallRepresentation('notAVariant')).toThrow(/notAVariant/);
  });

  test('a whitespace-only assayId is not an assay key', () => {
    const genome = genomeWithEca3(['KIT_W20'], []);
    genome.chromosomes.ECA3.copies[0].phasedVariants[0].assayId = '   ';
    expect(codes(validateAppearanceGenome(genome))).toContain('invalidField');
  });

  test('a legacy observation counts at most the two tokens of one legacy pair', () => {
    const observed = (...counts) => {
      const genome = createEmptyAppearanceGenome({ sexChromosomes: 'XX' });
      genome.legacyObservations = counts.map((count, i) => ({
        legacyLocus: 'A_Agouti',
        token: i === 0 ? 'At' : 'A+',
        count,
        reason: 'notAMolecularAllele',
      }));
      return validateAppearanceGenome(genome);
    };
    expect(observed(1)).toEqual({ valid: true, errors: [] });
    expect(observed(1, 1)).toEqual({ valid: true, errors: [] });
    expect(codes(observed(3))).toContain('invalidField');
    expect(codes(observed(1_000_000_000_000))).toContain('invalidField');
    expect(observed(2, 1).errors).toContainEqual({
      code: 'legacyObservationCountExceeded',
      legacyLocus: 'A_Agouti',
      total: 3,
    });
  });

  test("a gamete carries the parent's variants, not the parent's test results", () => {
    const genome = genomeWithEca3(['KIT_W20', 'KIT_W22'], []);
    const [w20, w22] = genome.chromosomes.ECA3.copies[0].phasedVariants;
    Object.assign(w20, { assayId: 'PARENT-ASSAY' });
    Object.assign(w22, { phaseQuality: 'STATISTICAL' });
    genome.chromosomes.ECA3.copies[1].phasedVariants = genome.chromosomes.ECA3.copies[0].phasedVariants.map(c => ({
      ...c,
    }));
    const gamete = transmitChromosomeCopy(genome, 'ECA3', seededRng(1), { mode: preservePhaseNoCrossover });
    const byId = Object.fromEntries(gamete.phasedVariants.map(c => [c.variantId, c]));
    expect(byId.KIT_W20).not.toHaveProperty('assayId');
    // A directly tested parent copy becomes a pedigree inference in the foal.
    expect(byId.KIT_W20.phaseQuality).toBe('pedigreeInferred');
    // Weaker parental phase is never upgraded.
    expect(byId.KIT_W22.phaseQuality).toBe('STATISTICAL');
    expect(byId.KIT_W20).toMatchObject({ assembly: 'EquCab3.0', callKind: 'SNV' });
    // The parent's record is untouched, whichever copy was passed on.
    for (const copy of genome.chromosomes.ECA3.copies) {
      expect(copy.phasedVariants[0]).toMatchObject({ phaseQuality: 'DIRECT', assayId: 'PARENT-ASSAY' });
    }
  });
});
