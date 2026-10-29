/**
 * Horse Foaling Controller
 *
 * Equoria-xod8b (child A of Equoria-mh937): extracted from horseController.mjs.
 * Owns createFoal (begin delayed pregnancy for a pair the caller owns). The
 * former resetHorseLastFed E2E helper was removed (Equoria-mwjst): it let any
 * owner rewind the daily feed authority.
 *
 * Equoria-q4uem.9: the breeding rules moved to services/breedingPairRules.mjs
 * (shared with stud bookings, same messages). The pregnancy claim is now one
 * wrapped transaction that also pins the sire to the caller (a stallion sold
 * after the route's ownership check can no longer sire a free pregnancy),
 * honours the pending-request lock (owner ruling S-Q4, 2026-10-16) and writes
 * the BreedingRecord (S-Q7: own pair, stud fee 0).
 */
import { GESTATION_DAYS } from '../../../constants/time.mjs';
import { getHorseById } from '../services/horseRouteQueries.mjs';
import {
  validateBreedingPair,
  pregnancyClaimData,
  pendingRequestMessage,
} from '../services/breedingPairRules.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';

/** Failures thrown out of the claim transaction; mapped to a response after rollback. */
function claimFailure(code, details = {}) {
  return Object.assign(new Error(code), { claimFailure: code, ...details });
}

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
    const { name, sireId, damId } = req.body;

    logger.info(
      `[horseController.createFoal] Beginning pregnancy: sire ${sireId}, dam ${damId} (foal name "${name}")`,
    );

    // sireId and damId are required; name is optional and stored as pending
    // intent on the dam for the foaling job to honour when the foal is born. The
    // foal's breed is never a request field: it is the parents' breed, and the
    // pair must share one (owner ruling 2026-10-20, Equoria-5nwwf).
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

    // Every breeding rule, in its long-standing order and wording. All checks
    // run BEFORE any DB mutation; a refusal starts no pregnancy and stamps no
    // cooldown.
    const verdict = await validateBreedingPair({ sire, dam });
    if (!verdict.ok) {
      return res
        .status(verdict.status)
        .json({ success: false, message: verdict.message, data: null });
    }

    const ownerId = req.user.id;
    const now = new Date();

    // ── ATOMIC OPTIMISTIC CLAIM (Equoria-9gsxg; Equoria-q4uem.9) ────────────
    // A guarded UPDATE on the dam row is the linearisation point for "this
    // breed claimed the pregnancy": WHERE id = ? AND userId = caller AND
    // inFoalSinceDate IS NULL, evaluated by Postgres against the COMMITTED row,
    // so the loser of a race matches 0 rows and neither starts a second
    // pregnancy nor re-stamps the cooldown. No SELECT…FOR-UPDATE (hyphenated
    // so no FOR\s+UPDATE sentinel trips on this comment).
    //
    // The sire is pinned the same way (WHERE id = ? AND userId = caller AND
    // sex = 'Stallion'): the route checked ownership BEFORE this transaction,
    // so a stallion sold in between used to sire a free pregnancy. Both rows
    // are written in ascending id order (the repository lock ruling).
    //
    // With the dam row held, a fresh read of her PENDING private-stud request
    // enforces owner ruling S-Q4 (2026-10-16): she may not be bred elsewhere
    // while one waits. A request that committed while this claim waited on the
    // dam row is visible to that read (a new statement under READ COMMITTED).
    //
    // Owner ruling S-Q7 (2026-10-16): every breeding leaves one BreedingRecord;
    // an own pair pays no stud fee, so its fee is 0.
    await withRetryableTxMapping(
      prisma.$transaction(
        async tx => {
          const pinSire = async () => {
            const pinned = await tx.horse.updateMany({
              where: { id: sire.id, userId: ownerId, sex: 'Stallion' },
              data: { userId: ownerId },
            });
            if (pinned.count !== 1) {
              throw claimFailure('sireNotOwned');
            }
          };
          const claimDam = async () => {
            const { count: affected } = await tx.horse.updateMany({
              where: { id: dam.id, userId: ownerId, inFoalSinceDate: null },
              data: pregnancyClaimData({
                sireId: sire.id,
                name,
                now,
              }),
            });
            if (affected === 0) {
              throw claimFailure('damNotClaimable');
            }
          };
          if (sire.id < dam.id) {
            await pinSire();
            await claimDam();
          } else {
            await claimDam();
            await pinSire();
          }

          const pending = await tx.breedingRecord.findFirst({
            where: { damId: dam.id, status: 'PENDING' },
            select: { id: true },
          });
          if (pending) {
            throw claimFailure('mareHasPendingRequest', { damName: dam.name });
          }

          const owner = await tx.user.findUnique({
            where: { id: ownerId },
            select: { username: true },
          });
          await tx.breedingRecord.create({
            data: {
              kind: 'OWN_PAIR',
              status: 'COMPLETED',
              fee: 0,
              sireId: sire.id,
              damId: dam.id,
              mareOwnerId: ownerId,
              stallionOwnerId: ownerId,
              sireName: sire.name,
              damName: dam.name,
              mareOwnerName: owner?.username ?? '',
              stallionOwnerName: owner?.username ?? '',
              resolvedAt: now,
            },
          });
        },
        { timeout: 30000 },
      ),
      { message: 'The breeding barn is busy right now, please retry in a moment.' },
    );

    // 00:00 Eastern on the day the nightly foaling run delivers (bred day + 7).
    const foalDueDate = startOfGameDayIndex(gameDayIndex(now) + GESTATION_DAYS);

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
    if (error.claimFailure === 'sireNotOwned') {
      // Byte-identical to the route's ownership 404 (horseFoalRoutes.mjs).
      return res.status(404).json({ success: false, message: 'Sire not found' });
    }
    if (error.claimFailure === 'mareHasPendingRequest') {
      return res.status(409).json({
        success: false,
        code: 'mareHasPendingRequest',
        message: pendingRequestMessage(error.damName),
        data: null,
      });
    }
    if (error.claimFailure === 'damNotClaimable') {
      // Rolled back. Tell apart "sold mid-request" (the route's ownership 404)
      // from "a concurrent breed already claimed her" (the long-standing 400).
      const current = await getHorseById(req.body.damId);
      if (!current || current.userId !== req.user.id) {
        return res.status(404).json({ success: false, message: 'Dam not found' });
      }
      logger.info(
        `[horseController.createFoal] Lost-update conflict: dam ${req.body.damId} already claimed by a concurrent breed`,
      );
      return res.status(400).json({
        success: false,
        message: `${current.name} is already in foal.`,
        data: null,
      });
    }
    if (error.statusCode === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }

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
