/**
 * Staff growth persistence (Equoria-xlw03): the hidden growth profile of riders and
 * grooms, the show count that levels them up, and the player-facing view of what has
 * been revealed. The rules themselves (counts, thresholds, reveals, the effects switch)
 * live in backend/constants/staffGrowth.mjs.
 *
 * The profile is in its own table (rider_growth_profiles / groom_growth_profiles) so no
 * read of a rider or groom row can carry unrevealed items; only `revealedGrowthView`
 * turns a profile into something a player sees, and it drops every hidden item and
 * every stored code name.
 *
 * Every function takes the caller's Prisma client or transaction; the writes are meant
 * to run inside the caller's transaction (player-state mutations are transactional).
 */

import { disciplineValues, horseTemperamentValues } from '../constants/schema.mjs';
import { staffLevelLabel, staffLevelStars } from '../constants/staffLevels.mjs';
import {
  applyGrowthShows,
  drawGrowthItems,
  growthItemCounts,
  growthItemKinds,
  growthItemTotal,
  growthRevealedCountForLevel,
  revealAllGrowthItems,
  revealRandomGrowthItems,
} from '../constants/staffGrowth.mjs';
import { getTraitDefinition, traitRosterIds } from '../utils/epigeneticTraits.mjs';
import { staffPersonalityLabel } from '../utils/staffPublicView.mjs';

const staffTables = Object.freeze({
  rider: Object.freeze({
    profile: 'riderGrowthProfile',
    staff: 'rider',
    key: 'riderId',
  }),
  groom: Object.freeze({
    profile: 'groomGrowthProfile',
    staff: 'groom',
    key: 'groomId',
  }),
});

function tablesFor(staffType) {
  const tables = staffTables[staffType];
  if (!tables) {
    throw new Error(`Staff type has no growth: ${String(staffType)}`);
  }
  return tables;
}

/** Authored headings for each kind (players never see stored names). */
const kindLabels = Object.freeze({
  trait: 'Horse traits',
  discipline: 'Disciplines',
  temperament: 'Temperaments',
  breed: 'Favourite breeds',
});

/**
 * Draw a full set of hidden items for a staff member at `starLevel`, with as many
 * revealed as that level shows (none for a Rookie).
 */
async function drawProfileItems(client, starLevel, random) {
  const breeds = await client.breed.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  const items = drawGrowthItems(
    {
      traits: traitRosterIds,
      disciplines: disciplineValues,
      temperaments: horseTemperamentValues,
      breedIds: breeds.map(b => b.id),
    },
    random,
  );
  const revealCount = growthRevealedCountForLevel(starLevel);
  return revealCount >= growthItemTotal
    ? revealAllGrowthItems(items)
    : revealRandomGrowthItems(items, revealCount, random);
}

/**
 * Make sure a rider or groom has its growth profile, drawing one if not, and return it
 * locked FOR UPDATE for the rest of the caller's transaction. A staff member made
 * before growth existed gets a profile whose reveals match its current level.
 *
 * @param {Object} tx - Prisma transaction client
 * @param {'rider'|'groom'} staffType
 * @param {number} staffId
 * @param {{ random?: () => number }} [options]
 * @returns {Promise<{ items: Array, showsAtLevel: number }>}
 */
export async function ensureGrowthProfileTx(tx, staffType, staffId, { random = Math.random } = {}) {
  const t = tablesFor(staffType);
  const staff = await tx[t.staff].findUnique({
    where: { id: staffId },
    select: { starLevel: true },
  });
  if (!staff) {
    throw new Error(`${staffType} ${staffId} not found`);
  }
  const existing = await tx[t.profile].findUnique({ where: { [t.key]: staffId } });
  if (!existing) {
    const items = await drawProfileItems(tx, staff.starLevel, random);
    // skipDuplicates: a concurrent first read may have drawn it already; theirs stands.
    await tx[t.profile].createMany({
      data: [{ [t.key]: staffId, items }],
      skipDuplicates: true,
    });
  }
  const locked =
    staffType === 'rider'
      ? await tx.$queryRaw`SELECT "items", "showsAtLevel" FROM "rider_growth_profiles" WHERE "riderId" = ${staffId} FOR UPDATE`
      : await tx.$queryRaw`SELECT "items", "showsAtLevel" FROM "groom_growth_profiles" WHERE "groomId" = ${staffId} FOR UPDATE`;
  if (locked.length !== 1) {
    throw new Error(`${staffType} ${staffId} growth profile could not be read`);
  }
  return {
    items: locked[0].items,
    showsAtLevel: locked[0].showsAtLevel,
    starLevel: staff.starLevel,
  };
}

/**
 * Record shows a rider or groom has completed and apply the level-ups they earn: the
 * star level rises, the count restarts at the new level, and each step reveals 3 random
 * hidden items (all at Expert). The price follows the new level from the next payday
 * (q235): nothing is charged here.
 *
 * Call inside the settling transaction, after the staff row is written or locked.
 *
 * @param {Object} tx
 * @param {'rider'|'groom'} staffType
 * @param {number} staffId
 * @param {number} [shows]
 * @param {{ random?: () => number }} [options]
 * @returns {Promise<{ starLevel: string, showsAtLevel: number, levelsGained: string[] }>}
 */
export async function recordStaffShowsTx(tx, staffType, staffId, shows = 1, options = {}) {
  const { random = Math.random } = options;
  const t = tablesFor(staffType);
  const profile = await ensureGrowthProfileTx(tx, staffType, staffId, { random });
  const next = applyGrowthShows(profile, shows, random);
  await tx[t.profile].update({
    where: { [t.key]: staffId },
    data: { items: next.items, showsAtLevel: next.showsAtLevel },
  });
  if (next.starLevel !== profile.starLevel) {
    await tx[t.staff].update({ where: { id: staffId }, data: { starLevel: next.starLevel } });
  }
  return {
    starLevel: next.starLevel,
    showsAtLevel: next.showsAtLevel,
    levelsGained: next.levelsGained,
  };
}

/**
 * What a player may see of staff members' growth: level, personality and ONLY the
 * revealed items, as authored labels. Hidden items appear only as a count per kind.
 * Read-only: a staff member without a profile yet shows nothing revealed, so callers
 * that serve a player run `ensureGrowthProfileTx` first (the discovery reads do, and
 * every hire and pool return makes the profile).
 *
 * @param {Object} client - Prisma client or transaction
 * @param {'rider'|'groom'} staffType
 * @param {Array<{ id: number, starLevel: string, personality: string }>} staffRows
 * @returns {Promise<Map<number, Object>>} staff id -> view
 */
export async function revealedGrowthViews(client, staffType, staffRows) {
  const t = tablesFor(staffType);
  const ids = staffRows.map(s => s.id);
  const profiles =
    ids.length > 0 ? await client[t.profile].findMany({ where: { [t.key]: { in: ids } } }) : [];
  const byId = new Map(profiles.map(p => [p[t.key], p]));
  const breedIds = new Set();
  for (const p of profiles) {
    for (const item of Array.isArray(p.items) ? p.items : []) {
      if (item.kind === 'breed' && item.revealed) {
        breedIds.add(item.value);
      }
    }
  }
  const breeds =
    breedIds.size > 0
      ? await client.breed.findMany({
          where: { id: { in: [...breedIds] } },
          select: { id: true, name: true },
        })
      : [];
  const breedNames = new Map(breeds.map(b => [b.id, b.name]));

  const labelFor = item => {
    if (item.kind === 'trait') {
      return getTraitDefinition(item.value)?.label ?? null;
    }
    if (item.kind === 'breed') {
      return breedNames.get(item.value) ?? null;
    }
    return typeof item.value === 'string' ? item.value : null;
  };

  const noteFor = item =>
    item.kind === 'breed' ? 'Favourite' : item.sign === 'negative' ? 'Weakness' : 'Strength';

  const views = new Map();
  for (const staff of staffRows) {
    const items = Array.isArray(byId.get(staff.id)?.items) ? byId.get(staff.id).items : [];
    const categories = growthItemKinds.map(kind => {
      const revealed = items
        .filter(item => item.kind === kind && item.revealed)
        .map(item => ({ label: labelFor(item), sign: item.sign, note: noteFor(item) }))
        .filter(item => item.label !== null);
      // Only authored words reach the player: no stored kind or value codes.
      return { label: kindLabels[kind], total: growthItemCounts[kind], revealed };
    });
    const revealedCount = categories.reduce((n, c) => n + c.revealed.length, 0);
    views.set(staff.id, {
      starLevel: staff.starLevel,
      stars: staffLevelStars(staff.starLevel),
      levelLabel: staffLevelLabel(staff.starLevel),
      // The stored word stays as a key for the badge; players read the label.
      personality: staff.personality,
      personalityLabel: staffPersonalityLabel(staff.personality),
      totalItems: growthItemTotal,
      revealedCount,
      categories,
    });
  }
  return views;
}

/** One staff member's view (see revealedGrowthViews). */
export async function revealedGrowthView(client, staffType, staffRow) {
  const views = await revealedGrowthViews(client, staffType, [staffRow]);
  return views.get(staffRow.id);
}
