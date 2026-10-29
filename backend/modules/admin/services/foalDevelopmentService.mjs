/**
 * Foal development listing for the admin monitor (GET /api/admin/foals/development).
 *
 * Moved out of adminController (Equoria-6pbka) when it began reading the live age.
 * The stored Horse.age only lags a birthday (until the nightly job at 00:05
 * Eastern), so it narrows the read; the live age (liveHorseAgeYears) decides
 * which foals are listed and the age each one shows.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { liveHorseAgeYears } from '../../../utils/horseAge.mjs';

/** The oldest live age the monitor lists, in game-years. */
const oldestFoalAge = 1;

/**
 * Foals whose live age is 0 or 1 at `now`, each with its live age.
 *
 * @param {Date} [now=new Date()]
 * @returns {Promise<object[]>}
 */
export async function listFoalsInDevelopment(now = new Date()) {
  const rows = await prisma.horse.findMany({
    where: { age: { in: [0, oldestFoalAge] } },
    select: {
      id: true,
      name: true,
      age: true,
      dateOfBirth: true,
      bondScore: true,
      epigeneticModifiers: true,
      breed: { select: { name: true } },
      foalDevelopment: {
        select: {
          currentDay: true,
          bondingLevel: true,
        },
      },
    },
  });
  return rows
    .map(({ dateOfBirth, ...foal }) => ({
      ...foal,
      age: liveHorseAgeYears({ age: foal.age, dateOfBirth }, now),
    }))
    .filter(foal => foal.age <= oldestFoalAge);
}
