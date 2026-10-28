/**
 * Epigenetic Trait Assignment at Birth — staged pipeline (Equoria-9o3n7.2 §A,
 * e2flk §D).
 *
 * One ordered pipeline produces a foal's `{ positive, negative, hidden }`
 * epigenetic modifiers at birth:
 *
 *   Stage 0 — INHERITANCE (§A): each sire/dam epigenetic trait ON THE ROSTER
 *     is inherited at a flat 25% per carrying parent (owner rulings
 *     2026-10-27 q138 and 2026-10-28 q145): one parent carrying it is one 25%
 *     roll; both parents carrying it is one 25% roll for each parent, so about
 *     43.75% overall. The flat rate replaced the rarity- and dam-bond-adjusted
 *     rates (common 50%, rare 15%, legendary 5%, otherwise 40%).
 *   Stage 1 — well-kept mare (feedQuality >= 80) → 10% resilient (bible 08
 *     numbers, owner ruling 2026-10-28 q175). Replaced the unruled 75% resilient
 *     + 60% peopleTrusting bonus.
 *   Stage 2 — inbreeding → fragile.
 *   Stage 3 — lineage discipline specialization → disciplineAffinity<Discipline>
 *     (the discipline trait, ruled separately from the trait roster).
 *   Dedupe, then VISIBILITY (owner ruling 2026-10-26, q98; Equoria-2d55z):
 *     every trait the foal carries is born HIDDEN, unless a parent had that
 *     trait active and revealed (`parentActiveTraits`), in which case it is
 *     born active in positive[] / negative[]. Hidden traits are revealed or
 *     switched off later only by grooming and neglect days
 *     (modules/traits/services/traitRevealEngine.mjs). This replaced the
 *     rarity/feed visibility rolls (rare 70% / legendary 90% / poor feed 30%
 *     hidden), which made a store-bred foal's traits visible by chance.
 *
 * Only roster traits are generated (owner ruling 2026-10-27, q117: the
 * twenty-trait roster in utils/epigeneticTraits.mjs replaces the old one).
 * The rolls that produced names no longer on it were removed: reactive and
 * lowImmunity from inbreeding, legacyTalent from a strong lineage, and
 * lowImmunity from poor feed. A parent's off-roster trait is never inherited.
 *
 * A mare in Fair health multiplies EVERY negative-trait roll here by 1.25 and a
 * mare in Bad health by 1.5 (owner ruling 2026-10-26, Equoria-pw7cm; kept on
 * top of the 25% by q146): pass the multiplier as `negativeRollMultiplier`.
 * When both parents carry a negative trait, each parent's roll takes it, as
 * every negative inheritance roll did before q145. No other odds move.
 *
 * Determinism: pass `seed` (number) or `rng` (a function returning [0, 1))
 * for reproducible rolls in tests. With neither, Math.random is used.
 *
 * Canonical trait keys (camelCase) only — see backend/utils/epigeneticTraitKeyMap.mjs.
 */

import logger from './logger.mjs';
import { getTraitDefinition, isRosterTrait } from './epigeneticTraits.mjs';
import { normalizeTraitKey, disciplineAffinityKey } from './epigeneticTraitKeyMap.mjs';

/**
 * Small deterministic LCG so seeded runs are reproducible. Mirrors the
 * SeededRandom used in epigeneticTraits.mjs so behaviour matches the ported
 * inheritance model. When no seed is given, falls back to Math.random.
 */
function makeRng(seed) {
  if (seed === undefined || seed === null) {
    return Math.random;
  }
  let state = Number(seed) || 1;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

/** Chance that a foal inherits a trait a parent carries (owner ruling 2026-10-27, q138). */
const inheritanceChance = 0.25;

/**
 * Feed quality from which a mare counts as well kept (unchanged threshold), and the
 * bible 08 chance her foal gets a positive constitution trait: "Mare stress <30 +
 * good feed: ~10% chance of Resilient / High Immunity-style positive flag" (owner
 * ruling 2026-10-28, q175: use the bible numbers). Equoria has no stress, so good
 * feed alone qualifies; High Immunity is not on the trait roster, so the one
 * roster trait the passage names, Resilient, is the outcome.
 */
const wellKeptMareFeedQuality = 80;
const wellKeptMareResilientChance = 0.1;

/** Whether a carried trait acts positively or negatively (q135), else by the stage that produced it. */
function traitPolarity(trait, fallbackType) {
  const def = getTraitDefinition(trait);
  if (def?.type === 'positive' || def?.type === 'negative') {
    return def.type;
  }
  return fallbackType;
}

/**
 * Apply epigenetic traits at birth via the staged pipeline.
 *
 * @param {Object} params
 * @param {Object} params.mare - Mare object (bondScore, ...)
 * @param {Array}  params.lineage - ancestor records (discipline info)
 * @param {number} params.feedQuality - 0-100
 * @param {number} [params.negativeRollMultiplier] - mare-health multiplier on every negative roll (default 1)
 * @param {string[]} [params.sireTraits] - sire's epigenetic traits (pos∪neg∪hidden)
 * @param {string[]} [params.damTraits]  - dam's epigenetic traits (pos∪neg∪hidden)
 * @param {string[]} [params.parentActiveTraits] - traits active and revealed on
 *   either parent (their positive ∪ negative); only these can be born active
 * @param {number} [params.seed] - deterministic seed for tests
 * @param {() => number} [params.rng] - injected random source for tests (wins over seed)
 * @returns {{positive:string[], negative:string[], hidden:string[]}}
 */
export function applyEpigeneticTraitsAtBirth({
  mare,
  lineage,
  feedQuality,
  negativeRollMultiplier = 1,
  sireTraits = [],
  damTraits = [],
  parentActiveTraits = [],
  seed,
  rng: injectedRng,
}) {
  logger.info('[applyEpigeneticTraitsAtBirth] Starting staged trait assignment at birth');

  if (!mare) {
    throw new Error('Mare object is required');
  }

  const rng = typeof injectedRng === 'function' ? injectedRng : makeRng(seed);

  // Classify each candidate trait as 'positive' or 'negative' for visibility
  // fallback when the trait has no definition (e.g. discipline-affinity keys).
  const positiveCandidates = new Set();
  const negativeCandidates = new Set();
  const addPositive = t => positiveCandidates.add(t);
  const addNegative = t => negativeCandidates.add(t);

  const currentFeedQuality = feedQuality !== undefined ? feedQuality : 50;

  // A negative roll's chance, scaled by the mare's health and capped at certainty.
  const negativeChance = chance => Math.min(1, chance * negativeRollMultiplier);

  logger.info(`[applyEpigeneticTraitsAtBirth] Feed quality: ${currentFeedQuality}`);

  // ── Stage 0 — INHERITANCE (§A) ─────────────────────────────────────────────
  // Normalize incoming parent traits to canonical keys so legacy snake-case
  // rows still inherit correctly and keep only roster traits (q117). Each
  // distinct trait then rolls the flat rate (q138) once for every parent that
  // carries it (q145): sire's roll first, then dam's. A negative trait's roll
  // still takes the mare-health multiplier (Equoria-pw7cm, q146).
  const rosterTraitsOf = traits =>
    new Set(
      (Array.isArray(traits) ? traits : [])
        .filter(t => typeof t === 'string' && t.length > 0)
        .map(normalizeTraitKey)
        .filter(isRosterTrait),
    );
  const sireCarried = rosterTraitsOf(sireTraits);
  const damCarried = rosterTraitsOf(damTraits);
  const parentTraits = [...new Set([...sireCarried, ...damCarried])];
  for (const trait of parentTraits) {
    const def = getTraitDefinition(trait);
    const p = def?.type === 'negative' ? negativeChance(inheritanceChance) : inheritanceChance;
    const rolls = (sireCarried.has(trait) ? 1 : 0) + (damCarried.has(trait) ? 1 : 0);
    let inherited = false;
    for (let roll = 0; roll < rolls; roll += 1) {
      if (rng() < p) {
        inherited = true;
      }
    }
    if (inherited) {
      if (def?.type === 'negative') {
        addNegative(trait);
      } else {
        addPositive(trait);
      }
      logger.info(
        `[applyEpigeneticTraitsAtBirth] Inherited parent trait '${trait}' (p=${p.toFixed(2)})`,
      );
    }
  }

  // ── Stage 1 — well-kept mare (bible 08, q175) ─────────────────────────────
  if (currentFeedQuality >= wellKeptMareFeedQuality && rng() < wellKeptMareResilientChance) {
    addPositive('resilient');
    logger.info('[applyEpigeneticTraitsAtBirth] Applied resilient (well-kept mare)');
  }

  // ── Stage 2 — inbreeding ────────────────────────────────────────────────────
  const inbreedingAnalysis = analyzeInbreeding(lineage);
  if (inbreedingAnalysis.inbreedingDetected) {
    logger.info(
      `[applyEpigeneticTraitsAtBirth] Inbreeding detected: ${inbreedingAnalysis.severity}`,
    );

    const fragileChance =
      inbreedingAnalysis.severity === 'high'
        ? 0.8
        : inbreedingAnalysis.severity === 'moderate'
          ? 0.5
          : 0.25;
    if (rng() < negativeChance(fragileChance)) {
      addNegative('fragile');
      logger.info('[applyEpigeneticTraitsAtBirth] Applied fragile (inbreeding)');
    }
  }

  // ── Stage 3 — lineage discipline specialization ─────────────────────────────
  const disciplineAnalysis = analyzeDisciplineSpecialization(lineage);
  if (disciplineAnalysis.hasSpecialization) {
    logger.info(
      `[applyEpigeneticTraitsAtBirth] Discipline specialization: ${disciplineAnalysis.discipline} (${disciplineAnalysis.count} ancestors)`,
    );

    // §F (9o3n7.5): emit the canonical camelCase affinity key
    // disciplineAffinity<Discipline>. The traitEffects map now has a rich
    // effect for EVERY canonical discipline, so a born affinity trait always
    // has a matching effect (resolves the historic jumping/show_jumping
    // silent-miss where the emitter built _show_jumping but only _jumping
    // had an effect).
    const affinityTrait = disciplineAffinityKey(disciplineAnalysis.discipline);
    if (affinityTrait && rng() < 0.7) {
      addPositive(affinityTrait);
      logger.info(`[applyEpigeneticTraitsAtBirth] Applied ${affinityTrait}`);
    }
  }

  // ── Dedupe + visibility (q98) ───────────────────────────────────────────────
  // Hidden unless a parent had the trait active and revealed.
  const activeOnParent = new Set(
    (Array.isArray(parentActiveTraits) ? parentActiveTraits : [])
      .filter(t => typeof t === 'string' && t.length > 0)
      .map(normalizeTraitKey),
  );
  const result = { positive: [], negative: [], hidden: [] };
  const seen = new Set();

  // Process positives then negatives; a trait that appears in both buckets
  // (shouldn't, but guard) is resolved once on first encounter.
  const ordered = [
    ...[...positiveCandidates].map(t => ({ trait: t, fallback: 'positive' })),
    ...[...negativeCandidates].map(t => ({ trait: t, fallback: 'negative' })),
  ];
  for (const { trait, fallback } of ordered) {
    if (seen.has(trait)) {
      continue;
    }
    seen.add(trait);
    if (activeOnParent.has(trait)) {
      result[traitPolarity(trait, fallback)].push(trait);
    } else {
      result.hidden.push(trait);
    }
  }

  logger.info(`[applyEpigeneticTraitsAtBirth] Final traits: ${JSON.stringify(result)}`);
  return result;
}

/**
 * Analyze lineage for inbreeding
 */
function analyzeInbreeding(lineage) {
  if (!lineage || lineage.length === 0) {
    return { inbreedingDetected: false, severity: 'none', commonAncestors: [] };
  }

  const ancestorCounts = {};
  const commonAncestors = [];

  lineage.forEach(ancestor => {
    if (ancestor && ancestor.id) {
      ancestorCounts[ancestor.id] = (ancestorCounts[ancestor.id] || 0) + 1;
      if (ancestorCounts[ancestor.id] > 1 && !commonAncestors.includes(ancestor.id)) {
        commonAncestors.push(ancestor.id);
      }
    }
  });

  const inbreedingDetected = commonAncestors.length > 0;
  let severity = 'none';

  if (inbreedingDetected) {
    const maxCount = Math.max(...Object.values(ancestorCounts));
    if (maxCount >= 4) {
      severity = 'high';
    } else if (maxCount >= 3) {
      severity = 'moderate';
    } else {
      severity = 'low';
    }
  }

  return { inbreedingDetected, severity, commonAncestors, ancestorCounts };
}

/**
 * Analyze lineage for discipline specialization
 */
function analyzeDisciplineSpecialization(lineage) {
  if (!lineage || lineage.length === 0) {
    return { hasSpecialization: false, discipline: null, count: 0 };
  }

  const disciplineCounts = {};

  lineage.forEach(ancestor => {
    if (ancestor && ancestor.discipline) {
      disciplineCounts[ancestor.discipline] = (disciplineCounts[ancestor.discipline] || 0) + 1;
    }
    if (ancestor && ancestor.mostCompetedDiscipline) {
      disciplineCounts[ancestor.mostCompetedDiscipline] =
        (disciplineCounts[ancestor.mostCompetedDiscipline] || 0) + 1;
    }
    if (ancestor && ancestor.disciplineScores) {
      const highestDiscipline = getHighestScoringDiscipline(ancestor.disciplineScores);
      if (highestDiscipline) {
        disciplineCounts[highestDiscipline] = (disciplineCounts[highestDiscipline] || 0) + 1;
      }
    }
  });

  let mostCommonDiscipline = null;
  let maxCount = 0;

  Object.entries(disciplineCounts).forEach(([discipline, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonDiscipline = discipline;
    }
  });

  const hasSpecialization = maxCount >= 3;

  return {
    hasSpecialization,
    discipline: hasSpecialization ? mostCommonDiscipline : null,
    count: maxCount,
    disciplineBreakdown: disciplineCounts,
  };
}

/**
 * Get the highest scoring discipline from discipline scores
 */
function getHighestScoringDiscipline(disciplineScores) {
  if (!disciplineScores || typeof disciplineScores !== 'object') {
    return null;
  }

  let highestDiscipline = null;
  let highestScore = -1;

  Object.entries(disciplineScores).forEach(([discipline, score]) => {
    if (typeof score === 'number' && score > highestScore) {
      highestScore = score;
      highestDiscipline = discipline;
    }
  });

  return highestDiscipline;
}

export default applyEpigeneticTraitsAtBirth;
