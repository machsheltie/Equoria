/**
 * Staff view of quarantined shows (Equoria-c7mx0.1).
 *
 * GET /api/v1/staff/shows/quarantined runs behind
 * requireStaffCapability('shows.quarantine.view'), which the owner alone holds
 * (owner ruling 2026-10-23, Equoria-ehlbj: quarantined shows are visible only to
 * the Owner). The owner's Diagnose, Test run and Run Show tools sit beside it; they
 * are the competition module's, reached through the port the app layer fills.
 */

import { listQuarantinedShows } from '../services/quarantinedShowsService.mjs';
import { listShowScoreInputs } from '../services/showScoreInputsService.mjs';
import { quarantinedShowTools } from '../services/quarantinedShowToolsPort.mjs';
import {
  fileOwnerReport,
  filingState,
  showFilingSubject,
} from '../services/ownerFilingService.mjs';

function parseShowId(req, res) {
  const showId = Number.parseInt(req.params.showId, 10);
  if (!Number.isInteger(showId) || showId < 1) {
    res.status(400).json({ success: false, message: 'Invalid show ID' });
    return null;
  }
  return showId;
}

/** Refusals the tools raise carry a status and a code; anything else is the error handler's. */
function respondRefusal(error, res, next) {
  if (error?.statusCode >= 400 && error.statusCode < 500 && error.code) {
    return res
      .status(error.statusCode)
      .json({ success: false, code: error.code, message: error.message });
  }
  if (error?.code === 'settlementFailed') {
    return res.status(500).json({ success: false, code: error.code, message: error.message });
  }
  return next(error);
}

/** GET /api/v1/staff/shows/quarantined/:showId/diagnose: the report to copy (Markdown text). */
export async function diagnoseShow(req, res, next) {
  try {
    const showId = parseShowId(req, res);
    if (showId === null) {
      return undefined;
    }
    const diagnosis = await quarantinedShowTools().diagnoseQuarantinedShow(showId);
    const filing = await filingState(await showFilingSubject(showId));
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, diagnosis, filing });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/**
 * POST /api/v1/staff/shows/quarantined/:showId/file: File for Claude Code
 * (Equoria-brh8c, q234). The report is built here, never taken from the browser.
 */
export async function fileShow(req, res, next) {
  try {
    const showId = parseShowId(req, res);
    if (showId === null) {
      return undefined;
    }
    const { report } = await quarantinedShowTools().diagnoseQuarantinedShow(showId);
    const filing = await fileOwnerReport(await showFilingSubject(showId), report, req.staff);
    return res.json({ success: true, filing });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/** POST /api/v1/staff/shows/quarantined/:showId/test-run: the real settlement, always rolled back. */
export async function testRunShow(req, res, next) {
  try {
    const showId = parseShowId(req, res);
    if (showId === null) {
      return undefined;
    }
    const testRun = await quarantinedShowTools().testRunQuarantinedShow(showId, {
      actor: { id: req.staff.id, role: req.staff.role },
    });
    return res.json({ success: true, testRun });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/** POST /api/v1/staff/shows/quarantined/:showId/run: settle once, after a passed test run. */
export async function runShow(req, res, next) {
  try {
    const showId = parseShowId(req, res);
    if (showId === null) {
      return undefined;
    }
    const result = await quarantinedShowTools().runQuarantinedShow(showId, {
      actor: { id: req.staff.id, role: req.staff.role },
    });
    return res.json({ success: true, result });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/** GET /api/v1/staff/shows/quarantined */
export async function getQuarantinedShows(req, res, next) {
  try {
    const shows = await listQuarantinedShows();
    res.json({ success: true, shows });
  } catch (error) {
    next(error);
  }
}

/** GET /api/v1/staff/shows/:showId/score-inputs (Equoria-4q02c) */
export async function getShowScoreInputs(req, res, next) {
  try {
    const showId = Number.parseInt(req.params.showId, 10);
    if (!Number.isInteger(showId) || showId < 1) {
      return res.status(400).json({ success: false, message: 'Invalid show ID' });
    }
    const results = await listShowScoreInputs(showId);
    return res.json({ success: true, showId, results });
  } catch (error) {
    return next(error);
  }
}
