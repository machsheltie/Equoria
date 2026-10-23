/**
 * Epigenetic flag trigger rules (moved out of flagEvaluationEngine.mjs verbatim
 * by Equoria-cmw85.38 so the engine stays under the 600-line production cap).
 *
 * Pure functions: given a flag definition and a horse's analysed care patterns,
 * decide whether the flag triggers. flagEvaluationEngine.mjs is the only
 * consumer and re-exports flagPredispositionBias and evaluateFlagTriggers, so
 * every existing importer is unchanged. Canonical engine: see
 * modules/traits/__tests__/flagEngineSingleSource.sentinel.test.mjs.
 */

import logger from './logger.mjs';

/**
 * Equoria-yzqhj.4 — Parent → foal epigenetic FLAG inheritance (PREDISPOSITION model).
 *
 * Foals are NOT born with inherited flags. Behavioral flags still come ONLY from
 * 0-3yr care patterns (the canonical path in evaluateHorseFlags). Predisposition
 * means: a flag present in EITHER parent biases the foal's care-evaluation so that
 * the SAME care pattern is slightly more likely to trigger that one flag. It is a
 * nudge, never an auto-grant — a predisposed foal with no qualifying care still
 * develops nothing.
 *
 * Inheritance rule chosen: UNION of sire + dam flags (a flag in EITHER parent
 * predisposes the foal). This is the broadest sensible reading of "the parents'
 * behavioral profile" and avoids requiring both parents to share a flag (which
 * would make inheritance vanishingly rare given max 5 flags each).
 *
 * Bias mechanism (single named constant, conservative): when a flag is in the
 * foal's predisposed set, the NUMERIC care-pattern thresholds for THAT flag are
 * relaxed by flagPredispositionBias (a multiplier on `>=` minimums and a
 * reciprocal widening on `<=` maximums). 0.85 = a 15% reduction in the required
 * care-pattern strength. Non-predisposed flags are evaluated with the unchanged
 * thresholds, so a foal with no parents / no parent flags behaves EXACTLY as
 * before (regression-safe). Predisposition only ever lowers a bar; it never
 * raises one and never sets `triggered` true on its own.
 */
export const flagPredispositionBias = 0.85;

/**
 * Relax a `>=` minimum threshold for a predisposed flag.
 * @param {number} threshold - The normal minimum required value.
 * @param {boolean} predisposed - Whether the foal is predisposed to this flag.
 * @returns {number} The (possibly relaxed) minimum. Predisposition lowers it.
 */
function relaxMin(threshold, predisposed) {
  return predisposed ? threshold * flagPredispositionBias : threshold;
}

/**
 * Relax a `<=` maximum threshold for a predisposed flag (negative-flag bars).
 * Predisposition makes a negative flag slightly easier to reach too, by widening
 * the ceiling the same 15%.
 * @param {number} threshold - The normal maximum allowed value.
 * @param {boolean} predisposed - Whether the foal is predisposed to this flag.
 * @returns {number} The (possibly widened) maximum.
 */
function relaxMax(threshold, predisposed) {
  return predisposed ? threshold / flagPredispositionBias : threshold;
}

/**
 * Evaluate trigger conditions for a specific flag
 * @param {Object} flagDefinition - Flag definition object
 * @param {Object} carePatterns - Care pattern analysis results
 * @param {boolean} [predisposed=false] - Equoria-yzqhj.4: whether the foal is
 *   predisposed to this flag via parent inheritance. When true, this flag's
 *   numeric care thresholds are relaxed by flagPredispositionBias. Defaults to
 *   false so every existing caller (and unknown-flag path) is unchanged.
 * @returns {Object} Evaluation result with trigger status and score
 */
export function evaluateFlagTriggers(flagDefinition, carePatterns, predisposed = false) {
  const conditions = flagDefinition.triggerConditions;
  const evaluationResults = {};
  const _totalScore = 0;
  const _maxScore = 0;
  let triggered = false;

  // Evaluate each trigger condition based on flag type
  switch (flagDefinition.name) {
    case 'brave':
      triggered = evaluateBraveTriggers(conditions, carePatterns, evaluationResults, predisposed);
      break;
    case 'confident':
      triggered = evaluateConfidentTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'affectionate':
      triggered = evaluateAffectionateTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'resilient':
      triggered = evaluateResilientTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'fearful':
      triggered = evaluateFearfulTriggers(conditions, carePatterns, evaluationResults, predisposed);
      break;
    case 'insecure':
      triggered = evaluateInsecureTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'aloof':
      triggered = evaluateAloofTriggers(conditions, carePatterns, evaluationResults, predisposed);
      break;
    case 'skittish':
      triggered = evaluateSkittishTriggers(
        conditions,
        carePatterns,
        evaluationResults,
        predisposed,
      );
      break;
    case 'fragile':
      triggered = evaluateFragileTriggers(conditions, carePatterns, evaluationResults, predisposed);
      break;
    default:
      logger.warn(`[flagEvaluationEngine] Unknown flag type: ${flagDefinition.name}`);
  }

  // Calculate overall score
  const conditionCount = Object.keys(evaluationResults).length;
  const metConditions = Object.values(evaluationResults).filter(Boolean).length;
  const score = conditionCount > 0 ? metConditions / conditionCount : 0;

  return {
    triggered,
    score,
    conditions: evaluationResults,
  };
}

// Flag-specific trigger evaluation functions.
//
// Equoria-yzqhj.4: each takes a `predisposed` flag. When false (the default for
// every existing caller and parentless foals), the NUMERIC comparisons below
// reproduce the EXACT canonical thresholds from carePatternAnalysis.mjs — so
// behavior is byte-identical to before this change. When true, the relevant
// `>=` minimums are relaxed via relaxMin() (predisposed foals need ~15% less
// care strength) and `<=` maximums widened via relaxMax(). Predisposition only
// lowers a bar; it never sets `triggered` true on its own (care must still
// drive the qualifying inputs — e.g. brave still requires a calm groom present
// and at least one novelty-with-support event).
//
// Canonical threshold sources (mirrored here so the bias can scale them):
//   brave        novelty noveltyWithSupport >= 3, bondScore >= 30
//   confident    positiveInteractions >= 10, bondScore >= 40; consecutiveDays >= 7, bondScore >= 40
//   affectionate daysWithInteraction >= 7, bondScore >= 50; qualityInteractions >= 5
//   resilient    stressWithSupport >= 3; stressEvents >= 2
//   fearful      fearEvents >= 2; bondScore <= 20; noveltyWithSupport === 0
//   insecure     daysWithoutCare >= 4 & bondScore <= 25; OR poorQualityInteractions >= 3
//   aloof        interactions < 3 & bondScore <= 30; positiveInteractions <= 2
//   skittish     startleEvents >= 2; (noveltyWithSupport === 0 OR bondScore <= 25)
//   fragile      stressEvents >= 3 & stressWithSupport === 0; recoveryEvents === 0

function evaluateBraveTriggers(conditions, patterns, results, predisposed = false) {
  results.noveltyExposure =
    patterns.noveltyExposure.noveltyWithSupport >= relaxMin(3, predisposed) &&
    patterns.bondingPatterns.currentBondScore >= relaxMin(30, predisposed);
  results.bondScore = patterns.bondingPatterns.currentBondScore >= relaxMin(30, predisposed);
  results.calmGroomPresent = patterns.noveltyExposure.calmGroomPresent;

  return results.noveltyExposure && results.bondScore && results.calmGroomPresent;
}

function evaluateConfidentTriggers(conditions, patterns, results, predisposed = false) {
  results.consistentCare =
    patterns.consistentCare.consecutiveDaysWithCare >= relaxMin(7, predisposed) &&
    patterns.bondingPatterns.currentBondScore >= relaxMin(40, predisposed);
  results.positiveInteractions =
    patterns.bondingPatterns.positiveInteractions >= relaxMin(10, predisposed) &&
    patterns.bondingPatterns.currentBondScore >= relaxMin(40, predisposed);

  return results.consistentCare && results.positiveInteractions;
}

function evaluateAffectionateTriggers(conditions, patterns, results, predisposed = false) {
  results.dailyGrooming =
    patterns.bondingPatterns.daysWithInteraction >= relaxMin(7, predisposed) &&
    patterns.bondingPatterns.currentBondScore >= relaxMin(50, predisposed);
  results.humanInteraction =
    patterns.consistentCare.qualityInteractions >= relaxMin(5, predisposed);

  return results.dailyGrooming && results.humanInteraction;
}

function evaluateResilientTriggers(conditions, patterns, results, predisposed = false) {
  results.stressRecovery = patterns.stressManagement.stressWithSupport >= relaxMin(3, predisposed);
  results.moderateStress = patterns.stressManagement.stressEvents >= relaxMin(2, predisposed);

  return results.stressRecovery && results.moderateStress;
}

function evaluateFearfulTriggers(conditions, patterns, results, predisposed = false) {
  results.fearEvents = patterns.noveltyExposure.fearEvents >= relaxMin(2, predisposed);
  results.lowBond = patterns.bondingPatterns.currentBondScore <= relaxMax(20, predisposed);
  results.noSupport = patterns.noveltyExposure.noveltyWithSupport === 0;

  return results.fearEvents && results.lowBond && results.noSupport;
}

function evaluateInsecureTriggers(conditions, patterns, results, predisposed = false) {
  results.neglect =
    patterns.neglectPatterns.maxConsecutiveDaysWithoutCare >= relaxMin(4, predisposed) &&
    patterns.neglectPatterns.currentBondScore <= relaxMax(25, predisposed);
  results.inconsistentCare =
    patterns.neglectPatterns.poorQualityInteractions >= relaxMin(3, predisposed);

  return results.neglect || results.inconsistentCare;
}

function evaluateAloofTriggers(conditions, patterns, results, predisposed = false) {
  // Canonical meetsAloofThreshold = totalInteractions < 3 && bondScore <= 30.
  // A `< N` ceiling is widened for predisposition the same way a `<= N` ceiling
  // is (relaxMax), so a predisposed foal tolerates slightly more interaction.
  results.limitedInteraction =
    patterns.consistentCare.totalInteractions < relaxMax(3, predisposed) &&
    patterns.neglectPatterns.currentBondScore <= relaxMax(30, predisposed);
  results.lowEngagement = patterns.bondingPatterns.positiveInteractions <= relaxMax(2, predisposed);

  return results.limitedInteraction && results.lowEngagement;
}

function evaluateSkittishTriggers(conditions, patterns, results, predisposed = false) {
  results.startleEvents = patterns.environmentalFactors.startleEvents >= relaxMin(2, predisposed);
  results.noGroomPresent = patterns.noveltyExposure.noveltyWithSupport === 0;
  results.lowBond = patterns.bondingPatterns.currentBondScore <= relaxMax(25, predisposed);

  return results.startleEvents && (results.noGroomPresent || results.lowBond);
}

function evaluateFragileTriggers(conditions, patterns, results, predisposed = false) {
  results.multipleStressSpikes =
    patterns.stressManagement.stressEvents >= relaxMin(3, predisposed) &&
    patterns.stressManagement.stressWithSupport === 0;
  results.inadequateSupport = patterns.stressManagement.recoveryEvents === 0;

  return results.multipleStressSpikes && results.inadequateSupport;
}
