/**
 * Horse Foaling Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns createFoal (begin delayed pregnancy) + resetHorseLastFed (E2E helper).
 * No behavior changes — functions moved verbatim.
 */
import { GESTATION_MS } from '../../../constants/time.mjs';
import { getHorseById } from '../services/horseModelService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { getDisplayedHealth } from '../../../utils/horseHealth.mjs';

/**
 * Begin a delayed pregnancy on the dam mare.
 *
 * Phase B (feed-system redesign 2026-04-29): breeding no longer creates a
 * foal Horse row. This handler validates sire/dam, then sets the mare's
 * `inFoalSinceDate`, `pregnancySireId`, `pregnancyFeedingsByTier`, and
 * `lastBredDate`. The foaling job (B5) materialises the foal +7 days later
 * via `foalingService.createFoalFromPregnancy()`.
 *
 * Response shape: 200 with
 *   { success, message, data: { pregnancyStarted, damId, sireId, foalDueDate } }
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function createFoal(req, res) {
  try {
    const { name, breedId, sireId, damId } = req.body;

    logger.info(
      `[horseController.createFoal] Beginning pregnancy: sire ${sireId}, dam ${damId} (foal name "${name}")`,
    );

    // sireId and damId are required; name and breedId are optional and stored as
    // pending intent on the dam for the foaling job to honour when the foal is born.
    if (!sireId || !damId) {
      return res.status(400).json({
        success: false,
        message: 'sireId and damId are required for foal creation',
        data: null,
      });
    }

    // Validate that sire and dam exist.
    const [sire, dam] = await Promise.all([getHorseById(sireId), getHorseById(damId)]);

    if (!sire) {
      return res.status(404).json({
        success: false,
        message: `Sire with ID ${sireId} not found`,
        data: null,
      });
    }

    if (!dam) {
      return res.status(404).json({
        success: false,
        message: `Dam with ID ${damId} not found`,
        data: null,
      });
    }

    // Critical-health gate (Equoria-2e7e): mirrors conformationShowController's A12 check.
    // Both sire and dam must have displayedHealth !== 'critical' before pregnancy can begin.
    if (getDisplayedHealth(sire) === 'critical') {
      const msg = `${sire.name} is in critical health and cannot breed. Feed and vet to restore health.`;
      logger.info(`[horseController.createFoal] Rejected: sire ${sireId} is in critical health`);
      return res.status(400).json({ success: false, message: msg, data: null });
    }
    if (getDisplayedHealth(dam) === 'critical') {
      const msg = `${dam.name} is in critical health and cannot breed. Feed and vet to restore health.`;
      logger.info(`[horseController.createFoal] Rejected: dam ${damId} is in critical health`);
      return res.status(400).json({ success: false, message: msg, data: null });
    }

    // Validate breedId if provided — malformed values must not put the mare
    // into an in-foal state with bad data.
    let normalizedBreedId = null;
    if (breedId !== undefined && breedId !== null && breedId !== '') {
      normalizedBreedId = Number.parseInt(breedId, 10);
      if (!Number.isInteger(normalizedBreedId) || normalizedBreedId <= 0) {
        return res.status(400).json({
          success: false,
          message: 'breedId must be a positive integer',
          data: null,
        });
      }
      const breedRecord = await prisma.breed.findUnique({
        where: { id: normalizedBreedId },
        select: { name: true },
      });
      if (!breedRecord?.name) {
        return res.status(400).json({
          success: false,
          message: `No breed found for id ${normalizedBreedId}`,
          data: null,
        });
      }
    }

    // The mare must not already be in foal.
    //
    // Concurrency model (Equoria-9gsxg — optimistic concurrency, NO row lock,
    // mirrors the feed-action fix Equoria-zvp4):
    //   This advisory pre-check produces a friendly 400 on the COMMON path. It
    //   does NOT close the lost-update race on its own: under READ COMMITTED two
    //   concurrent breed requests on the same dam can both read the stale
    //   inFoalSinceDate=NULL and both pass this guard. The race is closed by the
    //   ATOMIC GUARDED UPDATE below — a single UPDATE whose WHERE encodes the
    //   "not already in foal" precondition and whose affected-row count must be
    //   exactly 1. The first breed to commit flips inFoalSinceDate to a value;
    //   the loser's WHERE then matches 0 rows, so it neither starts a SECOND
    //   pregnancy (which would overwrite the winner's pregnancySireId /
    //   pendingFoalName) nor re-stamps lastBredDate a second time (cooldown
    //   bypass). affected===0 → reject with the same 400 the pre-check uses.
    //   Fail-closed: a conflict rejects, it never silently double-applies.
    if (dam.inFoalSinceDate) {
      return res.status(400).json({
        success: false,
        message: `${dam.name} is already in foal.`,
        data: null,
      });
    }

    const now = new Date();

    // ── ATOMIC OPTIMISTIC CLAIM (Equoria-9gsxg) ─────────────────────────────
    // A single guarded UPDATE on the dam row is the linearisation point for
    // "this breed claimed the pregnancy". Everything that must happen exactly
    // once per pregnancy rides on this ONE statement:
    //   - inFoalSinceDate := now      (the claim itself)
    //   - pregnancySireId := sireId
    //   - pregnancyFeedingsByTier := {}
    //   - lastBredDate := now         (the cooldown stamp)
    //   - pendingFoalName / pendingFoalBreedId := caller intent
    //
    // The WHERE clause (id = ? AND inFoalSinceDate = null) is evaluated by
    // Postgres against the COMMITTED row at statement time, so the loser of a
    // race sees the winner's already-committed inFoalSinceDate and matches 0
    // rows. No SELECT…FOR-UPDATE: updateMany compiles to a plain guarded UPDATE
    // taking only the ordinary per-row write lock for the statement's duration
    // — race-safe AND timeout-free. (Hyphenated "FOR-UPDATE" in prose so any
    // FOR\s+UPDATE sentinel can't trip on this comment.)
    //
    // Implemented with prisma.horse.updateMany (returns { count }) rather than
    // raw $executeRaw: this matches the EXISTING optimistic-claim precedent in
    // foalingService.runFoalingJob (the inverse pregnancy-CLEAR write, which
    // already guards with updateMany + count===0 skip), and lets Prisma handle
    // Int coercion + the `{}` Json default natively — no manual SQL, no
    // '{}'::jsonb literal, no string/Int binding subtlety. (zvp4's feed fix
    // needs raw SQL only because it does a per-column `stat + 1` increment +
    // jsonb_set that updateMany can't express; createFoal has no such
    // increment — every assignment here is a scalar, so updateMany is the
    // cleaner fit.)
    const { count: affected } = await prisma.horse.updateMany({
      where: { id: dam.id, inFoalSinceDate: null },
      data: {
        inFoalSinceDate: now,
        pregnancySireId: sire.id,
        pregnancyFeedingsByTier: {},
        lastBredDate: now,
        pendingFoalName: name ?? null,
        pendingFoalBreedId: normalizedBreedId || null,
      },
    });

    if (affected === 0) {
      // A concurrent breed already claimed this dam's pregnancy. Reject with
      // the same 400 the advisory pre-check uses — do NOT start a second
      // pregnancy or re-stamp the cooldown.
      logger.info(
        `[horseController.createFoal] Lost-update conflict: dam ${damId} already claimed by a concurrent breed`,
      );
      return res.status(400).json({
        success: false,
        message: `${dam.name} is already in foal.`,
        data: null,
      });
    }

    const foalDueDate = new Date(now.getTime() + GESTATION_MS);

    logger.info(
      `[horseController.createFoal] Pregnancy started for dam ${damId} (sire ${sireId}); foal due ${foalDueDate.toISOString()}`,
    );

    return res.status(200).json({
      success: true,
      message: `${dam.name} is now in foal. The foal will be born in 7 days.`,
      data: {
        pregnancyStarted: true,
        damId,
        sireId,
        foalDueDate: foalDueDate.toISOString(),
      },
    });
  } catch (error) {
    logger.error(`[horseController.createFoal] Error starting pregnancy: ${error.message}`);

    res.status(500).json({
      success: false,
      message: 'Internal server error during pregnancy start',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      data: null,
    });
  }
}

// Lineage gathering + mare feed-quality assessment moved to
// `services/foalingService.mjs` as part of the B3 delayed-foaling refactor.
// Foal materialisation now happens in `foalingService.createFoalFromPregnancy()`
// when the foaling job (B5) fires +7 days after `createFoal` flips the dam
// into the in-foal state.

/**
 * POST /api/v1/horses/:id/reset-last-fed
 * Owner-scoped test/fixture helper that rewinds the horse's lastFedDate by N
 * days (default 1) so the same-day feed gate (alreadyFedToday) no longer
 * blocks a subsequent feed within the same E2E session.
 *
 * Background (Equoria-4sqr): feed-system-phase-b test 2 must feed the
 * pregnant mare to verify pregnancyFeedingsByTier increments, but the mare
 * was already fed in beforeAll to satisfy the critical-health breeding gate
 * (Equoria-2e7e). Without this endpoint there's no way to satisfy both.
 *
 * Why owner-scoped, not admin-only: the E2E global-setup flow creates a
 * regular user without admin role, so an admin-only endpoint cannot be hit
 * from the test session. The operation has no privilege impact — rewinding
 * the user's OWN horse's lastFedDate is functionally equivalent to "skip a
 * real-world day" and grants no advantage over honest play (the user could
 * already just wait 24h).
 *
 * Mounted on authRouter via horseRoutes.mjs with requireOwnership('horse'),
 * so a user cannot reset a horse they don't own. Rate-limited.
 *
 * Body: { days?: number }  — days to subtract from now (default 1, max 30).
 */
export async function resetHorseLastFed(req, res) {
  try {
    // requireOwnership middleware pre-attaches the horse to req.horse and
    // validates that req.user owns it. Defensive guard in case middleware
    // ordering changes in the future.
    if (!req.horse) {
      logger.error(
        '[horseController.resetHorseLastFed] req.horse not set — requireOwnership middleware did not run',
      );
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }

    const days = Number(req.body?.days ?? 1);
    if (!Number.isFinite(days) || days < 0 || days > 30) {
      return res
        .status(400)
        .json({ success: false, message: 'days must be a number between 0 and 30' });
    }

    const newLastFed = new Date();
    newLastFed.setDate(newLastFed.getDate() - days);

    logger.info(
      `[horseController.resetHorseLastFed] horse ${req.horse.id} — rewinding lastFedDate by ${days} day(s) to ${newLastFed.toISOString()}`,
    );

    const updated = await prisma.horse.update({
      where: { id: req.horse.id },
      data: { lastFedDate: newLastFed },
      select: { id: true, name: true, lastFedDate: true },
    });

    return res.status(200).json({
      success: true,
      message: `Horse ${req.horse.id} lastFedDate rewound by ${days} day(s)`,
      // Explicit ISO conversion — some Prisma client builds serialize Date as
      // an empty object via JSON.stringify, so we coerce defensively.
      data: {
        id: updated.id,
        name: updated.name,
        lastFedDate: updated.lastFedDate ? new Date(updated.lastFedDate).toISOString() : null,
      },
    });
  } catch (error) {
    logger.error(
      `[horseController.resetHorseLastFed] Error: ${error.message}\nStack: ${error.stack}`,
    );
    return res.status(500).json({
      success: false,
      message: 'Failed to reset lastFedDate',
    });
  }
}
