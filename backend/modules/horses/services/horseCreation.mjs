/**
 * The horse-insert command (Equoria-q4uem.7 S2, command/query split of the former
 * horseModelService). createHorse writes one horse on the caller's transaction
 * client (or the global client) and is the funnel every acquisition path uses.
 * The by-id read lives in horseRouteQueries.mjs.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { validateConformationScores } from './conformationService.mjs';
import { validateGaitScores } from './gaitService.mjs';
import { generateGenotype } from './genotypeGenerationService.mjs';
import { calculatePhenotype } from './phenotypeCalculationService.mjs';
import { generateMarkings } from './markingGenerationService.mjs';

async function createHorse(horseData, client = prisma) {
  try {
    const {
      name,
      age,
      breedId,
      breed,
      userId,
      ownerId,
      stableId,
      sex,
      dateOfBirth,
      colorGenotype,
      phenotype,
      shade,
      imageUrl,
      trait,
      temperament,
      precision,
      strength,
      speed,
      stamina,
      agility,
      balance,
      endurance,
      intelligence,
      boldness,
      flexibility,
      obedience,
      focus,
      personality,
      totalEarnings,
      sireId,
      damId,
      studStatus,
      studFee,
      lastBredDate,
      forSale,
      salePrice,
      healthStatus,
      lastVettedDate,
      lastFedDate,
      hungerSince,
      tack,
      gaitScores,
      disciplineScores,
    } = horseData;

    // Validate required fields
    if (!name) {
      throw new Error('Horse name is required');
    }
    if (age === undefined || age === null) {
      throw new Error('Horse age is required');
    }
    if (!breedId && !breed) {
      throw new Error('Either breedId or breed connection is required');
    } // Prepare breed relationship
    let breedRelation = {};
    if (breed && typeof breed === 'object' && breed.connect) {
      // Handle Prisma relation format: { connect: { id: 1 } }
      breedRelation = { breed };
    } else if (breedId) {
      // Handle direct breedId using relationship
      breedRelation = { breed: { connect: { id: breedId } } };
    } else if (breed && typeof breed === 'number') {
      // Handle case where breed is passed as a number (treat as breedId)
      breedRelation = { breed: { connect: { id: breed } } };
    } else {
      throw new Error(
        'Invalid breed format. Use breedId (number) or breed: { connect: { id: number } }',
      );
    } // Prepare user relationship if provided
    let userRelation = {};
    const ownerIdToUse = ownerId || userId; // Accept either parameter name for backward compatibility
    if (ownerIdToUse) {
      // Use relation format (cannot set both scalar and relation)
      userRelation = {
        user: { connect: { id: ownerIdToUse } },
      };
    }

    // Prepare stable relationship if provided
    let stableRelation = {};
    if (stableId) {
      stableRelation = { stable: { connect: { id: stableId } } };
    }

    // Set default conformation scores (1-100 scale, default 20 for store/legacy horses)
    const defaultConformationScores = {
      head: 20,
      neck: 20,
      shoulders: 20,
      back: 20,
      legs: 20,
      hooves: 20,
      topline: 20,
      hindquarters: 20,
      overallConformation: 20,
    };

    // Use epigenetic modifiers as supplied by the caller. createHorse is the
    // GENERIC creation path; it does NOT roll at-birth epigenetic traits.
    // At-birth trait assignment lives exclusively in the live foaling path
    // (`foalingService.createFoalFromPregnancy()` → `applyEpigeneticTraitsAtBirth`
    // in `utils/applyEpigeneticTraitsAtBirth.mjs`), which passes the resolved
    // modifiers down to createHorse. The former horseModel fallback (Impl B,
    // `utils/atBirthTraits.mjs`) was removed per review decision B1
    // (Equoria-313oc): it used an incorrect trait vocabulary
    // (hardy/well_bred/inbred), most of whose traits had no traitEffects entry,
    // and its presence created a "flag lapse" trust landmine.
    const epigeneticModifiers = horseData.epigeneticModifiers || {
      positive: [],
      negative: [],
      hidden: [],
    };

    // Equoria-ennm: Auto-generate colorGenotype + phenotype when caller omits them.
    // createHorse is the GENERIC creation path called from horseRoutes POST /horses,
    // marketplace tests, breeding tests, etc. Without this defence any caller that
    // forgets to pass color genetics produces a NULL-phenotype horse. The horseRoutes
    // POST /horses path already pre-computes these; this branch is the safety net for
    // every other caller. Throws on generation failure so the model layer fails loud.
    let resolvedColorGenotype = colorGenotype;
    let resolvedPhenotype = phenotype;
    if (
      resolvedColorGenotype === null ||
      resolvedColorGenotype === undefined ||
      resolvedPhenotype === null ||
      resolvedPhenotype === undefined
    ) {
      // Resolve the breed's breedGeneticProfile via raw SQL because the Prisma DMMF
      // may omit the JSONB column. Both call-shapes are supported: scalar breedId
      // or breed: { connect: { id } } / breed: number.
      let resolvedBreedId = null;
      if (typeof breedId === 'number') {
        resolvedBreedId = breedId;
      } else if (breed && typeof breed === 'object' && breed.connect && breed.connect.id) {
        resolvedBreedId = breed.connect.id;
      } else if (typeof breed === 'number') {
        resolvedBreedId = breed;
      }

      let breedGeneticProfile = null;
      if (resolvedBreedId !== null && resolvedBreedId !== undefined) {
        try {
          const breedRows = await client.$queryRaw`
            SELECT "breedGeneticProfile"
            FROM breeds
            WHERE id = ${resolvedBreedId}
          `;
          breedGeneticProfile = breedRows?.[0]?.breedGeneticProfile ?? null;
        } catch (lookupErr) {
          logger.warn(
            `[horseModel.createHorse] Failed to load breedGeneticProfile for breed ${resolvedBreedId}: ${lookupErr.message}. Falling back to generic defaults.`,
          );
          breedGeneticProfile = null;
        }
      }

      if (resolvedColorGenotype === null || resolvedColorGenotype === undefined) {
        resolvedColorGenotype = generateGenotype(breedGeneticProfile);
      }
      if (resolvedPhenotype === null || resolvedPhenotype === undefined) {
        const baseColor = calculatePhenotype(
          resolvedColorGenotype,
          breedGeneticProfile?.shadeBias ?? null,
        );
        const markings = generateMarkings(breedGeneticProfile, baseColor.colorName);
        resolvedPhenotype = { ...baseColor, ...markings };
      }
    }

    // Create horse on `client` — caller's tx if passed, else global prisma (Equoria-gumnp).
    const horse = await client.horse.create({
      data: {
        name,
        age,
        ...breedRelation,
        ...userRelation,
        ...stableRelation,
        ...(sex && { sex }),
        ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
        ...(resolvedColorGenotype && { colorGenotype: resolvedColorGenotype }),
        ...(resolvedPhenotype && { phenotype: resolvedPhenotype }),
        ...(shade && { shade }),
        ...(imageUrl && { imageUrl }),
        ...(trait && { trait }),
        ...(temperament && { temperament }),
        ...(precision !== undefined && { precision }),
        ...(strength !== undefined && { strength }),
        ...(speed !== undefined && { speed }),
        ...(stamina !== undefined && { stamina }),
        ...(agility !== undefined && { agility }),
        ...(balance !== undefined && { balance }),
        ...(endurance !== undefined && { endurance }),
        ...(intelligence !== undefined && { intelligence }),
        ...(boldness !== undefined && { boldness }),
        ...(flexibility !== undefined && { flexibility }),
        ...(obedience !== undefined && { obedience }),
        ...(focus !== undefined && { focus }),
        ...(personality && { personality }),
        ...(totalEarnings !== undefined && { totalEarnings }),
        ...(sireId && { sire: { connect: { id: sireId } } }),
        ...(damId && { dam: { connect: { id: damId } } }),
        ...(studStatus && { studStatus }),
        ...(studFee !== undefined && { studFee }),
        ...(lastBredDate && { lastBredDate: new Date(lastBredDate) }),
        ...(forSale !== undefined && { forSale }),
        ...(salePrice !== undefined && { salePrice }),
        ...(healthStatus && { healthStatus }),
        ...(lastVettedDate && { lastVettedDate: new Date(lastVettedDate) }),
        // A foal is born with its mare's hunger (Equoria-w4ivy).
        ...(lastFedDate && { lastFedDate: new Date(lastFedDate) }),
        ...(hungerSince && { hungerSince: new Date(hungerSince) }),
        ...(tack && { tack }),
        epigeneticModifiers,
        conformationScores: validateConformationScores(
          horseData.conformationScores || defaultConformationScores,
        ),
        ...(gaitScores && { gaitScores: validateGaitScores(gaitScores) }),
        // Birth discipline +5 (Equoria-tl5l8): see services/birthDiscipline.mjs.
        ...(disciplineScores && { disciplineScores }),
      },
      // Equoria-q4uem.7: the owner's user row (password hash, MFA secret) is
      // never loaded; no caller reads it.
      include: {
        breed: true,
        stable: true,
      },
    });

    logger.info(
      `[horseModel.createHorse] Successfully created horse: ${horse.name} (ID: ${horse.id})`,
    );
    return horse;
  } catch (error) {
    logger.error('[horseModel.createHorse] Database error: %o', error);
    throw new Error(`Database error in createHorse: ${error.message}`, { cause: error });
  }
}

export { createHorse };
