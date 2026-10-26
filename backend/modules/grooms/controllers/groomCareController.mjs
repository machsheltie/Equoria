/**
 * HTTP handlers for daily care (GET /grooms/care/..., POST /grooms/care/:horseId/groom).
 * The routes have already checked that the horse belongs to the player.
 */

import logger from '../../../utils/logger.mjs';
import {
  GroomCareRefusal,
  getCareStatus,
  groomHorse,
  listUngroomedToday,
} from '../services/groomCareService.mjs';

function sendFailure(res, error, where) {
  if (error instanceof GroomCareRefusal) {
    return res
      .status(error.status)
      .json({ success: false, message: error.message, data: { code: error.code } });
  }
  if (error?.statusCode === 503 || error?.status === 503) {
    return res
      .status(503)
      .json({ success: false, message: 'The stable is busy right now. Please try again.' });
  }
  logger.error(`[groomCareController.${where}] ${error?.message}`);
  return res
    .status(500)
    .json({ success: false, message: 'Something went wrong. Please try again.' });
}

/**
 * POST /grooms/interact and POST /grooms/enhanced/interact, retired: "groom
 * horse" is the only way to groom (owner rulings 2026-10-20 and 2026-10-26, q87:
 * one daily press, +5 bond). The old doors let any task and their own bond
 * amounts through.
 */
export function retiredGroomDoor(req, res) {
  return res.status(410).json({
    success: false,
    message: 'Grooming is done with "groom horse" in the horse\'s Care area.',
    data: { code: 'useGroomHorse' },
  });
}

/** GET /grooms/care/ungroomed-today */
export async function getUngroomedToday(req, res) {
  try {
    const horses = await listUngroomedToday(req.user.id);
    return res.status(200).json({ success: true, data: { horses } });
  } catch (error) {
    return sendFailure(res, error, 'getUngroomedToday');
  }
}

/** GET /grooms/care/:horseId */
export async function getHorseCareStatus(req, res) {
  try {
    const status = await getCareStatus(req.horse.id);
    if (!status) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return sendFailure(res, error, 'getHorseCareStatus');
  }
}

/** POST /grooms/care/:horseId/groom  body: { activity? } */
export async function postGroomHorse(req, res) {
  try {
    const status = await groomHorse({ horseId: req.horse.id, activity: req.body?.activity });
    return res.status(200).json({ success: true, data: status });
  } catch (error) {
    return sendFailure(res, error, 'postGroomHorse');
  }
}
