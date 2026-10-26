/**
 * Trait reveal engine: grooming and neglect days turn carried traits on and off
 * (owner ruling 2026-10-26, q98 + q87; Equoria-2d55z).
 *
 * A horse carries a trait or it doesn't. In Horse.epigeneticModifiers a carried
 * trait sits in exactly one array:
 *   - `hidden`              carried, hidden and inactive (has no effect, admin-only);
 *   - `positive`/`negative` revealed and active.
 * This engine never adds a trait a horse does not carry; it only moves carried
 * traits between those arrays.
 *
 * Each completed Eastern game day of a horse's life is either a GROOMED day
 * (the player pressed "groom horse") or a NEGLECTED day. On a groomed day:
 *   - a hidden POSITIVE trait whose rarity's grooming-day count is reached gets
 *     a chance to reveal and turn on;
 *   - an active NEGATIVE trait whose switch-off count is reached gets a chance
 *     to switch off.
 * On a neglected day the mirror image: hidden NEGATIVE traits may reveal and
 * active POSITIVE traits may switch off. Counts are days since birth within the
 * evaluated window. Every change is a roll, never a guarantee. A trait that
 * switches off goes back to `hidden`: carried, inactive, and able to turn on
 * again later.
 *
 * The numbers are not ruled yet: they live in ONE object,
 * modules/traits/config/traitRevealSettings.mjs, and while any is null
 * runNightlyTraitReveal does nothing. THE NIGHTLY JOB IS NOT REGISTERED in
 * services/jobs/index.mjs until the owner answers. Players can never trigger an
 * evaluation: there is no route to this engine.
 *
 * Grooming is READ here, never recorded. The default reader takes
 * GroomInteraction rows (the record the "groom horse" action writes); the
 * grooming write path is owned elsewhere, so the reader is injectable.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  calendarDateDayIndex,
  gameDayIndex,
  startOfGameDayIndex,
} from '../../../utils/gameTime.mjs';
import { traitRarities, traitRevealSettingsPendingOwner } from '../config/traitRevealSettings.mjs';
import { logTraitAssignment } from './traitHistoryService.mjs';

/**
 * Whether each roster trait acts positively or negatively (owner trait roster,
 * 2026-10-19/20, plus Phoenix-Born, which q98 placed in this system).
 */
export const rosterPolarity = Object.freeze({
  brave: 'positive',
  fearful: 'negative',
  confident: 'positive',
  insecure: 'negative',
  affectionate: 'positive',
  skittish: 'negative',
  resilient: 'positive',
  fragile: 'negative',
  highImmunity: 'positive',
  lowImmunity: 'negative',
  peopleTrusting: 'positive',
  showCalm: 'positive',
  crowdReady: 'positive',
  bonded: 'positive',
  eagerLearner: 'positive',
  social: 'positive',
  antisocial: 'negative',
  presentationBoosted: 'positive',
  legendaryBloodline: 'positive',
  phoenixBorn: 'positive',
});

const isCount = v => Number.isInteger(v) && v >= 0;
const isChance = v => typeof v === 'number' && v >= 0 && v <= 1;

/**
 * True when every number the engine needs has been filled in. Trait rarities
 * may stay null individually: such a trait is simply never evaluated.
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
 * Apply ONE completed game day to a horse's traits. Pure: no I/O.
 *
 * @param {{positive:string[], negative:string[], hidden:string[]}} traits
 * @param {{groomed:boolean, groomedDays:number, neglectedDays:number}} day -
 *   counts INCLUDE this day
 * @param {object} settings - a ready settings object (see revealSettingsReady)
 * @param {() => number} rng - returns [0, 1)
 * @returns {{traits: object, changes: Array<{trait:string, change:'revealed'|'switchedOff', polarity:string}>}}
 */
export function applyTraitDay(traits, day, settings, rng) {
  const next = traitArrays(traits);
  const changes = [];
  const rarityOf = trait => (rosterPolarity[trait] ? settings.traitRarity?.[trait] : null) ?? null;
  const roll = rarity => rng() < settings.dailyChance[rarity];
  const count = day.groomed ? day.groomedDays : day.neglectedDays;
  // A groomed day reveals positives and switches negatives off; a neglected day the reverse.
  const revealPolarity = day.groomed ? 'positive' : 'negative';
  const switchOffPolarity = day.groomed ? 'negative' : 'positive';

  for (const trait of [...next.hidden].sort()) {
    const rarity = rarityOf(trait);
    if (!rarity || rosterPolarity[trait] !== revealPolarity) {
      continue;
    }
    if (count >= settings.revealDays[revealPolarity][rarity] && roll(rarity)) {
      next.hidden = next.hidden.filter(t => t !== trait);
      next[revealPolarity].push(trait);
      changes.push({ trait, change: 'revealed', polarity: revealPolarity });
    }
  }

  const active = [...new Set([...next.positive, ...next.negative])].sort();
  for (const trait of active) {
    const rarity = rarityOf(trait);
    if (!rarity || rosterPolarity[trait] !== switchOffPolarity) {
      continue;
    }
    if (changes.some(c => c.trait === trait)) {
      continue;
    }
    if (count >= settings.switchOffDays[switchOffPolarity][rarity] && roll(rarity)) {
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
    const lastCompletedDay = gameDayIndex(now) - 1 - birthDay;
    const throughDay = Math.min(lastCompletedDay, settings.lastDayOfLife);
    const evaluatedThrough = Number.isInteger(stored[revealProgressKey])
      ? stored[revealProgressKey]
      : 0;
    if (throughDay <= evaluatedThrough) {
      return { horseId, daysEvaluated: 0, changes: [] };
    }

    // Day 1 is the first whole day after birth; the birth day itself never counts.
    const groomedDays = await readGroomedDays(tx, horseId, birthDay + 1, birthDay + throughDay);
    let groomedCount = 0;
    for (let d = 1; d <= evaluatedThrough; d++) {
      groomedCount += groomedDays.has(birthDay + d) ? 1 : 0;
    }
    let traits = traitArrays(stored);
    const changes = [];
    for (let d = evaluatedThrough + 1; d <= throughDay; d++) {
      const groomed = groomedDays.has(birthDay + d);
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
 * Nightly pass over every horse still inside the evaluated window.
 * Not scheduled: see the file header.
 *
 * @param {object} [opts]
 * @param {object} [opts.settings=traitRevealSettingsPendingOwner]
 * @param {() => number} [opts.rng=Math.random]
 * @param {Date} [opts.now]
 * @param {number[]} [opts.horseIds] - restrict the pass (tests)
 * @param {Function} [opts.readGroomedDays]
 */
export async function runNightlyTraitReveal({
  settings = traitRevealSettingsPendingOwner,
  rng = Math.random,
  now = new Date(),
  horseIds,
  readGroomedDays = readGroomedGameDays,
} = {}) {
  if (!revealSettingsReady(settings)) {
    logger.info('[traitRevealEngine] Skipped: trait reveal settings are waiting on the owner');
    return { skipped: 'settingsPendingOwner', horsesEvaluated: 0, changes: 0, errors: 0 };
  }
  const where = {};
  if (Number.isFinite(settings.lastDayOfLife)) {
    // Born on or after (today - lastDayOfLife - 1): the window still has a day to evaluate.
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
