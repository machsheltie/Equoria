/**
 * Horse lookup for the Steward's Office (Equoria-puj1e.5,
 * docs/features/admin-time-back.md "Related controls"): by number or by name,
 * what the outage tools need to check a horse's clocks — owner, birth date,
 * age, retired or not, pregnancy and due day, foal development day — and its
 * traits.
 *
 * Who: the Owner and Admins (`horse.admin`); never moderators. Hidden traits
 * are the Owner's alone (`traits.hidden.view`, owner rulings 2026-10-19 and
 * 2026-10-23): everyone else gets the public view (revealed traits and a count
 * of hidden ones), the same view every JSON response is cut to.
 *
 * Reads only. Ages come from the birth date on the Eastern calendar, as the
 * game reads them, not from the stored age column.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { gestationDays } from '../../../constants/time.mjs';
import { retirementAgeYears } from '../../../constants/horseAgePolicy.mjs';
import { gameDayIndex, startOfGameDayIndex } from '../../../utils/gameTime.mjs';
import { getHorseAgeYears } from '../../../utils/horseAge.mjs';
import { publicTraitModifiers } from '../../../utils/publicTraitView.mjs';

export const maxLookupResults = 20;
const maxQueryLength = 40;

/**
 * How a lookup text is read: a whole number is a horse's number, anything
 * else part of a name. Returns null for text that cannot be looked up.
 * @param {unknown} text
 * @returns {{ id: number } | { name: string } | null}
 */
export function parseHorseQuery(text) {
  if (typeof text !== 'string') {
    return null;
  }
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > maxQueryLength) {
    return null;
  }
  if (/^\d+$/.test(trimmed)) {
    const id = Number(trimmed);
    return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? { id } : null;
  }
  return { name: trimmed };
}

const horseSelect = Object.freeze({
  id: true,
  name: true,
  sex: true,
  dateOfBirth: true,
  inFoalSinceDate: true,
  pregnancySireId: true,
  epigeneticModifiers: true,
  user: { select: { username: true } },
  foalDevelopment: { select: { currentDay: true } },
});

const calendarDate = date => (date ? date.toISOString().slice(0, 10) : null);

function describe(horse, sireNames, includeHidden, now) {
  const age = horse.dateOfBirth ? getHorseAgeYears(horse.dateOfBirth, now) : null;
  const pregnancy = horse.inFoalSinceDate
    ? {
        since: horse.inFoalSinceDate,
        // Bred on Eastern day D, the foal is due on day D + 7 (owner ruling 2026-10-12).
        dueDay: startOfGameDayIndex(gameDayIndex(horse.inFoalSinceDate) + gestationDays),
        sireName: sireNames.get(horse.pregnancySireId) ?? null,
      }
    : null;
  return {
    id: horse.id,
    name: horse.name,
    sex: horse.sex,
    ownerUsername: horse.user?.username ?? null,
    dateOfBirth: calendarDate(horse.dateOfBirth),
    age,
    retired: age !== null && age >= retirementAgeYears,
    pregnancy,
    foalDevelopmentDay: horse.foalDevelopment?.currentDay ?? null,
    epigeneticModifiers: publicTraitModifiers(horse.epigeneticModifiers, { includeHidden }),
  };
}

/**
 * Find horses by number or name (at most 20, lowest number first).
 * @param {{ id: number } | { name: string }} query from parseHorseQuery
 * @param {{ includeHidden: boolean, now?: Date }} options
 */
export async function lookupHorses(query, { includeHidden, now = new Date() }) {
  const where =
    'id' in query ? { id: query.id } : { name: { contains: query.name, mode: 'insensitive' } };
  const horses = await prisma.horse.findMany({
    where,
    select: horseSelect,
    orderBy: { id: 'asc' },
    take: maxLookupResults,
  });
  const sireIds = [...new Set(horses.map(h => h.pregnancySireId).filter(id => id !== null))];
  const sires =
    sireIds.length > 0
      ? await prisma.horse.findMany({
          where: { id: { in: sireIds } },
          select: { id: true, name: true },
        })
      : [];
  const sireNames = new Map(sires.map(s => [s.id, s.name]));
  return horses.map(horse => describe(horse, sireNames, includeHidden === true, now));
}
