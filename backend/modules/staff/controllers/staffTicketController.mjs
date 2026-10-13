/**
 * Staff ticket controller (Equoria-puj1e.1, Task 6)
 *
 * Validation and HTTP shape only; the transactional work lives in
 * staffTicketService. Routes carry the capability guards.
 */

import logger from '../../../utils/logger.mjs';
import {
  addReply,
  fileTicket,
  getTicket,
  listTickets,
  parseTicketId,
  setStatus,
} from '../services/staffTicketService.mjs';

const TARGET_TYPES = new Set(['user', 'post', 'horse', 'show']);
const STATUSES = new Set(['open', 'in_progress', 'resolved', 'declined']);

const invalid = (res, message) => res.status(400).json({ success: false, message });
const missing = res => res.status(404).json({ success: false, message: 'Ticket not found' });

/** Trimmed non-empty string within max, else null. */
function text(value, max) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

function respond(res, result, status = 200) {
  if (result.error === 'not_found') {
    return missing(res);
  }
  if (result.error === 'conflict') {
    return res.status(409).json({
      success: false,
      message: 'The ticket changed while you were working. Reload and try again.',
    });
  }
  return res.status(status).json(result);
}

const fail = (error, label, next) => {
  logger.error(`[staff] ticket ${label} failed: ${error.message}`);
  return next(error);
};

export async function createTicket(req, res, next) {
  try {
    const body = req.body ?? {};
    const targetType = typeof body.targetType === 'string' ? body.targetType : null;
    const targetId = text(body.targetId, 64);
    const targetUsername = text(body.targetUsername, 100);
    const category = text(body.category, 40);
    const note = text(body.note, 2000);
    if (!TARGET_TYPES.has(targetType)) {
      return invalid(res, 'targetType must be user, post, horse or show');
    }
    if (!category || !note) {
      return invalid(res, 'category and note are required and must fit their limits');
    }
    // A present-but-unusable value (blank, overlong, not text) is refused, not ignored.
    if (
      (body.targetId !== undefined && body.targetId !== null && !targetId) ||
      (body.targetUsername !== undefined && body.targetUsername !== null && !targetUsername)
    ) {
      return invalid(res, 'The player or target is not valid');
    }
    if (targetType === 'user') {
      if (!targetId && !targetUsername) {
        return invalid(res, 'Name the player by username or by ID');
      }
    } else if (body.targetUsername !== undefined && body.targetUsername !== null) {
      return invalid(res, 'A username can only name a player');
    } else if (!targetId) {
      return invalid(res, 'targetId, category and note are required and must fit their limits');
    }
    const result = await fileTicket(req.staff, {
      targetType,
      targetId,
      targetUsername,
      category,
      note,
    });
    if (result.error === 'no_player') {
      return res.status(404).json({ success: false, message: 'No player by that name or ID' });
    }
    if (result.error === 'name_id_mismatch') {
      return invalid(res, 'The name and ID point to different players');
    }
    return res.status(201).json(result);
  } catch (error) {
    return fail(error, 'filing', next);
  }
}

export async function getTickets(req, res, next) {
  try {
    const { status } = req.query ?? {};
    if (status !== undefined && !(typeof status === 'string' && STATUSES.has(status))) {
      return invalid(res, 'Invalid status');
    }
    return res.status(200).json(await listTickets(req.staff, status));
  } catch (error) {
    return fail(error, 'list', next);
  }
}

export async function getTicketById(req, res, next) {
  try {
    const id = parseTicketId(req.params.id);
    if (id === null) {
      return missing(res);
    }
    return respond(res, await getTicket(req.staff, id));
  } catch (error) {
    return fail(error, 'read', next);
  }
}

export async function replyToTicket(req, res, next) {
  try {
    const id = parseTicketId(req.params.id);
    if (id === null) {
      return missing(res);
    }
    const body = text(req.body?.body, 2000);
    if (!body) {
      return invalid(res, 'A reply is required and must be 2000 characters or fewer');
    }
    return respond(res, await addReply(req.staff, id, body), 201);
  } catch (error) {
    return fail(error, 'reply', next);
  }
}

export async function changeTicketStatus(req, res, next) {
  try {
    const id = parseTicketId(req.params.id);
    if (id === null) {
      return missing(res);
    }
    const status = req.body?.status;
    if (typeof status !== 'string' || !STATUSES.has(status)) {
      return invalid(res, 'status must be open, in_progress, resolved or declined');
    }
    return respond(res, await setStatus(req.staff, id, status));
  } catch (error) {
    return fail(error, 'status change', next);
  }
}
