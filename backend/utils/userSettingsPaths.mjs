/**
 * Atomic path updates for the `User.settings` jsonb document
 * (2026-09-05 security audit, Finding 1 — Equoria-6p398.1 / Equoria-q9nqm).
 *
 * ── The defect this exists to close ─────────────────────────────────────────
 * `User.settings` is ONE jsonb document shared by unrelated subsystems:
 * `inventory`, `craftingMaterials`, `milestones`, onboarding state,
 * `preferences` / `notifications` / `display` / `bio`, and the weekly
 * bank-claim marker `lastWeeklyClaimDate` (bank/controllers/bankController).
 *
 * Every writer used to read the whole document and write the whole document
 * back from that earlier snapshot:
 *
 *     const current = (await prisma.user.findUnique(...)).settings;
 *     await prisma.user.update({ data: { settings: { ...current, inventory } } });
 *
 * At PostgreSQL's READ COMMITTED isolation that snapshot goes stale the moment
 * any other request commits. The audit's executed exploit paused an equip after
 * its read, let `POST /bank/claim` commit (money +5,000 and the marker set),
 * then let equip write its stale document — erasing the marker and minting a
 * second 5,000-coin claim in the same week. Wrapping the final write in an
 * ordinary transaction does NOT help: the stale READ is the problem.
 *
 * ── The mechanism ───────────────────────────────────────────────────────────
 * One SQL statement that rewrites ONLY the named top-level keys via
 * `jsonb_set`, leaving every other key exactly as the database currently has
 * it. That is mechanism (1) of the repository's concurrency ruling — the same
 * primitive bankController already uses for the claim marker and
 * horseFeedService uses for `pregnancyFeedingsByTier`. No row lock is taken
 * and held (SELECT ... FOR UPDATE was removed under Equoria-5g5k for
 * pool-timeout reasons); the statement's own per-row write lock is all that is
 * needed.
 *
 * For keys whose new value is computed from the old value (an inventory array
 * being rewritten wholesale), a path update alone still loses a concurrent
 * writer's change to that SAME key. `expect` adds mechanism (2): a
 * compare-and-swap in the WHERE clause. The caller passes the value it read;
 * if the committed value no longer matches, zero rows are affected and the
 * caller must reject rather than continue with old data.
 *
 * @module utils/userSettingsPaths
 */

import { Prisma } from '../../packages/database/prismaClient.mjs';

/**
 * Top-level settings keys are code-authored identifiers, never player input.
 * The pattern is a fail-closed guard against a caller ever routing raw input
 * here — the key is still BOUND as a parameter, never spliced into SQL text.
 */
const SETTINGS_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function assertKey(key) {
  if (!SETTINGS_KEY_PATTERN.test(key)) {
    throw new Error(`updateUserSettingsPaths: unsafe settings key "${key}"`);
  }
}

/** Serialize a JS value for a jsonb bind parameter. `undefined` becomes null. */
function toJsonParam(value) {
  return JSON.stringify(value === undefined ? null : value);
}

/**
 * Update only the named top-level keys of `User.settings`, atomically.
 *
 * Every key not named in `set` keeps whatever the database currently holds —
 * including `lastWeeklyClaimDate`, materials, milestones and onboarding state
 * written by a concurrent request after this caller's read.
 *
 * @param {object} client - `prisma` or an interactive transaction client. Pass
 *   the SAME `tx` as the surrounding transaction; a default-argument fallback
 *   to the global client would silently escape the transaction boundary, so
 *   this parameter is required.
 * @param {string} userId - Target user id.
 * @param {object} options
 * @param {Record<string, unknown>} options.set - Top-level settings keys to
 *   write, mapped to their new values. At least one key is required.
 * @param {Record<string, {equals: unknown, whenMissing?: unknown}>} [options.expect]
 *   Optional compare-and-swap preconditions. For each entry the statement only
 *   applies when the stored value of that key equals `equals` (with an absent
 *   key read as `whenMissing`). Use it for any key whose new value was computed
 *   from a prior read of the same key.
 * @returns {Promise<number>} Rows affected: 1 on success, 0 when the user does
 *   not exist or a precondition no longer holds. Callers MUST check this.
 */
export async function updateUserSettingsPaths(client, userId, { set, expect } = {}) {
  if (!client || typeof client.$executeRaw !== 'function') {
    throw new Error('updateUserSettingsPaths: a Prisma client or tx client is required');
  }
  if (!userId) {
    throw new Error('updateUserSettingsPaths: userId is required');
  }

  const entries = Object.entries(set ?? {});
  if (entries.length === 0) {
    throw new Error('updateUserSettingsPaths: at least one settings key must be set');
  }

  // jsonb_set(target, path, new_value, create_missing) nested once per key, so
  // the statement rewrites exactly those paths and nothing else.
  let valueExpr = Prisma.sql`COALESCE("settings", '{}'::jsonb)`;
  for (const [key, value] of entries) {
    assertKey(key);
    valueExpr = Prisma.sql`jsonb_set(${valueExpr}, ARRAY[${key}::text], ${toJsonParam(value)}::jsonb, true)`;
  }

  const conditions = [Prisma.sql`"id" = ${userId}`];
  for (const [key, precondition] of Object.entries(expect ?? {})) {
    assertKey(key);
    const { equals, whenMissing = null } = precondition ?? {};
    conditions.push(
      Prisma.sql`COALESCE("settings" -> ${key}::text, ${toJsonParam(whenMissing)}::jsonb) = ${toJsonParam(equals)}::jsonb`,
    );
  }

  return client.$executeRaw(Prisma.sql`
    UPDATE "User"
    SET "settings" = ${valueExpr}, "updatedAt" = NOW()
    WHERE ${Prisma.join(conditions, ' AND ')}`);
}

export default updateUserSettingsPaths;
