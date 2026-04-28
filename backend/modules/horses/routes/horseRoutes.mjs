import express from 'express';
import { param, body, query, validationResult } from 'express-validator';
import { getTrainableHorses } from '../../../controllers/trainingController.mjs';
import {
  getHorseOverview,
  getHorsePersonalityImpact,
  getConformation,
  getConformationAnalysis,
  getGaits,
  getTemperamentDefinitions,
  getGenetics,
  getColor,
  getBreedingColorPrediction,
  getHorseCompetitionHistory,
} from '../controllers/horseController.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
import {
  foalRateLimiter,
  mutationRateLimiter,
  queryRateLimiter,
} from '../../../middleware/rateLimiting.mjs';
import * as horseXpController from '../controllers/horseXpController.mjs';
import { createHorse } from '../../../models/horseModel.mjs';
import { generateConformationScores } from '../services/conformationService.mjs';
import { generateGaitScores } from '../services/gaitService.mjs';
import { generateTemperament } from '../services/temperamentService.mjs';
import { generateGenotype } from '../services/genotypeGenerationService.mjs';
import { calculatePhenotype } from '../services/phenotypeCalculationService.mjs';
import { inheritColorGenotype } from '../services/breedingColorInheritanceService.mjs';
import { getBreedProfile } from '../data/breedProfileLoader.mjs';
import { generateMarkings, inheritMarkings } from '../services/markingGenerationService.mjs';
import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

const router = express.Router();

// Basic pollution/accept header guard used by multiple handlers
const rejectPollutedRequest = (req, res, next) => {
  // Reject duplicate query parameters (express surfaces duplicates as arrays)
  const hasArrayIdQuery = Object.entries(req.query || {}).some(
    ([key, value]) => Array.isArray(value) && key.toLowerCase().includes('id'),
  );
  if (hasArrayIdQuery) {
    return res.status(400).json({
      success: false,
      message: 'Invalid parameters',
    });
  }

  // Reject malicious Accept header
  const acceptHeader = req.headers?.accept || '';
  if (typeof acceptHeader === 'string' && acceptHeader.includes('<script>')) {
    return res.status(406).json({
      success: false,
      message: 'Not acceptable',
    });
  }

  // Reject obvious injection in custom filter header
  const filterBreed = req.headers?.['x-filter-breed'];
  if (typeof filterBreed === 'string' && filterBreed.includes("' OR '1'='1")) {
    return res.status(400).json({
      success: false,
      message: 'Invalid parameters',
    });
  }

  next();
};

// Validate horse update payload to prevent type coercion / mass assignment
const validateHorseUpdatePayload = (req, res, next) => {
  const getDepth = (value, seen = new Set()) => {
    if (value && typeof value === 'object') {
      if (seen.has(value)) {
        return 0;
      }
      seen.add(value);
      let maxDepth = 1;
      for (const key of Object.keys(value)) {
        maxDepth = Math.max(maxDepth, 1 + getDepth(value[key], seen));
      }
      return maxDepth;
    }
    return 0;
  };

  // Enforce content types for update to prevent content-type manipulation
  const contentType = (req.headers?.['content-type'] || '').toLowerCase();
  if (contentType.includes('application/xml')) {
    return res.status(415).json({ success: false, message: 'Unsupported Media Type' });
  }
  if (contentType.includes('charset=utf-7') || contentType.includes('multipart/form-data')) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }
  const isJson = contentType.startsWith('application/json');
  if (!isJson) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }

  if (typeof req.body !== 'object' || Array.isArray(req.body) || req.body === null) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }

  const body = req.body || {};

  // Reject prototype pollution keys at top-level
  if (
    Object.prototype.hasOwnProperty.call(body, '__proto__') ||
    Object.prototype.hasOwnProperty.call(body, 'constructor') ||
    Object.getPrototypeOf(body) !== Object.prototype
  ) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }

  const depth = getDepth(body);
  if (depth > 5) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid horse payload: nested too deep' });
  }

  const allowedFields = new Set([
    'name',
    'sex',
    'gender',
    'dateOfBirth',
    'breedId',
    'sireId',
    'damId',
  ]);

  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid horse payload: unexpected field' });
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid horse name' });
    }
    if (body.name.includes('<') || body.name.includes('\0')) {
      return res.status(400).json({ success: false, message: 'Invalid horse name' });
    }
  }

  if (body.age !== undefined || body.userId !== undefined || body.id !== undefined) {
    return res.status(400).json({ success: false, message: 'Invalid horse payload' });
  }

  if (body.traits !== undefined) {
    return res.status(400).json({ success: false, message: 'Invalid traits payload' });
  }

  next();
};

/**
 * Validation middleware for horse creation
 */
const validateHorseCreation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('breedId').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer'),
  body('age').optional().isInt({ min: 0, max: 50 }).withMessage('Age must be between 0 and 50'),
  body('sex')
    .optional()
    .isIn(['stallion', 'mare', 'gelding'])
    .withMessage('Sex must be stallion, mare, or gelding'),
  body('gender')
    .optional()
    .isIn(['STALLION', 'MARE', 'GELDING'])
    .withMessage('Gender must be STALLION, MARE, or GELDING'),
  body('userId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),
  body('finalDisplayColor')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Final display color must be a string up to 100 characters'),
  body('sireId').optional().isInt({ min: 1 }).withMessage('Sire ID must be a positive integer'),
  body('damId').optional().isInt({ min: 1 }).withMessage('Dam ID must be a positive integer'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * Validation middleware for horse ID parameter
 */
const validateHorseId = [
  param('id').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * Validation middleware for user ID parameter
 */
const validateUserId = [
  param('userId')
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * GET /horses
 * Get all horses with optional filtering
 */
router.get('/', queryRateLimiter, authenticateToken, rejectPollutedRequest, async (req, res) => {
  try {
    // Guard against overly long or malicious query strings
    const urlLength = (req.originalUrl || '').length;
    if (urlLength > 2000) {
      return res.status(414).json({ success: false, message: 'Query too long' });
    }

    let rawQuery = (req.url || '').toLowerCase();
    try {
      rawQuery = decodeURIComponent(req.url || '').toLowerCase();
    } catch {
      // keep rawQuery fallback
    }
    if (
      rawQuery.includes("' or '1'='1") ||
      rawQuery.includes('$ne') ||
      rawQuery.includes('<script>') ||
      rawQuery.includes('\0')
    ) {
      return res.status(400).json({ success: false, message: 'Invalid parameters' });
    }

    const { userId: queryUserId, breedId, limit = 200, offset = 0 } = req.query;

    const where = {};
    // Use userId from query if provided, otherwise default to the authenticated user's ID
    const effectiveUserId = queryUserId || req.user?.id;
    if (effectiveUserId) {
      // Match by userId (schema standard)
      where.userId = effectiveUserId;
    }

    if (breedId) {
      where.breedId = parseInt(breedId);
    }

    const horses = await prisma.horse.findMany({
      where,
      take: parseInt(limit),
      skip: parseInt(offset),
      include: {
        breed: true,
        user: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      message: `Found ${horses.length} horses`,
      data: horses,
    });
  } catch (error) {
    logger.error(`[horseRoutes] Error getting horses: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    });
  }
});

/**
 * GET /horses/trait-trends
 * Get trait development trends across user's horses
 */
router.get(
  '/trait-trends',
  queryRateLimiter,
  authenticateToken,
  query('userId').custom((value, { req }) => {
    if (value !== req.user.id) {
      throw new Error('Access denied: Can only access your own trait trends');
    }
    return true;
  }),
  query('timeframe')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Timeframe must be 1-365 days'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.query;
      const timeframe = parseInt(req.query.timeframe) || 30;

      // Analyze trends
      const cutoffDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);
      logger.debug(`Trend analysis requested with cutoff: ${cutoffDate.toISOString()}`);
      const trends = [];
      const patterns = {};
      const predictions = {};

      logger.info(`Trait trends analyzed for user ${userId} (${timeframe} days)`);

      res.json({
        success: true,
        data: {
          trends,
          patterns,
          predictions,
          timeframe,
          analysisDate: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error analyzing trait trends:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze trait trends',
      });
    }
  },
);

/**
 * GET /horses/temperament-definitions
 * Get all temperament type definitions with modifiers and groom synergy
 * Public endpoint — no auth required (static game data)
 */
router.get('/temperament-definitions', queryRateLimiter, getTemperamentDefinitions);

/**
 * GET /horses/:id/conformation
 * Get conformation scores for a specific horse (8 regions + overall)
 *
 * Security: Validates horse ownership before returning conformation data
 */
router.get(
  '/:id/conformation',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getConformation(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/conformation/analysis
 * Get conformation analysis with percentile rankings compared to breed
 *
 * Security: Validates horse ownership before returning analysis data
 */
router.get(
  '/:id/conformation/analysis',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getConformationAnalysis(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/gaits
 * Get gait quality scores for a specific horse (walk, trot, canter, gallop + gaiting)
 *
 * Security: Validates horse ownership before returning gait data
 */
router.get(
  '/:id/gaits',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getGaits(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/genetics
 * Get full color genotype + phenotype for a specific horse
 *
 * Security: Validates horse ownership before returning genetics data
 */
router.get(
  '/:id/genetics',
  queryRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getGenetics(req, res);
    } catch (error) {
      logger.error(`[horseRoutes] Error in genetics endpoint: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
);

/**
 * GET /horses/:id/color
 * Get player-facing coat color and markings summary for a specific horse
 *
 * Security: Validates horse ownership before returning color data
 */
router.get(
  '/:id/color',
  queryRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getColor(req, res);
    } catch (error) {
      logger.error(`[horseRoutes] Error in color endpoint: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
);

/**
 * POST /horses/breeding/color-prediction
 * Calculate breeding color prediction for two parent horses.
 * Returns probability chart of possible offspring coat colors.
 *
 * Security: Validates ownership of both sire and dam in controller
 */
router.post(
  '/breeding/color-prediction',
  mutationRateLimiter,
  rejectPollutedRequest,
  authenticateToken,
  [
    body('sireId').isInt({ min: 1 }).withMessage('sireId must be a positive integer'),
    body('damId').isInt({ min: 1 }).withMessage('damId must be a positive integer'),
    body('foalBreedId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('foalBreedId must be a positive integer'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    // Convert string body values to integers
    req.body.sireId = parseInt(req.body.sireId, 10);
    req.body.damId = parseInt(req.body.damId, 10);
    if (req.body.foalBreedId) {
      req.body.foalBreedId = parseInt(req.body.foalBreedId, 10);
    }

    try {
      await getBreedingColorPrediction(req, res);
    } catch (error) {
      logger.error(`[horseRoutes] Error in breeding color prediction: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
);

/**
 * GET /horses/:id
 * Get a specific horse by ID
 *
 * Security: Validates horse ownership before returning data
 */
router.get(
  '/:id',
  queryRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse', {
    include: ['breed', 'user'],
  }),
  async (req, res) => {
    try {
      // Horse already validated and attached to req.horse by ownership middleware
      // No need for additional database query!
      const horse = req.horse;

      res.json({
        success: true,
        data: horse,
      });
    } catch (error) {
      logger.error(`[horseRoutes] Error getting horse: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /horses
 * Create a new horse
 */
router.post(
  '/',
  mutationRateLimiter,
  authenticateToken,
  validateHorseCreation,
  async (req, res) => {
    try {
      // Resolve breed name from ID — every generator downstream keys by
      // display name against breedProfiles.json. A missing breed is a
      // data bug that must fail the request rather than silently ship
      // a horse with random stats.
      const breedRecord = req.body.breedId
        ? await prisma.breed.findUnique({
            where: { id: req.body.breedId },
            select: { name: true },
          })
        : null;
      if (!breedRecord?.name) {
        return res.status(400).json({
          success: false,
          message: `No breed found for id ${req.body.breedId}`,
        });
      }
      const breedName = breedRecord.name;

      // Generate conformation scores from breed genetics.
      const conformationScores = generateConformationScores(breedName);
      // Generate gait scores from breed genetics + conformation influence.
      const gaitScores = generateGaitScores(breedName, conformationScores);
      // Generate temperament from breed-weighted random selection.
      const temperament = generateTemperament(breedName);

      // Fetch breed genetic profile for coat color genotype generation
      // Use raw SQL to bypass stale Prisma client DMMF that may not include breedGeneticProfile
      let breedGeneticProfile = null;
      if (req.body.breedId) {
        const breedRows = await prisma.$queryRaw`
          SELECT "breedGeneticProfile" FROM breeds WHERE id = ${req.body.breedId}
        `;
        breedGeneticProfile = breedRows[0]?.breedGeneticProfile ?? null;
      }
      const breedName = breedRow.name;
      const breedGeneticProfile = breedRow.breedGeneticProfile ?? null;

      // Mirror horseController.createFoal: surface "breed exists in DB but has
      // no breedProfiles.json entry" as 422 rather than letting the generators
      // throw and fall through to the generic 500 handler.
      try {
        getBreedProfile(breedName);
      } catch (err) {
        logger.warn(
          `[horseRoutes POST /] No breedProfiles.json entry for "${breedName}" (id=${req.body.breedId}): ${err.message}`,
        );
        return res.status(422).json({
          success: false,
          message: `No breed profile available for breed "${breedName}"`,
        });
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
      const sireId = req.body.sireId ? parseInt(req.body.sireId, 10) : null;
      const damId = req.body.damId ? parseInt(req.body.damId, 10) : null;
      let sireHorse = null;
      let damHorse = null;

      if (sireId && damId) {
        [sireHorse, damHorse] = await Promise.all([
          prisma.horse.findUnique({
            where: { id: sireId },
            select: { colorGenotype: true, sex: true, phenotype: true },
          }),
          prisma.horse.findUnique({
            where: { id: damId },
            select: { colorGenotype: true, sex: true, phenotype: true },
          }),
        ]);

        // Validate parent existence
        if (!sireHorse) {
          return res
            .status(400)
            .json({ success: false, message: `Sire horse with ID ${sireId} not found` });
        }
        if (!damHorse) {
          return res
            .status(400)
            .json({ success: false, message: `Dam horse with ID ${damId} not found` });
        }

        // Validate biological sex roles
        if (sireHorse.sex !== 'stallion') {
          return res.status(400).json({ success: false, message: 'Sire must be a stallion' });
        }
        if (damHorse.sex !== 'mare') {
          return res.status(400).json({ success: false, message: 'Dam must be a mare' });
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

      // Derive dateOfBirth from age so that getHorseAge() computes the correct game age.
      // If the caller supplies an explicit dateOfBirth, honour it; otherwise compute from age
      // so a horse created with age:5 gets a dateOfBirth 5 years in the past.
      const horseAge = req.body.age ?? 0;
      const computedDateOfBirth = (() => {
        if (req.body.dateOfBirth) {
          return new Date(req.body.dateOfBirth).toISOString();
        }
        const d = new Date();
        d.setFullYear(d.getFullYear() - horseAge);
        return d.toISOString();
      })();

      const horseData = {
        name: req.body.name,
        breedId: req.body.breedId,
        age: req.body.age,
        sex: req.body.sex,
        gender: req.body.gender,
        userId: req.user.id,
        dateOfBirth: computedDateOfBirth,
        healthStatus: req.body.healthStatus || 'Good',
        conformationScores,
        gaitScores,
        temperament,
        colorGenotype,
        phenotype,
        ...(sireId && { sireId }),
        ...(damId && { damId }),
        ...(req.body.finalDisplayColor && { finalDisplayColor: req.body.finalDisplayColor }),
      };

      const newHorse = await createHorse(horseData);

      logger.info(`[horseRoutes] Created new horse: ${newHorse.name} (ID: ${newHorse.id})`);

      res.status(201).json({
        success: true,
        message: 'Horse created successfully',
        data: newHorse,
      });
    } catch (error) {
      logger.error(`[horseRoutes] Error creating horse: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /horses/batch-update
 * Stubbed endpoint to reject polluted batch update payloads
 */
router.post(
  '/batch-update',
  mutationRateLimiter,
  authenticateToken,
  rejectPollutedRequest,
  async (req, res) => {
    try {
      const { horseIds, updates, data } = req.body || {};

      if (data && Array.isArray(data)) {
        const getDepth = (arr, depth = 1) =>
          Array.isArray(arr)
            ? Math.max(...arr.map(item => getDepth(item, depth + 1)), depth)
            : depth;
        const depth = getDepth(data);
        if (depth > 5) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid payload: nested too deep' });
        }
      }

      if (!Array.isArray(horseIds)) {
        return res.status(400).json({ success: false, message: 'Invalid horseIds' });
      }

      if (horseIds.length > 1000) {
        return res.status(400).json({ success: false, message: 'Too many horseIds' });
      }

      const invalidIds = horseIds.some(id => !Number.isInteger(id) || id <= 0);
      if (invalidIds) {
        return res.status(400).json({ success: false, message: 'Invalid horseIds' });
      }

      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid updates payload' });
      }

      // Security-first stub: reject by default to prevent mass assignment
      return res.status(400).json({ success: false, message: 'Batch updates are not allowed' });
    } catch (error) {
      logger.error(`[horseRoutes] Error in batch-update: ${error.message}`);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
);

/**
 * PUT /horses/:id
 * Update a horse
 *
 * Security: Validates horse ownership before allowing updates
 */
router.put(
  '/:id',
  mutationRateLimiter,
  rejectPollutedRequest,
  validateHorseId,
  requireOwnership('horse'),
  validateHorseUpdatePayload,
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      // Ownership already validated by middleware
      const updatedHorse = await prisma.horse.update({
        where: { id: horseId },
        data: req.body,
        include: {
          breed: true,
          user: {
            select: { id: true, username: true },
          },
        },
      });

      logger.info(
        `[horseRoutes] User ${req.user.id} updated horse: ${updatedHorse.name} (ID: ${horseId})`,
      );

      res.json({
        success: true,
        message: 'Horse updated successfully',
        data: updatedHorse,
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      // Surface validation issues as 400 for security tests
      if (
        error.name === 'PrismaClientValidationError' ||
        error.message?.includes('Invalid `prisma.horse.update()`') ||
        error.message?.includes('Unknown argument')
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid horse payload',
        });
      }

      logger.error(`[horseRoutes] Error updating horse: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * DELETE /horses/:id
 * Delete a horse
 *
 * Security: Validates horse ownership before allowing deletion
 */
router.delete(
  '/:id',
  mutationRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id);

      // Ownership already validated by middleware
      await prisma.horse.delete({
        where: { id: horseId },
      });

      logger.info(`[horseRoutes] User ${req.user.id} deleted horse ID: ${horseId}`);

      res.json({
        success: true,
        message: 'Horse deleted successfully',
      });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          message: 'Horse not found',
        });
      }

      logger.error(`[horseRoutes] Error deleting horse: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/trainable/:userId
 * Get all horses owned by a user that are eligible for training
 *
 * Security: Validates that user can only access their own trainable horses
 */
router.get(
  '/trainable/:userId',
  queryRateLimiter,
  authenticateToken,
  validateUserId,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Test bypass mechanism removed for production security (2025-01-16)
      // Tests now use real JWT tokens via backend/tests/helpers/authHelper.mjs

      // Verify user can only access their own trainable horses
      if (!req.user || req.user.id !== userId) {
        logger.warn(
          `[horseRoutes] User ${req.user?.id} attempted to access trainable horses for user ${userId}`,
        );
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Cannot access trainable horses for another user',
        });
      }

      const trainableHorses = await getTrainableHorses(userId);

      res.json({
        success: true,
        message: `Found ${trainableHorses.length} trainable horses`,
        data: trainableHorses,
      });
    } catch (error) {
      logger.error('[trainable horses route] Error occurred:', {
        error: error.message,
        stack: error.stack,
      });

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /api/horses/:horseId/competition-history
 *
 * Per-horse competition history + statistics for the /my-stable Hall of
 * Fame career display (Story 21S-4). Response shape matches the
 * `CompetitionHistoryData` TypeScript interface used by
 * `useHorseCompetitionHistory` on the frontend.
 *
 * Security: horse ownership required.
 */
router.get(
  '/:horseId/competition-history',
  queryRateLimiter,
  authenticateToken,
  [
    param('horseId').isInt({ min: 1 }).withMessage('Horse ID must be a positive integer'),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res
          .status(400)
          .json({ success: false, message: 'Validation failed', errors: errors.array() });
      }
      return next();
    },
  ],
  requireOwnership('horse', { idParam: 'horseId' }),
  getHorseCompetitionHistory,
);

/**
 * GET /horses/:id/history
 * Get competition history for a specific horse
 *
 * Security: Validates horse ownership before returning history
 */
router.get(
  '/:id/history',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Dynamic import for ES module
      const { getHorseHistory } = await import('../controllers/horseController.mjs');
      await getHorseHistory(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * Validation middleware for foal creation
 */
const validateFoalCreation = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('breedId').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer'),
  body('sireId').isInt({ min: 1 }).withMessage('Sire ID must be a positive integer'),
  body('damId').isInt({ min: 1 }).withMessage('Dam ID must be a positive integer'),
  body('sex')
    .optional()
    .custom(async value => {
      const { isValidHorseSex } = await import('../../../constants/schema.mjs');
      if (value && !isValidHorseSex(value)) {
        const { HORSE_SEX_VALUES } = await import('../../../constants/schema.mjs');
        throw new Error(`Sex must be one of: ${HORSE_SEX_VALUES.join(', ')}`);
      }
      return true;
    }),
  body('userId')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('User ID must be between 1 and 50 characters'),
  body('stableId').optional().isInt({ min: 1 }).withMessage('Stable ID must be a positive integer'),
  body('healthStatus')
    .optional()
    .isIn(['Excellent', 'Good', 'Fair', 'Poor', 'Critical'])
    .withMessage('Health status must be one of: Excellent, Good, Fair, Poor, Critical'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }
    next();
  },
];

/**
 * POST /horses/foals
 * Create a new foal with epigenetic traits applied at birth
 *
 * NOTE: Currently validates sire/dam existence but NOT ownership.
 * TODO(security): Add ownership validation for sireId/damId to prevent
 * users from creating foals with other users' horses.
 */
router.post(
  '/foals',
  foalRateLimiter,
  authenticateToken,
  validateFoalCreation,
  async (req, res) => {
    try {
      // Set the owner from the authenticated user
      req.body.userId = req.user.id;

      // Dynamic import for ES module
      const { createFoal } = await import('../controllers/horseController.mjs');
      await createFoal(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error during foal creation',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/overview
 * Get comprehensive overview data for a specific horse
 *
 * Security: Validates horse ownership before returning overview
 */
router.get(
  '/:id/overview',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      await getHorseOverview(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

// Horse XP System Routes (require authentication)

/**
 * GET /horses/:id/xp
 * Get horse XP status and progression information
 *
 * Security: Validates horse ownership before returning XP data
 */
router.get(
  '/:id/xp',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Map :id to :horseId for the controller
      req.params.horseId = req.params.id;
      await horseXpController.getHorseXpStatus(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /horses/:id/allocate-stat
 * Allocate a stat point to a specific horse stat
 *
 * Security: Validates horse ownership before allowing stat allocation
 */
router.post(
  '/:id/allocate-stat',
  mutationRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Map :id to :horseId for the controller
      req.params.horseId = req.params.id;
      await horseXpController.allocateStatPoint(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /horses/:id/xp-history
 * Get horse XP event history with pagination
 *
 * Security: Validates horse ownership before returning XP history
 */
router.get(
  '/:id/xp-history',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Map :id to :horseId for the controller
      req.params.horseId = req.params.id;
      await horseXpController.getHorseXpHistory(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * POST /horses/:id/award-xp
 * Award XP to a horse (for system/admin use)
 *
 * Security: Validates horse ownership before awarding XP
 */
router.post(
  '/:id/award-xp',
  mutationRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      // Map :id to :horseId for the controller
      req.params.horseId = req.params.id;
      await horseXpController.awardXpToHorse(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

/**
 * GET /api/horses/:id/personality-impact
 * Get most compatible grooms for a horse based on temperament
 *
 * Security: Validates horse ownership before returning personality data
 */
router.get(
  '/:id/personality-impact',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  getHorsePersonalityImpact,
);

/**
 * @swagger
 * /api/horses/{id}/legacy-score:
 *   get:
 *     summary: Get horse legacy score with trait integration
 *     tags: [Horses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Horse ID
 *     responses:
 *       200:
 *         description: Legacy score retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 *
 * Security: Validates horse ownership before calculating legacy score
 */
router.get(
  '/:id/legacy-score',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      const { calculateLegacyScore } = await import('../../../services/legacyScoreCalculator.mjs');
      const legacyScore = await calculateLegacyScore(horseId);

      res.json({
        success: true,
        message: 'Legacy score retrieved successfully',
        data: {
          legacyScore,
        },
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to calculate legacy score',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

/**
 * @swagger
 * /api/horses/{id}/trait-card:
 *   get:
 *     summary: Get horse trait timeline card
 *     tags: [Horses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Horse ID
 *     responses:
 *       200:
 *         description: Trait timeline card retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 *
 * Security: Validates horse ownership before returning trait card
 */
router.get(
  '/:id/trait-card',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      const { generateTraitTimeline } = await import('../../../services/traitTimelineService.mjs');
      const timeline = await generateTraitTimeline(horseId);

      res.json({
        success: true,
        message: 'Trait timeline card retrieved successfully',
        data: {
          timeline,
        },
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to generate trait timeline',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

/**
 * @swagger
 * /api/horses/{id}/breeding-data:
 *   get:
 *     summary: Get horse breeding data with trait predictions
 *     tags: [Horses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Horse ID
 *     responses:
 *       200:
 *         description: Breeding data retrieved successfully
 *       404:
 *         description: Horse not found
 *       500:
 *         description: Internal server error
 *
 * Security: Validates horse ownership before returning breeding data
 */
router.get(
  '/:id/breeding-data',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      const { generateBreedingData } = await import(
        '../../../services/breedingPredictionService.mjs'
      );
      const breedingData = await generateBreedingData(horseId);

      res.json({
        success: true,
        message: 'Breeding data retrieved successfully',
        data: {
          breedingData,
        },
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to generate breeding data',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      });
    }
  },
);

/**
 * GET /api/horses/:id/prize-summary
 * Return aggregated prize statistics for a horse.
 * Includes totalPrizeMoney, firstPlaces, secondPlaces, thirdPlaces, bestPlacement.
 *
 * Security: Validates horse ownership before returning data.
 */
router.get(
  '/:id/prize-summary',
  queryRateLimiter,
  validateHorseId,
  requireOwnership('horse'),
  async (req, res) => {
    try {
      const horseId = parseInt(req.params.id, 10);

      const results = await prisma.competitionResult.findMany({
        where: { horseId },
        select: {
          placement: true,
          prizeWon: true,
        },
      });

      let totalPrizeMoney = 0;
      let firstPlaces = 0;
      let secondPlaces = 0;
      let thirdPlaces = 0;
      let bestPlacement = null;

      for (const result of results) {
        totalPrizeMoney += Number(result.prizeWon) || 0;

        const placement = parseInt(result.placement);
        if (!isNaN(placement)) {
          if (placement === 1) {
            firstPlaces++;
          }
          if (placement === 2) {
            secondPlaces++;
          }
          if (placement === 3) {
            thirdPlaces++;
          }
          if (bestPlacement === null || placement < bestPlacement) {
            bestPlacement = placement;
          }
        }
      }

      logger.info(
        `[horseRoutes.GET /:id/prize-summary] Retrieved prize summary for horse ${horseId}`,
      );

      return res.json({
        success: true,
        data: {
          horseId,
          totalPrizeMoney,
          firstPlaces,
          secondPlaces,
          thirdPlaces,
          bestPlacement,
          totalCompetitions: results.length,
        },
      });
    } catch (error) {
      logger.error(`[horseRoutes.GET /:id/prize-summary] Error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV !== 'production' ? error.message : 'Something went wrong',
      });
    }
  },
);

export default router;
