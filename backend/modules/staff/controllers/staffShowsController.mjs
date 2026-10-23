/**
 * Staff view of quarantined shows (Equoria-c7mx0.1).
 *
 * GET /api/v1/staff/shows/quarantined runs behind
 * requireStaffCapability('shows.quarantine.view'), which the owner alone holds
 * (owner ruling 2026-10-23, Equoria-ehlbj: quarantined shows are visible only to
 * the Owner). The owner's Diagnose, Preview and Run tools sit beside it; they
 * are the competition module's, reached through the port the app layer fills.
 */

import { listQuarantinedShows } from '../services/quarantinedShowsService.mjs';
import { listShowScoreInputs } from '../services/showScoreInputsService.mjs';
import { quarantinedShowTools } from '../services/quarantinedShowToolsPort.mjs';

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

/** GET /api/v1/staff/shows/quarantined/:showId/diagnose: the export, as a download. */
export async function diagnoseShow(req, res, next) {
  try {
    const showId = parseShowId(req, res);
    if (showId === null) {
      return undefined;
    }
    const diagnosis = await quarantinedShowTools().diagnoseQuarantinedShow(showId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="quarantined-show-${showId}-diagnosis.json"`,
    );
    return res.json({ success: true, diagnosis });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/** POST /api/v1/staff/shows/quarantined/:showId/preview: placements and prizes; moves nothing. */
export async function previewShow(req, res, next) {
  try {
    const showId = parseShowId(req, res);
    if (showId === null) {
      return undefined;
    }
    const preview = await quarantinedShowTools().previewQuarantinedShow(showId);
    return res.json({ success: true, preview });
  } catch (error) {
    return respondRefusal(error, res, next);
  }
}

/** POST /api/v1/staff/shows/quarantined/:showId/run: settle once, after a preview. */
export async function runShow(req, res, next) {
  try {
    const showId = parseShowId(req, res);
    if (showId === null) {
      return undefined;
    }
    const result = await quarantinedShowTools().runQuarantinedShow(showId, {
      actor: { id: req.staff.id, role: req.staff.role },
      previewDigest: req.body?.previewDigest,
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
