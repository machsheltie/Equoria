/**
 * Hoof-Condition Decay Service (Equoria-gg3v — farrier system enhancement loop)
 *
 * The farrier system (Equoria-8pes) lets a player book a service that
 * IMPROVES a horse's `Horse.hoofCondition` (excellent / good / fair / poor)
 * and stamps `Horse.lastFarrierDate`. Nothing ever degrades the condition,
 * so once a horse is shod its hooves stay perfect forever and the re-booking
 * loop is dead. This service closes that loop: a daily cron steps a horse's
 * hoof condition down over time since its last farrier visit, prompting the
 * player to re-book.
 *
 * Design decisions:
 *
 *   - **Expected-level model (idempotent, run-count independent).** The cron
 *     does NOT blindly "decrement one level per run" — that would over-decay
 *     if the job runs twice in a day, and the result would depend on how many
 *     times the cron fired rather than on elapsed time. Instead the expected
 *     condition is a pure function of elapsed time:
 *
 *       expectedLevel = clamp(MAINTENANCE_CEILING - floor(daysSinceLastFarrier
 *                              / HOOF_CONDITION_DECAY_DAYS), POOR, EXCELLENT)
 *
 *     Re-running the cron the same day computes the same expected level, so
 *     it is fully idempotent.
 *
 *   - **Decay only, never improve.** The cron lowers a horse to the expected
 *     level only when its current level is HIGHER than expected. It never
 *     raises a horse (that is the farrier's job). So a fresh `corrective`
 *     booking (`excellent`) is never silently knocked down to `good` on the
 *     next run — `lastFarrierDate` is ~now, so expected == ceiling and the
 *     horse is at-or-below nothing to do; it decays naturally only after a
 *     full HOOF_CONDITION_DECAY_DAYS interval elapses.
 *
 *   - **Decay anchor = the top of the ladder (`excellent`).** The post-farrier
 *     outcome (excellent / good / fair) is not persisted separately from
 *     `hoofCondition`. Anchoring the decay curve at the LADDER TOP means the
 *     expected level immediately after ANY farrier visit (daysSince ≈ 0) is
 *     `excellent`, which is ≥ every possible stored condition. Because the
 *     cron is decay-only (never raises), a fresh booking is therefore NEVER
 *     knocked down: a `shoeing` (`good`) or `emergency` (`fair`) horse is
 *     already at-or-below its expected level so nothing happens until a full
 *     decay interval has elapsed. After 1 interval expected drops to `good`,
 *     after 2 to `fair`, after 3 to `poor`. A horse decays at most one level
 *     per elapsed interval regardless of how many times the cron fires
 *     (idempotent — expected level is a pure function of elapsed time). No
 *     schema change required.
 *
 *   - **Horses with no `lastFarrierDate` are skipped.** A horse that has
 *     never seen a farrier has `hoofCondition` at its `@default("good")` (or
 *     null). There is no farrier anchor date to measure decay against, and
 *     fabricating one (e.g. createdAt) would punish brand-new horses for a
 *     service they were never expected to have booked yet. Skipping them is
 *     the honest default; once they get their first farrier visit they enter
 *     the decay curve normally.
 *
 *   - **Scoped, idempotent bulk update.** Each level transition is a single
 *     scoped `updateMany` (WHERE current-level AND lastFarrierDate old
 *     enough). NEVER an unscoped update. Recent / already-correct rows are
 *     untouched.
 *
 *   - **Fail-soft at the cron layer.** A decay failure is logged and
 *     re-thrown so the heartbeat layer records it, but it never crashes the
 *     process (mirrors every other CronJobService handler).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';

/**
 * Ordered hoof-condition ladder. Index === numeric level (0 = worst floor).
 * Canonical set confirmed by farrierController.FARRIER_SERVICES outcomes and
 * the farrier controller test (`['excellent','good','fair','poor']`).
 */
export const HOOF_CONDITION_LADDER = ['poor', 'fair', 'good', 'excellent'];

export const POOR_LEVEL = 0;
export const EXCELLENT_LEVEL = HOOF_CONDITION_LADDER.length - 1;

/**
 * Decay-curve anchor: the top of the ladder (`excellent`, level 3). The
 * expected level immediately after a farrier visit (daysSince ≈ 0) is the
 * anchor; because the cron is decay-only, anchoring at the top guarantees a
 * fresh booking of ANY service is never knocked down on the next run. After
 * each full decay interval the expected level drops one rung.
 */
export const MAINTENANCE_CEILING_LEVEL = EXCELLENT_LEVEL;

/** Default days per one-level decay step. */
export const DEFAULT_DECAY_DAYS = 30;

/** Floor so a misconfigured env can never decay every horse to `poor` in a day. */
export const MIN_DECAY_DAYS = 7;

/**
 * Resolve the effective decay interval in days.
 *
 * Reads HOOF_CONDITION_DECAY_DAYS; falls back to DEFAULT_DECAY_DAYS for
 * non-numeric / non-positive values. Clamped to MIN_DECAY_DAYS so a
 * misconfigured env cannot collapse every horse to `poor` overnight.
 *
 * @returns {number} decay interval in whole days, >= MIN_DECAY_DAYS
 */
export function getDecayDays() {
  const raw = process.env.HOOF_CONDITION_DECAY_DAYS;
  const parsed = Number.parseInt(raw, 10);
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DECAY_DAYS;
  return Math.max(MIN_DECAY_DAYS, days);
}

/**
 * Numeric level for a hoofCondition string. Unknown / null values map to the
 * maintenance ceiling (treated as "as-good-as-default") so a malformed value
 * is never decayed below where a sane default would sit.
 *
 * @param {string|null|undefined} condition
 * @returns {number}
 */
export function levelOf(condition) {
  const idx = HOOF_CONDITION_LADDER.indexOf(condition);
  return idx === -1 ? MAINTENANCE_CEILING_LEVEL : idx;
}

/**
 * Expected hoof-condition level given elapsed days since the last farrier
 * visit. Pure function — the basis of the idempotent decay.
 *
 * @param {number} daysSinceLastFarrier
 * @param {number} decayDays
 * @returns {number} expected level in [POOR_LEVEL, EXCELLENT_LEVEL]
 */
export function expectedLevel(daysSinceLastFarrier, decayDays) {
  const steps = Math.floor(Math.max(0, daysSinceLastFarrier) / decayDays);
  const lvl = MAINTENANCE_CEILING_LEVEL - steps;
  return Math.min(EXCELLENT_LEVEL, Math.max(POOR_LEVEL, lvl));
}

/**
 * Decay hoof condition for horses overdue for a farrier visit.
 *
 * For every level transition `from -> to` where `to` is below the
 * maintenance ceiling, runs a scoped `updateMany` that lowers exactly the
 * horses whose:
 *   - current `hoofCondition` == `from`, AND
 *   - `lastFarrierDate` is old enough that `expectedLevel(...) <= to`
 *     (i.e. `lastFarrierDate <= now - (ceiling - to) * decayDays days`).
 *
 * Horses with `lastFarrierDate == null` are excluded (no anchor — see
 * file docblock). The update is decay-only: a horse at or below its expected
 * level is never touched, and a horse is never raised.
 *
 * @param {Object} [opts]
 * @param {number} [opts.decayDays] override the resolved decay interval
 * @param {Date}   [opts.now] inject "now" for deterministic tests
 * @returns {Promise<{ decayedCount: number, decayDays: number,
 *                      transitions: Array<{from:string,to:string,count:number}> }>}
 */
export async function decayHoofConditions({ decayDays, now } = {}) {
  const effectiveDecayDays =
    Number.isFinite(decayDays) && decayDays > 0
      ? Math.max(MIN_DECAY_DAYS, decayDays)
      : getDecayDays();
  const nowDate = now instanceof Date ? now : new Date();

  const transitions = [];
  let decayedCount = 0;

  // Walk every adjacent transition from the ceiling downward:
  // good -> fair, fair -> poor, and also excellent -> good (so a corrective
  // job's `excellent` still slides once it is old enough). For each target
  // level `to`, a horse should be at `to` once it has aged
  // (CEILING - to) full decay intervals past its last farrier visit.
  for (let toLevel = EXCELLENT_LEVEL - 1; toLevel >= POOR_LEVEL; toLevel -= 1) {
    const fromCondition = HOOF_CONDITION_LADDER[toLevel + 1];
    const toCondition = HOOF_CONDITION_LADDER[toLevel];

    // Age (days) after which expectedLevel(...) <= toLevel:
    //   steps >= CEILING - toLevel  ⇒  daysSince >= (CEILING - toLevel) * decayDays
    const stepsToReach = MAINTENANCE_CEILING_LEVEL - toLevel;
    if (stepsToReach < 1) {
      // toLevel is at/above the ceiling — never a decay target.
      continue;
    }
    const cutoff = new Date(nowDate.getTime());
    cutoff.setUTCDate(cutoff.getUTCDate() - stepsToReach * effectiveDecayDays);

    // Scoped updateMany — never unscoped. Only horses currently exactly one
    // level above the target AND whose last farrier visit is old enough.
    const { count } = await prisma.horse.updateMany({
      where: {
        hoofCondition: fromCondition,
        lastFarrierDate: { not: null, lte: cutoff },
      },
      data: { hoofCondition: toCondition },
    });

    if (count > 0) {
      transitions.push({ from: fromCondition, to: toCondition, count });
      decayedCount += count;
    }
  }

  logger.info(
    `[hoofConditionDecay] Decayed ${decayedCount} horse(s) over ` +
      `${effectiveDecayDays}d intervals — ` +
      `${transitions.map(t => `${t.from}→${t.to}:${t.count}`).join(', ') || 'none overdue'}`,
  );

  return { decayedCount, decayDays: effectiveDecayDays, transitions };
}
