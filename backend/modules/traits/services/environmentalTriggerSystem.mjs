/**
 * Environmental Trigger System Service
 *
 * Reads a horse's groom-interaction history and analyses the environmental
 * triggers it implies (Equoria-q4uem.7 S4):
 *
 *   loadEnvironmentalTriggerSnapshot(horseId)    two reads: the horse, its interactions
 *     -> detectTriggers / triggerThresholds / traitExpressionProbability /
 *        cumulativeExposure / criticalPeriodSensitivity   pure projections
 *     -> environmentalReport (composes them once)
 *   generateEnvironmentalReport(horseId)          load + report
 *
 * Every projection of one snapshot shares one clock (`snapshot.now`). The
 * authored rule data lives in environmentalTriggerRules.mjs.
 * applyEnvironmentalEventFlag is the discrete-event write path (yzqhj.5).
 */

import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import { applyTemporaryFlag } from './temporaryFlagSystem.mjs';
import {
  BASE_EXPRESSION_PROBABILITY,
  BASE_TRIGGER_THRESHOLD,
  CRITICAL_PERIOD_RECOMMENDATIONS,
  CRITICAL_PERIODS,
  CUMULATIVE_EFFECTS_EVERY,
  DEFAULT_FACTOR_PRESENT_ABOVE,
  DEFAULT_QUALITY_SCORE,
  ENVIRONMENTAL_EVENT_TO_TEMP_FLAG,
  ENVIRONMENTAL_TRIGGERS,
  EXPOSURE_SCALING,
  EXPRESSION_AGE_BANDS,
  EXPRESSION_LIKELIHOOD_BANDS,
  EXPRESSION_LIKELIHOOD_FALLBACK,
  FACTOR_PRESENCE_RULES,
  MINIMAL_SENSITIVITY,
  OUTSIDE_CRITICAL_PERIODS_RECOMMENDATION,
  QUALITY_SCORES,
  REPORT_RECOMMENDATIONS,
  REPORT_TRAITS,
  RESIDUAL_SENSITIVITY,
  RESIDUAL_SENSITIVITY_DAYS,
  STRESS_AMPLIFIED_TRAITS,
  STRESS_DAMPENED_TRAITS,
  THRESHOLD_AGE_BANDS,
  TRIGGER_DETECTION_THRESHOLD,
  TRIGGER_SCORE_RULES,
  TRIGGER_WINDOW_DAYS,
} from './environmentalTriggerRules.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Record a discrete environmental event for a horse and, when the event maps to
 * a temporary epigenetic flag, apply that (expiring) flag (Equoria-yzqhj.5).
 * Persistence, dedup and expiry belong to temporaryFlagSystem.applyTemporaryFlag,
 * which writes only `Horse.temporaryEpigeneticFlags`. Unknown event types are a
 * no-op (null): fail-closed, no fabricated flag.
 *
 * @param {number} horseId
 * @param {string} eventType - 'startle' | 'routine_change'
 * @param {{source?: string, now?: Date}} [opts]
 * @returns {Promise<{flag:string, expiresAt:string, source:string}|null>}
 */
export async function applyEnvironmentalEventFlag(horseId, eventType, { source, now } = {}) {
  const flag = ENVIRONMENTAL_EVENT_TO_TEMP_FLAG[eventType];
  if (!flag) {
    logger.info(
      `[environmentalTriggerSystem.applyEnvironmentalEventFlag] Event '${eventType}' ` +
        `for horse ${horseId} maps to no temporary flag — no-op`,
    );
    return null;
  }
  const result = await applyTemporaryFlag(horseId, flag, {
    source: source ?? `environmental_event:${eventType}`,
    now,
  });
  return { flag: result.flag, expiresAt: result.expiresAt, source: result.source };
}

/**
 * Everything the trigger analysis reads, read once: the horse (null when it does
 * not exist) and all its groom interactions, oldest first.
 *
 * A caller that already holds the horse row (requireOwnership's req.horse) passes
 * it as `options.horse` and the horse is not read again (Equoria-glgyw).
 * @param {number} horseId
 * @param {{now?: Date, client?: object, horse?: object}} [options]
 * @returns {Promise<Readonly<{horseId: number, horse: object|null, interactions: object[], now: Date}>>}
 */
export async function loadEnvironmentalTriggerSnapshot(
  horseId,
  { now = new Date(), client = prisma, horse: heldHorse } = {},
) {
  const [horse, interactions] = await Promise.all([
    heldHorse
      ? {
          dateOfBirth: heldHorse.dateOfBirth,
          stressLevel: heldHorse.stressLevel,
          bondScore: heldHorse.bondScore,
        }
      : client.horse.findUnique({
          where: { id: horseId },
          select: { dateOfBirth: true, stressLevel: true, bondScore: true },
        }),
    client.groomInteraction.findMany({
      where: { foalId: horseId },
      include: { groom: { select: { epigeneticInfluenceType: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  return Object.freeze({ horseId, horse, interactions: Object.freeze(interactions), now });
}

/** Load once, then the full report. */
export async function generateEnvironmentalReport(horseId, options) {
  return environmentalReport(await loadEnvironmentalTriggerSnapshot(horseId, options));
}

/** Environmental triggers detected in the last TRIGGER_WINDOW_DAYS of interactions. */
export function detectTriggers({ horseId, interactions, now }) {
  const since = new Date(now.getTime() - TRIGGER_WINDOW_DAYS * DAY_MS);
  // Newest first, as the window was always read.
  const recent = interactions.filter(i => i.createdAt >= since).reverse();

  if (recent.length === 0) {
    return {
      horseId,
      detectedTriggers: [],
      triggerStrength: 0,
      environmentalFactors: [],
      analysisWindow: TRIGGER_WINDOW_DAYS,
      interactionCount: 0,
    };
  }

  const detectedTriggers = [];
  const environmentalFactors = [];
  let totalTriggerStrength = 0;

  Object.entries(ENVIRONMENTAL_TRIGGERS).forEach(([triggerType, triggerDef]) => {
    const triggerScore = scoreTrigger(recent, TRIGGER_SCORE_RULES[triggerType]);
    if (triggerScore > TRIGGER_DETECTION_THRESHOLD) {
      detectedTriggers.push({
        type: triggerType,
        name: triggerDef.name,
        strength: triggerScore,
        affectedTraits: triggerDef.traits_affected,
        factors: presentFactors(recent, triggerDef.factors),
      });
      totalTriggerStrength += triggerScore;
      environmentalFactors.push(...triggerDef.factors);
    }
  });

  return {
    horseId,
    detectedTriggers,
    triggerStrength: totalTriggerStrength / detectedTriggers.length || 0,
    environmentalFactors: [...new Set(environmentalFactors)],
    analysisWindow: TRIGGER_WINDOW_DAYS,
    interactionCount: recent.length,
    analysisTimestamp: now,
  };
}

/** Age-, stress- and bond-adjusted trigger threshold. Throws when the horse does not exist. */
export function triggerThresholds({ horseId, horse, now }) {
  if (!horse) {
    throw new Error(`Horse not found: ${horseId}`);
  }
  const ageInDays = getHorseAgeDays(horse.dateOfBirth, now);
  const baseThreshold = BASE_TRIGGER_THRESHOLD;
  const ageModifier = bandValue(THRESHOLD_AGE_BANDS, ageInDays);
  // Stressed horses are more sensitive; well-bonded horses less.
  const stressModifier = Math.max(0.5, 1.0 - horse.stressLevel / 20);
  const bondModifier = Math.min(1.2, 1.0 + horse.bondScore / 100);
  const finalThreshold = baseThreshold * ageModifier * stressModifier * bondModifier;

  return {
    horseId,
    baseThreshold,
    ageInDays,
    ageModifier,
    stressModifier,
    bondModifier,
    finalThreshold: Math.max(0.1, Math.min(1.0, finalThreshold)),
    sensitivity: 1.0 - finalThreshold, // Inverse relationship
  };
}

/**
 * Probability that a trait is expressed, from the detected triggers, the horse's
 * age and its stress. Throws when the horse does not exist.
 * `detected` lets a caller that already ran detectTriggers reuse it.
 */
export function traitExpressionProbability(
  snapshot,
  traitName,
  detected = detectTriggers(snapshot),
) {
  const { horseId, horse, now } = snapshot;
  if (!horse) {
    throw new Error(`Horse not found: ${horseId}`);
  }
  const baseProbability = BASE_EXPRESSION_PROBABILITY;

  let environmentalModifier = 1.0;
  detected.detectedTriggers.forEach(trigger => {
    if (trigger.affectedTraits.includes(traitName)) {
      environmentalModifier += trigger.strength * 0.5; // Up to 50% per relevant trigger
    }
  });

  const ageModifier = bandValue(EXPRESSION_AGE_BANDS, getHorseAgeDays(horse.dateOfBirth, now));

  let stressModifier = 1.0;
  if (STRESS_AMPLIFIED_TRAITS.includes(traitName)) {
    stressModifier = 1.0 + horse.stressLevel / 20;
  } else if (STRESS_DAMPENED_TRAITS.includes(traitName)) {
    stressModifier = Math.max(0.5, 1.0 - horse.stressLevel / 30);
  }

  const finalProbability = Math.max(
    0,
    Math.min(1, baseProbability * environmentalModifier * ageModifier * stressModifier),
  );
  const band = EXPRESSION_LIKELIHOOD_BANDS.find(([min]) => finalProbability >= min);

  return {
    horseId,
    traitName,
    baseProbability,
    environmentalModifier,
    ageModifier,
    stressModifier,
    finalProbability,
    expressionLikelihood: band ? band[1] : EXPRESSION_LIKELIHOOD_FALLBACK,
    relevantTriggers: detected.detectedTriggers.filter(t => t.affectedTraits.includes(traitName)),
    analysisTimestamp: now,
  };
}

/** Exposure accumulated over every interaction, oldest first. */
export function cumulativeExposure({ horseId, interactions, now }) {
  if (interactions.length === 0) {
    return {
      horseId,
      totalExposure: 0,
      exposureByType: {},
      exposureTimeline: [],
      cumulativeEffects: {},
    };
  }

  let totalExposure = 0;
  const exposureByType = {};
  const exposureTimeline = [];
  const cumulativeEffects = {};

  interactions.forEach((interaction, index) => {
    const exposureValue = interactionExposure(interaction);
    totalExposure += exposureValue;

    const { taskType } = interaction;
    if (!exposureByType[taskType]) {
      exposureByType[taskType] = 0;
    }
    exposureByType[taskType] += exposureValue;

    exposureTimeline.push({
      date: interaction.createdAt,
      taskType,
      exposureValue,
      cumulativeExposure: totalExposure,
      bondingChange: interaction.bondingChange,
      stressChange: interaction.stressChange,
    });

    if ((index + 1) % CUMULATIVE_EFFECTS_EVERY === 0) {
      const recent = interactions.slice(Math.max(0, index - 4), index + 1);
      cumulativeEffects[`interaction_${index + 1}`] = analyzeCumulativeEffects(recent);
    }
  });

  return {
    horseId,
    totalExposure,
    exposureByType,
    exposureTimeline,
    cumulativeEffects,
    analysisWindow: interactions.length,
    analysisTimestamp: now,
  };
}

/** Sensitivity from the critical developmental periods the horse is in (or just left). */
export function criticalPeriodSensitivity({ horseId, horse, now }) {
  const currentAge = getHorseAgeDays(horse.dateOfBirth, now);
  const activeWindows = CRITICAL_PERIODS.filter(
    period => currentAge >= period.start && currentAge <= period.end,
  );

  let sensitivityLevel;
  if (activeWindows.length > 0) {
    sensitivityLevel = Math.max(...activeWindows.map(window => window.sensitivity));
  } else {
    const daysSinceLastPeriod = Math.min(
      ...CRITICAL_PERIODS.map(period =>
        currentAge > period.end ? currentAge - period.end : Infinity,
      ),
    );
    sensitivityLevel =
      daysSinceLastPeriod < RESIDUAL_SENSITIVITY_DAYS ? RESIDUAL_SENSITIVITY : MINIMAL_SENSITIVITY;
  }

  const recommendations = activeWindows.flatMap(
    window => CRITICAL_PERIOD_RECOMMENDATIONS[window.name] ?? [],
  );
  if (recommendations.length === 0) {
    recommendations.push(OUTSIDE_CRITICAL_PERIODS_RECOMMENDATION);
  }

  return {
    horseId,
    currentAge,
    criticalPeriods: CRITICAL_PERIODS,
    activeWindows,
    sensitivityLevel,
    recommendations,
    analysisTimestamp: now,
  };
}

/** The full environmental report, every section from the one snapshot. */
export function environmentalReport(snapshot) {
  const environmentalTriggers = detectTriggers(snapshot);
  const triggerThresholdsResult = triggerThresholds(snapshot);
  const exposure = cumulativeExposure(snapshot);
  const criticalPeriods = criticalPeriodSensitivity(snapshot);
  const traitExpressionProbabilities = REPORT_TRAITS.map(trait =>
    traitExpressionProbability(snapshot, trait, environmentalTriggers),
  );

  return {
    horseId: snapshot.horseId,
    environmentalTriggers,
    triggerThresholds: triggerThresholdsResult,
    traitExpressionProbabilities,
    cumulativeExposure: exposure,
    criticalPeriodSensitivity: criticalPeriods,
    recommendations: reportRecommendations(
      environmentalTriggers,
      triggerThresholdsResult,
      criticalPeriods,
      traitExpressionProbabilities,
    ),
    reportTimestamp: snapshot.now,
  };
}

// ===== RULE INTERPRETATION =====

function fieldValue(interaction, field) {
  return field.split('.').reduce((value, key) => value?.[key], interaction);
}

function holds({ field, op, value }, interaction) {
  const actual = fieldValue(interaction, field);
  switch (op) {
    case 'eq':
      return actual === value;
    case 'in':
      return value.includes(actual);
    case 'gt':
      return actual > value;
    case 'lt':
      return actual < value;
    case 'lte':
      return actual <= value;
    default:
      throw new Error(`Unknown trigger rule operator: ${op}`);
  }
}

function bandValue(bands, x) {
  return bands.find(([max]) => x <= max)[1];
}

// Average points per interaction that scored at all (points summed in rule order).
function scoreTrigger(interactions, rules) {
  let score = 0;
  let relevantInteractions = 0;
  interactions.forEach(interaction => {
    let interactionScore = 0;
    for (const [condition, points] of rules) {
      if (holds(condition, interaction)) {
        interactionScore += points;
      }
    }
    if (interactionScore > 0) {
      score += interactionScore;
      relevantInteractions++;
    }
  });
  return relevantInteractions > 0 ? score / relevantInteractions : 0;
}

function presentFactors(interactions, possibleFactors) {
  return possibleFactors.filter(factor => {
    const rule = FACTOR_PRESENCE_RULES[factor];
    if (!rule) {
      return Math.random() > DEFAULT_FACTOR_PRESENT_ABOVE; // WS7-Q2: unruled factors are a random draw
    }
    if (rule.anyInteraction) {
      return interactions.some(i => rule.anyInteraction.every(condition => holds(condition, i)));
    }
    if (rule.distinctGroomsAbove !== undefined) {
      return new Set(interactions.map(i => i.groomId)).size > rule.distinctGroomsAbove;
    }
    if (rule.countBelow !== undefined) {
      return interactions.length < rule.countBelow;
    }
    if (rule.countAbove !== undefined) {
      return interactions.length > rule.countAbove;
    }
    throw new Error(`Unknown factor presence rule for ${factor}: ${JSON.stringify(rule)}`);
  });
}

function interactionExposure(interaction) {
  let exposure = interaction.duration / 60; // Base exposure in hours
  for (const [condition, factor] of EXPOSURE_SCALING) {
    if (holds(condition, interaction)) {
      exposure *= factor;
    }
  }
  return exposure;
}

function analyzeCumulativeEffects(interactions) {
  const totalBonding = interactions.reduce((sum, i) => sum + (i.bondingChange || 0), 0);
  const totalStress = interactions.reduce((sum, i) => sum + (i.stressChange || 0), 0);
  const avgQuality =
    interactions.reduce((sum, i) => sum + (QUALITY_SCORES[i.quality] || DEFAULT_QUALITY_SCORE), 0) /
    interactions.length;

  return {
    bondingTrend: totalBonding > 0 ? 'positive' : totalBonding < 0 ? 'negative' : 'neutral',
    stressTrend: totalStress > 0 ? 'increasing' : totalStress < 0 ? 'decreasing' : 'stable',
    qualityAverage: avgQuality,
    interactionCount: interactions.length,
  };
}

function reportRecommendations(triggers, thresholds, criticalPeriod, traitProbabilities) {
  const {
    highSensitivity,
    strongTrigger,
    criticalPeriod: critical,
    highProbabilityTraits,
  } = REPORT_RECOMMENDATIONS;
  const recommendations = [];
  if (thresholds.sensitivity > highSensitivity.above) {
    recommendations.push(highSensitivity.text);
  }
  triggers.detectedTriggers.forEach(trigger => {
    if (trigger.strength > strongTrigger.above) {
      recommendations.push(strongTrigger.text.replace('{trigger}', trigger.name.toLowerCase()));
    }
  });
  if (criticalPeriod.sensitivityLevel > critical.above) {
    recommendations.push(critical.text);
  }
  const highProbTraits = traitProbabilities.filter(
    t => t.finalProbability > highProbabilityTraits.above,
  );
  if (highProbTraits.length > 0) {
    recommendations.push(
      highProbabilityTraits.text.replace(
        '{traits}',
        highProbTraits.map(t => t.traitName).join(', '),
      ),
    );
  }
  return recommendations;
}
