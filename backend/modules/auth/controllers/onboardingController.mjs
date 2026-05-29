/**
 * onboardingController.mjs (Equoria-vhv3i — extracted from authController.mjs)
 *
 * Two onboarding endpoints + the breed-aware starter-stat generator:
 *
 *   POST /api/v1/auth/complete-onboarding   authenticated
 *   POST /api/v1/auth/advance-onboarding    authenticated
 *
 * advanceOnboarding owns the 10-step guided-tour state machine PLUS the
 * starter-horse customization at step 10 (name + breed + gender). The
 * starter-horse customization writes into the SAME row that registration
 * created (the "TestFixture-style" stand-in horse with the default breed +
 * Thoroughbred-fallback temperament + null phenotype), upgrading it to the
 * user's chosen breed, temperament, and breed-aware color.
 *
 * Game-design history preserved (do NOT regress when editing):
 *   - Equoria-3f0yx: ESM-native JSON load (readFileSync + JSON.parse) for
 *     the per-breed starter-stat distribution. Do NOT switch to
 *     `createRequire(import.meta.url)` (CommonJS bridge) or to import
 *     attributes (`with { type: 'json' }`) without a separate ESLint
 *     config bump.
 *   - Equoria-vbrc4: the breed-genotype + phenotype computation MUST run
 *     OUTSIDE prisma.$transaction. Doing the genotype/phenotype work
 *     inside the 5s tx budget caused Prisma P2028 "transaction already
 *     closed". The transaction only owns the create/update writes.
 *   - Equoria-f5372 + Equoria-8vwly: temperament is re-assigned from the
 *     CHOSEN breed's weighted distribution at onboarding. The permanence
 *     invariant ("temperament assigned once, never changes") is preserved
 *     — the permanence boundary is breed finalization (onboarding step
 *     10), NOT registration. The register-time temperament is a
 *     Thoroughbred-fallback placeholder the user never sees.
 *   - JSONB guard: breedGeneticProfile is a Prisma JsonValue. Treat ONLY
 *     a plain object as usable; null / primitives / arrays fall back to
 *     generic defaults (CONTRIBUTING.md "JSONB type guard").
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { AppError } from '../../../errors/index.mjs';
import logger from '../../../utils/logger.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { MS_PER_GAME_YEAR } from '../../../constants/time.mjs';
import { HORSE_STAT_VALUES } from '../../../constants/schema.mjs';
import { canonicalizeHorseSex } from '../../../../packages/database/horseSexCanonical.mjs';
import { generateGenotype } from '../../horses/services/genotypeGenerationService.mjs';
import { calculatePhenotype } from '../../horses/services/phenotypeCalculationService.mjs';
import { generateMarkings } from '../../horses/services/markingGenerationService.mjs';
import { generateTemperamentWithDefault } from '../../horses/services/temperamentService.mjs';

// Equoria-3f0yx: ESM-native JSON load. See module docstring for the
// rationale on readFileSync vs createRequire vs import attributes.
const breedStarterStatsDir = dirname(fileURLToPath(import.meta.url));
const BREED_STARTER_STATS = JSON.parse(
  readFileSync(resolve(breedStarterStatsDir, '../../../data/breedStarterStats.json'), 'utf8'),
);

/**
 * Generate breed-specific starter stats using mean + std_dev from breed data.
 * Uses normal distribution (Box-Muller) around the breed's mean for each stat.
 * Clamps each stat to [1, 100] and ensures total does not exceed 200.
 */
function generateStarterStats(breedName) {
  const statNames = HORSE_STAT_VALUES;
  const breedData = breedName ? BREED_STARTER_STATS[breedName] : null;

  const stats = {};

  if (breedData) {
    // Box-Muller transform for normal distribution
    function normalRandom(mean, std) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return Math.round(mean + z * std);
    }

    for (const stat of statNames) {
      const def = breedData[stat];
      if (def) {
        stats[stat] = Math.max(1, Math.min(100, normalRandom(def.mean, def.std)));
      } else {
        stats[stat] = Math.max(1, Math.min(100, normalRandom(15, 3)));
      }
    }

    // Enforce total cap of 200
    let total = Object.values(stats).reduce((a, b) => a + b, 0);
    while (total > 200) {
      // Reduce the highest stat by 1
      const highest = statNames.reduce((a, b) => (stats[a] >= stats[b] ? a : b));
      if (stats[highest] > 1) {
        stats[highest]--;
        total--;
      } else {
        break;
      }
    }
  } else {
    // Fallback: balanced stats, ~17 each across 12 stats
    statNames.forEach(s => {
      stats[s] = 17;
    });
  }

  return stats;
}

/**
 * POST /api/v1/auth/complete-onboarding
 * Marks the authenticated user's onboarding as complete in User.settings.
 */
export const completeOnboarding = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentSettings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};

    await prisma.user.update({
      where: { id: userId },
      data: { settings: { ...currentSettings, completedOnboarding: true } },
    });

    logger.info(`[onboardingController.completeOnboarding] User ${userId} completed onboarding`);

    res.status(200).json({
      success: true,
      message: 'Onboarding completed',
      data: { completedOnboarding: true },
    });
  } catch (error) {
    logger.error('[onboardingController.completeOnboarding] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Failed to complete onboarding.', 500));
  }
};

/**
 * POST /api/v1/auth/advance-onboarding
 * Increments the authenticated user's onboarding step.
 * When the user reaches step 10, also sets completedOnboarding: true.
 * Used by the OnboardingSpotlight component to drive the 10-step guided tour.
 */
export const advanceOnboarding = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { horseName, breedId, gender } = req.body || {};
    const hasHorseCustomization =
      typeof horseName === 'string' || breedId !== undefined || typeof gender === 'string';
    const trimmedHorseName = typeof horseName === 'string' ? horseName.trim().slice(0, 40) : '';
    const normalizedBreedId =
      breedId !== undefined && Number.isInteger(Number(breedId)) ? Number(breedId) : null;
    // Canonicalize the client-supplied gender to Title Case. The frontend
    // currently sends Title Case ('Mare' / 'Stallion'), but the canonicalizer
    // accepts any casing so this stays robust if client typings drift.
    // Only adult sexes are valid for starter-horse selection.
    let normalizedGender = null;
    if (typeof gender === 'string') {
      try {
        const canonical = canonicalizeHorseSex(gender);
        if (canonical === 'Mare' || canonical === 'Stallion') {
          normalizedGender = canonical;
        }
      } catch {
        normalizedGender = null;
      }
    }

    if (hasHorseCustomization) {
      if (!trimmedHorseName) {
        throw new AppError('Starter horse name is required.', 400);
      }
      if (!normalizedBreedId) {
        throw new AppError('Starter horse breed is required.', 400);
      }
      if (!normalizedGender) {
        throw new AppError('Starter horse gender is required.', 400);
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const currentSettings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
    const currentStep =
      typeof currentSettings.onboardingStep === 'number' ? currentSettings.onboardingStep : 0;
    const newStep = hasHorseCustomization ? 10 : currentStep + 1;
    const isComplete = newStep >= 10;

    const updatedSettings = {
      ...currentSettings,
      onboardingStep: newStep,
      ...(isComplete ? { completedOnboarding: true } : {}),
    };

    let persistedHorse = null;

    // Equoria-vbrc4: pre-compute the starter horse's color OUTSIDE the
    // interactive transaction. The breed-profile read + genotype/phenotype
    // generation are pure-ish work that must NOT run inside the 5s tx budget
    // (doing so caused Prisma P2028 "transaction already closed"). Only the
    // create/update writes belong in the tx. Computed only when a horse is
    // actually being customized; discarded harmlessly if the tx later rejects
    // a missing breed.
    let starterColorGenotype = null;
    let starterPhenotype = null;
    if (hasHorseCustomization) {
      let breedGeneticProfile = null;
      try {
        const breedRows = await prisma.$queryRaw`
          SELECT "breedGeneticProfile"
          FROM breeds
          WHERE id = ${normalizedBreedId}
        `;
        const profile = breedRows?.[0]?.breedGeneticProfile ?? null;
        // JSONB guard (CONTRIBUTING.md): a JsonValue may be null, primitive,
        // array, or object — only treat a plain object as a usable profile.
        if (
          profile !== null &&
          profile !== undefined &&
          typeof profile === 'object' &&
          !Array.isArray(profile)
        ) {
          breedGeneticProfile = profile;
        }
      } catch (lookupErr) {
        logger.warn(
          `[onboardingController.advanceOnboarding] Failed to load breedGeneticProfile for breed ${normalizedBreedId}: ${lookupErr.message}. Falling back to generic defaults.`,
        );
        breedGeneticProfile = null;
      }

      starterColorGenotype = generateGenotype(breedGeneticProfile);
      const starterBaseColor = calculatePhenotype(
        starterColorGenotype,
        breedGeneticProfile?.shade_bias ?? null,
      );
      const starterMarkings = generateMarkings(breedGeneticProfile, starterBaseColor.colorName);
      starterPhenotype = { ...starterBaseColor, ...starterMarkings };
    }

    await prisma.$transaction(async tx => {
      if (hasHorseCustomization) {
        const breed = await tx.breed.findUnique({
          where: { id: normalizedBreedId },
          select: { id: true, name: true },
        });

        if (!breed) {
          throw new AppError('Selected starter horse breed was not found.', 400);
        }

        const updateData = {
          name: trimmedHorseName,
          breedId: breed.id,
          sex: normalizedGender,
          ...generateStarterStats(breed.name),
        };

        const starterHorse = await tx.horse.findFirst({
          where: { userId },
          orderBy: { id: 'asc' },
        });

        if (starterHorse) {
          // Equoria-f5372: fill temperament only if the existing starter horse
          // Equoria-8vwly: re-assign the temperament from the CHOSEN breed's
          // weighted distribution at onboarding. The temperament-permanence
          // invariant ("assigned once, never changed") is preserved — the
          // permanence boundary is BREED FINALIZATION (onboarding completion),
          // NOT registration. The register-time temperament is a Thoroughbred-
          // fallback placeholder that the user never sees, set before the breed
          // is chosen; replacing it with the user's actual breed's distribution
          // is the correct first-and-only assignment. (Game-realism: a foal of
          // a Friesian doesn't have Thoroughbred-distributed behavior.) Existing
          // horses that completed onboarding under the OLD behavior are NOT
          // backfilled — their temperaments are now real gameplay state.
          persistedHorse = await tx.horse.update({
            where: { id: starterHorse.id },
            data: {
              ...updateData,
              temperament: generateTemperamentWithDefault(breed.name),
            },
            include: { breed: { select: { id: true, name: true } } },
          });
        } else {
          // Equoria game-year convention: 1 game-year = 7 real days. A 3-game-year
          // starter horse is born 3*7 = 21 real days ago, NOT 3 calendar years ago
          // (which the canonical age helper would read as ~156 game-years).
          const dateOfBirth = new Date(Date.now() - 3 * MS_PER_GAME_YEAR);

          // Equoria-vbrc4: a brand-new starter horse created via this branch must
          // be born with a valid colorGenotype + phenotype (omitting them produced
          // a NULL-phenotype row, tripping backend/__tests__/horseColorNullSentinel).
          // The breed-aware color is pre-computed BEFORE the transaction (see above)
          // so the genotype/phenotype generation never runs inside the 5s tx budget.
          // Equoria-f5372: brand-new horse — assign temperament from the chosen breed.
          persistedHorse = await tx.horse.create({
            data: {
              ...updateData,
              age: 3,
              dateOfBirth,
              userId,
              healthStatus: 'Excellent',
              temperament: generateTemperamentWithDefault(breed.name),
              colorGenotype: starterColorGenotype,
              phenotype: starterPhenotype,
            },
            include: { breed: { select: { id: true, name: true } } },
          });
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { settings: updatedSettings },
      });
    });

    if (persistedHorse) {
      logger.info(
        `[onboardingController.advanceOnboarding] Persisted starter horse ${persistedHorse.id} for user ${userId}`,
      );
    }

    logger.info(
      `[onboardingController.advanceOnboarding] User ${userId} advanced to step ${newStep}${isComplete ? ' (onboarding complete)' : ''}`,
    );

    res.status(200).json({
      success: true,
      message: isComplete ? 'Onboarding complete' : 'Onboarding step advanced',
      data: {
        step: newStep,
        completed: isComplete,
        horse: persistedHorse
          ? {
              id: persistedHorse.id,
              name: persistedHorse.name,
              breedId: persistedHorse.breedId,
              breed: persistedHorse.breed?.name ?? null,
              gender: persistedHorse.sex,
            }
          : null,
      },
    });
  } catch (error) {
    logger.error('[onboardingController.advanceOnboarding] Error:', error);
    if (AppError.isAppError(error)) {
      return next(error);
    }
    next(new AppError('Failed to advance onboarding.', 500));
  }
};
