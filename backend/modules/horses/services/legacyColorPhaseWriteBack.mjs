/**
 * legacyColorPhaseWriteBack.mjs
 *
 * The phase half of converting an appearance genome back to the flat legacy
 * `colorGenotype` (genetics master spec §17, Equoria-8xxnf slice 1). Legacy
 * pairs hold no phase except one spelling, trans cream/pearl (`cr/prl`), so
 * this decides which resolved phase legacy can rebuild and reports the rest.
 * Pure functions, no Prisma.
 */

import { getVariant, cisIncompatibilityReason } from './appearanceVariantRegistry.mjs';

const CR = 'SLC45A2_Cr';
const PRL = 'SLC45A2_Prl';

function copyContents(chromosome) {
  return (chromosome.copies ?? []).map(copy => (copy.phasedVariants ?? []).map(c => c.variantId));
}

/** Resolved copies show cream without pearl on one copy and pearl without cream on another. */
function creamPearlTransOnCopies(chromosome) {
  if (chromosome.phaseResolution !== 'RESOLVED') {
    return false;
  }
  const copies = copyContents(chromosome);
  const creamOnly = copies.findIndex(ids => ids.includes(CR) && !ids.includes(PRL));
  const pearlOnly = copies.findIndex(ids => ids.includes(PRL) && !ids.includes(CR));
  return creamOnly !== -1 && pearlOnly !== -1 && creamOnly !== pearlOnly;
}

/** Both variants are known and can never share a copy, so they are always in trans. */
function forcedTrans(a, b) {
  return (
    getVariant(a) !== null && getVariant(b) !== null && cisIncompatibilityReason(a, b) !== null
  );
}

/**
 * Whether legacy can rebuild the whole arrangement of these heterozygous
 * variants. Two are linked when their relative phase follows from what legacy
 * keeps: they cannot share a copy, one requires the other in cis, or they are
 * the trans cream/pearl pair legacy spells as `cr/prl`. One linked group means
 * the arrangement is fully determined.
 */
function phaseRebuildable(chromosome, heterozygous) {
  const creamPearl = creamPearlTransOnCopies(chromosome);
  const group = new Map(heterozygous.map(id => [id, id]));
  const root = id => (group.get(id) === id ? id : root(group.get(id)));
  heterozygous.forEach((a, i) => {
    for (const b of heterozygous.slice(i + 1)) {
      const linked =
        forcedTrans(a, b) ||
        getVariant(a)?.requiresCisWith.includes(b) ||
        getVariant(b)?.requiresCisWith.includes(a) ||
        (creamPearl && [a, b].sort().join('|') === `${CR}|${PRL}`);
      if (linked) {
        group.set(root(a), root(b));
      }
    }
  });
  return new Set(heterozygous.map(root)).size <= 1;
}

/**
 * Resolved phase the legacy shape cannot hold. Legacy spells exactly one phase
 * relationship, trans cream/pearl (`cr/prl`); phase that follows from which
 * alleles can or must share a copy needs no spelling. Anything else is lost.
 */
export function phaseLosses(genome) {
  const loss = [];
  for (const [chromosomeId, chromosome] of Object.entries(genome.chromosomes ?? {})) {
    if (chromosome.phaseResolution !== 'RESOLVED') {
      continue;
    }
    const counts = new Map();
    for (const ids of copyContents(chromosome)) {
      ids.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
    }
    const heterozygous = [...counts].filter(([, c]) => c === 1).map(([id]) => id);
    if (!phaseRebuildable(chromosome, heterozygous)) {
      loss.push({ code: 'phaseDropped', chromosome: chromosomeId });
    }
  }
  return loss;
}

/**
 * Known trans phase, from a persisted constraint or from resolved copies.
 * Legacy can hold exactly one kind: a cream in trans with pearl is `cr` in the
 * Prl_Pearl slot. It is written once, and not at all when a pearl-slot `cr`
 * observation (whatever its reason) already writes it; Cr_Cream keeps its
 * cream, as in the matched form. Any other trans pair has no legacy spelling
 * and is reported as phaseDropped, unless the pair can only sit in trans or
 * phaseLosses already reported the chromosome.
 */
export function writeBackPhaseConstraints(genome, slots, loss) {
  const written = (genome.legacyObservations ?? []).some(
    o => o.legacyLocus === 'Prl_Pearl' && o.token === 'cr',
  );
  const lostByCopies = new Set(loss.filter(l => l.code === 'phaseDropped').map(l => l.chromosome));
  let creamPearlTrans = false;
  for (const [chromosomeId, chromosome] of Object.entries(genome.chromosomes ?? {})) {
    creamPearlTrans = creamPearlTrans || creamPearlTransOnCopies(chromosome);
    const reported = new Set(lostByCopies.has(chromosomeId) ? ['*'] : []);
    for (const constraint of chromosome.phaseConstraints ?? []) {
      const ids = [...constraint.variantIds].sort();
      const key = ids.join('|');
      if (ids[0] === CR && ids[1] === PRL) {
        creamPearlTrans = true;
      } else if (!reported.has(key) && !reported.has('*') && !forcedTrans(ids[0], ids[1])) {
        reported.add(key);
        loss.push({
          code: 'phaseDropped',
          chromosome: chromosomeId,
          variantIds: constraint.variantIds,
        });
      }
    }
  }
  if (creamPearlTrans && !written) {
    slots.Prl_Pearl.unshift('cr');
  }
}
