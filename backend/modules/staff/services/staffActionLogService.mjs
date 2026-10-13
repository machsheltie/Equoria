/**
 * Staff action log service (Equoria-puj1e.1, Task 4)
 *
 * The log is permanent: this module exposes create and read only — no update,
 * no delete. Every staff tool records through recordStaffActionTx inside the
 * same transaction as the action, so an action and its entry commit or roll
 * back together. A failed attempt is recorded afterwards, outside any
 * transaction, with recordStaffFailure.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import AppError from '../../../errors/AppError.mjs';

export const LOG_PAGE_SIZE = 50;

/** Capabilities that need a stated reason: warn, freeze, any ban.*, roles.manage. */
export function isPunitiveCapability(capability) {
  return (
    typeof capability === 'string' &&
    (capability === 'warn' ||
      capability === 'freeze' ||
      capability === 'roles.manage' ||
      capability.startsWith('ban.'))
  );
}

const isBlank = value => typeof value !== 'string' || value.trim() === '';

// Prisma wants an omitted field, not null, for an optional Json column.
const jsonOrOmit = value => (value === null || value === undefined ? undefined : value);

function buildData(entry, outcome) {
  const {
    actorId,
    actorRole,
    capability,
    targetType,
    targetId,
    reason,
    before,
    after,
    reversesId,
    error,
  } = entry;
  return {
    actorId,
    actorRole,
    capability,
    targetType,
    targetId: targetId ?? null,
    reason: isBlank(reason) ? null : reason.trim(),
    before: jsonOrOmit(before),
    after: jsonOrOmit(after),
    outcome,
    error: outcome === 'failed' ? String(error ?? 'unknown error').slice(0, 1000) : null,
    reversesId: reversesId ?? null,
  };
}

/**
 * Record a succeeded staff action inside the caller's transaction.
 * @param {object} tx Prisma transaction client
 * @param {object} entry actorId, actorRole, capability, targetType, targetId?,
 *   reason?, before?, after?, reversesId?
 * @returns {Promise<object>} the created row
 * @throws {AppError} 400 when a punitive capability has no reason
 */
export async function recordStaffActionTx(tx, entry) {
  if (isPunitiveCapability(entry.capability) && isBlank(entry.reason)) {
    throw new AppError('A reason is required for this staff action', 400);
  }
  return tx.staffActionLog.create({ data: buildData(entry, 'succeeded') });
}

/**
 * Record a failed staff action outside any transaction (the action itself
 * rolled back, so there is no transaction to join). The reason is optional.
 * @param {object} entry as recordStaffActionTx, plus `error`
 * @returns {Promise<object>} the created row
 */
export async function recordStaffFailure(entry) {
  return prisma.staffActionLog.create({ data: buildData(entry, 'failed') });
}

/**
 * One page of entries, newest first by id.
 * @param {{ actorId?: string, targetType?: string, targetId?: string, capability?: string, cursor?: number }} filter
 * @returns {Promise<{ entries: object[], nextCursor: number | null }>}
 */
export async function listStaffActions({ actorId, targetType, targetId, capability, cursor } = {}) {
  const where = {};
  if (actorId !== undefined) {
    where.actorId = actorId;
  }
  if (targetType !== undefined) {
    where.targetType = targetType;
  }
  if (targetId !== undefined) {
    where.targetId = targetId;
  }
  if (capability !== undefined) {
    where.capability = capability;
  }
  if (cursor !== undefined) {
    where.id = { lt: cursor };
  }
  const rows = await prisma.staffActionLog.findMany({
    where,
    orderBy: { id: 'desc' },
    take: LOG_PAGE_SIZE + 1,
  });
  const entries = rows.slice(0, LOG_PAGE_SIZE);
  const nextCursor = rows.length > LOG_PAGE_SIZE ? entries[entries.length - 1].id : null;
  return { entries, nextCursor };
}
