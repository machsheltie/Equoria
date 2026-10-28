/**
 * Groom Handler Controller
 * Manages groom assignments as competition handlers
 *
 * GET /recommendations/:horseId (best-handler ranking) was removed
 * (Equoria-a7f1p; owner ruling 2026-10-07: the game never gives advice).
 * GET /eligibility/:horseId/:className and GET /config were removed
 * (Equoria-4fa7s; owner ruling 2026-10-28 q154: the handler is the horse's
 * groom, any groom may handle in any class).
 */

import logger from '../../../utils/logger.mjs';
import { getAssignedHandler } from '../services/groomHandlerService.mjs';

/**
 * GET /api/groom-handlers/horse/:horseId
 * Get the assigned handler for a horse
 */
export async function getHorseHandler(req, res) {
  try {
    const { horseId } = req.params;
    const userId = req.user?.id;

    logger.info(`[groomHandlerController] Getting handler for horse ${horseId}`);

    // Validate horse ID
    const parsedHorseId = parseInt(horseId);
    if (isNaN(parsedHorseId) || parsedHorseId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid horse ID',
        data: null,
      });
    }

    // Ownership validated by requireOwnership('horse') middleware on the route.
    // req.horse is the validated, owned record (full fields from middleware).
    const horse = req.horse;

    // Get assigned handler
    const handlerData = await getAssignedHandler(parsedHorseId, userId);

    res.status(200).json({
      success: true,
      message: handlerData.hasHandler
        ? `Handler ${handlerData.groom.name} is assigned to ${horse.name}`
        : `No handler assigned to ${horse.name}`,
      data: {
        hasHandler: handlerData.hasHandler,
        horse: {
          id: horse.id,
          name: horse.name,
        },
        handler: handlerData.hasHandler
          ? {
              id: handlerData.groom.id,
              name: handlerData.groom.name,
              skillLevel: handlerData.groom.skillLevel,
              speciality: handlerData.groom.speciality,
              personality: handlerData.groom.personality,
              experience: handlerData.groom.experience,
            }
          : 'none',
        assignment: handlerData.hasHandler
          ? {
              id: handlerData.assignment.id,
              createdAt: handlerData.assignment.createdAt,
            }
          : 'none',
      },
    });
  } catch (error) {
    logger.error(`[groomHandlerController] Error getting horse handler: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
}
