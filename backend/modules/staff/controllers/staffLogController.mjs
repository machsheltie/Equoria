/**
 * Staff action log controller (Equoria-puj1e.1, Task 4)
 *
 * GET /api/v1/staff/log runs behind requireStaffCapability('log.view.own').
 * Only an actor holding log.view.all may widen past their own entries; for
 * everyone else any actorId query parameter is ignored and forced to self.
 */

import logger from '../../../utils/logger.mjs';
import { ROLE_CAPABILITIES, hasCapability } from '../capabilities.mjs';
import { listStaffActions } from '../services/staffActionLogService.mjs';

// Logged actions that are not capabilities: things any staff member does
// (reply to a ticket, check in). Never granted, so they stay out of
// capabilities.mjs and are only accepted here as ledger filters.
const LOGGED_NON_CAPABILITY_ACTIONS = ['ticket.reply', 'staff.checkin'];
const ALL_CAPABILITIES = new Set([
  ...Object.values(ROLE_CAPABILITIES).flatMap(set => [...set]),
  ...LOGGED_NON_CAPABILITY_ACTIONS,
]);
const FILTER_KEYS = new Set(['actorId', 'targetType', 'targetId', 'capability', 'cursor']);
const MAX_TEXT = 100;
const MAX_INT4 = 2147483647;

const invalid = (res, message) => res.status(400).json({ success: false, message });

const isText = value => typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT;

/** Returns an error message, or null when the query is acceptable. */
function validateQuery(query) {
  for (const key of Object.keys(query)) {
    if (!FILTER_KEYS.has(key)) {
      return `Unknown filter: ${key}`;
    }
  }
  for (const key of ['actorId', 'targetType', 'targetId']) {
    if (query[key] !== undefined && !isText(query[key])) {
      return `Invalid ${key}`;
    }
  }
  if (query.capability !== undefined && !ALL_CAPABILITIES.has(query.capability)) {
    return 'Invalid capability';
  }
  if (query.cursor !== undefined) {
    const ok =
      typeof query.cursor === 'string' &&
      /^[1-9]\d{0,9}$/.test(query.cursor) &&
      Number(query.cursor) <= MAX_INT4;
    if (!ok) {
      return 'Invalid cursor';
    }
  }
  return null;
}

/** GET /api/v1/staff/log?actorId&targetType&targetId&capability&cursor */
export async function getStaffLog(req, res, next) {
  try {
    const query = req.query ?? {};
    const problem = validateQuery(query);
    if (problem) {
      return invalid(res, problem);
    }

    const seesAll = hasCapability(req.staff.role, 'log.view.all');
    const result = await listStaffActions({
      actorId: seesAll ? query.actorId : req.staff.id,
      targetType: query.targetType,
      targetId: query.targetId,
      capability: query.capability,
      cursor: query.cursor === undefined ? undefined : Number(query.cursor),
    });
    return res.status(200).json(result);
  } catch (error) {
    logger.error(`[staff] log read failed: ${error.message}`);
    return next(error);
  }
}
