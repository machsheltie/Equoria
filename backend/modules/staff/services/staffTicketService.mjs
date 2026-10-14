/**
 * Staff ticket service (Equoria-puj1e.1, Task 6)
 *
 * Moderators file tickets for the admin. Every write is one transaction that
 * also creates the in-game notifications and the staff action-log entry.
 * Bells are finalized and emails sent only after commit; an email failure is
 * logged and never thrown, so the ticket and its bell always stand. Emails are
 * not awaited: a slow or hung mail server never delays the filing response.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { sendStaffTicketEmail } from '../../../utils/emailService.mjs';
import {
  createNotificationTx,
  finalizeNotificationAfterCommit,
} from '../../../utils/notificationService.mjs';
import AppError from '../../../errors/AppError.mjs';
import { assertActionableTarget, hasCapability } from '../capabilities.mjs';
import { recordStaffActionTx } from './staffActionLogService.mjs';

export const LIST_LIMIT = 100;
const MAX_INT4 = 2147483647;

/** A positive int4 written plainly (no sign, no leading zero), else null. */
export const parseTicketId = raw =>
  typeof raw === 'string' && /^[1-9]\d{0,9}$/.test(raw) && Number(raw) <= MAX_INT4
    ? Number(raw)
    : null;

const seesAll = staff => hasCapability(staff.role, 'ticket.resolve');

/**
 * A moderator sees only tickets they filed. An erased filer leaves filedById
 * null (Equoria-2yugk); such a ticket is visible only to ticket.resolve
 * holders, so the moderator filter must never be widened or dropped.
 */
function ownedBy(staff) {
  if (typeof staff.id !== 'string' || staff.id === '') {
    // Prisma drops an undefined filter, which would widen to every ticket.
    throw new Error('[staff] a ticket query needs the staff account id');
  }
  return { filedById: staff.id };
}

/** Tickets a moderator did not file read as missing, not forbidden. */
const visibleWhere = (staff, id) => (seesAll(staff) ? { id } : { id, ...ownedBy(staff) });

const notFound = () => ({ error: 'not_found' });

function finalizeAll(notes) {
  for (const { userId, type, payload } of notes) {
    finalizeNotificationAfterCommit(userId, type, payload);
  }
}

/** One admin email, own try/catch: failure is logged and swallowed. */
async function emailAdmin(admin, details) {
  try {
    await sendStaffTicketEmail(admin.email, details);
    return { to: admin.email, sent: true };
  } catch (error) {
    logger.error(`[staff] ticket email failed for ticket ${details.ticketId}: ${error.message}`);
    return { to: admin.email, sent: false, error: error.message };
  }
}

// The most recent filing's email batch. One reference, overwritten per filing,
// so nothing accumulates; tests await it to see real delivery outcomes.
let lastTicketEmails = Promise.resolve([]);

/** Test-only: the per-admin outcomes of the most recent filing's emails. */
export function _lastTicketEmails() {
  return lastTicketEmails;
}

const NO_PLAYER = { error: 'no_player' };
const NOT_A_PLAYER = { error: 'not_a_player' };
const NAME_ID_DISAGREE = { error: 'name_id_mismatch' };
const NO_TARGET = { error: 'no_target' };

/**
 * The player a ticket names, by ID, by username, or by both. Usernames match
 * exactly as stored (the same findUnique rule the staff roles lookup uses).
 * Unknown name and unknown ID give the same refusal.
 *
 * Players only (owner ruling 2026-10-13, STAFF-CR-02): the filer, another
 * moderator and the admin are refused by the shared actionable-target rule,
 * whichever way they were named. The role is read under a row lock, so a
 * promotion either commits first and is seen, or waits for this filing.
 */
async function resolvePlayer(tx, staff, { targetId, targetUsername }) {
  const [byId, byName] = await Promise.all([
    targetId ? tx.user.findUnique({ where: { id: targetId }, select: { id: true } }) : null,
    targetUsername
      ? tx.user.findUnique({ where: { username: targetUsername }, select: { id: true } })
      : null,
  ]);
  if ((targetId && !byId) || (targetUsername && !byName)) {
    return NO_PLAYER;
  }
  if (byId && byName && byId.id !== byName.id) {
    return NAME_ID_DISAGREE;
  }
  const id = (byId ?? byName).id;
  const [locked] = await tx.$queryRaw`SELECT id, role FROM "User" WHERE id = ${id} FOR UPDATE`;
  if (!locked) {
    return NO_PLAYER;
  }
  try {
    assertActionableTarget({ actorId: staff.id, targetUser: locked });
  } catch (error) {
    if (error instanceof AppError) {
      return NOT_A_PLAYER;
    }
    throw error;
  }
  return { id: locked.id };
}

// The authoritative row for each non-player target (STAFF-CR-07).
const TARGET_TABLES = {
  horse: tx => tx.horse,
  show: tx => tx.show,
  post: tx => tx.forumPost,
};

/**
 * The horse, show or forum post a ticket names. Its ID is a positive integer
 * written plainly; anything else, and any ID with no row, is the same
 * NO_TARGET, so the answer never says which.
 */
async function resolveTarget(tx, targetType, targetId) {
  const table = TARGET_TABLES[targetType];
  if (!table) {
    throw new Error(`[staff] unknown ticket target type: ${targetType}`);
  }
  const id = parseTicketId(targetId);
  if (id === null) {
    return NO_TARGET;
  }
  const row = await table(tx).findUnique({ where: { id }, select: { id: true } });
  return row ? { id: String(row.id) } : NO_TARGET;
}

/** Attach each user-targeted ticket's current username in one query. */
async function withTargetUsernames(tickets) {
  const ids = [...new Set(tickets.filter(t => t.targetType === 'user').map(t => t.targetId))];
  const rows = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, username: true },
      })
    : [];
  const names = new Map(rows.map(row => [row.id, row.username]));
  return tickets.map(t =>
    t.targetType === 'user' ? { ...t, targetUsername: names.get(t.targetId) ?? null } : t,
  );
}

export async function fileTicket(staff, { targetType, targetId, targetUsername, category, note }) {
  const notes = [];
  const outcome = await prisma.$transaction(async tx => {
    const target =
      targetType === 'user'
        ? await resolvePlayer(tx, staff, { targetId, targetUsername })
        : await resolveTarget(tx, targetType, targetId);
    if (target.error) {
      return target;
    }
    const resolvedId = target.id;
    const filerRow = await tx.user.findUnique({
      where: { id: staff.id },
      select: { username: true },
    });
    const created = await tx.staffTicket.create({
      data: { filedById: staff.id, targetType, targetId: resolvedId, category, note },
    });
    const adminRows = await tx.user.findMany({
      where: { role: 'admin' },
      select: { id: true, email: true, emailVerified: true },
    });
    for (const admin of adminRows) {
      const payload = { ticketId: created.id, category };
      await createNotificationTx(tx, admin.id, 'staff_ticket', payload);
      notes.push({ userId: admin.id, type: 'staff_ticket', payload });
    }
    await recordStaffActionTx(tx, {
      actorId: staff.id,
      actorRole: staff.role,
      capability: 'ticket.file',
      targetType: 'ticket',
      targetId: String(created.id),
      reason: category,
    });
    return { ticket: created, admins: adminRows, filer: filerRow };
  });
  if (outcome.error) {
    return outcome;
  }
  const { ticket, admins, filer } = outcome;

  finalizeAll(notes);
  const details = { ticketId: ticket.id, category, filedBy: filer?.username ?? 'A moderator' };
  const batch = Promise.allSettled(
    admins
      .filter(admin => admin.emailVerified === true && admin.email)
      .map(admin => emailAdmin(admin, details)),
  ).then(results => results.map(result => result.value));
  // Deliberately not awaited; emailAdmin never rejects, so nothing goes unhandled.
  lastTicketEmails = batch;
  return { ticket };
}

export async function listTickets(staff, status) {
  const where = seesAll(staff) ? {} : ownedBy(staff);
  if (status) {
    where.status = status;
  }
  const tickets = await prisma.staffTicket.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: LIST_LIMIT,
    include: { filedBy: { select: { id: true, username: true } } },
  });
  return { tickets: await withTargetUsernames(tickets) };
}

export async function getTicket(staff, id) {
  const ticket = await prisma.staffTicket.findFirst({
    where: visibleWhere(staff, id),
    include: {
      filedBy: { select: { id: true, username: true } },
      replies: {
        orderBy: { id: 'asc' },
        include: { author: { select: { id: true, username: true } } },
      },
    },
  });
  return ticket ? { ticket: (await withTargetUsernames([ticket]))[0] } : notFound();
}

export async function addReply(staff, id, body) {
  const notes = [];
  const result = await prisma.$transaction(async tx => {
    const ticket = await tx.staffTicket.findFirst({ where: visibleWhere(staff, id) });
    if (!ticket) {
      return notFound();
    }
    const reply = await tx.staffTicketReply.create({
      data: { ticketId: id, authorId: staff.id, body },
    });
    // The reply text stays in the ticket thread; the log only notes that it happened.
    await recordStaffActionTx(tx, {
      actorId: staff.id,
      actorRole: staff.role,
      capability: 'ticket.reply',
      targetType: 'ticket',
      targetId: String(id),
      reason: null,
      before: null,
      after: null,
    });
    // The filer's own reply tells the admins; anyone else's tells the filer,
    // unless the filer's account was erased (filedById null): then no one.
    let recipients = [];
    if (ticket.filedById !== null && staff.id === ticket.filedById) {
      recipients = (await tx.user.findMany({ where: { role: 'admin' }, select: { id: true } })).map(
        row => row.id,
      );
    } else if (ticket.filedById !== null) {
      recipients = [ticket.filedById];
    }
    for (const userId of recipients) {
      const payload = { ticketId: id };
      await createNotificationTx(tx, userId, 'staff_ticket_update', payload);
      notes.push({ userId, type: 'staff_ticket_update', payload });
    }
    return { reply };
  });
  finalizeAll(notes);
  return result;
}

export async function setStatus(staff, id, status) {
  const notes = [];
  const result = await prisma.$transaction(async tx => {
    const ticket = await tx.staffTicket.findUnique({ where: { id } });
    if (!ticket) {
      return notFound();
    }
    const changed = await tx.staffTicket.updateMany({
      where: { id, status: ticket.status },
      data: { status },
    });
    if (changed.count !== 1) {
      return { error: 'conflict' };
    }
    await recordStaffActionTx(tx, {
      actorId: staff.id,
      actorRole: staff.role,
      capability: 'ticket.resolve',
      targetType: 'ticket',
      targetId: String(id),
      before: { status: ticket.status },
      after: { status },
    });
    // An erased filer (filedById null) has no one to tell.
    if (ticket.filedById !== null) {
      const payload = { ticketId: id, status };
      await createNotificationTx(tx, ticket.filedById, 'staff_ticket_update', payload);
      notes.push({ userId: ticket.filedById, type: 'staff_ticket_update', payload });
    }
    return { ticket: await tx.staffTicket.findUnique({ where: { id } }) };
  });
  finalizeAll(notes);
  return result;
}
