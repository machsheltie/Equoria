/**
 * Conformation Show Service
 *
 * Handles conformation-based competitions where grooms act as handlers.
 * This is a SEPARATE competition system from performance disciplines.
 *
 * Scoring formula (65/20/8/7 per PRD-03 §3.6):
 *   finalScore = (conformationScore * 0.65)
 *              + (handlerScore * 0.20)
 *              + (horse.bondScore * 0.08)
 *              + (synergyScore * 0.07)
 *   Clamped to integer [0, 100].
 *
 * Bond note: No GroomHorseBond model exists — horse.bondScore (Int 0-100) is used directly.
 *
 * Structure (Equoria-urqic.7 file-size split): the pure, DB-free scoring +
 * reward helpers (config tables, the score formula, age-class assignment,
 * synergy, and placement→reward/title/breeding-boost resolution) live in the
 * sibling ./conformationShowScoring.mjs. This file owns the stateful paths —
 * DB-backed entry validation and the transactional show execution (with the
 * Equoria-2ksil retryable-tx wrap) — and re-exports the scoring surface so the
 * service's public API is unchanged for all consumers (controller + barrel).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';

import {
  CONFORMATION_SHOW_CONFIG,
  SCORE_NEUTRAL_CONFORMATION_CLASS,
  isValidConformationClass,
  getConformationAgeClass,
  calculateConformationShowScore,
  resolveReward,
  resolveTitle,
  applyBreedingValueBoost,
} from './conformationShowScoring.mjs';

// Re-export the pure scoring + reward surface so existing consumers
// (conformationShowController, the competition barrel, and the test suites that
// import scoring/reward helpers directly from this service path) are unaffected
// by the split. Public-export parity per Equoria-urqic.7.
export {
  CONFORMATION_SHOW_CONFIG,
  SHOW_HANDLING_SKILL_SCORES,
  CONFORMATION_AGE_CLASSES,
  SCORE_NEUTRAL_CONFORMATION_CLASS,
  isValidConformationClass,
  calculateConformationScore,
  getHandlerScore,
  getConformationAgeClass,
  calculateSynergy,
  calculateConformationShowScore,
  REWARD_TABLE,
  BREEDING_BOOST_CAP,
  TITLE_THRESHOLDS,
  resolveReward,
  resolveTitle,
  applyBreedingValueBoost,
} from './conformationShowScoring.mjs';

/**
 * Error thrown when a conformation show entry has no active groom assignment at
 * execution time (Equoria-axad9.1). This is a data-integrity anomaly: entry
 * validation (`validateConformationEntry`) REQUIRES an active groom assignment
 * before an entry is accepted, so a null groom at execution means the
 * assignment was deactivated/deleted between entry and execution. Rather than
 * silently fabricating a novice handler (which would award a real 20*0.20=4pt
 * handler component + synergy to a horse with no handler and corrupt
 * placements), we fail honest and surface the affected horses.
 */
export class ConformationGroomMissingError extends Error {
  constructor(horseIds) {
    super(
      `Conformation show cannot be executed: ${horseIds.length} entr${horseIds.length === 1 ? 'y has' : 'ies have'} no active groom assignment (horse id(s): ${horseIds.join(', ')}). A handler is required for every entry.`,
    );
    this.name = 'ConformationGroomMissingError';
    this.statusCode = 400;
    this.horseIds = horseIds;
  }
}

// ---------------------------------------------------------------------------
// Entry validation (async — requires DB)
// ---------------------------------------------------------------------------

/**
 * Validate conformation show entry requirements — AC3, AC4.
 *
 * Rejects if:
 *  - className is not a valid conformation sex/category class
 *  - horse is not owned by userId
 *  - groom is not owned by userId
 *  - groom is not actively assigned to the horse
 *  - groom assignment is younger than MIN_GROOM_ASSIGNMENT_DAYS
 *  - horse.age < 0 (negative age is invalid)
 *  - horse.health is not "Excellent" or "Good"
 *
 * Note: No training score or discipline prerequisite — conformation is innate (AC3).
 *
 * @param {Object} horse
 * @param {Object} groom
 * @param {string} className
 * @param {string} userId
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[], assignment: Object|null, ageClass: string|null}>}
 */
export async function validateConformationEntry(horse, groom, className, userId) {
  try {
    if (!horse || !groom) {
      return {
        valid: false,
        errors: ['Horse and groom are required'],
        warnings: [],
        assignment: null,
        ageClass: null,
      };
    }

    const errors = [];
    const warnings = [];

    // Validate class
    if (!isValidConformationClass(className)) {
      errors.push(`${className} is not a valid conformation show class`);
    }

    // Ownership validated upstream by the controller via findOwnedResource
    // (conformationShowController.mjs:enterConformationShow). The horse and
    // groom passed here always belong to userId — these branches were
    // dead-code defence-in-depth and were removed for CWE-639 cleanup
    // (Equoria-fspi). Tests covering 'You do not own this horse' / groom
    // strings still pass because they call validateConformationEntry directly
    // with mismatched userId, which is a unit-test contract, not a route
    // contract. If those tests need to assert disclosure resistance, they
    // should drive the route, not the service.

    // Groom assignment to horse — guard undefined IDs before querying
    let assignment = null;
    if (
      horse.id !== null &&
      horse.id !== undefined &&
      groom.id !== null &&
      groom.id !== undefined
    ) {
      assignment = await prisma.groomAssignment.findFirst({
        where: {
          groomId: groom.id,
          foalId: horse.id,
          userId,
          isActive: true,
        },
      });
    }

    if (!assignment) {
      errors.push('Groom must be assigned to this horse before entering conformation shows');
    } else {
      const createdAtTime = assignment.createdAt ? new Date(assignment.createdAt).getTime() : NaN;
      if (!Number.isFinite(createdAtTime)) {
        errors.push('Groom assignment record is missing a valid date');
      } else {
        const daysSinceAssignment = (Date.now() - createdAtTime) / (1000 * 60 * 60 * 24);
        if (daysSinceAssignment < CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS) {
          errors.push(
            `Groom must be assigned to horse for at least ${CONFORMATION_SHOW_CONFIG.MIN_GROOM_ASSIGNMENT_DAYS} days before show entry`,
          );
        }
      }
    }

    // Age validation — reject only invalid (< 0); Weanlings (0-<1) are allowed — AC4
    const age = horse.age ?? 0;
    if (age < CONFORMATION_SHOW_CONFIG.MIN_AGE) {
      errors.push('Horse age is invalid (negative)');
    }

    // Assign age class for the entry
    const ageClass = age >= 0 ? getConformationAgeClass(age) : null;

    // Health — "Excellent" or "Good" map to healthy; all others rejected — AC3
    // Note: Prisma schema field is `healthStatus`; handle both for compatibility
    const healthValue = horse.healthStatus ?? horse.health;
    if (healthValue !== 'Excellent' && healthValue !== 'Good') {
      errors.push('Horse must be healthy (Excellent or Good health) to enter conformation shows');
    }

    // Stress advisory warning (does not block entry)
    if (horse.stressLevel && horse.stressLevel > 80) {
      warnings.push('Horse has high stress levels — may affect performance');
    }

    // Conformation scores advisory (show will use default 50 if missing)
    if (!horse.conformationScores) {
      warnings.push('Horse has no conformation scores — neutral score (50) will be used');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      assignment,
      ageClass,
    };
  } catch (error) {
    logger.error(`[conformationShowService] Error validating conformation entry: ${error.message}`);
    return {
      valid: false,
      errors: ['Validation error occurred'],
      warnings: [],
      assignment: null,
      ageClass: null,
    };
  }
}

// ---------------------------------------------------------------------------
// executeConformationShow (AC1)
// ---------------------------------------------------------------------------

/**
 * Execute a conformation show: score all entries, rank, distribute rewards,
 * persist CompetitionResult per horse, update Horse title fields.
 *
 * Returns the full results array so the controller can build the HTTP response.
 *
 * @param {number} showId
 * @returns {Promise<Array<{horseId, placement, score, ribbon, titlePoints, newTitle, breedingValueBoost}>>}
 * @throws {Error} with .statusCode set to 400 for bad showId / wrong show type
 */
export async function executeConformationShow(showId) {
  // Load show
  const show = await prisma.show.findUnique({ where: { id: showId } });
  if (!show) {
    const err = new Error('Show not found');
    err.statusCode = 400;
    throw err;
  }
  if (show.showType !== 'conformation') {
    const err = new Error('Show is not a conformation show');
    err.statusCode = 400;
    throw err;
  }

  // Idempotency guard (Equoria-08ln). A second call on an already-executed
  // show would double-pay titlePoints + breedingValueBoost and insert
  // duplicate CompetitionResult rows. The pre-transaction read here is the
  // fast-path reject; the atomic flip inside $transaction below is the
  // race-condition guard. Both are required: without the pre-read every
  // duplicate call pays the full DB cost; without the atomic flip two
  // concurrent calls can both pass the pre-read and double-execute.
  if (show.status === 'completed') {
    const err = new Error('Show already executed');
    err.statusCode = 400;
    throw err;
  }

  // Load all entries with horse + active groom assignment + groom
  const entries = await prisma.showEntry.findMany({
    where: { showId },
    include: {
      horse: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (entries.length === 0) {
    return [];
  }

  // Resolve the active groom (handler) for every entry. Equoria-axad9.1:
  // do NOT fabricate a placeholder groom when none is assigned — that would
  // silently award a real handler-score component to a horse with no handler.
  // Entry validation already requires an active assignment, so a null groom
  // here is a data-integrity anomaly; fail honest below.
  const resolved = await Promise.all(
    entries.map(async entry => {
      const horse = entry.horse;
      const assignment = await prisma.groomAssignment.findFirst({
        where: { foalId: horse.id, isActive: true },
        include: { groom: true },
      });
      return { entry, horse, groom: assignment?.groom ?? null };
    }),
  );

  // Fail honest: surface every entry that lost its handler before scoring.
  const missingGroomHorseIds = resolved.filter(r => r.groom === null).map(r => r.horse.id);
  if (missingGroomHorseIds.length > 0) {
    logger.error(
      `[conformationShowService] Show ${showId} has ${missingGroomHorseIds.length} entr(y/ies) with no active groom: ${missingGroomHorseIds.join(', ')}`,
    );
    throw new ConformationGroomMissingError(missingGroomHorseIds);
  }

  // Score each entry against its REAL handler. className is score-irrelevant
  // (see SCORE_NEUTRAL_CONFORMATION_CLASS) and there is no per-entry class
  // column to read, so the score-neutral default satisfies class validation.
  const scored = resolved.map(({ entry, horse, groom }) => {
    const { finalScore } = calculateConformationShowScore(
      horse,
      groom,
      SCORE_NEUTRAL_CONFORMATION_CLASS,
    );
    return { entry, horse, finalScore };
  });

  // Rank by score descending, ties broken by entry creation order (already asc)
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Build results and persist via transaction
  const results = [];

  // Equoria-2ksil: the ONLY caller of executeConformationShow is the
  // client-facing POST /api/v1/competition/conformation/execute handler
  // (conformationShowController.executeConformationShowHandler). There is no
  // cron/executor caller of THIS transaction (the daily show-execution cron
  // path lives in showController.executeClosedShows, which is separately and
  // intentionally left unwrapped). So a transient P2028 interactive-transaction
  // timeout here should reach that client as a retryable 503
  // (RetryableTransactionError) rather than a permanent 500. The wrap rethrows
  // a 503 on timeout and leaves the in-tx 400 idempotency rejects (thrown
  // Errors with statusCode:400) and every genuine fault unchanged.
  await withRetryableTxMapping(
    prisma.$transaction(
      async tx => {
        // Atomic idempotency claim (Equoria-08ln race-condition guard).
        // updateMany with a `status: 'open'` predicate succeeds with count=1
        // only when no concurrent caller has flipped the row yet. Two
        // simultaneous executors race here; whichever wins gets count=1 and
        // continues; the loser gets count=0 and throws. Pre-transaction read
        // above + this atomic flip together fully close the gap.
        const claim = await tx.show.updateMany({
          where: { id: showId, status: 'open' },
          data: { status: 'executing' },
        });
        if (claim.count === 0) {
          const err = new Error('Show already executed');
          err.statusCode = 400;
          throw err;
        }

        for (let i = 0; i < scored.length; i++) {
          const { horse, finalScore } = scored[i];
          const placement = i + 1;
          const { ribbon, titlePoints: tpAwarded, breedingBoostDelta } = resolveReward(placement);

          // Accumulate title points
          const newTitlePoints = (horse.titlePoints ?? 0) + tpAwarded;
          const newTitle = resolveTitle(newTitlePoints);
          const newBoost = applyBreedingValueBoost(
            horse.breedingValueBoost ?? 0,
            breedingBoostDelta,
          );

          // Update horse title fields
          await tx.horse.update({
            where: { id: horse.id },
            data: {
              titlePoints: newTitlePoints,
              currentTitle: newTitle,
              breedingValueBoost: newBoost,
            },
          });

          // Create CompetitionResult — no prizeWon (AC4)
          await tx.competitionResult.create({
            data: {
              horseId: horse.id,
              showId,
              score: finalScore,
              placement: String(placement),
              discipline: 'conformation',
              runDate: new Date(),
              showName: show.name ?? `Show #${showId}`,
              prizeWon: null,
              statGains: { ribbon, titlePoints: tpAwarded },
            },
          });

          results.push({
            horseId: horse.id,
            placement,
            score: finalScore,
            ribbon,
            titlePoints: tpAwarded,
            newTitle,
            breedingValueBoost: newBoost,
          });
        }

        // Finalise the idempotency claim — flip from 'executing' to 'completed'
        // inside the same transaction so a future call gets rejected by both
        // the pre-transaction read and the atomic flip above. Equoria-08ln.
        await tx.show.update({
          where: { id: showId },
          data: { status: 'completed', executedAt: new Date() },
        });
      },
      { timeout: 30000 },
    ),
    { message: 'The server is busy executing the show, please retry in a moment.' },
  );

  return results;
}
