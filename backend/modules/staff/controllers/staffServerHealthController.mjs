/**
 * The owner's server memory and speed panel (Equoria-brh8c, owner ruling q158).
 *
 * Both routes run behind requireStaffCapability('server.health.view'), which the
 * Owner alone holds, so they need the emailed staff check-in on this browser.
 */

import { readServerHealth } from '../services/serverHealthService.mjs';
import {
  fileOwnerReport,
  filingState,
  serverFilingSubject,
} from '../services/ownerFilingService.mjs';

/** GET /api/v1/staff/server-health */
export async function getServerHealth(req, res, next) {
  try {
    const filing = await filingState(serverFilingSubject());
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, health: readServerHealth(), filing });
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/staff/server-health/file: File for Claude Code (Equoria-brh8c, q234),
 * once per game day. The report is built here, never taken from the browser.
 */
export async function fileServerHealth(req, res, next) {
  try {
    const { report } = readServerHealth();
    const filing = await fileOwnerReport(serverFilingSubject(), report, req.staff);
    return res.json({ success: true, filing });
  } catch (error) {
    return next(error);
  }
}
