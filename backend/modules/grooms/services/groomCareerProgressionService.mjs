/**
 * Groom Career Progression — THE weekly game pass.
 *
 * Split out of groomRetirementService.mjs by Equoria-ypb7d.1. The honest reason:
 * that file sat at 598 lines against a 600-line cap and the age model had to go
 * into it. The good reason: retirement is a decision about ONE groom, and this is
 * the pass that walks EVERY groom once a week — different subject, different
 * failure mode (a per-groom error must not stop the week), and the natural home
 * for the two idempotent backstops that fill in state older grooms lack.
 *
 * THE CLOCK. `careerWeeks` advances by exactly one here, once per weekly pass.
 * One weekly pass is one game-year on Equoria's clock (1 real week = 1 game-year,
 * declared in backend/utils/horseAge.mjs, which is what horses age on), and a
 * groom's age is `startAge + careerWeeks`. So this loop IS the year-per-week tick
 * the owner's ruling asks for, and there is no second counter and no second cron
 * anywhere in the groom lifecycle.
 *
 * THE SCHEDULER: backend/services/jobs/groomCareerProgressionJob.mjs (registry A —
 * advisory-locked, heartbeat-wrapped, visible at /api/admin/cron/health), Mondays
 * 09:45 UTC, deliberately AFTER weeklySalaries at 09:00. Read that descriptor's
 * header before relying on it.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { ensureStartAge } from './groomAgeService.mjs';
// `ensureRetirementDrawn` returns a BOOLEAN, never the hidden retirement age.
// This module is not one of the two files allowed to handle that age, and
// scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs enforces it; the
// safe accessor is the remedy that check's own message names.
import {
  incrementCareerWeeks,
  ensureRetirementDrawn,
  checkRetirementEligibility,
  processRetirement,
} from './groomRetirementService.mjs';

/**
 * Process weekly career progression for all active grooms — THE game path.
 *
 * Per groom, in order:
 *   - draw and persist the START age (18-24) if it has none yet;
 *   - draw and persist the hidden retirement age if it has none yet;
 *   - advance `careerWeeks` by one, which advances the groom's age by one
 *     game-year;
 *   - retire the groom if it has reached its retirement age, notifying the player
 *     inside the retirement transaction.
 *
 * Age is the only retirement trigger, and only two random draws decide when it
 * arrives — the start age and the retirement age. Level, experience, assignment
 * count and performance do not appear in this loop, and must not be added to it:
 * "Math.random determines when they retire between 50-65 years old. That is all."
 * (owner, 2026-09-09). See groomRetirementService.mjs's header for the two
 * merit-based triggers Equoria-m9lz1 removed for the same reason.
 *
 * Per-groom failures are collected rather than aborting the pass: one groom with
 * bad data must not stop every other player's week. A failed retirement leaves
 * that groom entirely untouched, because the retirement is one transaction.
 *
 * @param {string|null} userId - Optional user ID to scope processing (used in tests for isolation)
 * @returns {Promise<Object>} Processing results with statistics
 */
export async function processWeeklyCareerProgression(userId = null) {
  try {
    logger.info('Starting weekly career progression processing');

    // Get all active (non-retired) grooms, optionally scoped to a specific user
    const whereClause = { retired: false, isActive: true };
    if (userId) {
      whereClause.userId = userId;
    }
    const activeGrooms = await prisma.groom.findMany({
      where: whereClause,
      select: { id: true, name: true, careerWeeks: true, startAge: true, level: true },
    });

    const results = {
      processed: 0,
      retired: 0,
      scheduled: 0,
      aged: 0,
      errors: [],
      retirements: [],
    };

    for (const groom of activeGrooms) {
      try {
        // Equoria-ypb7d.1 backstop for grooms that predate this story. Idempotent
        // (a guarded conditional update inside `ensureStartAge`) and skipped for
        // the already-drawn case. Migration
        // 20260909120000_ypb7d_groom_age_and_engagement performs no backfill
        // precisely because this exists — the posture Equoria-m9lz1 took.
        let startAge = groom.startAge;
        if (startAge === null) {
          startAge = await ensureStartAge(prisma, groom.id);
          results.aged++;
        }

        // Equoria-m9lz1 backstop for grooms that predate THAT story, legacy
        // protégés, and fixtures. Idempotent; the already-scheduled case costs
        // exactly one read and tells this loop nothing but "yes".
        if (await ensureRetirementDrawn(groom.id)) {
          results.scheduled++;
        }

        // The groom ages one game-year.
        await incrementCareerWeeks(groom.id);
        results.processed++;

        // Retire if the groom has reached its hidden retirement age.
        const eligibility = await checkRetirementEligibility(groom.id);
        if (eligibility.eligible) {
          await processRetirement(groom.id, eligibility.reason);
          results.retired++;
          results.retirements.push({
            groomId: groom.id,
            groomName: groom.name,
            reason: eligibility.reason,
            // Equoria-maeba (owner, 2026-09-14): the pass reports the AGE the
            // groom retired at, in game-years. `careerWeeks + 1` — years WORKED
            // since hire — was the retired career-weeks reading of that age.
            ageYears: startAge + groom.careerWeeks + 1,
            level: groom.level,
          });

          logger.info(`Groom ${groom.name} (ID: ${groom.id}) retired: ${eligibility.reason}`);
        }
      } catch (error) {
        logger.error(`Error processing groom ${groom.id}:`, error);
        results.errors.push({
          groomId: groom.id,
          groomName: groom.name,
          error: error.message,
        });
      }
    }

    logger.info(
      `Weekly career progression completed: ${results.processed} processed, ${results.retired} retired, ${results.errors.length} errors`,
    );

    return results;
  } catch (error) {
    logger.error(`Error in weekly career progression: ${error.message}`);
    throw new Error('Failed to process weekly career progression', { cause: error });
  }
}

export default { processWeeklyCareerProgression };
