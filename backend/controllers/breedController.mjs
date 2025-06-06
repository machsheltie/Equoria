import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';
import { ValidationError, NotFoundError, DatabaseError } from '../errors/index.mjs';

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

    // Handle Prisma unique constraint errors
    if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
      return next(new ValidationError('Breed name already exists', 'name', name));
    }

    next(new DatabaseError('Failed to create breed', error));
  }
}

// Get all breeds
export async function getAllBreeds(req, res, next) {
  try {
    const breeds = await prisma.breed.findMany({
      orderBy: {
        name: 'asc',
      },
    });

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
export async function getBreedById(req, res, next) {
  const { id } = req.params;

  try {
    const breedId = parseInt(id, 10);

    if (isNaN(breedId) || breedId <= 0) {
      throw new ValidationError('Invalid breed ID', 'id', id);
    }

    const breed = await prisma.breed.findUnique({
      where: { id: breedId },
    });

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
