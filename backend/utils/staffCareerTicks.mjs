/**
 * The career-week record (Equoria-puj1e.5, Codex r2 #2/#3;
 * docs/features/admin-time-back.md, rule 3).
 *
 * Every career week a weekly staff pass adds to a groom, rider or trainer is
 * recorded in staff_career_ticks in the SAME statement or transaction as the
 * increment, so a record exists exactly when the week was added. An outage
 * time-back gives back only the weeks recorded inside its window, to the staff
 * they were added to — never a week the pass skipped (an inactive groom) or
 * failed to add (a per-groom error, or the trainers' half failing after the
 * riders' half committed).
 *
 * Instants are bound as ISO text through timestamptz to UTC, never as raw Date
 * binds (a non-UTC session shifts those, Equoria-7uphu).
 */

import { Prisma } from '../../packages/database/prismaClient.mjs';

/** The staff table each recorded kind's week was added to. */
export const careerTickTables = Object.freeze({
  groom: 'grooms',
  rider: 'riders',
  trainer: 'trainers',
});

const utcInstant = date => Prisma.sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

/**
 * Add one career week to the `staffKind` rows matching `condition` (SQL over
 * the staff table) and record each, in one statement: both happen or neither
 * does. Resolves to how many were aged.
 */
function tickStaff(client, staffKind, condition, at) {
  const table = Prisma.raw(`"${careerTickTables[staffKind]}"`);
  const when = utcInstant(at);
  return client.$executeRaw`
    WITH ticked AS (
      UPDATE ${table} SET "careerWeeks" = "careerWeeks" + 1, "updatedAt" = ${when}
      WHERE ${condition}
      RETURNING "id"
    )
    INSERT INTO "staff_career_ticks" ("staffKind", "staffId", "tickedAt")
    SELECT ${staffKind}, "id", ${when} FROM ticked`;
}

/** One career week for one staff member, recorded. Resolves to 1, or 0 when there is no such row. */
export function tickOneStaff(client, staffKind, staffId, at = new Date()) {
  return tickStaff(client, staffKind, Prisma.sql`"id" = ${staffId}`, at);
}

/** One career week for every staff member of `staffKind` not retired, each recorded. */
export function tickEveryActiveStaff(client, staffKind, at = new Date()) {
  return tickStaff(client, staffKind, Prisma.sql`"retired" = false`, at);
}
