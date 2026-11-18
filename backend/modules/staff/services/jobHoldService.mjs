/**
 * The durable nightly-job hold (Equoria-puj1e.5, owner ruling q377,
 * docs/features/admin-time-back.md "Nightly-job hold").
 *
 * One GameControl row (id 1). While it says held, every scheduled job records
 * 'skipped-held' and does nothing (CronJobMonitor.runWithHeartbeat reads it
 * before each run), so a hold survives a restart: there is no in-memory state.
 * No row means jobs run. Holding and releasing are the owner's (`jobs.hold`),
 * each recorded in the staff action log in the same transaction.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';
import { recordStaffActionTx } from './staffActionLogService.mjs';

const controlId = 1;
const maxReasonLength = 500;

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
export async function isJobsHeld(client = prisma) {
  return (await readJobHold(client)).held;
}

/**
 * Lock the control row inside a transaction (creating it, not held, if absent)
 * and return the hold. Serializes hold, release and time-back apply.
 */
export async function lockJobHoldTx(tx) {
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
  return prisma.$transaction(async tx => {
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
  });
}
