/**
 * onboardingService.mjs (Equoria-vhv3i — AC item 2)
 *
 * Server-authoritative starter-horse creation at registration. Owned by
 * the auth-module ONBOARDING SERVICE (not the controller) so the registration
 * controller stays focused on user-row mechanics and so a future signup
 * flow that needs the same starter horse (admin-create, magic-link-flow,
 * etc.) can call the same code path.
 *
 * Game-design history preserved (do NOT regress when editing):
 *   - Equoria game-year convention: 1 game-year = 7 real days. A 3-game-year
 *     starter horse is born 3*7 = 21 real days ago, NOT 3 calendar years
 *     ago (which the canonical age helper would read as ~156 game-years).
 *   - Equoria-b9zgr: the starter horse must NEVER be born with a NULL
 *     breedId — the default breed (Thoroughbred) is resolved and the
 *     horse is created with that breed. Non-fatal: a missing default
 *     breed row logs at error level but registration succeeds; the
 *     onboarding breed-selection step (advanceOnboarding) will assign
 *     the player's chosen breed.
 *   - Equoria-b9zgr (Prisma client gotcha): the controller's prisma
 *     client persists FKs via the SCALAR field (breedId), NOT Prisma
 *     relation-connect syntax. `breed: { connect }` throws
 *     "Invalid invocation" — use the scalar to mirror the working
 *     userId pattern.
 *   - Equoria-a429: a color/temperament failure is logged at ERROR
 *     level (was: warn). The user is still registered and the horse
 *     still exists, but the gap is visible in production logs + Sentry
 *     so the long-term sentinel job (Equoria-fhag) is not the only
 *     line of defense.
 *   - Equoria-f5372: temperament is applied via raw SQL on the existing
 *     column so a stale Prisma client create-input type cannot break
 *     registration AND a color-generation failure cannot leave
 *     temperament NULL.
 */

import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  generateGenotype,
  calculatePhenotype,
  generateMarkings,
  generateTemperamentWithDefault,
  DEFAULT_TEMPERAMENT_BREED,
} from '../../horses/index.mjs';

const STARTER_HORSE_AGE_GAME_YEARS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Create the starter horse for a brand-new user. Non-fatal: failures
 * inside this function MUST NOT propagate to the registration handler —
 * a user is registered even if the starter horse creation fails, and
 * the gap is logged at error level so the regression is visible.
 *
 * @param {{ id: string, username: string }} user  The freshly-created user row.
 * @returns {Promise<void>}
 */
export async function createStarterHorseForNewUser(user) {
  try {
    // Equoria game-year convention: 1 game-year = 7 real days. A 3-game-year
    // starter horse is born 3*7 = 21 real days ago, NOT 3 calendar years ago
    // (which the canonical age helper would read as ~156 game-years).
    const dateOfBirth = new Date(Date.now() - STARTER_HORSE_AGE_GAME_YEARS * 7 * MS_PER_DAY);

    // Equoria-b9zgr: resolve the default breed id so the starter horse is
    // never born with a NULL breedId (the prior behaviour left every
    // registration starter horse breedless — 0/3334 rows had breedId set).
    // Non-fatal: if the default breed row is missing the horse is still
    // created and registration succeeds; the onboarding breed-selection step
    // will assign a breedId. Logged at error level so the gap is visible.
    let defaultBreedId = null;
    try {
      const defaultBreed = await prisma.breed.findUnique({
        where: { name: DEFAULT_TEMPERAMENT_BREED },
        select: { id: true },
      });
      defaultBreedId = defaultBreed?.id ?? null;
      if (defaultBreedId === null) {
        logger.error(
          `[onboardingService.createStarterHorseForNewUser] Default breed "${DEFAULT_TEMPERAMENT_BREED}" not found — starter horse will be created without a breedId until onboarding assigns one.`,
          { userId: user.id },
        );
      }
    } catch (breedLookupError) {
      logger.error(
        '[onboardingService.createStarterHorseForNewUser] FAILED to resolve default breed for starter horse (horse will have NULL breedId until onboarding/backfill):',
        { userId: user.id, error: breedLookupError.message },
      );
    }

    const starterHorse = await prisma.horse.create({
      data: {
        name: `${user.username}'s First Horse`,
        sex: 'Mare',
        age: 3,
        dateOfBirth,
        // Equoria-b9zgr: this controller's prisma client
        // (packages/database/prismaClient.mjs) is a different generation than
        // the test client and persists FKs via the SCALAR field (like
        // `userId` above), NOT Prisma relation-connect syntax — `breed:
        // { connect }` throws "Invalid invocation" here. Use the scalar
        // breedId to mirror the working userId pattern.
        ...(defaultBreedId !== null && { breedId: defaultBreedId }),
        userId: user.id,
        speed: 17,
        stamina: 17,
        agility: 17,
        balance: 17,
        precision: 17,
        intelligence: 17,
        boldness: 17,
        flexibility: 17,
        obedience: 17,
        focus: 17,
        endurance: 17,
        strength: 17,
        healthStatus: 'Excellent',
      },
    });
    logger.info('[onboardingService.createStarterHorseForNewUser] Starter horse created', {
      userId: user.id,
    });

    // Apply coat color via raw SQL — bypasses stale Prisma client schema that uses old
    // field names (genotype/phenotypicMarkings) instead of current (colorGenotype/phenotype).
    try {
      const starterGenotype = generateGenotype(null);
      const starterBaseColor = calculatePhenotype(starterGenotype, null);
      const starterMarkings = generateMarkings(null, starterBaseColor.colorName);
      const starterPhenotype = { ...starterBaseColor, ...starterMarkings };
      await prisma.$executeRaw`
        UPDATE horses
        SET "colorGenotype" = ${JSON.stringify(starterGenotype)}::jsonb,
            phenotype = ${JSON.stringify(starterPhenotype)}::jsonb
        WHERE id = ${starterHorse.id}
      `;
      logger.info('[onboardingService.createStarterHorseForNewUser] Starter horse color applied', {
        horseId: starterHorse.id,
        color: starterBaseColor.colorName,
      });
    } catch (colorError) {
      // Equoria-a429: was logger.warn (silent fail-warn-drop pattern that
      // produced 111 NULL-phenotype stragglers in the canonical DB). Now
      // logger.error so the regression is visible in production logs +
      // Sentry. Still non-fatal at the request level — the user is
      // registered and the horse exists; the sentinel job in
      // Equoria-fhag is the long-term guard.
      logger.error(
        '[onboardingService.createStarterHorseForNewUser] FAILED to apply starter horse color (horse will have NULL phenotype until backfilled):',
        {
          horseId: starterHorse.id,
          userId: user.id,
          error: colorError.message,
          stack: colorError.stack,
        },
      );
    }

    // Equoria-f5372: assign a permanent temperament. The starter horse is
    // seeded with the default breed (Equoria-b9zgr), so temperament is
    // generated from the same default breed's weights. Written via raw SQL on
    // the existing column (independent of the color block) so a
    // color-generation failure can never leave temperament NULL, and so a
    // stale Prisma client create-input type can never break registration.
    try {
      const starterTemperament = generateTemperamentWithDefault(null);
      await prisma.$executeRaw`
        UPDATE horses
        SET temperament = ${starterTemperament}
        WHERE id = ${starterHorse.id}
      `;
      logger.info(
        '[onboardingService.createStarterHorseForNewUser] Starter horse temperament applied',
        { horseId: starterHorse.id, temperament: starterTemperament },
      );
    } catch (temperamentError) {
      // Non-fatal at the request level (the user is registered and the horse
      // exists); logged at error level so the regression is visible.
      logger.error(
        '[onboardingService.createStarterHorseForNewUser] FAILED to apply starter horse temperament (horse will have NULL temperament until backfilled):',
        {
          horseId: starterHorse.id,
          userId: user.id,
          error: temperamentError.message,
          stack: temperamentError.stack,
        },
      );
    }
  } catch (horseError) {
    // Non-fatal — user is registered even if starter horse creation fails
    logger.error(
      '[onboardingService.createStarterHorseForNewUser] Failed to create starter horse:',
      horseError,
    );
  }
}
