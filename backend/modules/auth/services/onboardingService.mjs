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
 *   - Equoria-2wjp7 (fail-closed): Equoria-b9zgr resolved the breed but
 *     still spread it CONDITIONALLY, so an unresolved breed created the
 *     horse anyway with a NULL breedId. That is the source of the
 *     breedless-mare population (Equoria-qsp1b.1): breeding now correctly
 *     refuses conception for a dam with no breed, nothing filters such a
 *     mare out of the breeding selector, and no surface can set a breed —
 *     the player meets a dead end. The guard is now fail-CLOSED: if the
 *     starter breed cannot be resolved, NO horse is created. Registration
 *     still succeeds (this whole function has always been non-fatal), and
 *     advanceOnboarding's no-existing-starter-horse branch creates the
 *     horse from the player's CHOSEN breed — a path that already refuses a
 *     missing breed with a 400.
 *   - Equoria-b9zgr (Prisma client gotcha): the controller's prisma
 *     client persists FKs via the SCALAR field (breedId), NOT Prisma
 *     relation-connect syntax. `breed: { connect }` throws
 *     "Invalid invocation" — use the scalar to mirror the working
 *     userId pattern.
 *   - Equoria-a429: a color/temperament failure is logged at ERROR
 *     level (was: warn). The user is still registered and the horse
 *     still exists, but the gap is visible in production logs
 *     so the long-term sentinel job (Equoria-fhag) is not the only
 *     line of defense.
 *   - Equoria-576c0.5 (owner ruling 2026-10-19, O5 option A): the starter
 *     horse is created WITH its temperament, rolled from the starter breed's
 *     temperament weights (was: a later raw UPDATE with Thoroughbred weights
 *     whatever the starter breed, which could fail and leave it NULL). A
 *     breed with no weights creates no horse, as for missing gait ranges.
 *   - Equoria-q4uem.17 (owner ruling q308, 2026-10-29): the starter horse
 *     carries hidden traits rolled exactly as a Horse Trader horse's are
 *     (generateStoreHorseTraitRoster), set in the same insert. This is the
 *     player's one roll: the onboarding wizard fills this horse's name, breed
 *     and sex but never its traits (the roster does not depend on breed), and
 *     rolls only when it has to create the horse because none exists here.
 */

import logger from '../../../utils/logger.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { horseArrivalCare } from '../../../utils/horseArrivalCare.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  generateGenotype,
  calculatePhenotype,
  generateMarkings,
  generateTemperament,
  generateBreedPhysiqueOrRefuse,
  breedScoresMissingCode,
  breedBirthDisciplineScores,
  DEFAULT_TEMPERAMENT_BREED,
  horseNameMaxLength,
} from '../../horses/index.mjs';
import { generateStoreHorseTraitRoster } from '../../traits/index.mjs';

const STARTER_HORSE_AGE_GAME_YEARS = 3;

const starterHorseNameSuffix = "'s First Horse";

/**
 * The generated starter horse name, `<username>'s First Horse`, shortened so it
 * always fits the shared horse-name limit (Equoria-4fnro; owner ruling
 * 2026-09-14, Equoria-zalyb: 40 characters). A username may be 30 characters,
 * which would make 44, so only the username part is cut; the suffix is kept.
 * Usernames are letters, digits and underscores only, so a plain slice never
 * splits a character.
 *
 * @param {string} username
 * @returns {string}
 */
export function starterHorseName(username) {
  const room = horseNameMaxLength - starterHorseNameSuffix.length;
  return `${String(username).slice(0, room)}${starterHorseNameSuffix}`;
}

/**
 * Create the starter horse for a brand-new user. Non-fatal: failures
 * inside this function MUST NOT propagate to the registration handler —
 * a user is registered even if the starter horse creation fails, and
 * the gap is logged at error level so the regression is visible.
 *
 * @param {{ id: string, username: string }} user  The freshly-created user row.
 * @param {object} [options]
 * @param {string} [options.breedName]  Name of the breed the starter horse is
 *   seeded with. Defaults to the canonical DEFAULT_TEMPERAMENT_BREED
 *   ('Thoroughbred'). Explicit because the fail-closed path (Equoria-2wjp7 —
 *   breed row absent ⇒ no horse) is only reachable with a breed name that is
 *   genuinely not in the `breeds` table, and CLAUDE.md forbids mocking an
 *   Equoria-owned Prisma path to fake that. See
 *   modules/auth/__tests__/starterHorseBreedFailClosed.integration.test.mjs.
 * @returns {Promise<void>}
 */
export async function createStarterHorseForNewUser(
  user,
  { breedName = DEFAULT_TEMPERAMENT_BREED } = {},
) {
  try {
    // Equoria game-year convention: 1 game-year = 7 real days. A 3-game-year
    // starter horse is born 3*7 = 21 real days ago, NOT 3 calendar years ago
    // (which the canonical age helper would read as ~156 game-years).
    const dateOfBirth = birthDateForAge(STARTER_HORSE_AGE_GAME_YEARS);

    // Equoria-b9zgr: resolve the breed id so the starter horse is never born
    // with a NULL breedId (the prior behaviour left every registration starter
    // horse breedless — 0/3334 rows had breedId set).
    // Equoria-2wjp7: FAIL CLOSED. If the breed cannot be resolved we do not
    // create the horse at all — a breedless mare is a dead end the player
    // cannot escape (breeding refuses her, the selector still offers her, and
    // no surface can set her breed). Registration still succeeds; the
    // onboarding breed-selection step creates the horse from the chosen breed.
    let starterBreedId = null;
    let starterDisciplineScores;
    try {
      const starterBreed = await prisma.breed.findUnique({
        where: { name: breedName },
        select: { id: true, defaultTrait: true, breedGeneticProfile: true },
      });
      starterBreedId = starterBreed?.id ?? null;
      starterDisciplineScores = breedBirthDisciplineScores(starterBreed);
    } catch (breedLookupError) {
      logger.error(
        '[onboardingService.createStarterHorseForNewUser] FAILED to resolve the starter breed — NOT creating a starter horse (a breedless horse is worse than none):',
        { userId: user.id, breedName, error: breedLookupError.message },
      );
      return;
    }

    if (starterBreedId === null) {
      logger.error(
        `[onboardingService.createStarterHorseForNewUser] Starter breed "${breedName}" not found — NOT creating a starter horse (a breedless horse is worse than none). The onboarding breed-selection step will create it from the player's chosen breed.`,
        { userId: user.id },
      );
      return;
    }

    // Owner request 2026-10-28 (Equoria-vqz4b, Equoria-17zgu): conformation and gaits
    // rolled from the starter breed's ranges. The breed step re-rolls them for the
    // player's chosen breed. A breed without ranges is refused (owner ruling 2026-10-28,
    // q211): no starter horse is created, as for a missing breed above, and the
    // onboarding breed step creates it from the player's chosen breed.
    let physique;
    try {
      physique = generateBreedPhysiqueOrRefuse(breedName, {
        context: `registration starter horse for user ${user.id}`,
      });
    } catch (refusal) {
      if (refusal?.code === breedScoresMissingCode) {
        return;
      }
      throw refusal;
    }

    // Equoria-576c0.5: a permanent temperament from the starter breed's weights,
    // set in the same insert. A breed without weights throws before the insert, so no
    // horse is created (the outer catch logs it; registration still succeeds).
    const temperament = generateTemperament(breedName);

    const starterHorse = await prisma.horse.create({
      data: {
        name: starterHorseName(user.username),
        sex: 'Mare',
        age: 3,
        dateOfBirth,
        // Equoria-b9zgr: this controller's prisma client
        // (packages/database/prismaClient.mjs) is a different generation than
        // the test client and persists FKs via the SCALAR field (like
        // `userId` above), NOT Prisma relation-connect syntax — `breed:
        // { connect }` throws "Invalid invocation" here. Use the scalar
        // breedId to mirror the working userId pattern.
        // Equoria-2wjp7: unconditional — the guard above already returned if it
        // could not be resolved, so this is never NULL.
        breedId: starterBreedId,
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
        // Owner ruling 2026-10-28 (Equoria-fd3f2): Excellent health and fully fed.
        ...horseArrivalCare(),
        ...physique,
        temperament,
        // Equoria-q4uem.17 (q308): the Horse Trader's hidden roll, 1-5 roster traits.
        epigeneticModifiers: generateStoreHorseTraitRoster(),
        // Equoria-tl5l8: born with the starter breed's discipline at +5.
        ...(starterDisciplineScores && { disciplineScores: starterDisciplineScores }),
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
      const starterMarkings = generateMarkings(
        null,
        starterBaseColor.colorName,
        Math.random,
        starterGenotype,
      );
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
      // the error log. Still non-fatal at the request level — the user is
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
  } catch (horseError) {
    // Non-fatal — user is registered even if starter horse creation fails
    logger.error(
      '[onboardingService.createStarterHorseForNewUser] Failed to create starter horse:',
      horseError,
    );
  }
}
