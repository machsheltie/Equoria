/**
 * GET /api/v1/competition/horse/:horseId/results
 *
 * A horse's competition results, newest first, one keyset page (Equoria-cmw85.20):
 * 100 per page by default and at most, `?cursor` continues a list, `pageInfo` says
 * whether there is more. Ownership is proved by the route's requireOwnership.
 */

import logger from '../../../utils/logger.mjs';
import { InvalidCursorError, readKeysetParams } from '../../../utils/paginationHelper.mjs';
import { getResultsPageByHorse } from '../services/resultModelService.mjs';

export async function getHorseResults(req, res) {
  try {
    const horseId = parseInt(req.params.horseId, 10);

    const { limit, cursor, skip } = readKeysetParams(req.query, { def: 100, max: 100 });
    const { items: results, pageInfo } = await getResultsPageByHorse(horseId, {
      limit,
      cursor,
      skip,
    });

    logger.info(
      `[competitionRoutes.GET /horse/${horseId}/results] Retrieved ${results.length} results`,
    );

    return res.json({
      success: true,
      horseId,
      results,
      count: results.length,
      pageInfo,
    });
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error(`[competitionRoutes.GET /horse/:horseId/results] Error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
}
