import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { AppError, ValidationError, NotFoundError, DatabaseError } from '../../../errors/index.mjs';
import { getCachedQuery } from '../../../utils/cacheHelper.mjs';

// Cache TTL constants (seconds)
const BREED_LIST_TTL = 600; // 10 minutes — breed list rarely changes
const BREED_DETAIL_TTL = 600; // 10 minutes — breed detail rarely changes

/**
 * Breed Controller
 * Handles CRUD operations for horse breeds
 */

// Create a new breed
export async function createBreed(req, res, next) {
  const { name, description } = req.body; // Added description

  try {
    // Check if breed name already exists (case-sensitive)
    const existingBreed = await prisma.breed.findFirst({
      where: { name }, // Prisma is case-sensitive by default for checks on PostgreSQL
    });

    if (existingBreed) {
      throw new ValidationError('Breed name already exists', 'name', name);
    }

    // Additional case-insensitive check
    const breeds = await prisma.breed.findMany({
      where: { name: { equals: name, mode: 'insensitive' } },
    });

    if (breeds.length > 0) {
      throw new ValidationError('Breed name already exists (case-insensitive)', 'name', name);
    }

    const newBreed = await prisma.breed.create({
      data: {
        name,
        description,
      },
    });

    logger.info(`Created new breed: ${newBreed.name} (ID: ${newBreed.id})`);

    res.status(201).json({
      success: true,
      data: newBreed,
      message: 'Breed created successfully',
    });
  } catch (error) {
    logger.error(`Error creating breed: ${error.message}`);

    // Forward operational AppErrors (e.g. the duplicate-name ValidationError
    // thrown above) UNCHANGED so the central handler maps them to their real
    // 4xx status. Without this, the DatabaseError fallback below re-wrapped a
    // 400 client-validation error into a 500 server error (Equoria-jv7ur).
    // Uses the cross-module-cache-safe marker check (see AppError.isAppError).
    if (AppError.isAppError(error)) {
      return next(error);
    }

    // Handle Prisma unique constraint errors (race between the existence check
    // above and the create — yields the same duplicate-name 400 semantics).
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return next(new ValidationError('Breed name already exists', 'name', name));
    }

    next(new DatabaseError('Failed to create breed', error));
  }
}

// Get all breeds
export async function getAllBreeds(req, res, next) {
  try {
    const breeds = await getCachedQuery(
      'breeds:list:all',
      () =>
        prisma.breed.findMany({
          orderBy: { name: 'asc' },
        }),
      BREED_LIST_TTL,
    );

    logger.info(`Retrieved ${breeds.length} breeds`);

    res.status(200).json({
      success: true,
      data: breeds,
      count: breeds.length,
    });
  } catch (error) {
    logger.error(`Error getting all breeds: ${error.message}`);
    next(new DatabaseError('Failed to retrieve breeds', error));
  }
}

// Get a single breed by ID
const CONFORMATION_REGIONS = [
  'head',
  'neck',
  'shoulders',
  'back',
  'hindquarters',
  'legs',
  'hooves',
  'topline',
  'overallConformation',
];

/**
 * Get average conformation scores for all horses of a given breed.
 * Endpoint: GET /api/v1/breeds/:id/conformation-averages
 */
export async function getConformationAverages(req, res, next) {
  const { id } = req.params;

  try {
    const breedId = parseInt(id, 10);

    if (isNaN(breedId) || breedId <= 0) {
      throw new ValidationError('Invalid breed ID', 'id', id);
    }

    const breed = await prisma.breed.findUnique({ where: { id: breedId } });

    if (!breed) {
      throw new NotFoundError('Breed', breedId);
    }

    const horses = await prisma.horse.findMany({
      where: {
        breedId,
        conformationScores: { not: null },
      },
      select: { conformationScores: true },
    });

    // Compute per-region averages from real data; return 0 when no horses exist
    const totals = Object.fromEntries(CONFORMATION_REGIONS.map(r => [r, 0]));
    let count = 0;

    for (const horse of horses) {
      const scores = horse.conformationScores;
      if (!scores || typeof scores !== 'object') {
        continue;
      }
      CONFORMATION_REGIONS.forEach(region => {
        const val = scores[region];
        if (typeof val === 'number') {
          totals[region] += val;
        }
      });
      count++;
    }

    const averages = Object.fromEntries(
      CONFORMATION_REGIONS.map(region => [
        region,
        count > 0 ? Math.round((totals[region] / count) * 10) / 10 : 0,
      ]),
    );

    logger.info(
      `[breedController.getConformationAverages] breed ${breedId} (${breed.name}): ${count} horses`,
    );

    res.status(200).json({
      success: true,
      data: {
        breedId: String(breedId),
        breedName: breed.name,
        averages,
        horseCount: count,
      },
    });
  } catch (error) {
    logger.error(`Error getting conformation averages for breed ${id}: ${error.message}`);

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return next(error);
    }

    next(new DatabaseError('Failed to retrieve conformation averages', error));
  }
}

export async function getBreedById(req, res, next) {
  const { id } = req.params;

  try {
    const breedId = parseInt(id, 10);

    if (isNaN(breedId) || breedId <= 0) {
      throw new ValidationError('Invalid breed ID', 'id', id);
    }

    const breed = await getCachedQuery(
      `breeds:detail:${breedId}`,
      () => prisma.breed.findUnique({ where: { id: breedId } }),
      BREED_DETAIL_TTL,
    );

    if (!breed) {
      throw new NotFoundError('Breed', breedId);
    }

    logger.info(`Retrieved breed: ${breed.name} (ID: ${breed.id})`);

    res.status(200).json({
      success: true,
      data: breed,
    });
  } catch (error) {
    logger.error(`Error getting breed by id ${id}: ${error.message}`);

    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return next(error);
    }

    next(new DatabaseError('Failed to retrieve breed', error));
  }
}
