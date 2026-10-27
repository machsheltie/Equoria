/**
 * Trait reveal engine: grooming and neglect days turn carried traits on and off
 * (owner rulings 2026-10-26, q98 + q87, and 2026-10-27, q113-q118; Equoria-2d55z).
 *
 * A horse carries a trait or it doesn't. In Horse.epigeneticModifiers a carried
 * trait sits in exactly one array:
 *   - `hidden`              carried, hidden and inactive (has no effect, admin-only);
 *   - `positive`/`negative` revealed and active.
 * This engine never adds a trait a horse does not carry; it only moves carried
 * traits between those arrays.
 *
 * Each Eastern game day of a horse's first 21 days of life (the birth day is
 * day 1) is either a GROOMED day (the player pressed "groom horse") or a
 * NEGLECTED day. The counts are cumulative over the window.
 *
 * The ladder (q113): a rarity's gate opens once the horse has had that many
 * groomed days (3 / 6 / 12 / 16 / 19 for Common .. Legendary). Opening a gate
 * reveals nothing by itself: every groomed day AFTER the gate day rolls a chance
 * (25%, q114) for each hidden positive trait at or below the opened gates, so a
 * higher gate adds the rarer traits while the commoner ones keep rolling. On
 * the same groomed days an active negative trait past its switch-off gate rolls
 * to switch off (q116, q118: any active negative). A neglected day is the
 * mirror image: hidden negative traits roll to reveal and active positive
 * traits roll to switch off, counted in neglected days. A trait that switches
 * off goes back to `hidden`: carried, inactive, and able to turn on again.
 *
 * Every number lives in modules/traits/config/traitRevealSettings.mjs. A trait
 * whose rarity or polarity is not ruled there is never touched. Players can
 * never trigger an evaluation: there is no route to this engine; the nightly
 * job (services/jobs/nightlyTraitRevealJob.mjs) is the only caller.
 *
 * Grooming is READ here, never recorded. The default reader takes
 * GroomInteraction rows (the record the "groom horse" action writes, see the
 * care API contract); the grooming write path is owned elsewhere, so the
 * reader is injectable.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  calendarDateDayIndex,
  gameDayIndex,
  startOfGameDayIndex,
} from '../../../utils/gameTime.mjs';
import { traitRarities, traitRevealSettings } from '../config/traitRevealSettings.mjs';
import { logTraitAssignment } from './traitHistoryService.mjs';

const isCount = v => Number.isInteger(v) && v >= 0;
const isChance = v => typeof v === 'number' && v >= 0 && v <= 1;

/**
 * True when every number the engine needs has been filled in. Per-trait rarity
 * and polarity may stay null: such a trait is simply never evaluated.
 * @param {object} settings
 * @returns {boolean}
 */
export function revealSettingsReady(settings) {
  if (!settings) {
    return false;
  }
  const tablesReady = traitRarities.every(
    r =>
      isCount(settings.revealDays?.positive?.[r]) &&
      isCount(settings.revealDays?.negative?.[r]) &&
      isCount(settings.switchOffDays?.positive?.[r]) &&
      isCount(settings.switchOffDays?.negative?.[r]) &&
      isChance(settings.dailyChance?.[r]),
  );
  const last = settings.lastDayOfLife;
  const windowReady = last === Infinity || (Number.isInteger(last) && last > 0);
  return tablesReady && windowReady;
}

/** The three trait arrays, whatever the stored Json holds. */
export function traitArrays(raw) {
  const value = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const list = key => (Array.isArray(value[key]) ? [...value[key]] : []);
  return { positive: list('positive'), negative: list('negative'), hidden: list('hidden') };
}

/**
 * The traits the engine may evaluate: rarity and polarity both ruled.
 * @param {object} settings
 * @returns {Map<string, {rarity:string, polarity:'positive'|'negative'}>}
 */
export function ruledTraits(settings) {
  const ruled = new Map();
  for (const [trait, rarity] of Object.entries(settings?.traitRarity ?? {})) {
    const polarity = settings?.traitPolarity?.[trait];
    if (traitRarities.includes(rarity) && (polarity === 'positive' || polarity === 'negative')) {
      ruled.set(trait, { rarity, polarity });
    }
  }
  return ruled;
}

/**
 * Apply ONE completed game day to a horse's traits. Pure: no I/O.
 *
 * @param {{positive:string[], negative:string[], hidden:string[]}} traits
 * @param {{groomed:boolean, groomedDays:number, neglectedDays:number}} day -
 *   counts INCLUDE this day, so a gate of N rolls first when the count is N + 1
 * @param {object} settings - a ready settings object (see revealSettingsReady)
 * @param {() => number} rng - returns [0, 1)
 * @returns {{traits: object, changes: Array<{trait:string, change:'revealed'|'switchedOff', polarity:string}>}}
 */
export function applyTraitDay(traits, day, settings, rng) {
  const next = traitArrays(traits);
  const changes = [];
  const ruled = ruledTraits(settings);
  const roll = rarity => rng() < settings.dailyChance[rarity];
  const count = day.groomed ? day.groomedDays : day.neglectedDays;
  // The gate day itself only opens the gate; the qualifying days after it roll.
  const pastGate = gate => count > gate;
  // A groomed day reveals positives and switches negatives off; a neglected day the reverse.
  const revealPolarity = day.groomed ? 'positive' : 'negative';
  const switchOffPolarity = day.groomed ? 'negative' : 'positive';

  for (const trait of [...next.hidden].sort()) {
    const rule = ruled.get(trait);
    if (!rule || rule.polarity !== revealPolarity) {
      continue;
    }
    if (pastGate(settings.revealDays[revealPolarity][rule.rarity]) && roll(rule.rarity)) {
      next.hidden = next.hidden.filter(t => t !== trait);
      next[revealPolarity].push(trait);
      changes.push({ trait, change: 'revealed', polarity: revealPolarity });
    }
  }

  const active = [...new Set([...next.positive, ...next.negative])].sort();
  for (const trait of active) {
    const rule = ruled.get(trait);
    if (!rule || rule.polarity !== switchOffPolarity) {
      continue;
    }
    if (changes.some(c => c.trait === trait)) {
      continue;
    }
    if (pastGate(settings.switchOffDays[switchOffPolarity][rule.rarity]) && roll(rule.rarity)) {
      next.positive = next.positive.filter(t => t !== trait);
      next.negative = next.negative.filter(t => t !== trait);
      next.hidden.push(trait);
      changes.push({ trait, change: 'switchedOff', polarity: switchOffPolarity });
    }
  }

  return { traits: next, changes };
}

/**
 * Default grooming reader: the Eastern game-day indexes in [fromDay, toDay] on
 * which the horse has a GroomInteraction row.
 * @returns {Promise<Set<number>>}
 */
export async function readGroomedGameDays(client, horseId, fromDay, toDay) {
  const rows = await client.groomInteraction.findMany({
    where: {
      foalId: horseId,
      timestamp: { gte: startOfGameDayIndex(fromDay), lt: startOfGameDayIndex(toDay + 1) },
    },
    select: { timestamp: true },
  });
  return new Set(rows.map(r => gameDayIndex(r.timestamp)));
}

/** epigeneticModifiers key holding the last day of life this engine evaluated. */
export const revealProgressKey = 'revealEvaluatedThroughDay';

/**
 * Evaluate every completed, not-yet-evaluated day of one horse's window, in one
 * transaction under the horse's row lock, so two runs cannot roll the same day.
 *
 * @param {number} horseId
 * @param {object} opts
 * @param {object} opts.settings - ready settings
 * @param {() => number} opts.rng
 * @param {Date} [opts.now]
 * @param {Function} [opts.readGroomedDays] - (client, horseId, fromDay, toDay) => Set<dayIndex>
 * @returns {Promise<{horseId:number, daysEvaluated:number, changes:Array}>}
 */
export async function evaluateHorseTraitReveal(
  horseId,
  { settings, rng, now = new Date(), readGroomedDays = readGroomedGameDays, client = prisma },
) {
  if (!revealSettingsReady(settings)) {
    throw new Error('evaluateHorseTraitReveal: trait reveal settings are not ruled yet');
  }
  return client.$transaction(async tx => {
    const rows = await tx.$queryRaw`
      SELECT "id", "dateOfBirth", "epigeneticModifiers"
      FROM "horses" WHERE "id" = ${horseId} FOR UPDATE`;
    const horse = rows[0];
    if (!horse) {
      return { horseId, daysEvaluated: 0, changes: [] };
    }
    const stored =
      horse.epigeneticModifiers !== null &&
      typeof horse.epigeneticModifiers === 'object' &&
      !Array.isArray(horse.epigeneticModifiers)
        ? horse.epigeneticModifiers
        : {};
    const birthDay = calendarDateDayIndex(horse.dateOfBirth);
    // The birth day is day 1 (q115), so today is day (today - birthDay + 1) and
    // the last completed day of life is the one before it.
    const lastCompletedDay = gameDayIndex(now) - birthDay;
    const calendarDayOf = dayOfLife => birthDay + dayOfLife - 1;
    const throughDay = Math.min(lastCompletedDay, settings.lastDayOfLife);
    const evaluatedThrough = Number.isInteger(stored[revealProgressKey])
      ? stored[revealProgressKey]
      : 0;
    if (throughDay <= evaluatedThrough) {
      return { horseId, daysEvaluated: 0, changes: [] };
    }

    const groomedDays = await readGroomedDays(
      tx,
      horseId,
      calendarDayOf(1),
      calendarDayOf(throughDay),
    );
    let groomedCount = 0;
    for (let d = 1; d <= evaluatedThrough; d++) {
      groomedCount += groomedDays.has(calendarDayOf(d)) ? 1 : 0;
    }
    let traits = traitArrays(stored);
    const changes = [];
    for (let d = evaluatedThrough + 1; d <= throughDay; d++) {
      const groomed = groomedDays.has(calendarDayOf(d));
      groomedCount += groomed ? 1 : 0;
      const result = applyTraitDay(
        traits,
        { groomed, groomedDays: groomedCount, neglectedDays: d - groomedCount },
        settings,
        rng,
      );
      traits = result.traits;
      for (const change of result.changes) {
        changes.push({ ...change, dayOfLife: d, groomed });
      }
    }

    // Set only the keys this engine owns; every other key (e.g. the age-1
    // milestone's tags) is kept as stored. The row lock above makes this safe.
    await tx.$executeRaw`
      UPDATE "horses"
      SET "epigeneticModifiers" = jsonb_set(jsonb_set(jsonb_set(jsonb_set(
        CASE WHEN jsonb_typeof("epigeneticModifiers") = 'object'
          THEN "epigeneticModifiers" ELSE '{}'::jsonb END,
        '{positive}', ${JSON.stringify(traits.positive)}::jsonb),
        '{negative}', ${JSON.stringify(traits.negative)}::jsonb),
        '{hidden}', ${JSON.stringify(traits.hidden)}::jsonb),
        ARRAY[${revealProgressKey}::text], ${JSON.stringify(throughDay)}::jsonb)
      WHERE "id" = ${horseId}`;

    for (const change of changes) {
      await logTraitAssignment(
        {
          horseId,
          traitName: change.trait,
          sourceType: change.groomed ? 'grooming' : 'neglect',
          isEpigenetic: true,
        },
        tx,
      );
    }
    return { horseId, daysEvaluated: throughDay - evaluatedThrough, changes };
  });
}

/**
 * Nightly pass over every horse still inside the evaluated window
 * (services/jobs/nightlyTraitRevealJob.mjs).
 *
 * @param {object} [opts]
 * @param {object} [opts.settings=traitRevealSettings]
 * @param {() => number} [opts.rng=Math.random]
 * @param {Date} [opts.now]
 * @param {number[]} [opts.horseIds] - restrict the pass (tests)
 * @param {Function} [opts.readGroomedDays]
 */
export async function runNightlyTraitReveal({
  settings = traitRevealSettings,
  rng = Math.random,
  now = new Date(),
  horseIds,
  readGroomedDays = readGroomedGameDays,
} = {}) {
  if (!revealSettingsReady(settings)) {
    logger.info('[traitRevealEngine] Skipped: trait reveal settings are waiting on the owner');
    return { skipped: 'settingsPendingOwner', horsesEvaluated: 0, changes: 0, errors: 0 };
  }
  if (ruledTraits(settings).size === 0) {
    // No trait has both a rarity and a polarity yet: nothing could change, so
    // no horse's days are marked evaluated. Once the owner rules them, the days
    // already lived in the window are rolled on the next night.
    logger.info('[traitRevealEngine] Skipped: no trait has a ruled rarity and polarity yet');
    return { skipped: 'noTraitsRuled', horsesEvaluated: 0, changes: 0, errors: 0 };
  }
  const where = {};
  if (Number.isFinite(settings.lastDayOfLife)) {
    // Born on or after (today - lastDayOfLife - 1): the window may still have a
    // day to evaluate (day lastDayOfLife is calendar day birth + lastDayOfLife - 1,
    // completed once today is birth + lastDayOfLife). One spare day of slack.
    where.dateOfBirth = {
      gte: new Date((gameDayIndex(now) - settings.lastDayOfLife - 1) * 86_400_000),
    };
  }
  if (Array.isArray(horseIds)) {
    where.id = { in: horseIds };
  }
  const horses = await prisma.horse.findMany({
    where,
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  let changes = 0;
  let errors = 0;
  for (const { id } of horses) {
    try {
      const result = await evaluateHorseTraitReveal(id, { settings, rng, now, readGroomedDays });
      changes += result.changes.length;
    } catch (error) {
      errors++;
      logger.error(`[traitRevealEngine] Horse ${id} failed: ${error.message}`);
    }
  }
  return { skipped: null, horsesEvaluated: horses.length, changes, errors };
}
