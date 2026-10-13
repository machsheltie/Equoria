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
import { hasCapability } from '../capabilities.mjs';
import { recordStaffActionTx } from './staffActionLogService.mjs';

export const LIST_LIMIT = 100;
const MAX_INT4 = 2147483647;

export const parseTicketId = raw =>
  typeof raw === 'string' && /^[1-9]\d{0,9}$/.test(raw) && Number(raw) <= MAX_INT4
    ? Number(raw)
    : null;

const seesAll = staff => hasCapability(staff.role, 'ticket.resolve');

/** Tickets a moderator did not file read as missing, not forbidden. */
const visibleWhere = (staff, id) => (seesAll(staff) ? { id } : { id, filedById: staff.id });

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
const NAME_ID_DISAGREE = { error: 'name_id_mismatch' };

/**
 * The account a ticket names, by ID, by username, or by both. Usernames match
 * exactly as stored (the same findUnique rule the staff roles lookup uses).
 * Unknown name and unknown ID give the same refusal.
 */
async function resolvePlayer(tx, { targetId, targetUsername }) {
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
  return { id: (byId ?? byName).id };
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
    let resolvedId = targetId;
    if (targetType === 'user') {
      const player = await resolvePlayer(tx, { targetId, targetUsername });
      if (player.error) {
        return player;
      }
      resolvedId = player.id;
    }
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
  const where = seesAll(staff) ? {} : { filedById: staff.id };
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
    // The filer's own reply tells the admins; anyone else's tells the filer.
    const recipients =
      staff.id === ticket.filedById
        ? (await tx.user.findMany({ where: { role: 'admin' }, select: { id: true } })).map(
            row => row.id,
          )
        : [ticket.filedById];
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
    const payload = { ticketId: id, status };
    await createNotificationTx(tx, ticket.filedById, 'staff_ticket_update', payload);
    notes.push({ userId: ticket.filedById, type: 'staff_ticket_update', payload });
    return { ticket: await tx.staffTicket.findUnique({ where: { id } }) };
  });
  finalizeAll(notes);
  return result;
}
