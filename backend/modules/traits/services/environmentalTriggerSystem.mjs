/**
 * Environmental Trigger System Service
 *
 * Reads a horse's groom-interaction history and analyses the environmental
 * triggers it implies (Equoria-q4uem.7 S4):
 *
 *   loadEnvironmentalTriggerSnapshot(horseId)    two reads: the horse, its interactions
 *     -> detectTriggers / triggerThresholds / cumulativeExposure   pure projections
 *     -> environmentalReport (composes them once)
 *   generateEnvironmentalReport(horseId)          load + report
 *
 * Every projection of one snapshot shares one clock (`snapshot.now`). The
 * authored rule data lives in environmentalTriggerRules.mjs.
 * Nothing here writes a horse: the discrete-event temporary-flag writer
 * (applyEnvironmentalEventFlag, yzqhj.5) was removed with the temporary flags
 * (Equoria-kqdde; owner ruling 2026-10-22 on Equoria-q4uem.17).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import {
  BASE_TRIGGER_THRESHOLD,
  CUMULATIVE_EFFECTS_EVERY,
  DEFAULT_FACTOR_PRESENT_ABOVE,
  DEFAULT_QUALITY_SCORE,
  ENVIRONMENTAL_TRIGGERS,
  EXPOSURE_SCALING,
  FACTOR_PRESENCE_RULES,
  QUALITY_SCORES,
  THRESHOLD_AGE_BANDS,
  TRIGGER_DETECTION_THRESHOLD,
  TRIGGER_SCORE_RULES,
  TRIGGER_WINDOW_DAYS,
} from './environmentalTriggerRules.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

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
          bondScore: heldHorse.bondScore,
        }
      : client.horse.findUnique({
          where: { id: horseId },
          select: { dateOfBirth: true, bondScore: true },
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
        affectedTraits: triggerDef.traitsAffected,
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

/** Age- and bond-adjusted trigger threshold. Throws when the horse does not exist. */
export function triggerThresholds({ horseId, horse, now }) {
  if (!horse) {
    throw new Error(`Horse not found: ${horseId}`);
  }
  const ageInDays = getHorseAgeDays(horse.dateOfBirth, now);
  const baseThreshold = BASE_TRIGGER_THRESHOLD;
  const ageModifier = bandValue(THRESHOLD_AGE_BANDS, ageInDays);
  // Well-bonded horses are less sensitive.
  const bondModifier = Math.min(1.2, 1.0 + horse.bondScore / 100);
  const finalThreshold = baseThreshold * ageModifier * bondModifier;

  return {
    horseId,
    baseThreshold,
    ageInDays,
    ageModifier,
    bondModifier,
    finalThreshold: Math.max(0.1, Math.min(1.0, finalThreshold)),
    sensitivity: 1.0 - finalThreshold, // Inverse relationship
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
    });

    if ((index + 1) % CUMULATIVE_EFFECTS_EVERY === 0) {
      const recent = interactions.slice(Math.max(0, index - 4), index + 1);
      cumulativeEffects[`interaction${index + 1}`] = analyzeCumulativeEffects(recent);
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

/**
 * The full environmental report, every section from the one snapshot. It
 * describes what was detected; it gives no advice, windows or forecasts (owner
 * ruling 2026-10-07, Equoria-5nxw0).
 */
export function environmentalReport(snapshot) {
  const environmentalTriggers = detectTriggers(snapshot);
  const triggerThresholdsResult = triggerThresholds(snapshot);
  const exposure = cumulativeExposure(snapshot);

  return {
    horseId: snapshot.horseId,
    environmentalTriggers,
    triggerThresholds: triggerThresholdsResult,
    cumulativeExposure: exposure,
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
  const avgQuality =
    interactions.reduce((sum, i) => sum + (QUALITY_SCORES[i.quality] || DEFAULT_QUALITY_SCORE), 0) /
    interactions.length;

  return {
    bondingTrend: totalBonding > 0 ? 'positive' : totalBonding < 0 ? 'negative' : 'neutral',
    qualityAverage: avgQuality,
    interactionCount: interactions.length,
  };
}
