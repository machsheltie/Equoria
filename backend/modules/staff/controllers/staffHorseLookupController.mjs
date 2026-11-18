/**
 * GET /api/v1/staff/horses/lookup?q=<number or name> (Equoria-puj1e.5).
 *
 * The Owner and Admins (`horse.admin`, checked by the route's guard) look a
 * horse up by number or name. Hidden traits are named only for the Owner
 * (`traits.hidden.view`); the response guard cuts every other view to the
 * public one as well.
 */

import logger from '../../../utils/logger.mjs';
import { can } from '../capabilities.mjs';
import { lookupHorses, parseHorseQuery } from '../services/horseLookupService.mjs';

export async function lookupHorsesHandler(req, res, next) {
  try {
    const query = parseHorseQuery(req.query?.q);
    if (!query) {
      return res.status(400).json({
        success: false,
        code: 'horseLookupInvalid',
        message: 'Enter a horse’s number or part of its name.',
      });
    }
    const horses = await lookupHorses(query, {
      includeHidden: can(req.staff ?? req.user, 'traits.hidden.view'),
    });
    return res.json({ success: true, data: { horses } });
  } catch (error) {
    logger.error(`[staff] horse lookup failed: ${error.message}`);
    return next(error);
  }
}
