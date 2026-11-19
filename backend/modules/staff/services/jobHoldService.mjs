/**
 * The durable nightly-job hold (Equoria-puj1e.5, owner ruling q377,
 * docs/features/admin-time-back.md "Nightly-job hold").
 *
 * One GameControl row (id 1). While it says held, every scheduled job records
 * 'skipped-held' and does nothing, so a hold survives a restart: there is no
 * in-memory state. No row means jobs run. Holding and releasing are the
 * owner's (`jobs.hold`), each recorded in the staff action log in the same
 * transaction.
 *
 * The hold is a quiescence barrier (Codex r2 #1). Every job run takes the
 * nightly-job barrier lock in SHARED mode inside its own lock transaction,
 * reads the hold there (admitJobRunTx), and keeps the lock until its body has
 * finished. Hold, release and time-back apply take the same lock EXCLUSIVELY
 * (lockJobHoldTx) before they read or change the hold. So:
 *   - a hold cannot commit while any job body is mid-run: it waits for it;
 *   - a job that has not yet read the hold waits for the hold to commit, then
 *     reads "held" and records 'skipped-held';
 *   - while apply holds the lock, no job body can be running or start.
 * The wait is bounded (holdLockWaitMs): past it the hold or apply is refused
 * with 'jobsRunning' and nothing changes.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';
import { recordStaffActionTx } from './staffActionLogService.mjs';

const controlId = 1;
const maxReasonLength = 500;
const barrierKey = jobNameToLockKey('nightlyJobBarrier');
/** How long hold, release or apply waits for a running job before refusing. */
const holdLockWaitMs = 10_000;
/** setJobHold's transaction outlives the bounded wait (Prisma's default is 5s). */
const holdTxTimeoutMs = holdLockWaitMs + 20_000;

/** A refused hold or release; `code` is for the API, the message for a person. */
export class JobHoldError extends AppError {
  constructor(message, statusCode, code) {
    super(message, statusCode);
    this.code = code;
  }
}

function shape(row) {
  return {
    held: row?.jobsHeld === true,
    heldAt: row?.jobsHeld ? row.heldAt : null,
    heldById: row?.jobsHeld ? row.heldById : null,
    reason: row?.jobsHeld ? row.reason : null,
  };
}

/**
 * The hold as stored. `client` may be a transaction.
 * @returns {Promise<{ held: boolean, heldAt: Date|null, heldById: string|null, reason: string|null }>}
 */
export async function readJobHold(client = prisma) {
  return shape(await client.gameControl.findUnique({ where: { id: controlId } }));
}

/** Whether nightly jobs are held right now. Errors propagate (the caller decides). */
async function isJobsHeld(client = prisma) {
  return (await readJobHold(client)).held;
}

/**
 * Admission for one job run, on the job's own lock transaction (cronLock's
 * `admit`): take the barrier in shared mode, held until that transaction ends,
 * then read the hold. False means the jobs are held and the run must not start.
 * Several jobs run side by side; only hold, release and apply exclude them.
 */
export async function admitJobRunTx(tx) {
  // $executeRaw: pg_advisory_xact_lock_shared returns void, which $queryRaw cannot read.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${barrierKey}::bigint)`;
  return !(await isJobsHeld(tx));
}

const isLockTimeout = error =>
  error?.meta?.code === '55P03' || /55P03|lock timeout/i.test(String(error?.message ?? ''));

/**
 * Take the barrier exclusively, waiting at most holdLockWaitMs for running jobs
 * to finish. Must be the transaction's first lock. The transaction's own
 * lock_timeout is put back afterwards, so later statements wait as before.
 */
async function excludeJobRunsTx(tx) {
  const [{ previous }] = await tx.$queryRaw`SELECT current_setting('lock_timeout') AS previous`;
  await tx.$queryRaw`SELECT set_config('lock_timeout', ${String(holdLockWaitMs)}, true)`;
  try {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${barrierKey}::bigint)`;
  } catch (error) {
    if (isLockTimeout(error)) {
      throw new JobHoldError(
        'A nightly job is running right now. Try again in a minute, once it finishes.',
        409,
        'jobsRunning',
      );
    }
    throw error;
  }
  await tx.$queryRaw`SELECT set_config('lock_timeout', ${previous}, true)`;
}

/**
 * Wait out any running job, keep new runs from starting until this transaction
 * ends, lock the control row (creating it, not held, if absent) and return the
 * hold. Serializes hold, release and time-back apply against each other and
 * against every job run. Must be the first statement of the transaction.
 */
export async function lockJobHoldTx(tx) {
  await excludeJobRunsTx(tx);
  await tx.$executeRaw`
    INSERT INTO "game_control" ("id", "jobsHeld", "updatedAt")
    VALUES (${controlId}, false, now()) ON CONFLICT ("id") DO NOTHING`;
  const [row] = await tx.$queryRaw`
    SELECT "jobsHeld", "heldAt", "heldById", "reason" FROM "game_control"
    WHERE "id" = ${controlId} FOR UPDATE`;
  return shape(row);
}

/**
 * Hold or release the nightly jobs.
 * @param {{ actor: { id: string, role: string }, held: boolean, reason?: string }} params
 * @returns {Promise<object>} the hold after the change
 */
export async function setJobHold({ actor, held, reason }) {
  const note = typeof reason === 'string' ? reason.trim().slice(0, maxReasonLength) : '';
  return prisma.$transaction(
    async tx => {
      const before = await lockJobHoldTx(tx);
      if (before.held === held) {
        throw held
          ? new JobHoldError('The nightly jobs are already held.', 409, 'jobsAlreadyHeld')
          : new JobHoldError('The nightly jobs are not held.', 409, 'jobsNotHeld');
      }
      const now = new Date();
      const row = await tx.gameControl.update({
        where: { id: controlId },
        data: held
          ? { jobsHeld: true, heldAt: now, heldById: actor.id, reason: note || null }
          : { jobsHeld: false, heldAt: null, heldById: null, reason: null },
      });
      await recordStaffActionTx(tx, {
        actorId: actor.id,
        actorRole: actor.role,
        capability: 'jobs.hold',
        targetType: 'game',
        targetId: 'nightlyJobs',
        reason: note || null,
        before: { held: before.held },
        after: { held },
      });
      return shape(row);
    },
    { timeout: holdTxTimeoutMs },
  );
}
