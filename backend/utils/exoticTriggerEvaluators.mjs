/**
 * Exotic-trait unlock evaluators: Shadow-Follower, Ghostwalker, Soulbonded,
 * Fey-Kissed, Dreamtwin. Split out of ultraRareTriggerEngine.mjs by Equoria-owj33
 * to bring that file under the 600-line source threshold; no behaviour change.
 * The engine owns horse loading and the name-to-evaluator dispatch; each function
 * here takes the already-loaded horse and resolves to whether the unlock fires.
 *
 * Log lines keep the `[ultraRareTriggerEngine]` prefix so existing log searches
 * and tests keep matching.
 */

import logger from './logger.mjs';
import {
  msPerDay,
  age2Days,
  age3Days,
  failedMilestoneScore,
  earlyBondMax,
  lateBondMin,
  lowYouthBondMax,
  soulbondedMinMilestones,
  soulbondedMinBond,
  soulbondedMinCareStreak,
  feyFoalAgeDays,
  feyMinFoalGrooms,
  feyMinQuality,
  twinSameDayMs,
  raisedTogetherTolerance,
  collectBondByAge,
  hasFlagMatching,
  textIncludesAny,
  uniqueGroomIds,
  parentHasUltraRareTrait,
} from './ultraRareTriggerHelpers.mjs';

/**
 * Shadow-Follower: Missed socialization + late bond formation
 */
export async function evaluateShadowFollowerConditions(horse, conditions) {
  try {
    // Missed socialization events — socialization milestones that FAILED (score
    // below threshold, PRD-04 §3.3 "Failed milestone scored below threshold").
    // Equoria-oey96.9: milestoneType/score are real; the prior code also read a
    // nonexistent log.notes and counted absent milestones by a fixed opportunity
    // count.
    const missedSocializationEvents = (horse.milestoneTraitLogs || []).filter(
      log =>
        textIncludesAny(log.milestoneType, ['social']) &&
        (typeof log.score === 'number' ? log.score : 100) < failedMilestoneScore,
    ).length;

    // Late bond formation (after age 2) — early bond low, late bond high, using the
    // real ageInDays on the bond-bearing logs (Equoria-oey96.9: replaces the age
    // proxy derived from the nonexistent per-day care-log count).
    const bondByAge = collectBondByAge(horse);
    const earlyBonds = bondByAge.filter(b => b.ageInDays < age2Days).map(b => b.bondScore);
    const lateBonds = bondByAge.filter(b => b.ageInDays >= age2Days).map(b => b.bondScore);
    const earlyMaxBond = earlyBonds.length ? Math.max(...earlyBonds) : 0;
    const lateMaxBond = lateBonds.length ? Math.max(...lateBonds) : 0;
    const lateBondFormation = earlyMaxBond < earlyBondMax && lateMaxBond >= lateBondMin;

    const meetsConditions =
      missedSocializationEvents >= conditions.missedSocializationEvents && lateBondFormation;

    logger.debug(
      `[ultraRareTriggerEngine] Shadow-Follower evaluation: missed socialization: ${missedSocializationEvents}, late bond: ${lateBondFormation}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Shadow-Follower conditions: ${error.message}`,
    );
    return false;
  }
}

/**
 * Ghostwalker: Low bond throughout youth + resilient flag
 */
export async function evaluateGhostwalkerConditions(horse, _conditions) {
  try {
    // Low bond throughout youth (first 3 years) — max bond among youth-age
    // bond-bearing logs < 30, AND the current bond snapshot < 30 (Equoria-oey96.9:
    // uses real ageInDays instead of the nonexistent per-day care-log relation).
    const bondByAge = collectBondByAge(horse);
    const youthBonds = bondByAge.filter(b => b.ageInDays < age3Days).map(b => b.bondScore);
    const maxBondInYouth = youthBonds.length ? Math.max(...youthBonds) : horse.bondScore || 0;
    const lowBondThroughoutYouth =
      maxBondInYouth < lowYouthBondMax && (horse.bondScore || 0) < lowYouthBondMax;

    // Resilient / survivor flag — epigeneticFlags is a String[] (Equoria-oey96.9:
    // FIX — the prior code read a per-flag object property that never exists on a
    // String[]).
    const resilientFlag = hasFlagMatching(horse.epigeneticFlags, ['resilient', 'survivor']);

    // Emotional detachment indicators — from milestone reasoning/finalTrait and
    // trait-history traitName (Equoria-oey96.9: real fields; prior code read a
    // nonexistent log.notes).
    const emotionalDetachment =
      (horse.milestoneTraitLogs || []).some(
        log =>
          textIncludesAny(log.reasoning, ['detached', 'withdrawn', 'isolated']) ||
          textIncludesAny(log.finalTrait, ['detached', 'withdrawn', 'isolated']),
      ) ||
      (horse.traitHistoryLogs || []).some(log =>
        textIncludesAny(log.traitName, ['detached', 'withdrawn', 'isolated']),
      );

    const meetsConditions = lowBondThroughoutYouth && resilientFlag && emotionalDetachment;

    logger.debug(
      `[ultraRareTriggerEngine] Ghostwalker evaluation: low bond: ${lowBondThroughoutYouth}, resilient flag: ${resilientFlag}, detachment: ${emotionalDetachment}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Ghostwalker conditions: ${error.message}`,
    );
    return false;
  }
}

/**
 * Soulbonded: Same groom for all milestones + >90 bond during each
 */
export async function evaluateSoulbondedConditions(horse, _conditions) {
  try {
    const milestones = horse.milestoneTraitLogs || [];

    // Same groom used for all milestones (Equoria-oey96.9: groomId is real on
    // MilestoneTraitLog).
    const milestoneGrooms = milestones
      .filter(log => log.groomId !== null && log.groomId !== undefined)
      .map(log => log.groomId);
    const uniqueMilestoneGrooms = [...new Set(milestoneGrooms)];
    const sameGroomAllMilestones =
      uniqueMilestoneGrooms.length === 1 && milestoneGrooms.length >= soulbondedMinMilestones;

    // >90 bond during each milestone (Equoria-oey96.9: bondScore is real on
    // MilestoneTraitLog).
    const milestoneBondScores = milestones
      .filter(log => typeof log.bondScore === 'number')
      .map(log => log.bondScore);
    const highBondAllMilestones =
      milestoneBondScores.length >= soulbondedMinMilestones &&
      milestoneBondScores.every(score => score >= soulbondedMinBond);

    // Perfect care history — SNAPSHOT on the horse's current uninterrupted grooming
    // streak (Equoria-oey96.9 / DECISION 2026-07-06: replaces the day-gap scan over
    // the nonexistent per-day care-log relation; daysGroomedInARow is the real
    // care-consistency counter).
    const perfectCareHistory = (horse.daysGroomedInARow || 0) >= soulbondedMinCareStreak;

    const meetsConditions = sameGroomAllMilestones && highBondAllMilestones && perfectCareHistory;

    logger.debug(
      `[ultraRareTriggerEngine] Soulbonded evaluation: same groom: ${sameGroomAllMilestones}, high bond: ${highBondAllMilestones}, perfect care: ${perfectCareHistory}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Soulbonded conditions: ${error.message}`,
    );
    return false;
  }
}

/**
 * Fey-Kissed: Both parents ultra-rare + perfect grooming history
 */
export async function evaluateFeyKissedConditions(horse, _conditions, registryKeys) {
  try {
    // Both parents carry an ultra-rare/exotic trait — via each parent's
    // ultraRareTraits JSON snapshot or trait-history names (Equoria-oey96.9).
    const bothParentsUltraRare =
      parentHasUltraRareTrait(horse.sire, registryKeys) &&
      parentHasUltraRareTrait(horse.dam, registryKeys);

    // Perfect foal-stage grooming — SNAPSHOT on the foal-stage groom interactions
    // (Equoria-oey96.9 / DECISION 2026-07-06: replaces the 300-daily-task check over
    // the nonexistent per-day care-log + groom-task-log relations). A perfect record
    // means a meaningful number of foal-stage interactions, all high quality.
    const birthMs = new Date(horse.dateOfBirth).getTime();
    const foalGrooms = (horse.groomInteractions || []).filter(i => {
      const taskMs = new Date(i.timestamp).getTime();
      if (Number.isNaN(taskMs) || Number.isNaN(birthMs)) {
        return false;
      }
      const ageAtTaskDays = (taskMs - birthMs) / msPerDay;
      return ageAtTaskDays <= feyFoalAgeDays;
    });
    const perfectGroomingHistory =
      foalGrooms.length >= feyMinFoalGrooms &&
      foalGrooms.every(
        i => (typeof i.qualityScore === 'number' ? i.qualityScore : 0) >= feyMinQuality,
      );

    const meetsConditions = bothParentsUltraRare && perfectGroomingHistory;

    logger.debug(
      `[ultraRareTriggerEngine] Fey-Kissed evaluation: both parents ultra-rare: ${bothParentsUltraRare}, perfect grooming: ${perfectGroomingHistory}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Fey-Kissed conditions: ${error.message}`,
    );
    return false;
  }
}

/**
 * Dreamtwin: Twin birth + raised together + same groom + matching flags
 */
export async function evaluateDreamtwinConditions(horse, _conditions) {
  try {
    // Twin birth — a full sibling (shares BOTH sire and dam) born within one day
    // (Equoria-oey96.9: derived full-siblings from getHorseWithHistory, NOT the
    // nonexistent same-parents siblings relation).
    const siblings = horse.fullSiblings || [];
    const horseBirthMs = new Date(horse.dateOfBirth).getTime();
    const twins = siblings.filter(sibling => {
      const siblingBirthMs = new Date(sibling.dateOfBirth).getTime();
      return (
        !Number.isNaN(siblingBirthMs) &&
        !Number.isNaN(horseBirthMs) &&
        Math.abs(siblingBirthMs - horseBirthMs) < twinSameDayMs
      );
    });

    const twinBirth = twins.length > 0;
    if (!twinBirth) {
      return false; // No twin, cannot have Dreamtwin trait
    }

    const [twin] = twins;

    // Raised together — SNAPSHOT on comparable groom-interaction volume between the
    // twins (Equoria-oey96.9 / DECISION 2026-07-06: replaces the count comparison
    // over the nonexistent per-day care-log relation).
    const horseInteractionCount = (horse.groomInteractions || []).length;
    const twinInteractionCount = (twin.groomInteractions || []).length;
    const raisedTogether =
      Math.abs(horseInteractionCount - twinInteractionCount) <= raisedTogetherTolerance;

    // Same single groom for both twins (Equoria-oey96.9: via groomInteractions,
    // NOT the nonexistent groom-task-log relation).
    const horseGrooms = uniqueGroomIds(horse.groomInteractions);
    const twinGrooms = uniqueGroomIds(twin.groomInteractions);
    const sameGroom =
      horseGrooms.length === 1 && twinGrooms.length === 1 && horseGrooms[0] === twinGrooms[0];

    // Matching epigenetic flags — epigeneticFlags is a String[] (Equoria-oey96.9:
    // FIX — the prior code read a per-flag object property, always undefined).
    const horseFlags = Array.isArray(horse.epigeneticFlags) ? horse.epigeneticFlags : [];
    const twinFlags = Array.isArray(twin.epigeneticFlags) ? twin.epigeneticFlags : [];
    const matchingFlags =
      horseFlags.length > 0 && horseFlags.every(flag => twinFlags.includes(flag));

    const meetsConditions = twinBirth && raisedTogether && sameGroom && matchingFlags;

    logger.debug(
      `[ultraRareTriggerEngine] Dreamtwin evaluation: twin birth: ${twinBirth}, raised together: ${raisedTogether}, same groom: ${sameGroom}, matching flags: ${matchingFlags}, meets conditions: ${meetsConditions}`,
    );

    return meetsConditions;
  } catch (error) {
    logger.error(
      `[ultraRareTriggerEngine] Error evaluating Dreamtwin conditions: ${error.message}`,
    );
    return false;
  }
}
