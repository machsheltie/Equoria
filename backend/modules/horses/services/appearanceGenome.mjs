/**
 * appearanceGenome.mjs
 *
 * The phased molecular state of a horse's appearance genetics (genetics master
 * spec §3 and §13, Equoria-8xxnf slice 1). Pure functions, no Prisma.
 *
 * Shape (schemaVersion 2):
 *   {
 *     schemaVersion: 2,
 *     sexChromosomes: 'XX' | 'XY' | 'UNKNOWN',
 *     chromosomes: {
 *       [chromosomeId]: {
 *         copies: [{ copyId, phasedVariants: [{ variantId, assembly, callKind, phaseQuality,
 *                                               copyNumber?, assayId? }] }, ...],
 *         unphasedCalls: [{ variantId, assembly, callKind, dosage }],   // copy not known
 *         phaseResolution: 'RESOLVED' | 'UNRESOLVED',
 *         phaseConstraints?: [{ kind: 'TRANS', variantIds: [a, b], source: 'legacyEncoded' }],
 *       },                                         // known partial phase: a and b never share a copy
 *     },
 *     unplacedCalls: [{ variantId, assembly, callKind, dosage }],  // no known chromosome
 *     legacyObservations: [{ legacyLocus, token, count, reason }],
 *     legacyRawValues: [{ legacyLocus, value, reason }],  // legacy input kept verbatim
 *     migrationProvenance: 'legacyInferred' | null,
 *   }
 *
 * A chromosome absent from `chromosomes` is two wild-type copies. Wild type is
 * the absence of a call, never a literal `n` variant. Unphased calls never enter
 * transmission: a chromosome with unresolved phase cannot be passed on until its
 * phase is inferred, tested, or sampled once and persisted.
 *
 * Copy-number states (STX17_G2/G3) are identified by their variantId; a call's
 * optional copyNumber must agree with the registry record.
 *
 * Slice 1 is not wired into the game. Quantitative, developmental and life-event
 * layers arrive in later slices.
 */

import { getVariant, cisIncompatibilityReason } from './appearanceVariantRegistry.mjs';
import { checkCallRecord } from './appearanceCallRecord.mjs';

/**
 * Transmission that passes one whole parental chromosome copy with no
 * recombination. Named explicitly because it is not real chromosome behavior;
 * making it the live breeding default is a gameplay change that needs the
 * owner's approval.
 */
export const preservePhaseNoCrossover = 'preservePhaseNoCrossover';

const sexValues = new Set(['XX', 'XY', 'UNKNOWN']);
const phaseQualities = new Set(['DIRECT', 'pedigreeInferred', 'STATISTICAL', 'UNKNOWN']);
const provenanceValues = new Set([null, 'legacyInferred']);
/** A legacy allele pair holds two tokens, so no locus can have observed more. */
const legacyPairTokens = 2;

/** The horse karyotype: autosomes ECA1-ECA31 plus ECAX. No appearance variant sits on ECAY. */
const knownChromosomes = new Set([...Array.from({ length: 31 }, (_, i) => `ECA${i + 1}`), 'ECAX']);

/**
 * @param {{ sexChromosomes?: 'XX'|'XY'|'UNKNOWN' }} [options]
 * @returns {object} a genome with no calls
 */
export function createEmptyAppearanceGenome({ sexChromosomes = 'UNKNOWN' } = {}) {
  if (!sexValues.has(sexChromosomes)) {
    throw new Error(`sexChromosomes must be XX, XY or UNKNOWN, got ${sexChromosomes}`);
  }
  return {
    schemaVersion: 2,
    sexChromosomes,
    chromosomes: {},
    unplacedCalls: [],
    legacyObservations: [],
    legacyRawValues: [],
    migrationProvenance: null,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalid(errors, path, detail) {
  errors.push({ code: 'invalidField', path, detail });
}

/** An array at `path`, or null after recording why it is not one. */
function requireArray(value, path, errors) {
  if (Array.isArray(value)) {
    return value;
  }
  invalid(errors, path, 'must be an array');
  return null;
}

/** Number of copies a chromosome has in this horse, or null when not fixed. */
function expectedCopies(chromosomeId, sexChromosomes) {
  if (chromosomeId !== 'ECAX') {
    return 2;
  }
  if (sexChromosomes === 'XY') {
    return 1;
  }
  return sexChromosomes === 'XX' ? 2 : null;
}

function checkPlacement(variantId, chromosomeId, errors) {
  const entry = getVariant(variantId);
  if (!entry) {
    errors.push({ code: 'unknownVariant', chromosome: chromosomeId, variantId });
    return null;
  }
  if (entry.chromosome !== chromosomeId) {
    errors.push({
      code: 'wrongChromosome',
      chromosome: chromosomeId,
      variantId,
      expected: entry.chromosome,
    });
    return null;
  }
  return entry;
}

function checkCopyNumber(call, entry, path, errors) {
  if (call.copyNumber === undefined) {
    return;
  }
  if (entry.copyNumber === null || call.copyNumber !== entry.copyNumber) {
    errors.push({
      code: 'copyNumberMismatch',
      path,
      variantId: call.variantId,
      expected: entry.copyNumber,
    });
  }
}

/** Validates one copy; returns the registry-known variantIds on it. */
function validateCopy(copy, path, chromosomeId, errors) {
  if (!isPlainObject(copy)) {
    invalid(errors, path, 'copy must be an object');
    return [];
  }
  if (typeof copy.copyId !== 'string' || copy.copyId.length === 0) {
    invalid(errors, `${path}.copyId`, 'must be a non-empty string');
  }
  const calls = requireArray(copy.phasedVariants, `${path}.phasedVariants`, errors) ?? [];
  const onCopy = [];
  calls.forEach((call, i) => {
    const callPath = `${path}.phasedVariants[${i}]`;
    if (!isPlainObject(call) || typeof call.variantId !== 'string') {
      invalid(errors, callPath, 'call must be an object with a string variantId');
      return;
    }
    if (!phaseQualities.has(call.phaseQuality)) {
      errors.push({ code: 'invalidPhaseQuality', path: callPath, variantId: call.variantId });
    }
    checkCallRecord(call, callPath, errors);
    if (onCopy.includes(call.variantId)) {
      errors.push({
        code: 'duplicateCallOnCopy',
        chromosome: chromosomeId,
        copyId: copy.copyId,
        variantId: call.variantId,
      });
      return;
    }
    const entry = checkPlacement(call.variantId, chromosomeId, errors);
    if (entry) {
      checkCopyNumber(call, entry, callPath, errors);
      onCopy.push(call.variantId);
    }
  });
  for (let i = 0; i < onCopy.length; i++) {
    for (let j = i + 1; j < onCopy.length; j++) {
      const reason = cisIncompatibilityReason(onCopy[i], onCopy[j]);
      if (reason) {
        errors.push({
          code: 'cisIncompatible',
          chromosome: chromosomeId,
          copyId: copy.copyId,
          variantIds: [onCopy[i], onCopy[j]],
          reason,
        });
      }
    }
  }
  return onCopy;
}

/** Variants on a fully phased copy whose required cis partners are not on it. */
function checkPartialHaplotypesOnCopies(chromosomeId, copySets, copyIds, errors) {
  copySets.forEach((onCopy, i) => {
    for (const id of onCopy) {
      const missing = getVariant(id).requiresCisWith.filter(other => !onCopy.includes(other));
      if (missing.length > 0) {
        errors.push({
          code: 'partialRequiredHaplotype',
          chromosome: chromosomeId,
          copyId: copyIds[i],
          variantId: id,
          missing,
        });
      }
    }
  });
}

function validateCalls(list, path, errors, onValid) {
  list.forEach((call, i) => {
    const callPath = `${path}[${i}]`;
    if (!isPlainObject(call) || typeof call.variantId !== 'string') {
      invalid(errors, callPath, 'call must be an object with a string variantId');
      return;
    }
    checkCallRecord(call, callPath, errors);
    if (!Number.isInteger(call.dosage) || call.dosage < 1) {
      errors.push({ code: 'invalidDosage', path: callPath, variantId: call.variantId });
      return;
    }
    onValid(call, callPath);
  });
}

/** Every set (size 2+) of present variants that may not share a copy with each other. */
function exclusiveCliques(variantIds, conflicts) {
  const cliques = [];
  const extend = (clique, candidates) => {
    if (clique.length >= 2) {
      cliques.push(clique);
    }
    candidates.forEach((v, i) => {
      if (clique.every(c => conflicts(c, v))) {
        extend([...clique, v], candidates.slice(i + 1));
      }
    });
  };
  extend([], variantIds);
  return cliques;
}

/** Per-variant and joint capacity: each copy holds at most one of a mutually exclusive set. */
function checkCapacity(chromosomeId, dosage, limit, conflicts, errors) {
  for (const [variantId, total] of dosage) {
    if (total > limit) {
      errors.push({
        code: 'dosageExceedsCopies',
        chromosome: chromosomeId,
        variantId,
        dosage: total,
        copies: limit,
      });
    }
  }
  for (const clique of exclusiveCliques([...dosage.keys()], conflicts)) {
    const total = clique.reduce((sum, id) => sum + dosage.get(id), 0);
    if (total > limit) {
      errors.push({
        code: 'jointSiteCapacityExceeded',
        chromosome: chromosomeId,
        variantIds: clique,
        dosage: total,
        copies: limit,
      });
    }
  }
}

const phaseConstraintSources = new Set(['legacyEncoded']);

/**
 * Known partial phase that the copies do not yet show, e.g. a legacy `cr/prl`
 * that names cream and pearl in trans. Returns the valid TRANS pairs.
 */
function validatePhaseConstraints(chromosome, path, present, errors) {
  if (chromosome.phaseConstraints === undefined) {
    return [];
  }
  const list = requireArray(chromosome.phaseConstraints, `${path}.phaseConstraints`, errors) ?? [];
  const pairs = [];
  const seen = new Set();
  list.forEach((constraint, i) => {
    const ids = isPlainObject(constraint) ? constraint.variantIds : null;
    const ok =
      Array.isArray(ids) &&
      constraint.kind === 'TRANS' &&
      phaseConstraintSources.has(constraint.source) &&
      ids.length === 2 &&
      ids[0] !== ids[1] &&
      ids.every(id => present.has(id));
    // [a, b] and [b, a] state the same thing; one statement per pair.
    const key = ok ? [...ids].sort().join('|') : null;
    if (ok && seen.has(key)) {
      invalid(errors, `${path}.phaseConstraints[${i}]`, 'duplicate trans constraint');
    } else if (ok) {
      seen.add(key);
      pairs.push(ids);
    } else {
      invalid(
        errors,
        `${path}.phaseConstraints[${i}]`,
        'needs kind TRANS, a known source and two different variants called on this chromosome',
      );
    }
  });
  return pairs;
}

function copyChoices(limit, dosage) {
  if (dosage === 1) {
    return Array.from({ length: limit }, (_, i) => [i]);
  }
  return dosage === 2 && limit === 2 ? [[0, 1]] : [];
}

/**
 * Whether the unphased calls can be placed on the copies around the phased
 * calls already there: no copy holds a variant twice or two variants that may
 * not share a copy, and (when requireCis) no copy, phased calls included, ends
 * up holding half of a required cis haplotype. Only calls that conflict with,
 * or require, another present variant can fail, so only they are searched.
 */
function hasCopyAssignment(copySets, unphasedDosage, present, conflicts, requireCis) {
  const constrained = id =>
    getVariant(id).requiresCisWith.length > 0 ||
    [...present].some(other => other !== id && conflicts(id, other));
  const calls = [...unphasedDosage].filter(([id]) => constrained(id)).sort((a, b) => b[1] - a[1]);
  const placed = copySets.map(() => []);
  const fits = (copyIndex, id) => {
    const onCopy = [...copySets[copyIndex], ...placed[copyIndex]];
    return !onCopy.includes(id) && onCopy.every(other => !conflicts(other, id));
  };
  const cisComplete = () =>
    copySets.every((phased, i) => {
      const onCopy = [...phased, ...placed[i]];
      return onCopy.every(id =>
        getVariant(id).requiresCisWith.every(partner => onCopy.includes(partner)),
      );
    });
  const search = index => {
    if (index === calls.length) {
      return !requireCis || cisComplete();
    }
    const [id, dosage] = calls[index];
    for (const choice of copyChoices(copySets.length, dosage)) {
      if (choice.every(c => fits(c, id))) {
        choice.forEach(c => placed[c].push(id));
        const found = search(index + 1);
        choice.forEach(c => placed[c].pop());
        if (found) {
          return true;
        }
      }
    }
    return false;
  };
  return search(0);
}

function validateChromosome(chromosomeId, chromosome, sexChromosomes, errors) {
  const path = `chromosomes.${chromosomeId}`;
  if (!isPlainObject(chromosome)) {
    invalid(errors, path, 'chromosome must be an object');
    return;
  }
  if (chromosome.phaseResolution !== 'RESOLVED' && chromosome.phaseResolution !== 'UNRESOLVED') {
    errors.push({ code: 'phaseStateMismatch', chromosome: chromosomeId });
  }
  const expected = expectedCopies(chromosomeId, sexChromosomes);
  const copies = requireArray(chromosome.copies, `${path}.copies`, errors);
  // With unknown sex, an X holds only the copies actually stored (one or two).
  const storedCount = copies && (copies.length === 1 || copies.length === 2) ? copies.length : 2;
  const limit = expected ?? storedCount;
  const dosage = new Map();
  const add = (id, n) => dosage.set(id, (dosage.get(id) ?? 0) + n);
  const copySets = Array.from({ length: limit }, () => []);
  const copyIds = Array.from({ length: limit }, () => null);

  if (copies) {
    // A known sex fixes the count; an unknown-sex X must still store one or two copies.
    const countOk =
      expected === null ? copies.length === 1 || copies.length === 2 : copies.length === expected;
    if (!countOk) {
      errors.push({ code: 'wrongCopyCount', chromosome: chromosomeId, copies: copies.length });
    }
    const storedIds = copies.filter(isPlainObject).map(c => c.copyId);
    if (new Set(storedIds).size !== storedIds.length) {
      invalid(errors, `${path}.copies`, 'copyIds must be unique');
    }
    copies.forEach((copy, i) => {
      const onCopy = validateCopy(copy, `${path}.copies[${i}]`, chromosomeId, errors);
      onCopy.forEach(id => add(id, 1));
      if (i < limit) {
        copySets[i] = onCopy;
        copyIds[i] = copy?.copyId ?? null;
      }
    });
  }

  const unphased = requireArray(chromosome.unphasedCalls, `${path}.unphasedCalls`, errors) ?? [];
  const unphasedDosage = new Map();
  validateCalls(unphased, `${path}.unphasedCalls`, errors, (call, callPath) => {
    const entry = checkPlacement(call.variantId, chromosomeId, errors);
    if (entry) {
      checkCopyNumber(call, entry, callPath, errors);
      add(call.variantId, call.dosage);
      unphasedDosage.set(call.variantId, (unphasedDosage.get(call.variantId) ?? 0) + call.dosage);
    }
  });
  if (chromosome.phaseResolution === 'RESOLVED' && unphased.length > 0) {
    errors.push({ code: 'phaseStateMismatch', chromosome: chromosomeId });
  }

  const present = new Set(dosage.keys());
  const transPairs = validatePhaseConstraints(chromosome, path, present, errors);
  const inTrans = (a, b) =>
    transPairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const conflicts = (a, b) => cisIncompatibilityReason(a, b) !== null || inTrans(a, b);
  copySets.forEach((onCopy, i) => {
    for (const [a, b] of transPairs) {
      if (onCopy.includes(a) && onCopy.includes(b)) {
        errors.push({
          code: 'transConstraintViolated',
          chromosome: chromosomeId,
          copyIndex: i,
          variantIds: [a, b],
        });
      }
    }
  });

  if (unphasedDosage.size === 0) {
    checkPartialHaplotypesOnCopies(chromosomeId, copySets, copyIds, errors);
  }
  const before = errors.length;
  checkCapacity(chromosomeId, dosage, limit, conflicts, errors);
  if (errors.length > before || unphasedDosage.size === 0) {
    return;
  }
  // One search decides capacity and required cis together, phased calls included.
  if (!hasCopyAssignment(copySets, unphasedDosage, present, conflicts, true)) {
    const fitsWithoutCis = hasCopyAssignment(copySets, unphasedDosage, present, conflicts, false);
    errors.push({
      code: fitsWithoutCis ? 'partialRequiredHaplotype' : 'jointSiteCapacityExceeded',
      chromosome: chromosomeId,
      variantIds: [...unphasedDosage.keys()],
      reason: 'noCopyAssignment',
    });
  }
}

function validateLegacyRecords(genome, errors) {
  const observations = requireArray(genome.legacyObservations, 'legacyObservations', errors) ?? [];
  const tokensPerLocus = new Map();
  observations.forEach((obs, i) => {
    const ok =
      isPlainObject(obs) &&
      typeof obs.legacyLocus === 'string' &&
      typeof obs.token === 'string' &&
      Number.isInteger(obs.count) &&
      obs.count >= 1 &&
      obs.count <= legacyPairTokens &&
      typeof obs.reason === 'string';
    if (!ok) {
      invalid(
        errors,
        `legacyObservations[${i}]`,
        'needs legacyLocus, token, a count of 1 or 2 and reason',
      );
      return;
    }
    tokensPerLocus.set(obs.legacyLocus, (tokensPerLocus.get(obs.legacyLocus) ?? 0) + obs.count);
  });
  for (const [legacyLocus, total] of tokensPerLocus) {
    if (total > legacyPairTokens) {
      errors.push({ code: 'legacyObservationCountExceeded', legacyLocus, total });
    }
  }
  const raw = requireArray(genome.legacyRawValues, 'legacyRawValues', errors) ?? [];
  const seenLoci = new Set();
  raw.forEach((entry, i) => {
    const ok =
      isPlainObject(entry) &&
      typeof entry.legacyLocus === 'string' &&
      typeof entry.reason === 'string' &&
      Object.hasOwn(entry, 'value');
    if (!ok) {
      invalid(errors, `legacyRawValues[${i}]`, 'needs legacyLocus, value and reason');
    } else if (seenLoci.has(entry.legacyLocus)) {
      // One legacy slot holds one value; a second record could only be lost.
      invalid(errors, `legacyRawValues[${i}]`, `duplicate legacyLocus ${entry.legacyLocus}`);
    } else {
      seenLoci.add(entry.legacyLocus);
    }
  });
}

/**
 * Check a genome against the registry and the phased-state rules. Never throws:
 * every problem, including malformed JSON shapes, comes back as a coded error.
 *
 * @param {unknown} genome
 * @returns {{ valid: boolean, errors: Array<{ code: string }> }}
 */
export function validateAppearanceGenome(genome) {
  if (!isPlainObject(genome)) {
    return { valid: false, errors: [{ code: 'notAnObject' }] };
  }
  const errors = [];
  if (genome.schemaVersion !== 2) {
    errors.push({ code: 'wrongSchemaVersion' });
  }
  if (!sexValues.has(genome.sexChromosomes)) {
    errors.push({ code: 'invalidSexChromosomes' });
  }
  if (!provenanceValues.has(genome.migrationProvenance)) {
    invalid(errors, 'migrationProvenance', 'must be null or legacyInferred');
  }
  if (isPlainObject(genome.chromosomes)) {
    for (const [chromosomeId, chromosome] of Object.entries(genome.chromosomes)) {
      if (knownChromosomes.has(chromosomeId)) {
        validateChromosome(chromosomeId, chromosome, genome.sexChromosomes, errors);
      } else {
        errors.push({ code: 'unknownChromosome', chromosome: chromosomeId });
      }
    }
  } else {
    invalid(errors, 'chromosomes', 'must be an object');
  }
  const unplaced = requireArray(genome.unplacedCalls, 'unplacedCalls', errors) ?? [];
  const unplacedDosage = new Map();
  validateCalls(unplaced, 'unplacedCalls', errors, (call, path) => {
    const entry = getVariant(call.variantId);
    if (!entry) {
      errors.push({ code: 'unknownVariant', variantId: call.variantId });
    } else if (entry.chromosome !== null) {
      errors.push({ code: 'placedVariantUnplaced', variantId: call.variantId });
    } else {
      // Unplaced sentinels have no copy-number state, so any copyNumber is a mismatch.
      checkCopyNumber(call, entry, path, errors);
      unplacedDosage.set(call.variantId, (unplacedDosage.get(call.variantId) ?? 0) + call.dosage);
    }
  });
  // Every record of one variant counts against the same two diploid copies.
  for (const [variantId, total] of unplacedDosage) {
    if (total > 2) {
      errors.push({ code: 'invalidDosage', path: 'unplacedCalls', variantId, total });
    }
  }
  validateLegacyRecords(genome, errors);
  return { valid: errors.length === 0, errors };
}

/**
 * A parent's call as the foal receives it. DNA results belong to the horse that
 * was tested, so the assay key stays with the parent, and a directly tested
 * phase becomes a pedigree inference; weaker phase is never upgraded.
 */
function inheritedCall({ assayId: _parentAssay, ...call }) {
  return {
    ...call,
    phaseQuality: call.phaseQuality === 'DIRECT' ? 'pedigreeInferred' : call.phaseQuality,
  };
}

/**
 * Pass one parental chromosome copy to a gamete.
 *
 * @param {object} genome - parent's appearance genome
 * @param {string} chromosomeId - an autosome, e.g. 'ECA3'
 * @param {() => number} rng - returns floats in [0, 1)
 * @param {{ mode: string }} options - must be preservePhaseNoCrossover
 * @returns {{ copyId: string, phasedVariants: object[] }} a fresh copy
 */
export function transmitChromosomeCopy(genome, chromosomeId, rng, { mode } = {}) {
  if (mode !== preservePhaseNoCrossover) {
    throw new Error(
      `transmitChromosomeCopy: mode must be ${preservePhaseNoCrossover}; got ${mode}`,
    );
  }
  if (chromosomeId === 'ECAX' || chromosomeId === 'ECAY') {
    throw new Error(
      'transmitChromosomeCopy: sex chromosome transmission is not implemented in slice 1',
    );
  }
  if (!knownChromosomes.has(chromosomeId)) {
    throw new Error(`transmitChromosomeCopy: unknown chromosome ${chromosomeId}`);
  }
  // A known chromosome the horse has no calls on is wild type.
  const chromosome = genome.chromosomes?.[chromosomeId];
  if (!chromosome) {
    return { copyId: 'GAMETE', phasedVariants: [] };
  }
  if (chromosome.phaseResolution !== 'RESOLVED' || chromosome.unphasedCalls.length > 0) {
    throw new Error(`transmitChromosomeCopy: ${chromosomeId} phase is unresolved`);
  }
  const index = rng() < 0.5 ? 0 : 1;
  const source = chromosome.copies[index];
  return { copyId: 'GAMETE', phasedVariants: source.phasedVariants.map(inheritedCall) };
}
