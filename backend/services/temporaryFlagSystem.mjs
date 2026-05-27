/**
 * Temporary Epigenetic Flag System (Equoria-yzqhj.5)
 *
 * Every epigenetic flag in `Horse.epigeneticFlags` is PERMANENT once assigned
 * (flagAssignmentEngine.mjs / flagEvaluationEngine.mjs both state so). This
 * service adds the missing concept of TEMPORARY, environment-triggered
 * behavioral states that EXPIRE on their own.
 *
 * Storage (additive, separate column — never the permanent String[]):
 *   `Horse.temporaryEpigeneticFlags` is a JSONB array of
 *     { flag: string, expiresAt: ISO-string, source: string }
 *   The permanent `Horse.epigeneticFlags` column is untouched by this module;
 *   a temporary flag never duplicates a permanent flag's semantics — temporary
 *   flags live ONLY in the new column.
 *
 * Lifecycle:
 *   1. A real environmental event (startle / routine-change) calls
 *      `applyTemporaryFlag(horseId, flag, { source })`, which pushes an entry
 *      with `expiresAt = now + DURATION_DAYS[flag]`.
 *   2. A DAILY cron (`temporaryFlagExpiry` in cronJobs.mjs) calls
 *      `sweepExpiredTemporaryFlags()`, which removes any entry whose
 *      `expiresAt < now` from every horse with a non-empty array.
 *
 * Initial catalog (MINIMAL + extensible — flagged to the user for review):
 *   - `startled`  — triggered by a startle environmental event; 3-day expiry.
 *   - `unsettled` — triggered by a routine-change / care-gap event; 5-day expiry.
 * Adding a new temporary flag is a one-line addition to TEMPORARY_FLAG_DURATION_DAYS.
 *
 * Discipline notes:
 *   - JSONB type-guard before reading the Json column (CONTRIBUTING §1):
 *     Prisma returns the column as a JsonValue that could be null / a
 *     primitive / an object; `normalizeTempFlags()` coerces to a safe array.
 *   - Dedup: re-applying an already-active flag REFRESHES its expiresAt rather
 *     than appending a duplicate.
 *   - The sweep is SCOPED — it only reads horses with a non-empty temp array,
 *     and writes a per-horse `update` for the rows that actually changed. Never
 *     an unscoped deleteMany / updateMany over all horses.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from '../utils/logger.mjs';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Initial temporary-flag catalog. Maps flag name -> expiry duration in days.
 * MINIMAL by design; extend by adding an entry here. A flag not present here
 * is rejected by `applyTemporaryFlag` (fail-closed — no silent unknown flags).
 */
export const TEMPORARY_FLAG_DURATION_DAYS = Object.freeze({
  startled: 3, // startle environmental event
  unsettled: 5, // routine-change / care-gap event
});

/**
 * The canonical set of temporary-flag names. Used to validate input and to
 * keep `applyTemporaryFlag` from accepting an arbitrary string.
 */
export const TEMPORARY_FLAG_NAMES = Object.freeze(Object.keys(TEMPORARY_FLAG_DURATION_DAYS));

/**
 * JSONB type-guard + normalizer (CONTRIBUTING §1). Coerces a raw Prisma
 * JsonValue into a clean array of well-formed temp-flag entries. Anything
 * that is not a non-null, non-array object with a string `flag` and a valid
 * `expiresAt` is dropped — a malformed column never throws downstream.
 *
 * @param {*} raw - value of Horse.temporaryEpigeneticFlags from Prisma
 * @returns {Array<{flag:string, expiresAt:string, source:string}>}
 */
export function normalizeTempFlags(raw) {
  if (raw === null || raw === undefined || !Array.isArray(raw)) {
    return [];
  }
  const out = [];
  for (const entry of raw) {
    if (
      entry === null ||
      entry === undefined ||
      typeof entry !== 'object' ||
      Array.isArray(entry)
    ) {
      continue;
    }
    const { flag, expiresAt, source } = entry;
    if (typeof flag !== 'string' || typeof expiresAt !== 'string') {
      continue;
    }
    const ms = new Date(expiresAt).getTime();
    if (Number.isNaN(ms)) {
      continue;
    }
    out.push({ flag, expiresAt, source: typeof source === 'string' ? source : 'unknown' });
  }
  return out;
}

/**
 * Apply (or refresh) a temporary epigenetic flag on a horse.
 *
 * Pushes `{ flag, expiresAt: now + DURATION_DAYS[flag] days, source }` onto
 * `Horse.temporaryEpigeneticFlags`. Dedup: if the same flag is already active,
 * its `expiresAt` is REFRESHED (the entry is replaced) rather than duplicated.
 *
 * @param {number} horseId
 * @param {string} flag - must be a name in TEMPORARY_FLAG_DURATION_DAYS
 * @param {Object} [opts]
 * @param {string} [opts.source='environmental_event'] - originating event tag
 * @param {Date}   [opts.now] - inject "now" for deterministic tests
 * @returns {Promise<{flag:string, expiresAt:string, source:string,
 *                     temporaryEpigeneticFlags:Array}>}
 */
export async function applyTemporaryFlag(
  horseId,
  flag,
  { source = 'environmental_event', now } = {},
) {
  if (!Number.isInteger(horseId) || horseId <= 0) {
    throw new Error(`applyTemporaryFlag: invalid horseId ${horseId}`);
  }
  const durationDays = TEMPORARY_FLAG_DURATION_DAYS[flag];
  if (durationDays === undefined) {
    throw new Error(
      `applyTemporaryFlag: unknown temporary flag '${flag}' (known: ${TEMPORARY_FLAG_NAMES.join(', ')})`,
    );
  }

  const nowDate = now instanceof Date ? now : new Date();
  const expiresAt = new Date(nowDate.getTime() + durationDays * MS_PER_DAY).toISOString();

  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { id: true, temporaryEpigeneticFlags: true },
  });
  if (!horse) {
    throw new Error(`applyTemporaryFlag: horse ${horseId} not found`);
  }

  const current = normalizeTempFlags(horse.temporaryEpigeneticFlags);
  // Dedup: drop any existing entry with the same flag, then add the fresh one.
  const without = current.filter(e => e.flag !== flag);
  const entry = { flag, expiresAt, source };
  const next = [...without, entry];

  await prisma.horse.update({
    where: { id: horseId },
    data: { temporaryEpigeneticFlags: next },
  });

  logger.info(
    `[temporaryFlagSystem.applyTemporaryFlag] Horse ${horseId} flag '${flag}' ` +
      `(source=${source}) active until ${expiresAt}`,
  );

  return { ...entry, temporaryEpigeneticFlags: next };
}

/**
 * Sweep expired temporary flags off every horse that currently has any.
 *
 * Scoped: reads ONLY horses whose `temporaryEpigeneticFlags` is a non-empty
 * JSON array (Prisma filter), then for each horse drops entries whose
 * `expiresAt < now` and writes back ONLY when something actually changed.
 * Never an unscoped bulk delete/update.
 *
 * Idempotent: re-running with the same `now` is a no-op once everything
 * expired is gone.
 *
 * @param {Object} [opts]
 * @param {Date} [opts.now] - inject "now" for deterministic tests
 * @returns {Promise<{ horsesScanned:number, horsesUpdated:number,
 *                      flagsRemoved:number }>}
 */
export async function sweepExpiredTemporaryFlags({ now } = {}) {
  const nowMs = (now instanceof Date ? now : new Date()).getTime();

  // Scoped read: only horses that have at least one temp-flag entry. The
  // JSONB `not: { equals: [] }` filter excludes the overwhelming majority of
  // horses (default '[]') so the sweep stays efficient on a large table.
  const horses = await prisma.horse.findMany({
    where: { temporaryEpigeneticFlags: { not: [] } },
    select: { id: true, temporaryEpigeneticFlags: true },
  });

  let horsesUpdated = 0;
  let flagsRemoved = 0;

  for (const horse of horses) {
    const current = normalizeTempFlags(horse.temporaryEpigeneticFlags);
    if (current.length === 0) {
      continue;
    }
    const retained = current.filter(e => new Date(e.expiresAt).getTime() >= nowMs);
    const removedHere = current.length - retained.length;
    if (removedHere === 0) {
      continue; // nothing expired on this horse — leave untouched
    }
    await prisma.horse.update({
      where: { id: horse.id },
      data: { temporaryEpigeneticFlags: retained },
    });
    horsesUpdated += 1;
    flagsRemoved += removedHere;
  }

  logger.info(
    `[temporaryFlagSystem.sweepExpiredTemporaryFlags] Scanned ${horses.length} horse(s) with ` +
      `temp flags, updated ${horsesUpdated}, removed ${flagsRemoved} expired flag(s)`,
  );

  return { horsesScanned: horses.length, horsesUpdated, flagsRemoved };
}

export default { applyTemporaryFlag, sweepExpiredTemporaryFlags, normalizeTempFlags };
