/**
 * legacyColorGenotypeConversion.mjs
 *
 * Converts today's flat `Horse.colorGenotype` (one unphased allele-pair string
 * per legacy locus, e.g. { TO_Tobiano: 'TO/to' }) to the phased appearance
 * genome and back (genetics master spec §17, Equoria-8xxnf slice 1).
 *
 * Forward rules:
 *   - Never invent phase. Every converted chromosome is UNRESOLVED; calls sit in
 *     `unphasedCalls` with their dosage and the copies stay empty.
 *   - Never invent a specific variant. Legacy roan, bare dominant white, bare
 *     splash and gray become unknown sentinels, not RN1-3, a W number, an SW
 *     number, or G2/G3.
 *   - Legacy tokens that are not DNA (At, A+) and tokens that cannot be mapped
 *     without guessing are kept in `legacyObservations` so nothing is lost, and
 *     the latter are also returned in `unresolved`.
 *   - Unknown loci and malformed values are kept verbatim in `legacyRawValues`
 *     (and reported in `unresolved`), so a saved genome can restore them.
 *   - A Prl_Pearl `cr/prl` is the trans cream/pearl compound: its cream is
 *     matched to a Cr_Cream cream or added as an SLC45A2_Cr call, and the
 *     choice is returned in `reconciliations` (reconcilePearlSlotCream). With
 *     one cream and one pearl, ECA21 keeps a legacyEncoded TRANS phase
 *     constraint, so the saved genome still knows the pair sits in trans.
 *   - Locus names and tokens are looked up as own keys only, so raw keys such as
 *     `__proto__` stay ordinary unknown loci.
 *
 * Back rules: the legacy shape cannot hold phase, copy number, or a third call
 * per locus, so every such loss is listed in `loss`; nothing is dropped
 * silently. Raw values are written back; one displaced by calls in its slot is
 * reported as rawValueConflict.
 *
 * Slice 1 is not wired into the game; the live code still reads colorGenotype.
 */

import { createEmptyAppearanceGenome } from './appearanceGenome.mjs';
import { getVariant } from './appearanceVariantRegistry.mjs';
import { phaseLosses, writeBackPhaseConstraints } from './legacyColorPhaseWriteBack.mjs';
import { registryCallRepresentation } from './appearanceCallRecord.mjs';

const N = ['n', 'N'];

function numbered(prefix, numbers, idFor) {
  return Object.fromEntries(numbers.map(n => [`${prefix}${n}`, idFor(n)]));
}

const splashGene = {
  1: 'MITF',
  2: 'PAX3',
  3: 'MITF',
  4: 'PAX3',
  5: 'MITF',
  6: 'MITF',
  7: 'MITF',
  8: 'MITF',
  9: 'MITF',
  10: 'PAX3',
};

/**
 * Per legacy locus: wild-type tokens (first is the engine spelling written
 * back), token → variantId (or the variantIds of one cis haplotype, as W17 is,
 * spec §4.4), tokens kept only as observations, and variants that write back to
 * a token with a reported loss.
 */
const LEGACY = {
  E_Extension: { wild: ['E'], tokens: { e: 'MC1R_e' } },
  A_Agouti: { wild: ['A'], tokens: { a: 'ASIP_a' }, observations: ['At', 'A+'] },
  Cr_Cream: { wild: N, tokens: { Cr: 'SLC45A2_Cr' } },
  Prl_Pearl: { wild: N, tokens: { prl: 'SLC45A2_Prl', Prl: 'SLC45A2_Prl' } },
  Sdp_Snowdrop: { wild: N, tokens: { sdp: 'SLC45A2_Sno', Sdp: 'SLC45A2_Sno' } },
  Sun_Sunshine: { wild: N, tokens: { sun: 'SLC45A2_Sun', Sun: 'SLC45A2_Sun' } },
  D_Dun: { wild: ['nd2'], tokens: { D: 'TBX3_D', nd1: 'TBX3_nd1' } },
  Z_Silver: { wild: N, tokens: { Z: 'PMEL_Z' } },
  Ch_Champagne: { wild: N, tokens: { Ch: 'SLC36A1_Ch' } },
  G_Gray: {
    wild: ['g'],
    tokens: { G: 'stx17GrayUnknownCopyNumber' },
    lossyBack: { STX17_G2: 'G', STX17_G3: 'G' },
  },
  Rn_Roan: { wild: ['rn'], tokens: { Rn: 'roanUnknownKit' } },
  W_DominantWhite: {
    wild: ['w'],
    tokens: {
      W: 'kitWhiteUnknownLegacy',
      ...numbered('W', [3, 4, 5, 10, 13, 15, 19, 20, 22, 30, 31, 32, 35, 37], n => `KIT_W${n}`),
      W17: ['KIT_W17_E667D', 'KIT_W17_L674P'],
    },
  },
  TO_Tobiano: { wild: ['to'], tokens: { TO: 'KIT_TO' } },
  O_FrameOvero: { wild: N, tokens: { O: 'EDNRB_O' } },
  SB1_Sabino1: { wild: N, tokens: { SB1: 'KIT_SB1' } },
  SW_SplashWhite: {
    wild: N,
    tokens: {
      SW: 'splashUnknownLegacy',
      ...numbered('SW', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], n => `${splashGene[n]}_SW${n}`),
    },
  },
  LP_LeopardComplex: { wild: ['lp'], tokens: { LP: 'TRPM1_LP' } },
  PATN1_Pattern1: { wild: ['patn1'], tokens: { PATN1: 'RFWD3_PATN1' } },
  EDXW: { wild: N, tokens: numbered('EDXW', [1, 2, 3], n => `HPS5_EDXW${n}`) },
  MFSD12_Mushroom: { wild: ['N', 'n'], tokens: { M: 'MFSD12_Mu', Mu: 'MFSD12_Mu' } },
  BR1_Brindle1: { wild: N, tokens: { br1: 'MBTPS2_BR1', BR1: 'MBTPS2_BR1' } },
};

export const legacyLocusKeys = Object.freeze(Object.keys(LEGACY));

/**
 * variantId → { legacyLocus, token } using the first token listed for it, and
 * the tokens that stand for a whole cis haplotype.
 */
const BACK = new Map();
const haplotypeTokens = [];
for (const [legacyLocus, spec] of Object.entries(LEGACY)) {
  for (const [token, variantId] of Object.entries(spec.tokens)) {
    if (Array.isArray(variantId)) {
      haplotypeTokens.push({ legacyLocus, token, variantIds: variantId });
    } else if (!BACK.has(variantId)) {
      BACK.set(variantId, { legacyLocus, token, lossy: false });
    }
  }
  for (const [variantId, token] of Object.entries(spec.lossyBack ?? {})) {
    BACK.set(variantId, { legacyLocus, token, lossy: true });
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The legacy spec for a locus, never one inherited from Object.prototype. */
function legacySpec(legacyLocus) {
  return Object.hasOwn(LEGACY, legacyLocus) ? LEGACY[legacyLocus] : null;
}

/** Sets an own data property, so a raw key such as `__proto__` stays a plain key. */
function setOwn(target, key, value) {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function splitPair(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const parts = value.split('/');
  return parts.length === 2 && parts.every(p => p.length > 0) ? parts : null;
}

function chromosomeFor(genome, chromosomeId) {
  if (!genome.chromosomes[chromosomeId]) {
    const hemizygous = chromosomeId === 'ECAX' && genome.sexChromosomes === 'XY';
    genome.chromosomes[chromosomeId] = {
      copies: hemizygous
        ? [{ copyId: 'X', phasedVariants: [] }]
        : [
            { copyId: 'A', phasedVariants: [] },
            { copyId: 'B', phasedVariants: [] },
          ],
      unphasedCalls: [],
      phaseResolution: 'UNRESOLVED',
      phaseConstraints: [],
    };
  }
  return genome.chromosomes[chromosomeId];
}

function addCall(genome, variantId, dosage) {
  const entry = getVariant(variantId);
  const list =
    entry.chromosome === null
      ? genome.unplacedCalls
      : chromosomeFor(genome, entry.chromosome).unphasedCalls;
  const existing = list.find(c => c.variantId === variantId);
  if (existing) {
    existing.dosage += dosage;
  } else {
    list.push({ variantId, dosage, ...registryCallRepresentation(variantId) });
  }
}

function addObservation(genome, legacyLocus, token, count, reason) {
  const existing = genome.legacyObservations.find(
    o => o.legacyLocus === legacyLocus && o.token === token && o.reason === reason,
  );
  if (existing) {
    existing.count += count;
  } else {
    genome.legacyObservations.push({ legacyLocus, token, count, reason });
  }
}

/**
 * Copies of an X-linked variant an XY horse can still take: one X, less what
 * earlier tokens of the same variant (in any spelling) already placed.
 */
function xCopiesLeft(genome, variantId, sexChromosomes) {
  if (getVariant(variantId).chromosome !== 'ECAX' || sexChromosomes !== 'XY') {
    return Infinity;
  }
  const placed = genome.chromosomes.ECAX?.unphasedCalls.find(c => c.variantId === variantId);
  return 1 - (placed?.dosage ?? 0);
}

function countTokens(parts) {
  const counts = new Map();
  for (const token of parts) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}

/**
 * With one cream and one pearl, `cr/prl` says they sit on opposite copies.
 * The rest of ECA21 stays unresolved. With two creams, pearl shares a copy with
 * one of them whatever the phase, so there is nothing to record.
 */
function recordLegacyTrans(genome) {
  const eca21 = genome.chromosomes.ECA21;
  const dosageOf = id => eca21?.unphasedCalls.find(c => c.variantId === id)?.dosage ?? 0;
  if (dosageOf('SLC45A2_Cr') === 1 && dosageOf('SLC45A2_Prl') === 1) {
    eca21.phaseConstraints.push({
      kind: 'TRANS',
      variantIds: ['SLC45A2_Cr', 'SLC45A2_Prl'],
      source: 'legacyEncoded',
    });
  }
}

/**
 * A `cr` token in the Prl_Pearl slot marks the trans cream/pearl compound. The
 * cream it names is either one already counted in Cr_Cream (matched) or a cream
 * Cr_Cream did not record (added as an SLC45A2_Cr call). Both cases keep an
 * observation so the legacy value restores exactly. If Cr_Cream itself was
 * unreadable the two cannot be compared, so nothing is guessed.
 */
function reconcilePearlSlotCream(genome, pearl, unresolved) {
  if (pearl.count === 0) {
    return [];
  }
  if (!pearl.creamReadable) {
    unresolved.push({
      legacyLocus: 'Prl_Pearl',
      value: pearl.value,
      token: 'cr',
      reason: 'pearlSlotCreamUnreconcilable',
    });
    addObservation(genome, 'Prl_Pearl', 'cr', pearl.count, 'unmappableWithoutGuessing');
    return [];
  }
  const matched = Math.min(pearl.count, pearl.creamCopies);
  const added = pearl.count - matched;
  if (matched > 0) {
    addObservation(genome, 'Prl_Pearl', 'cr', matched, 'pearlSlotCreamMatched');
  }
  if (added > 0) {
    addCall(genome, 'SLC45A2_Cr', added);
    addObservation(genome, 'Prl_Pearl', 'cr', added, 'pearlSlotCreamAdded');
  }
  recordLegacyTrans(genome);
  return [
    {
      code: added > 0 ? 'pearlSlotCreamAdded' : 'pearlSlotCreamMatchesCrCream',
      legacyLoci: ['Prl_Pearl', 'Cr_Cream'],
      creamCopies: pearl.count,
    },
  ];
}

/**
 * @param {object} legacyGenotype - Horse.colorGenotype
 * @param {{ sexChromosomes?: 'XX'|'XY'|'UNKNOWN' }} [options]
 * @returns {{ genome: object, unresolved: object[], reconciliations: object[] }}
 */
export function fromLegacyColorGenotype(legacyGenotype, { sexChromosomes = 'UNKNOWN' } = {}) {
  if (!isPlainObject(legacyGenotype)) {
    throw new Error('fromLegacyColorGenotype: legacy genotype must be a plain object');
  }
  const genome = createEmptyAppearanceGenome({ sexChromosomes });
  genome.migrationProvenance = 'legacyInferred';
  const unresolved = [];
  const pearl = { count: 0, value: null, creamCopies: 0, creamReadable: true };

  for (const [legacyLocus, value] of Object.entries(legacyGenotype)) {
    const spec = legacySpec(legacyLocus);
    if (!spec) {
      unresolved.push({ legacyLocus, value, reason: 'unknownLegacyLocus' });
      genome.legacyRawValues.push({ legacyLocus, value, reason: 'unknownLegacyLocus' });
      continue;
    }
    const parts = splitPair(value);
    if (!parts) {
      unresolved.push({ legacyLocus, value, reason: 'malformedPair' });
      genome.legacyRawValues.push({ legacyLocus, value, reason: 'malformedPair' });
      pearl.creamReadable = pearl.creamReadable && legacyLocus !== 'Cr_Cream';
      continue;
    }
    for (const [token, count] of countTokens(parts)) {
      if (spec.wild.includes(token)) {
        continue;
      }
      if (legacyLocus === 'Prl_Pearl' && token === 'cr') {
        pearl.count += count;
        pearl.value = value;
        continue;
      }
      if (legacyLocus === 'Cr_Cream' && token === 'Cr') {
        pearl.creamCopies += count;
      }
      const mapped = Object.hasOwn(spec.tokens, token) ? spec.tokens[token] : null;
      if (Array.isArray(mapped)) {
        // A haplotype token names every variant on one autosomal copy.
        mapped.forEach(id => addCall(genome, id, count));
      } else if (mapped) {
        const variantId = mapped;
        // The variant is certainly present; only copies beyond the horse's X are doubtful.
        const placed = Math.min(count, xCopiesLeft(genome, variantId, sexChromosomes));
        if (placed > 0) {
          addCall(genome, variantId, placed);
        }
        if (count > placed) {
          unresolved.push({ legacyLocus, value, token, reason: 'xDosageExceedsCopies' });
          addObservation(genome, legacyLocus, token, count - placed, 'xDosageExceedsCopies');
        }
      } else if (spec.observations?.includes(token)) {
        addObservation(genome, legacyLocus, token, count, 'notAMolecularAllele');
      } else {
        unresolved.push({ legacyLocus, value, token, reason: 'unmappableWithoutGuessing' });
        addObservation(genome, legacyLocus, token, count, 'unmappableWithoutGuessing');
        // An unreadable Cream token may itself be the cream the pearl slot names.
        pearl.creamReadable = pearl.creamReadable && legacyLocus !== 'Cr_Cream';
      }
    }
  }
  const reconciliations = reconcilePearlSlotCream(genome, pearl, unresolved);
  return { genome, unresolved, reconciliations };
}

/** Uppercase-initial tokens first, then variant before wild type: 'E/e', 'Cr/n', 'prl/n', 'M/N'. */
function orderTokens(legacyLocus, tokens) {
  const wild = LEGACY[legacyLocus].wild;
  const rank = t => (/^[A-Z]/.test(t) ? 0 : 2) + (wild.includes(t) ? 1 : 0);
  return tokens
    .map((t, i) => [t, i])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1])
    .map(([t]) => t);
}

function allCalls(genome) {
  const calls = [];
  for (const [chromosomeId, chromosome] of Object.entries(genome.chromosomes ?? {})) {
    for (const copy of chromosome.copies ?? []) {
      for (const call of copy.phasedVariants ?? []) {
        calls.push({ variantId: call.variantId, dosage: 1 });
      }
    }
    for (const call of chromosome.unphasedCalls ?? []) {
      calls.push({ variantId: call.variantId, dosage: call.dosage, chromosomeId });
    }
  }
  for (const call of genome.unplacedCalls ?? []) {
    calls.push({ variantId: call.variantId, dosage: call.dosage });
  }
  return calls;
}

/** One raw value per locus; any further record for the same locus is reported. */
function rawValuesByLocus(genome, loss) {
  const raw = new Map();
  const dropped = new Map();
  for (const { legacyLocus, value } of genome.legacyRawValues ?? []) {
    if (raw.has(legacyLocus)) {
      dropped.set(legacyLocus, [...(dropped.get(legacyLocus) ?? []), value]);
    } else {
      raw.set(legacyLocus, value);
    }
  }
  for (const [legacyLocus, values] of dropped) {
    loss.push({ code: 'duplicateRawLocus', legacyLocus, dropped: values });
  }
  return raw;
}

/**
 * The calls back-conversion can write. Its input is not validated, and a pair
 * holds at most two copies, so any other dosage is reported, not written: a
 * corrupt count must never drive the token loops.
 */
function writableCalls(genome, loss) {
  return allCalls(genome).filter(call => {
    const ok = Number.isInteger(call.dosage) && call.dosage >= 1 && call.dosage <= 2;
    if (!ok) {
      loss.push({ code: 'invalidCallDosage', variantId: call.variantId, dosage: call.dosage });
    }
    return ok;
  });
}

/**
 * Writes one haplotype token (W17) per copy carrying the whole haplotype. A
 * valid genome holds its components in equal dosage, since each requires the
 * other in cis; any component left over has no legacy spelling.
 * Returns the component variantIds, which the per-call pass then skips.
 */
function writeBackHaplotypeTokens(calls, slots, loss) {
  const components = new Set();
  for (const { legacyLocus, token, variantIds } of haplotypeTokens) {
    const totals = variantIds.map(id =>
      calls.filter(c => c.variantId === id).reduce((sum, c) => sum + c.dosage, 0),
    );
    const copies = Math.min(...totals);
    for (let i = 0; i < copies; i++) {
      slots[legacyLocus].push(token);
    }
    variantIds.forEach((variantId, i) => {
      components.add(variantId);
      if (totals[i] > copies) {
        loss.push({ code: 'noLegacyRepresentation', variantId });
      }
    });
  }
  return components;
}

/**
 * @param {object} genome - appearance genome
 * @returns {{ genotype: object, loss: object[] }} legacy colorGenotype and every loss
 */
export function toLegacyColorGenotype(genome) {
  const loss = phaseLosses(genome);
  const slots = Object.fromEntries(legacyLocusKeys.map(locus => [locus, []]));
  const calls = writableCalls(genome, loss);
  const haplotypeComponents = writeBackHaplotypeTokens(calls, slots, loss);

  for (const { variantId, dosage } of calls) {
    if (haplotypeComponents.has(variantId)) {
      continue;
    }
    const back = BACK.get(variantId);
    if (!back) {
      loss.push({ code: 'noLegacyRepresentation', variantId });
      continue;
    }
    if (back.lossy) {
      loss.push({ code: 'copyNumberDropped', variantId });
    }
    for (let i = 0; i < dosage; i++) {
      slots[back.legacyLocus].push(back.token);
    }
  }
  for (const obs of genome.legacyObservations ?? []) {
    // A legacy pair holds two tokens; any other count cannot be written back.
    if (!Number.isInteger(obs.count) || obs.count < 1 || obs.count > 2) {
      loss.push({
        code: 'invalidObservationCount',
        legacyLocus: obs.legacyLocus,
        token: obs.token,
        count: obs.count,
      });
      continue;
    }
    if (!Object.hasOwn(slots, obs.legacyLocus)) {
      loss.push({
        code: 'noLegacyRepresentation',
        legacyLocus: obs.legacyLocus,
        token: obs.token,
      });
      continue;
    }
    if (obs.reason === 'pearlSlotCreamAdded') {
      // This cream was recovered from the pearl slot, not from Cr_Cream: write it back there.
      for (let i = 0; i < obs.count; i++) {
        const at = slots.Cr_Cream.indexOf('Cr');
        if (at === -1) {
          loss.push({ code: 'pearlSlotCreamMissing', legacyLocus: 'Prl_Pearl' });
          break;
        }
        slots.Cr_Cream.splice(at, 1);
      }
    }
    // Legacy spells a pearl-slot cream first (`cr/prl`), however it was kept.
    const pearlSlotCream = obs.legacyLocus === 'Prl_Pearl' && obs.token === 'cr';
    for (let i = 0; i < obs.count; i++) {
      slots[obs.legacyLocus][pearlSlotCream ? 'unshift' : 'push'](obs.token);
    }
  }

  writeBackPhaseConstraints(genome, slots, loss);
  const raw = rawValuesByLocus(genome, loss);
  const genotype = {};
  for (const locus of legacyLocusKeys) {
    const tokens = slots[locus];
    if (raw.has(locus) && tokens.length === 0) {
      genotype[locus] = raw.get(locus);
      continue;
    }
    if (tokens.length > 2) {
      loss.push({ code: 'legacySlotOverflow', legacyLocus: locus, dropped: tokens.slice(2) });
    }
    const kept = tokens.slice(0, 2);
    while (kept.length < 2) {
      kept.push(LEGACY[locus].wild[0]);
    }
    genotype[locus] = orderTokens(locus, kept).join('/');
    if (raw.has(locus)) {
      loss.push({
        code: 'rawValueConflict',
        legacyLocus: locus,
        rawValue: raw.get(locus),
        emitted: genotype[locus],
      });
    }
  }
  for (const [locus, value] of raw) {
    if (!legacySpec(locus)) {
      setOwn(genotype, locus, value);
    }
  }
  return { genotype, loss };
}

/**
 * The meaning of a legacy pair, independent of token order and wild-type
 * spelling: sorted tokens with every wild-type token written the engine way.
 * A missing pair means wild type.
 *
 * @param {string} legacyLocus
 * @param {string|null|undefined} pair
 * @returns {string[]}
 */
export function normalizeLegacyPair(legacyLocus, pair) {
  const spec = legacySpec(legacyLocus);
  const wild = spec ? spec.wild[0] : 'n';
  const parts =
    pair === null || pair === undefined ? [wild, wild] : (splitPair(pair) ?? [String(pair)]);
  return parts.map(t => (spec?.wild.includes(t) ? wild : t)).sort();
}
