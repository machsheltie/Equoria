/**
 * The owner's outage tools (Equoria-puj1e.5, owner rulings q377/q378): hold
 * and release the nightly jobs, preview and give back outage time, undo it.
 *
 * Every route is behind requireStaffCapability('jobs.hold') or ('time-back'),
 * which the Owner alone holds. Apply and undo are also behind
 * requireFreshStaffProof, so each needs its own fresh emailed code.
 */

import logger from '../../../utils/logger.mjs';
import { JobHoldError, readJobHold, setJobHold } from '../services/jobHoldService.mjs';
import { StaffCheckinError } from '../services/staffCheckinService.mjs';
import { freshCodePurposes, requestFreshCode } from '../services/staffFreshCodeService.mjs';
import {
  TimeBackError,
  applyTimeBack,
  listTimeBacks,
  previewTimeBack,
  undoTimeBack,
} from '../services/timeBackService.mjs';

const codeRefusals = Object.freeze({
  rateLimited: {
    status: 429,
    code: 'staffCheckinRateLimited',
    message: 'Too many codes asked for. Wait a few minutes and try again.',
  },
  emailUnverified: {
    status: 403,
    code: 'staffEmailUnverified',
    message: 'Staff tools need a verified email address.',
  },
  codeInvalid: {
    status: 403,
    code: 'staffFreshCodeInvalid',
    message: 'That code is not right, or it has run out. Send a new code and try again.',
  },
});

function respondKnown(res, error) {
  if (error instanceof TimeBackError || error instanceof JobHoldError) {
    return res
      .status(error.statusCode)
      .json({ success: false, code: error.code, message: error.message });
  }
  if (error instanceof StaffCheckinError) {
    const refusal = codeRefusals[error.reason] ?? codeRefusals.codeInvalid;
    return res
      .status(refusal.status)
      .json({ success: false, code: refusal.code, message: refusal.message });
  }
  return null;
}

const actorOf = req => ({ id: req.staff.id, role: req.staff.role });
const windowOf = body => ({ start: body?.start, end: body?.end });

/** GET /api/v1/staff/jobs/hold */
export async function getJobHold(req, res, next) {
  try {
    return res.json({ success: true, data: await readJobHold() });
  } catch (error) {
    return next(error);
  }
}

/** POST /api/v1/staff/jobs/hold  Body: { reason? } */
export async function holdJobs(req, res, next) {
  try {
    const data = await setJobHold({ actor: actorOf(req), held: true, reason: req.body?.reason });
    logger.info(`[staff] nightly jobs held by ${req.staff.id}`);
    return res.json({ success: true, data });
  } catch (error) {
    return respondKnown(res, error) ?? next(error);
  }
}

/** POST /api/v1/staff/jobs/release */
export async function releaseJobs(req, res, next) {
  try {
    const data = await setJobHold({ actor: actorOf(req), held: false });
    logger.info(`[staff] nightly jobs released by ${req.staff.id}`);
    return res.json({ success: true, data });
  } catch (error) {
    return respondKnown(res, error) ?? next(error);
  }
}

/** POST /api/v1/staff/time-back/code  Body: { purpose: 'timeBackApply' | 'timeBackUndo' } */
export async function sendTimeBackCode(req, res, next) {
  try {
    const purpose = req.body?.purpose;
    if (!freshCodePurposes.includes(purpose)) {
      return res.status(400).json({
        success: false,
        code: 'staffFreshCodePurposeInvalid',
        message: 'Choose what the code is for.',
      });
    }
    await requestFreshCode(req.staffAccount, purpose);
    return res.status(202).json({ success: true, message: 'A code is on its way to your email.' });
  } catch (error) {
    return respondKnown(res, error) ?? next(error);
  }
}

/** GET /api/v1/staff/time-back */
export async function getTimeBacks(req, res, next) {
  try {
    return res.json({ success: true, data: await listTimeBacks() });
  } catch (error) {
    return next(error);
  }
}

/** GET /api/v1/staff/time-back/preview?start=YYYY-MM-DDTHH:mm&end=... (Eastern) */
export async function getTimeBackPreview(req, res, next) {
  try {
    return res.json({ success: true, data: await previewTimeBack(windowOf(req.query)) });
  } catch (error) {
    return respondKnown(res, error) ?? next(error);
  }
}

/** POST /api/v1/staff/time-back/apply  Body: { start, end, code } */
export async function applyTimeBackHandler(req, res, next) {
  try {
    const data = await applyTimeBack({
      actor: actorOf(req),
      input: windowOf(req.body),
      proof: req.freshProof,
    });
    logger.info(`[staff] time-back ${data.id} applied by ${req.staff.id}`);
    return res.json({ success: true, data });
  } catch (error) {
    return respondKnown(res, error) ?? next(error);
  }
}

/** POST /api/v1/staff/time-back/:timeBackId/undo  Body: { code } */
export async function undoTimeBackHandler(req, res, next) {
  try {
    const timeBackId = Number(req.params.timeBackId);
    if (!Number.isSafeInteger(timeBackId) || timeBackId <= 0) {
      return res.status(404).json({
        success: false,
        code: 'timeBackNotFound',
        message: 'No time-back has that number.',
      });
    }
    const data = await undoTimeBack({ actor: actorOf(req), timeBackId, proof: req.freshProof });
    logger.info(`[staff] time-back ${timeBackId} undone by ${req.staff.id}`);
    return res.json({ success: true, data });
  } catch (error) {
    return respondKnown(res, error) ?? next(error);
  }
}
