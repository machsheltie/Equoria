/**
 * renameHorseService.mjs (Equoria-qkgfh.1)
 *
 * Service layer for PATCH /horses/:id/name. Mirrors deleteHorseService.mjs:
 * the route owns validation + response shape, this owns the write and returns
 * an HTTP envelope.
 *
 * WHY THE OWNERSHIP CHECK IS REPEATED HERE
 *   The route already runs `requireOwnership('horse')`, which SELECTs
 *   `{ id, userId: req.user.id }` and 404s when that finds nothing. That read
 *   happens before this write, so a horse sold, gifted, or deleted in the gap
 *   would still be renamed by the stale decision. The write below therefore
 *   re-asserts ownership as part of the UPDATE's own WHERE clause and requires
 *   exactly one affected row — the guarded conditional update this codebase
 *   prefers over a lock. There is no `SELECT ... FOR UPDATE` because a rename
 *   reads nothing it then depends on; last write wins, which is the correct
 *   semantics for a name.
 *
 * RESPONSE COLLAPSE (CWE-639)
 *   A zero-row update means "no horse with this id belongs to you" and cannot
 *   distinguish a missing horse from someone else's. It returns the SAME 404
 *   message the ownership middleware returns, so the two cases stay
 *   indistinguishable on every path into this endpoint.
 *
 * NO UNIQUENESS CHECK
 *   Deliberate. The owner ruled 2026-09-09 that horse names need not be unique.
 *   `Horse.name` has no unique index in schema.prisma or in any migration, so
 *   duplicates are legal both within one stable and across stables.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';

/**
 * Rename a horse on behalf of its owner.
 *
 * @param {number} horseId - the horse to rename (already-parsed integer)
 * @param {string} userId - the authenticated user's id (the ownership guard)
 * @param {string} name - the validated new name, stored verbatim
 * @param {string|null} previousName - the name the ownership middleware read,
 *   echoed back so the caller can report what changed
 * @returns {Promise<{status:number, body:object}>} HTTP response envelope
 *   200 — { success: true, data: { id, name, previousName } }
 *   404 — { success: false, message: 'Horse not found' } when the guarded
 *         update matched no row (missing horse OR not the caller's)
 */
export async function renameHorseById(horseId, userId, name, previousName = null) {
  // Single transaction: the guarded write and the read-back that reports it are
  // one atomic unit, so the name returned to the player is the name that was
  // committed. Every statement runs on `tx` — none falls back to the global
  // client.
  const renamed = await prisma.$transaction(async tx => {
    const guarded = await tx.horse.updateMany({
      where: { id: horseId, userId },
      data: { name },
    });

    if (guarded.count !== 1) {
      return null;
    }

    return tx.horse.findFirst({
      where: { id: horseId, userId },
      select: { id: true, name: true },
    });
  });

  if (!renamed) {
    logger.warn(
      `[renameHorseService] Rename refused: horse ${horseId} not found or not owned by user ${userId}`,
    );
    return {
      status: 404,
      body: { success: false, message: 'Horse not found' },
    };
  }

  logger.info(`[renameHorseService] User ${userId} renamed horse ${renamed.id}`);

  // Horse lists cache the name; drop them so the next fetch shows the rename.
  // Same non-critical treatment as deleteHorseService / PUT /horses/:id.
  invalidateCachePattern('horses:list:*').catch(() => {
    /* non-critical */
  });

  return {
    status: 200,
    body: {
      success: true,
      message: 'Horse renamed successfully',
      data: { id: renamed.id, name: renamed.name, previousName },
    },
  };
}
