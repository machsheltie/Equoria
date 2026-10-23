/**
 * Staff view of quarantined shows (Equoria-c7mx0.1).
 *
 * GET /api/v1/staff/shows/quarantined runs behind
 * requireStaffCapability('shows.quarantine.view'), which the owner and admins
 * hold (owner ruling 2026-10-23: quarantined shows are listed for Owner/Admin
 * to resolve). Read-only: resolving a quarantined show is not built yet.
 */

import { listQuarantinedShows } from '../services/quarantinedShowsService.mjs';

/** GET /api/v1/staff/shows/quarantined */
export async function getQuarantinedShows(req, res, next) {
  try {
    const shows = await listQuarantinedShows();
    res.json({ success: true, shows });
  } catch (error) {
    next(error);
  }
}
