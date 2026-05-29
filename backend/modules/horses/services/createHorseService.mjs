/**
 * createHorseService.mjs
 *
 * Service layer for POST /horses creation. Extracted from horseRoutes.mjs
 * inline body (Equoria-y8u2j, AC1) — same logic, lifted verbatim from the
 * route handler so behaviour is byte-equivalent.
 *
 * Responsibilities (all of which were previously inline in the router):
 *   - parse + validate the breedId param
 *   - resolve breed name + breedGeneticProfile via raw SQL (DMMF may omit it)
 *   - probe breedProfiles.json existence (surface as 422 vs generic 500)
 *   - generate conformation / gait / temperament from breed genetics
 *   - generate or inherit colorGenotype (with sire/dam ownership + sex guards)
 *   - calculate phenotype + markings (random or inherited)
 *   - compute dateOfBirth from age (1 game year = 7 real days) unless caller
 *     supplies an explicit dateOfBirth
 *   - call createHorse() with a whitelisted field set (prevents mass-assign)
 *   - invalidate the horse-list cache for the user
 *
 * The function returns { status, body } so the route handler can stay thin —
 * status is the HTTP code, body is the JSON envelope. Errors that should not
 * be served as 422/404/400 are rethrown so the route's catch can 500 them
 * (preserving the prior error path verbatim).
 */

import { MS_PER_GAME_YEAR } from '../../../constants/time.mjs';
import { findOwnedResource } from '../../../middleware/ownership.mjs';
import { createHorse } from '../../../models/horseModel.mjs';
import { generateConformationScores } from './conformationService.mjs';
import { generateGaitScores } from './gaitService.mjs';
import { generateTemperament } from './temperamentService.mjs';
import { generateGenotype } from './genotypeGenerationService.mjs';
import { calculatePhenotype } from './phenotypeCalculationService.mjs';
import { inheritColorGenotype } from './breedingColorInheritanceService.mjs';
import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import { generateMarkings, inheritMarkings } from './markingGenerationService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { invalidateCachePattern } from '../../../utils/cacheHelper.mjs';

/**
 * Create a horse for the given user from a validated request body.
 *
 * The caller (route handler) is responsible for running validateHorseCreation
 * + auth FIRST; this service trusts that the body has already been schema-
 * validated and that req.user.id is real.
 *
 * @param {object} reqBody - the express request body (post-validation)
 * @param {string|number} userId - the authenticated user's id
 * @returns {Promise<{status:number, body:object}>} HTTP response envelope
 */
export async function createHorseFromRequest(reqBody, userId) {
  // Parse and normalize breedId — validateHorseCreation runs isInt() but does not
  // coerce to a number type; Prisma and $queryRaw expect a numeric Int.
  const parsedBreedId = Number.parseInt(reqBody.breedId, 10);
  if (!Number.isFinite(parsedBreedId) || parsedBreedId <= 0) {
    return {
      status: 400,
      body: { success: false, message: `Invalid breedId: ${reqBody.breedId}` },
    };
  }

  // Resolve breed name + genetic profile in a single raw SQL query.
  // Raw SQL is required because the Prisma DMMF may not include breedGeneticProfile.
  // A missing breed is a data bug that must fail the request rather than
  // silently ship a horse with random stats.
  const breedRows = await prisma.$queryRaw`
    SELECT name, "breedGeneticProfile"
    FROM breeds
    WHERE id = ${parsedBreedId}
  `;
  const breedRow = breedRows[0];
  if (!breedRow?.name) {
    return {
      status: 400,
      body: { success: false, message: `No breed found for id ${parsedBreedId}` },
    };
  }
  const breedName = breedRow.name;
  const breedGeneticProfile = breedRow.breedGeneticProfile ?? null;

  // Mirror horseController.createFoal: surface "breed exists in DB but has
  // no breedProfiles.json entry" as 422 rather than letting the generators
  // throw and fall through to the generic 500 handler.
  try {
    getBreedProfile(breedName);
  } catch (err) {
    if (!err.message?.startsWith('No breedProfiles.json entry for breed')) {
      throw err;
    }
    logger.warn(
      `[createHorseService] No breedProfiles.json entry for "${breedName}" (id=${parsedBreedId}): ${err.message}`,
    );
    return {
      status: 422,
      body: {
        success: false,
        message: `No breed profile available for breed "${breedName}"`,
      },
    };
  }

  // Generate conformation scores from breed genetics.
  const conformationScores = generateConformationScores(breedName);
  // Generate gait scores from breed genetics + conformation influence.
  const gaitScores = generateGaitScores(breedName, conformationScores);
  // Generate temperament from breed-weighted random selection.
  const temperament = generateTemperament(breedName);

  // Generate coat color genotype (31E-1a / 31E-2)
  // If sireId + damId provided and both have colorGenotype → use Mendelian inheritance (31E-2)
  // Otherwise → random breed-weighted generation (31E-1a)
  let colorGenotype;
  const sireId = reqBody.sireId ? parseInt(reqBody.sireId, 10) : null;
  const damId = reqBody.damId ? parseInt(reqBody.damId, 10) : null;
  let sireHorse = null;
  let damHorse = null;

  if (sireId && damId) {
    // Dual ownership validation (CWE-284 + CWE-639). Mirrors POST /foals
    // (horseRoutes.mjs:1197): same 404 'Sire not found' / 'Dam not found'
    // for both not-found and cross-user cases to prevent ID-enumeration
    // disclosure of other players' horses. Equoria-zrbc, 31E-2 follow-up.
    const ownedSire = await findOwnedResource('horse', sireId, userId);
    if (!ownedSire) {
      return { status: 404, body: { success: false, message: 'Sire not found' } };
    }
    const ownedDam = await findOwnedResource('horse', damId, userId);
    if (!ownedDam) {
      return { status: 404, body: { success: false, message: 'Dam not found' } };
    }
    sireHorse = ownedSire;
    damHorse = ownedDam;

    // Validate biological sex roles. Sex is canonical Title Case
    // post-Equoria-duz2 — see packages/database/horseSexCanonical.mjs.
    if (sireHorse.sex !== 'Stallion') {
      return { status: 400, body: { success: false, message: 'Sire must be a stallion' } };
    }
    if (damHorse.sex !== 'Mare') {
      return { status: 400, body: { success: false, message: 'Dam must be a mare' } };
    }

    // Delegate entirely to the service — it handles missing/null genotypes internally
    // (logs a warning and falls back to random generation when a parent lacks a genotype).
    colorGenotype = inheritColorGenotype(
      sireHorse.colorGenotype ?? null,
      damHorse.colorGenotype ?? null,
      breedGeneticProfile,
    );
  } else {
    colorGenotype = generateGenotype(breedGeneticProfile);
  }

  // Calculate phenotype (display color name + pattern flags) from genotype (31E-1b)
  const baseColor = calculatePhenotype(colorGenotype, breedGeneticProfile?.shade_bias ?? null);

  // Generate markings (31E-3): face, leg, advanced, modifiers
  // When sireId+damId: inherit markings from parent phenotypes (40/40/20 rule)
  // Otherwise: random generation from breed marking_bias
  let markings;
  if (sireId && damId && sireHorse?.phenotype && damHorse?.phenotype) {
    markings = inheritMarkings(
      sireHorse.phenotype,
      damHorse.phenotype,
      breedGeneticProfile,
      baseColor.colorName,
    );
  } else {
    markings = generateMarkings(breedGeneticProfile, baseColor.colorName);
  }
  const phenotype = { ...baseColor, ...markings };

  // Whitelist creation fields to prevent mass-assignment of protected fields
  // (e.g. totalEarnings, level, bondScore, stressLevel, epigeneticModifiers)

  // Derive dateOfBirth from age so that getHorseAgeYears() computes the correct game age.
  // Equoria game-year convention: 1 game-year = 7 real days. A horse created with
  // age:5 gets a dateOfBirth 5*7 = 35 real days in the past — NOT 5 calendar years
  // (which the canonical age helper would read as ~260 game-years).
  // If the caller supplies an explicit dateOfBirth, honour it.
  const horseAge = reqBody.age ?? 0;
  const computedDateOfBirth = reqBody.dateOfBirth
    ? new Date(reqBody.dateOfBirth).toISOString()
    : new Date(Date.now() - horseAge * MS_PER_GAME_YEAR).toISOString();

  const horseData = {
    name: reqBody.name,
    breedId: parsedBreedId,
    age: reqBody.age,
    sex: reqBody.sex,
    gender: reqBody.gender,
    userId,
    dateOfBirth: computedDateOfBirth,
    healthStatus: reqBody.healthStatus || 'Excellent',
    conformationScores,
    gaitScores,
    temperament,
    colorGenotype,
    phenotype,
    ...(sireId && { sireId }),
    ...(damId && { damId }),
    ...(reqBody.finalDisplayColor && { finalDisplayColor: reqBody.finalDisplayColor }),
  };

  const newHorse = await createHorse(horseData);

  logger.info(`[createHorseService] Created new horse: ${newHorse.name} (ID: ${newHorse.id})`);

  // Invalidate horse list caches so the new horse appears on next fetch
  invalidateCachePattern('horses:list:*').catch(() => {
    /* non-critical */
  });

  return {
    status: 201,
    body: {
      success: true,
      message: 'Horse created successfully',
      data: newHorse,
    },
  };
}
