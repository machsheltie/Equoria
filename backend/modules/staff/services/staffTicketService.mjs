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

export async function fileTicket(staff, { targetType, targetId, category, note }) {
  const notes = [];
  const { ticket, admins, filer } = await prisma.$transaction(async tx => {
    const filerRow = await tx.user.findUnique({
      where: { id: staff.id },
      select: { username: true },
    });
    const created = await tx.staffTicket.create({
      data: { filedById: staff.id, targetType, targetId, category, note },
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
  return { tickets };
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
  return ticket ? { ticket } : notFound();
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
