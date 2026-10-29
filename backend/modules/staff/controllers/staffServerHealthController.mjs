/**
 * The owner's server memory and speed panel (Equoria-brh8c, owner ruling q158).
 *
 * GET /api/v1/staff/server-health runs behind
 * requireStaffCapability('server.health.view'), which the Owner alone holds, so
 * it needs the emailed staff check-in on this browser.
 */

import { readServerHealth } from '../services/serverHealthService.mjs';

/** GET /api/v1/staff/server-health */
export function getServerHealth(req, res, next) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, health: readServerHealth() });
  } catch (error) {
    return next(error);
  }
}
