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
 *   - while hold, apply or undo is still WAITING, it is not in the lock queue:
 *     it retries the lock without waiting (Postgres would queue every new
 *     shared request behind a waiting exclusive one, each holding a pooled
 *     connection; Equoria-puj1e.5.2). A job that starts during that wait is
 *     admitted, runs normally, and the hold waits for it too (owner q398);
 *   - once the hold has the lock, a job that has not yet read the hold waits
 *     for the hold to commit, then reads "held" and records 'skipped-held';
 *   - while apply or undo holds the lock, no job body can be running or start.
 * The wait is bounded (holdLockWaitMs): past it the hold, apply or undo is
 * refused with 'jobsRunning' and nothing changes.
 *
 * The show settlements that are not nightly jobs take the same barrier in
 * shared mode before any row lock (takeJobBarrierSharedTx, Equoria-puj1e.5.3):
 * the admin's run of every due show (POST /api/v1/shows/execute) for its whole
 * run, as the nightly show job does, and the Owner's Run Show and test run of a
 * quarantined show in their own transaction. So none of them settles a show
 * while apply, undo or a hold change holds the barrier (apply moves open shows'
 * dates), and those wait for a settlement already running. They do not read
 * the hold: only the nightly jobs stop while it is on.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';
import { recordStaffActionTx } from './staffActionLogService.mjs';

const controlId = 1;
const maxReasonLength = 500;
const barrierKey = jobNameToLockKey('nightlyJobBarrier');
/** How long hold, release, apply or undo waits for running jobs before refusing. */
const holdLockWaitMs = 10_000;
/** How often a waiting hold, release, apply or undo tries the barrier again. */
const barrierRetryMs = 50;
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
  await takeJobBarrierSharedTx(tx);
  return !(await isJobsHeld(tx));
}

/**
 * Take the nightly-job barrier in shared mode on `tx`, held until that
 * transaction ends: waits while hold, release, apply or undo holds it, and
 * keeps them out until `tx` ends. Must be the transaction's first lock. For a
 * show settlement that is not a nightly job (see the header); it does not read
 * the hold.
 */
export async function takeJobBarrierSharedTx(tx) {
  // $executeRaw: pg_advisory_xact_lock_shared returns void, which $queryRaw cannot read.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${barrierKey}::bigint)`;
}

/**
 * Take the barrier exclusively, waiting at most holdLockWaitMs for running jobs
 * to finish. Must be the transaction's first lock. It only ever TRIES the lock:
 * a blocking exclusive request would make every new shared admission queue
 * behind it (Equoria-puj1e.5.2), so instead jobs that start meanwhile run, and
 * this waits for them too, within the same bound.
 */
async function excludeJobRunsTx(tx) {
  const deadline = Date.now() + holdLockWaitMs;
  for (;;) {
    const [{ taken }] =
      await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${barrierKey}::bigint) AS taken`;
    if (taken === true) {
      return;
    }
    if (Date.now() >= deadline) {
      throw new JobHoldError(
        'A nightly job is running right now. Try again in a minute, once it finishes.',
        409,
        'jobsRunning',
      );
    }
    await new Promise(resolve => setTimeout(resolve, barrierRetryMs));
  }
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
