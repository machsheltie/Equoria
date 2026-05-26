/**
 * Epigenetic Trait Assignment at Birth — staged pipeline (Equoria-9o3n7.2 §A,
 * e2flk §D).
 *
 * One ordered pipeline produces a foal's `{ positive, negative, hidden }`
 * epigenetic modifiers at birth:
 *
 *   Stage 0 — INHERITANCE (NEW, §A): each distinct sire/dam epigenetic trait is
 *     inherited with a per-trait probability (rarity- + dam-condition-adjusted,
 *     ported from epigeneticTraits.calculateEpigeneticTraits).
 *   Stage 1 — low mare stress + premium feed → resilient / peopleTrusting.
 *   Stage 2 — inbreeding → fragile / reactive / lowImmunity.
 *   Stage 3 — lineage discipline specialization → disciplineAffinity<Discipline>
 *     (+ legacyTalent for a strong 4+-ancestor lineage).
 *   Stage 4 — high mare stress → nervous; poor feed → lowImmunity.
 *   Dedupe, then RESOLVE VISIBILITY (§D): rare traits 70% / legendary 90% born
 *     hidden, and ANY trait 30% hidden under poor conditions (high stress / low
 *     feed). Hidden traits land in `hidden[]` for later discovery.
 *
 * Determinism: pass `seed` (number) for reproducible Stage-0 + visibility rolls
 * in tests. Without a seed, Math.random is used.
 *
 * Canonical trait keys (camelCase) only — see backend/utils/epigeneticTraitKeyMap.mjs.
 */

import logger from './logger.mjs';
import { getTraitDefinition } from './epigeneticTraits.mjs';
import { normalizeTraitKey } from './epigeneticTraitKeyMap.mjs';

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

/**
 * Per-trait inheritance probability, rarity- and dam-condition-adjusted.
 * Ported from epigeneticTraits.calculateInheritanceProbability so the live
 * birth path and the (previously orphaned) model agree.
 */
function inheritanceProbability(trait, bondScore, stressLevel) {
  const def = getTraitDefinition(trait);
  let base = 0.4; // unknown-trait default
  if (def) {
    switch (def.rarity) {
      case 'common':
        base = 0.5;
        break;
      case 'rare':
        base = 0.15;
        break;
      case 'legendary':
        base = 0.05;
        break;
      default:
        base = 0.4;
    }
    if (def.type === 'positive') {
      base += (bondScore - 50) * 0.004;
      base -= (stressLevel - 50) * 0.003;
    } else if (def.type === 'negative') {
      base -= (bondScore - 50) * 0.003;
      base += (stressLevel - 50) * 0.004;
    }
  }
  return Math.max(0, Math.min(1, base));
}

/**
 * §D visibility resolution. Returns 'hidden' | 'positive' | 'negative'.
 *   - rare trait: 70% hidden
 *   - legendary trait: 90% hidden
 *   - ANY trait under poor conditions (high stress / low feed): 30% hidden
 * Falls through to the trait's natural type (positive/negative) otherwise.
 */
function resolveVisibility(trait, { poorConditions }, rng, fallbackType) {
  const def = getTraitDefinition(trait);
  const rarity = def?.rarity;
  if (rarity === 'rare' && rng() < 0.7) {
    return 'hidden';
  }
  if (rarity === 'legendary' && rng() < 0.9) {
    return 'hidden';
  }
  if (poorConditions && rng() < 0.3) {
    return 'hidden';
  }
  // Natural type: prefer the definition, else the stage's classification.
  if (def?.type === 'positive' || def?.type === 'negative') {
    return def.type;
  }
  return fallbackType;
}

/**
 * Apply epigenetic traits at birth via the staged pipeline.
 *
 * @param {Object} params
 * @param {Object} params.mare - Mare object (stressLevel, bondScore, ...)
 * @param {Array}  params.lineage - ancestor records (discipline info)
 * @param {number} params.feedQuality - 0-100
 * @param {number} params.stressLevel - mare stress 0-100
 * @param {string[]} [params.sireTraits] - sire's epigenetic traits (pos∪neg∪hidden)
 * @param {string[]} [params.damTraits]  - dam's epigenetic traits (pos∪neg∪hidden)
 * @param {number} [params.seed] - deterministic seed for tests
 * @returns {{positive:string[], negative:string[], hidden:string[]}}
 */
export function applyEpigeneticTraitsAtBirth({
  mare,
  lineage,
  feedQuality,
  stressLevel,
  sireTraits = [],
  damTraits = [],
  seed,
}) {
  try {
    logger.info('[applyEpigeneticTraitsAtBirth] Starting staged trait assignment at birth');

    if (!mare) {
      throw new Error('Mare object is required');
    }

    const rng = makeRng(seed);

    // Classify each candidate trait as 'positive' or 'negative' for visibility
    // fallback when the trait has no definition (e.g. discipline-affinity keys).
    const positiveCandidates = new Set();
    const negativeCandidates = new Set();
    const addPositive = t => positiveCandidates.add(t);
    const addNegative = t => negativeCandidates.add(t);

    const currentStressLevel = stressLevel !== undefined ? stressLevel : mare.stressLevel || 50;
    const currentFeedQuality = feedQuality !== undefined ? feedQuality : 50;
    const damBondScore = typeof mare.bondScore === 'number' ? mare.bondScore : 50;

    logger.info(
      `[applyEpigeneticTraitsAtBirth] Mare stress: ${currentStressLevel}, Feed quality: ${currentFeedQuality}`,
    );

    // ── Stage 0 — INHERITANCE (§A) ─────────────────────────────────────────────
    // Normalize incoming parent traits to canonical keys so legacy snake-case
    // rows still inherit correctly, then inherit each distinct trait by its
    // rarity/condition-adjusted probability.
    const parentTraits = [
      ...new Set(
        [...(Array.isArray(sireTraits) ? sireTraits : []), ...(Array.isArray(damTraits) ? damTraits : [])]
          .filter(t => typeof t === 'string' && t.length > 0)
          .map(normalizeTraitKey),
      ),
    ];
    for (const trait of parentTraits) {
      const p = inheritanceProbability(trait, damBondScore, currentStressLevel);
      if (rng() < p) {
        const def = getTraitDefinition(trait);
        if (def?.type === 'negative') {
          addNegative(trait);
        } else {
          addPositive(trait);
        }
        logger.info(`[applyEpigeneticTraitsAtBirth] Inherited parent trait '${trait}' (p=${p.toFixed(2)})`);
      }
    }

    // ── Stage 1 — low stress + premium feed ────────────────────────────────────
    if (currentStressLevel <= 20 && currentFeedQuality >= 80) {
      if (rng() < 0.75) {
        addPositive('resilient');
        logger.info('[applyEpigeneticTraitsAtBirth] Applied resilient (low stress + premium feed)');
      }
      if (rng() < 0.6) {
        addPositive('peopleTrusting');
        logger.info('[applyEpigeneticTraitsAtBirth] Applied peopleTrusting (low stress + premium feed)');
      }
    }

    // ── Stage 2 — inbreeding ────────────────────────────────────────────────────
    const inbreedingAnalysis = analyzeInbreeding(lineage);
    if (inbreedingAnalysis.inbreedingDetected) {
      logger.info(`[applyEpigeneticTraitsAtBirth] Inbreeding detected: ${inbreedingAnalysis.severity}`);

      const fragileChance =
        inbreedingAnalysis.severity === 'high' ? 0.8 : inbreedingAnalysis.severity === 'moderate' ? 0.5 : 0.25;
      if (rng() < fragileChance) {
        addNegative('fragile');
        logger.info('[applyEpigeneticTraitsAtBirth] Applied fragile (inbreeding)');
      }

      const reactiveChance =
        inbreedingAnalysis.severity === 'high' ? 0.7 : inbreedingAnalysis.severity === 'moderate' ? 0.4 : 0.2;
      if (rng() < reactiveChance) {
        addNegative('reactive');
        logger.info('[applyEpigeneticTraitsAtBirth] Applied reactive (inbreeding)');
      }

      const immunityChance =
        inbreedingAnalysis.severity === 'high' ? 0.6 : inbreedingAnalysis.severity === 'moderate' ? 0.35 : 0.15;
      if (rng() < immunityChance) {
        addNegative('lowImmunity');
        logger.info('[applyEpigeneticTraitsAtBirth] Applied lowImmunity (inbreeding)');
      }
    }

    // ── Stage 3 — lineage discipline specialization ─────────────────────────────
    const disciplineAnalysis = analyzeDisciplineSpecialization(lineage);
    if (disciplineAnalysis.hasSpecialization) {
      logger.info(
        `[applyEpigeneticTraitsAtBirth] Discipline specialization: ${disciplineAnalysis.discipline} (${disciplineAnalysis.count} ancestors)`,
      );

      // NOTE: the affinity-key GENERATOR is fixed to canonical camelCase in §F
      // (9o3n7.5), together with the full per-discipline traitEffects roster, so
      // a born affinity trait always has a matching effect. Until §F lands this
      // stage emits the legacy snake key (which has a matching snake effect for
      // racing/jumping/dressage and is baselined in the 2mgor sentinel for the
      // rest). This keeps the §A commit's at-birth traits effect-backed.
      const affinityTrait = `discipline_affinity_${disciplineAnalysis.discipline
        .toLowerCase()
        .replace(/\s+/g, '_')}`;
      if (affinityTrait && rng() < 0.7) {
        addPositive(affinityTrait);
        logger.info(`[applyEpigeneticTraitsAtBirth] Applied ${affinityTrait}`);
      }

      if (disciplineAnalysis.count >= 4 && rng() < 0.4) {
        addPositive('legacyTalent');
        logger.info('[applyEpigeneticTraitsAtBirth] Applied legacyTalent (strong lineage)');
      }
    }

    // ── Stage 4 — high mare stress / poor feed ──────────────────────────────────
    if (currentStressLevel >= 80 && rng() < 0.4 && !negativeCandidates.has('reactive')) {
      addNegative('nervous');
      logger.info('[applyEpigeneticTraitsAtBirth] Applied nervous (high mare stress)');
    }
    if (currentFeedQuality <= 30 && rng() < 0.3 && !negativeCandidates.has('lowImmunity')) {
      addNegative('lowImmunity');
      logger.info('[applyEpigeneticTraitsAtBirth] Applied lowImmunity (poor nutrition)');
    }

    // ── Dedupe + §D visibility resolution ───────────────────────────────────────
    const poorConditions = currentStressLevel >= 80 || currentFeedQuality <= 30;
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
      const visibility = resolveVisibility(trait, { poorConditions }, rng, fallback);
      if (visibility === 'hidden') {
        result.hidden.push(trait);
      } else if (visibility === 'negative') {
        result.negative.push(trait);
      } else {
        result.positive.push(trait);
      }
    }

    logger.info(`[applyEpigeneticTraitsAtBirth] Final traits: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    logger.error(`[applyEpigeneticTraitsAtBirth] Error: ${error.message}`);
    throw error;
  }
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
