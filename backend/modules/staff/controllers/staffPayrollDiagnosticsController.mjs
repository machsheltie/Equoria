/**
 * The owner's payroll diagnostics (Equoria-brh8c, owner ruling q158).
 *
 * Every route runs behind requireStaffCapability('payroll.diagnose'), which the
 * Owner alone holds, so it needs the emailed staff check-in on this browser.
 * The work is payrollDiagnosticsService.mjs and payrollDiagnosis.mjs.
 */

import {
  parseStaffType,
  payrollFailuresFor,
  rerunPayrollFailure,
  searchPayrollStaff,
  testRunPayrollFailure,
} from '../services/payrollDiagnosticsService.mjs';
import { diagnosePayrollStaff } from '../services/payrollDiagnosis.mjs';

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 && String(id) === String(value) ? id : null;
}

/** Reads :staffType and :staffId; answers 400 and returns null when either is wrong. */
function parseTarget(req, res) {
  const staffId = parseId(req.params.staffId);
  if (!['groom', 'rider'].includes(req.params.staffType) || staffId === null) {
    res.status(400).json({ success: false, message: 'Invalid groom or rider' });
    return null;
  }
  return { staffType: req.params.staffType, staffId };
}

/** Refusals the tools raise carry a status and a code; anything else is the error handler's. */
function respondRefusal(error, res, next) {
  if (error?.statusCode >= 400 && error.statusCode < 500 && error.code) {
    return res
      .status(error.statusCode)
      .json({ success: false, code: error.code, message: error.message });
  }
  if (error?.code === 'rerunFailed') {
    return res.status(500).json({ success: false, code: error.code, message: error.message });
  }
  return next(error);
}

/** GET /api/v1/staff/payroll/staff?type=groom|rider&q=name */
export async function searchPayroll(req, res, next) {
  try {
    const staffType = parseStaffType(req.query.type);
    const staff = await searchPayrollStaff(staffType, req.query.q ?? '');
    return res.json({ success: true, staff });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/** GET /api/v1/staff/payroll/:staffType/:staffId/failures */
export async function getPayrollFailures(req, res, next) {
  try {
    const target = parseTarget(req, res);
    if (!target) {
      return undefined;
    }
    const result = await payrollFailuresFor(target.staffType, target.staffId);
    return res.json({ success: true, ...result });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/** GET /api/v1/staff/payroll/:staffType/:staffId/diagnose: the report to copy (Markdown text). */
export async function diagnosePayroll(req, res, next) {
  try {
    const target = parseTarget(req, res);
    if (!target) {
      return undefined;
    }
    const diagnosis = await diagnosePayrollStaff(target.staffType, target.staffId);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, diagnosis });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

function parseFailureId(req, res) {
  const failureId = parseId(req.params.failureId);
  if (failureId === null) {
    res.status(400).json({ success: false, message: 'Invalid failure' });
  }
  return failureId;
}

/** POST /api/v1/staff/payroll/:staffType/:staffId/failures/:failureId/test-run */
export async function testRunPayroll(req, res, next) {
  try {
    const target = parseTarget(req, res);
    const failureId = target ? parseFailureId(req, res) : null;
    if (!target || failureId === null) {
      return undefined;
    }
    const testRun = await testRunPayrollFailure(target.staffType, target.staffId, failureId, {
      actor: { id: req.staff.id, role: req.staff.role },
    });
    return res.json({ success: true, testRun });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/** POST /api/v1/staff/payroll/:staffType/:staffId/failures/:failureId/rerun */
export async function rerunPayroll(req, res, next) {
  try {
    const target = parseTarget(req, res);
    const failureId = target ? parseFailureId(req, res) : null;
    if (!target || failureId === null) {
      return undefined;
    }
    const result = await rerunPayrollFailure(target.staffType, target.staffId, failureId, {
      actor: { id: req.staff.id, role: req.staff.role },
    });
    return res.json({ success: true, result });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}
