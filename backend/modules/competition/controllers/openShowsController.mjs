/**
 * GET /api/competition (and /api/v1/competition via the v1 mount)
 * List shows that are currently open for entry. Used by the frontend
 * CompetitionBrowserPage which renders cards from this response.
 *
 * Equoria-nj0y triage: this list endpoint was missing and the frontend
 * `competitionsApi.list()` call was 404'ing, leaving the browser in
 * permanent loading state and breaking the broader E2E specs that wait
 * for filter controls. The shape here matches the Competition type the
 * client expects (id, name, discipline, dates, fee, prize, status).
 *
 * Moved out of competitionRoutes.mjs with its keyset pagination
 * (Equoria-cmw85.19): ?cursor continues a list, ?page / ?limit keep working, and
 * the page/total envelope gains `pageInfo`.
 */

import logger from '../../../utils/logger.mjs';
import {
  InvalidCursorError,
  buildPaginatedResponse,
  parsePaginationParams,
} from '../../../utils/paginationHelper.mjs';
import { listShowsPaginated } from '../services/competitionRouteQueries.mjs';

export async function listOpenShows(req, res) {
  try {
    const { page, limit, skip } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;

    const { shows, total, pageInfo } = await listShowsPaginated({
      where: { status: 'open' },
      skip,
      limit,
      cursor,
    });

    return buildPaginatedResponse(res, shows, { page, limit, total }, {}, { pageInfo });
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    logger.error(`[competitionRoutes.GET /] Error listing competitions: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to load competitions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal error',
    });
  }
}
