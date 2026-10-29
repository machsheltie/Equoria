/**
 * Durable staff-ticket email (STAFF-CR-10).
 *
 * Filing a ticket writes one `email_outbox` row per admin inside the ticket's
 * transaction, so the email exists exactly when the ticket does. After commit
 * the filing kicks a delivery of just its own rows (not awaited); the
 * scheduled `emailOutboxDelivery` job delivers whatever that kick did not,
 * whether the process restarted, the mail service was down, or the kick died.
 *
 * Each attempt claims one row at a time (FOR UPDATE SKIP LOCKED, attempts + 1,
 * claimedAt = now), then sends through the real email service. A claim older
 * than LEASE_MS belongs to a worker that died; the next run retakes it as the
 * same attempt (STAFF-RR-02), so a crash before the send never uses up one of
 * the MAX_ATTEMPTS. Two workers never hold the same row, so a send is never
 * duplicated except when the process dies after the provider accepted the
 * message and before the row is marked sent (no mail provider here offers an
 * idempotent send).
 *
 * The recipient is re-read under a shared lock on their user row, held through
 * the send (STAFF-RR-06): a demotion or email change waits for an in-flight
 * send, and a send waits for an in-flight change and then reads its result, so
 * no alert goes to an admin already demoted or to an address already replaced.
 * The email service's own timeouts end every send well inside sendTxTimeoutMs.
 *
 * A failed send waits BACKOFF_MS before the next try; the MAX_ATTEMPTS-th
 * failure ends the row as `failed`, logged as an error and counted in the
 * job's summary on /api/admin/cron/health. When it comes due, an email whose
 * recipient is no longer a verified admin is `cancelled`, not sent.
 */

import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { maskEmailsInText } from '../../../utils/emailIdentityPolicy.mjs';
import { sendStaffTicketEmail } from '../../../utils/emailService.mjs';
import { hasCapability } from '../capabilities.mjs';

export const MAX_ATTEMPTS = 5;
/** Far longer than one send can take (see sendTxTimeoutMs). */
export const LEASE_MS = 15 * 60 * 1000;
/**
 * Most one send may hold the recipient's row lock. Both transports give up
 * long before (emailService SMTP timeouts, the Gmail transport's per-stage
 * timeout), and it is well inside the lease.
 */
const sendTxTimeoutMs = 3 * 60 * 1000;
/**
 * A scheduled run stops claiming once this long has passed since its first
 * claim (STAFF-RR-08), so with the one send still in flight it ends inside the
 * job's 5-minute period; what it did not reach stays due for the next run.
 */
export const runBudgetMs = 3 * 60 * 1000;
/** Wait after the 1st, 2nd, 3rd and 4th failed attempt. */
const BACKOFF_MS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];
/** Most rows one run delivers; the rest wait for the next run. */
const MAX_PER_RUN = 50;
const ERROR_TEXT_LIMIT = 1000;

const TICKET_TEMPLATE = 'staffTicket';

export const ticketEmailKey = (ticketId, recipientId) =>
  `${TICKET_TEMPLATE}:${ticketId}:${recipientId}`;

/**
 * Queue the ticket alert for each recipient inside the filing transaction.
 * A (ticket, recipient) pair already queued is left as it is.
 * @returns {Promise<string[]>} the rows' idempotency keys
 */
export async function enqueueTicketEmailsTx(tx, recipients, { ticketId, category, filedBy }) {
  // Due now by this process's clock, the one every claim compares against;
  // the column default comes from Prisma's engine clock, which can run a few
  // ms ahead, and the kick would then find its own row not yet due.
  const nextAttemptAt = new Date();
  const data = recipients.map(recipient => ({
    idempotencyKey: ticketEmailKey(ticketId, recipient.id),
    recipientId: recipient.id,
    templateKey: TICKET_TEMPLATE,
    payload: { ticketId, category, filedBy },
    nextAttemptAt,
  }));
  if (data.length > 0) {
    await tx.emailOutbox.createMany({ data, skipDuplicates: true });
  }
  return data.map(row => row.idempotencyKey);
}

// Timestamps are stored as UTC wall time; pass instants as text so the
// session time zone never shifts a comparison.
const utc = date => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

/**
 * Claim the next due row: pending and due, or claimed by a worker whose
 * lease ran out. `keys` limits the claim to those rows (the post-commit kick).
 * @returns {Promise<object[]>} zero or one claimed row
 */
export async function claimDueEmails({ now = new Date(), keys = null } = {}) {
  if (keys && keys.length === 0) {
    return [];
  }
  const leaseCutoff = new Date(now.getTime() - LEASE_MS);
  const scope = keys ? Prisma.sql`AND "idempotencyKey" IN (${Prisma.join(keys)})` : Prisma.empty;
  // Composed with Prisma.sql and passed whole, so the nested fragments are
  // never mistaken for values.
  //
  // The due row is picked in a MATERIALIZED CTE, run exactly once
  // (Equoria-7ykaq). As an UPDATE ... FROM (subquery) the pick was up to the
  // planner: when the table's statistics said it held about one row, it put
  // email_outbox outermost and re-ran the subquery for each row, and SKIP
  // LOCKED stepped past the rows the statement had just claimed, so one claim
  // marked every due row 'sending' and returned them all. The caller delivers
  // only the first; the rest sat claimed, unsent, until the lease ran out.
  return prisma.$queryRaw(Prisma.sql`
    WITH due AS MATERIALIZED (
      SELECT id FROM email_outbox
      WHERE ((status = 'pending' AND "nextAttemptAt" <= ${utc(now)})
          OR (status = 'sending' AND "claimedAt" <= ${utc(leaseCutoff)}))
        ${scope}
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE email_outbox AS o
    SET status = 'sending', "claimedAt" = ${utc(now)},
        -- Retaking a lapsed claim resumes the attempt its worker never finished.
        attempts = CASE WHEN o.status = 'sending' THEN o.attempts ELSE o.attempts + 1 END,
        "updatedAt" = ${utc(now)}
    FROM due
    WHERE o.id = due.id
    RETURNING o.id, o."idempotencyKey", o."recipientId", o."templateKey", o.payload,
              o.attempts, o."claimedAt"`);
}

/** The stored ticket details, or null when the payload is not usable. */
function ticketDetails(raw) {
  const value = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const { ticketId, category, filedBy } = value;
  return Number.isInteger(ticketId) && typeof category === 'string' && typeof filedBy === 'string'
    ? { ticketId, category, filedBy }
    : null;
}

/** Whether the recipient should still get a ticket alert: a verified admin. */
const stillWanted = user =>
  Boolean(user) &&
  user.emailVerified === true &&
  Boolean(user.email) &&
  hasCapability(user.role, 'ticket.resolve');

/**
 * STAFF-RR-06: check the recipient and send to the address read, holding a
 * shared lock on their user row from the check until the send ends. Every
 * role or email change updates that row, so it waits for this send, and this
 * send waits for a change already in flight and reads what it committed.
 * @returns {Promise<{ cancelled?: true, sent?: true, error?: unknown }>}
 */
async function sendUnderRecipientLock(recipientId, details) {
  let outcome = null;
  try {
    await prisma.$transaction(
      async tx => {
        const [user] = await tx.$queryRaw`
          SELECT email, "emailVerified", role FROM "User" WHERE id = ${recipientId} FOR SHARE`;
        if (!stillWanted(user)) {
          outcome = { cancelled: true };
          return;
        }
        try {
          await sendStaffTicketEmail(user.email, details);
          outcome = { sent: true };
        } catch (error) {
          outcome = { error };
        }
      },
      { timeout: sendTxTimeoutMs },
    );
  } catch (error) {
    // A send that finished stands even if releasing the lock failed; without
    // one, the row keeps its claim and the lease hands it to a later run.
    if (!outcome) {
      throw error;
    }
  }
  return outcome;
}

/**
 * Deliver one claimed row; returns the summary bucket it lands in. Logs come
 * before the row's final write, so nothing of this delivery runs after the
 * row is seen settled.
 */
async function deliver(row, clock) {
  // Only the holder of this claim may finish the row.
  const finish = data =>
    prisma.emailOutbox.updateMany({
      where: { id: row.id, status: 'sending', claimedAt: row.claimedAt },
      data,
    });
  const fail = async message => {
    logger.error(
      `[emailOutbox] ${row.idempotencyKey} failed for good after ${row.attempts} attempt(s): ${message}`,
    );
    await finish({ status: 'failed', lastError: message });
    return 'failed';
  };

  const details = row.templateKey === TICKET_TEMPLATE ? ticketDetails(row.payload) : null;
  if (!details) {
    return fail(`unusable ${row.templateKey} payload`);
  }
  const outcome = await sendUnderRecipientLock(row.recipientId, details);
  if (outcome.cancelled) {
    logger.info(`[emailOutbox] ${row.idempotencyKey} cancelled: recipient no longer an admin`);
    await finish({ status: 'cancelled', lastError: 'recipient is no longer a verified admin' });
    return 'cancelled';
  }

  if (outcome.error) {
    const { error } = outcome;
    // Equoria-5vyuh: a provider error can name the recipient; mask before log/store.
    const message = maskEmailsInText(String(error?.message ?? error)).slice(0, ERROR_TEXT_LIMIT);
    if (row.attempts >= MAX_ATTEMPTS) {
      return fail(message);
    }
    const delay = BACKOFF_MS[Math.min(row.attempts, BACKOFF_MS.length) - 1];
    logger.warn(
      `[emailOutbox] ${row.idempotencyKey} attempt ${row.attempts} failed, retrying: ${message}`,
    );
    // Backoff runs from when this send failed, not from when the run began.
    await finish({
      status: 'pending',
      lastError: message,
      nextAttemptAt: new Date(clock().getTime() + delay),
    });
    return 'retrying';
  }

  const sentAt = clock();
  const marked = await finish({ status: 'sent', sentAt, lastError: null });
  if (marked.count === 0) {
    logger.warn(`[emailOutbox] ${row.idempotencyKey} sent after its claim lapsed`);
  }
  return 'sent';
}

/**
 * Deliver due rows one claim at a time. The clock is read afresh for every
 * claim and every backoff, so each row's lease starts just before its own
 * send however long earlier rows took (STAFF-CR-10 review). `clock` is a test
 * override; `keys` limits the run to those rows (the post-commit kick), and
 * the run stops once each of them has been claimed. A scheduled run (no keys)
 * also stops claiming after `budgetMs` from its first claim (STAFF-RR-08); a
 * kick is bounded by its own few rows.
 */
export async function runEmailOutbox({
  clock = () => new Date(),
  keys = null,
  budgetMs = keys ? Infinity : runBudgetMs,
} = {}) {
  const summary = { claimed: 0, sent: 0, retrying: 0, failed: 0, cancelled: 0 };
  const limit = keys ? Math.min(keys.length, MAX_PER_RUN) : MAX_PER_RUN;
  let startedAt = null;
  while (summary.claimed < limit) {
    const now = clock();
    startedAt ??= now.getTime();
    if (now.getTime() - startedAt >= budgetMs) {
      break;
    }
    const [row] = await claimDueEmails({ now, keys });
    if (!row) {
      break;
    }
    summary.claimed += 1;
    summary[await deliver(row, clock)] += 1;
  }
  return summary;
}

export const SENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const FAILED_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Retention (STAFF-CR-10 review): a sent or cancelled email is deleted 30
 * days after it settled, a failed one 90 days after (time for the admin to
 * see it on the cron-health page and in the table). Strictly older than the
 * cutoff, so a rerun with the same clock deletes nothing more. Pending and
 * sending rows are never deleted here. Runs in the nightly staff retention job.
 */
export async function purgeSettledEmails(now = new Date()) {
  const sentCutoff = new Date(now.getTime() - SENT_RETENTION_MS);
  const failedCutoff = new Date(now.getTime() - FAILED_RETENTION_MS);
  const { count } = await prisma.emailOutbox.deleteMany({
    where: {
      OR: [
        { status: { in: ['sent', 'cancelled'] }, updatedAt: { lt: sentCutoff } },
        { status: 'failed', updatedAt: { lt: failedCutoff } },
      ],
    },
  });
  return {
    emailsDeleted: count,
    sentCutoff: sentCutoff.toISOString(),
    failedCutoff: failedCutoff.toISOString(),
  };
}

export const FORMER_STEWARD = 'A former steward';

/**
 * Account erasure (STAFF-CR-10 review): the outbox rows about tickets this
 * user filed stop naming them. Runs inside the erasure transaction, before
 * the user row goes (while filedById still points at them). updatedAt is left
 * alone so retention timing is unchanged.
 * @returns {Promise<number>} rows scrubbed
 */
export async function scrubTicketEmailFilerTx(tx, userId) {
  return tx.$executeRaw`
    UPDATE email_outbox
    SET payload = jsonb_set(payload, '{filedBy}', to_jsonb(${FORMER_STEWARD}::text))
    WHERE "templateKey" = ${TICKET_TEMPLATE}
      AND (payload->>'ticketId') IN (
        SELECT id::text FROM staff_tickets WHERE "filedById" = ${userId}
      )`;
}

// Post-commit deliveries still running in this process. The request never waits
// for them; whenTicketEmailKicksFinish lets a caller that must (a test, a
// shutdown) wait for the real completion instead of guessing a time.
const runningKicks = new Set();

/**
 * After-commit kick for a filing's own rows. Never awaited by the request;
 * anything it cannot deliver stays in the outbox for the scheduled job.
 */
export function kickTicketEmails(keys) {
  if (keys.length === 0) {
    return;
  }
  const run = runEmailOutbox({ keys })
    .catch(error => {
      logger.error(
        `[emailOutbox] post-commit delivery stopped: ${maskEmailsInText(error.message)}; the job will retry`,
      );
    })
    .finally(() => runningKicks.delete(run));
  runningKicks.add(run);
}

/** Resolves once every post-commit delivery started in this process has finished. */
export async function whenTicketEmailKicksFinish() {
  while (runningKicks.size > 0) {
    await Promise.all([...runningKicks]);
  }
}
