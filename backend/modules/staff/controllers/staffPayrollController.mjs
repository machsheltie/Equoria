/**
 * The owner's manual groom payday (Equoria-opdt7, owner ruling 2026-10-28, q262).
 *
 * POST /api/v1/staff/payroll/grooms/run runs behind
 * requireStaffCapability('payroll.run'), which the Owner alone holds, so it needs
 * the emailed staff check-in on this browser. It runs the same weekly pass the
 * Monday payday runs; a re-run in the same pay week pays nobody twice.
 */

import logger from '../../../utils/logger.mjs';
import { groomPayrollRun } from '../services/groomPayrollPort.mjs';

/** POST /api/v1/staff/payroll/grooms/run */
export async function runGroomPayroll(req, res, next) {
  try {
    logger.info(`[staff] manual groom payday run by ${req.staff.id}`);
    const results = await groomPayrollRun()();
    return res.json({ success: true, message: 'Groom payday completed', data: results });
  } catch (error) {
    return next(error);
  }
}
