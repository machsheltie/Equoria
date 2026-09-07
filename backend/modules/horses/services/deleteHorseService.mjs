/**
 * deleteHorseService.mjs
 *
 * Service layer for DELETE /horses/:id. Extracted from horseRoutes.mjs
 * inline body (Equoria-y8u2j, AC2) — same logic, lifted verbatim from
 * the route handler so behaviour is byte-equivalent.
 *
 * The route handler is responsible for running requireOwnership('horse')
 * FIRST (which validates BOTH existence and that the caller owns it). This
 * service therefore trusts that the horseId belongs to the user and only
 * worries about the destructive call itself + cache invalidation. The
 * Prisma `P2025` "Record to delete not found" path is retained here as a
 * defence-in-depth guard against a race where the row is deleted between
 * the ownership check and this call.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';

/**
 * Delete a horse by id on behalf of the given user.
 *
 * @param {number} horseId - the horse to delete (already-parsed integer)
 * @param {string|number} userId - the authenticated user's id (for logging)
 * @returns {Promise<{status:number, body:object}>} HTTP response envelope
 *   200 — { success: true, message: 'Horse deleted successfully' }
 *   404 — { success: false, message: 'Horse not found' } (race-window guard)
 *   Throws on any other Prisma error so the route's catch can 500 it
 *   (preserves the prior error path verbatim).
 */
export async function deleteHorseById(horseId, userId) {
  try {
    // Ownership already validated by middleware
    await prisma.horse.delete({
      where: { id: horseId },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return {
        status: 404,
        body: { success: false, message: 'Horse not found' },
      };
    }
    throw error;
  }

  logger.info(`[deleteHorseService] User ${userId} deleted horse ID: ${horseId}`);

  // Invalidate horse list caches so deleted horse disappears on next fetch
  invalidateCachePattern('horses:list:*').catch(() => {
    /* non-critical */
  });

  return {
    status: 200,
    body: { success: true, message: 'Horse deleted successfully' },
  };
}
