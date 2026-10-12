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
import { settleShowFeeEscrowInTx } from '../shows/showEscrowTx.mjs';

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
 *  - groom is not on userId's staff (Equoria-ypb7d.2: `Groom.userId` is an
 *    engagement, not ownership — players never own grooms)
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
    // groom passed here are always the caller's own horse and a groom on the caller's
    // own STAFF (Equoria-ypb7d.2: engagement, not ownership — this said the groom
    // "always belong to userId") — these branches were
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
// executeConformationShow — nightly settlement of one due show (AC1)
// ---------------------------------------------------------------------------

/**
 * Thrown when a conformation show is asked to settle before its closeDate
 * (Equoria-mwjst). Owner ruling 2026-10-05: conformation shows run exactly 7
 * days from creation and are settled by the nightly show job — never early. A
 * show with no closeDate has no due time and never settles.
 */
export class ConformationShowNotDueError extends Error {
  constructor(showId, closeDate) {
    super(
      closeDate
        ? `Conformation show ${showId} is not due for settlement until ${new Date(closeDate).toISOString()}`
        : `Conformation show ${showId} has no closing date, so it is not due for settlement`,
    );
    this.name = 'ConformationShowNotDueError';
    this.statusCode = 409;
    this.showId = showId;
  }
}

/**
 * Thrown when the show was already settled, or another settlement claimed it
 * first (Equoria-08ln idempotency). Message and 400 status are the established
 * contract; the nightly executor reads this as "another run won", not a fault.
 */
export class ConformationShowAlreadySettledError extends Error {
  constructor(showId) {
    super('Show already executed');
    this.name = 'ConformationShowAlreadySettledError';
    this.statusCode = 400;
    this.showId = showId;
  }
}

/**
 * Settle one due conformation show: score every entry against its real
 * handler, rank, award ribbons, title points, titles and breeding-value boosts,
 * write a CompetitionResult per horse (no prize money, AC4), complete the show,
 * and pay its entry-fee escrow to the creator (or burn it).
 *
 * The production caller is the nightly executor (showController
 * .executeClosedShows). The host-triggered POST /execute that used to call this
 * on any open show was removed (Equoria-mwjst).
 *
 * Exactly-once and on time — ONE transaction (Equoria-08ln + Equoria-mwjst):
 *   1. the atomic claim `open → executing`, WHERE the show is still open, is a
 *      conformation show AND its closeDate has passed. The due predicate is in
 *      the same statement as the state transition, so neither an early call
 *      nor a concurrent second settlement can get past it;
 *   2. the entries are read AFTER the claim, on the transaction, so the scored
 *      set is the final one;
 *   3. rewards, results, the completion write and the fee-escrow settlement
 *      follow on the same transaction. Any failure (e.g. a missing handler)
 *      rolls ALL of it back, claim included: the show stays open, unscored and
 *      unpaid, and the next nightly run tries again.
 *
 * @param {number} showId
 * @param {{ now?: Date }} [options] - the settlement clock (the executor's run time)
 * @returns {Promise<Array<{horseId, placement, score, ribbon, titlePoints, newTitle, breedingValueBoost}>>}
 * @throws {Error} statusCode 400 for a missing or non-conformation show
 * @throws {ConformationShowAlreadySettledError} already settled or claimed
 * @throws {ConformationShowNotDueError} closeDate has not passed
 * @throws {ConformationGroomMissingError} an entry has no active handler
 */
export async function executeConformationShow(showId, { now = new Date() } = {}) {
  // Fast-path reads only; the claim inside the transaction is the authority.
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
  if (show.status !== 'open') {
    throw new ConformationShowAlreadySettledError(showId);
  }
  if (!show.closeDate || new Date(show.closeDate) > now) {
    throw new ConformationShowNotDueError(showId, show.closeDate);
  }

  // Equoria-2ksil: a transient P2028 interactive-transaction timeout becomes a
  // retryable 503 (RetryableTransactionError); the in-transaction rejections
  // above and every genuine fault are rethrown unchanged.
  return withRetryableTxMapping(
    prisma.$transaction(
      async tx => {
        const claim = await tx.show.updateMany({
          where: { id: showId, status: 'open', showType: 'conformation', closeDate: { lte: now } },
          data: { status: 'executing' },
        });
        if (claim.count === 0) {
          const current = await tx.show.findUnique({
            where: { id: showId },
            select: { status: true, closeDate: true },
          });
          if (current?.status === 'open') {
            throw new ConformationShowNotDueError(showId, current.closeDate);
          }
          throw new ConformationShowAlreadySettledError(showId);
        }

        const entries = await tx.showEntry.findMany({
          where: { showId },
          include: { horse: true },
          orderBy: { createdAt: 'asc' },
        });

        // Resolve the active groom (handler) for every entry. Equoria-axad9.1:
        // never fabricate a placeholder groom — that would award a real
        // handler-score component to a horse with no handler. Entry validation
        // requires an active assignment, so a missing one is a data-integrity
        // anomaly; fail honest, which rolls the claim back.
        const resolved = [];
        for (const entry of entries) {
          const assignment = await tx.groomAssignment.findFirst({
            where: { foalId: entry.horse.id, isActive: true },
            include: { groom: true },
          });
          resolved.push({ entry, horse: entry.horse, groom: assignment?.groom ?? null });
        }
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
        const scored = resolved.map(({ horse, groom }) => {
          const { finalScore } = calculateConformationShowScore(
            horse,
            groom,
            SCORE_NEUTRAL_CONFORMATION_CLASS,
          );
          return { horse, finalScore };
        });

        // Rank by score descending; ties keep entry creation order (already asc).
        scored.sort((a, b) => b.finalScore - a.finalScore);

        const results = [];
        for (let i = 0; i < scored.length; i++) {
          const { horse, finalScore } = scored[i];
          const placement = i + 1;
          const { ribbon, titlePoints: tpAwarded, breedingBoostDelta } = resolveReward(placement);

          // Equoria-bvddn.21: titlePoints is incremented IN the database
          // (`{ increment }` → `SET titlePoints = titlePoints + n`) and the title
          // is derived from the value the update RETURNS, so two settlements
          // that share a horse cannot clobber each other's points.
          // breedingValueBoost keeps its precomputed-write behaviour.
          const newBoost = applyBreedingValueBoost(
            horse.breedingValueBoost ?? 0,
            breedingBoostDelta,
          );

          const updatedHorse = await tx.horse.update({
            where: { id: horse.id },
            data: {
              titlePoints: { increment: tpAwarded },
              breedingValueBoost: newBoost,
            },
          });

          const newTitle = resolveTitle(updatedHorse.titlePoints);
          if (newTitle !== updatedHorse.currentTitle) {
            await tx.horse.update({
              where: { id: horse.id },
              data: { currentTitle: newTitle },
            });
          }

          // CompetitionResult — no prizeWon (AC4)
          await tx.competitionResult.create({
            data: {
              horseId: horse.id,
              showId,
              score: finalScore,
              placement: String(placement),
              discipline: 'conformation',
              runDate: now,
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

        await tx.show.update({
          where: { id: showId },
          data: { status: 'completed', executedAt: now },
        });

        // Equoria-mwjst: the entry fees leave escrow for the creator (or the
        // burn account) on the SAME transaction as the results, so a show is
        // never paid out without being scored, or scored without being paid.
        await settleShowFeeEscrowInTx(tx, showId);

        return results;
      },
      { timeout: 30000 },
    ),
    { message: 'The server is busy executing the show, please retry in a moment.' },
  );
}

/**
 * Nightly dispatch (Equoria-mwjst): settle every due conformation show — still
 * open, closeDate passed — through executeConformationShow. Called by
 * showController.executeClosedShows, whose ridden scan excludes conformation
 * shows so they are never scored as ridden shows.
 *
 * A show another run settled first is skipped. A show that fails is logged and
 * left open (its transaction rolled back) while the rest still settle; the run
 * then throws so the failure surfaces to the executor instead of vanishing.
 *
 * @param {{ now?: Date, showIds?: number[] | null }} [options] - showIds narrows
 *   the scan exactly as executeClosedShows' test-isolation filter does.
 * @returns {Promise<number>} how many shows this run settled
 */
export async function settleDueConformationShows({ now = new Date(), showIds = null } = {}) {
  const where = { status: 'open', showType: 'conformation', closeDate: { lte: now } };
  if (Array.isArray(showIds) && showIds.length > 0) {
    where.id = { in: showIds };
  }
  const due = await prisma.show.findMany({ where, select: { id: true }, orderBy: { id: 'asc' } });

  let settled = 0;
  const failedShowIds = [];
  for (const { id } of due) {
    try {
      await executeConformationShow(id, { now });
      settled++;
    } catch (error) {
      if (error instanceof ConformationShowAlreadySettledError) {
        logger.info(`[conformationShowService] Show ${id} was already settled by another run`);
        continue;
      }
      logger.error(
        `[conformationShowService] Settling conformation show ${id} failed: ${error.message}`,
      );
      failedShowIds.push(id);
    }
  }
  if (failedShowIds.length > 0) {
    throw new Error(`Conformation show settlement failed for show(s) ${failedShowIds.join(', ')}`);
  }
  return settled;
}
