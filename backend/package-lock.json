import express from 'express';
import { body, param } from 'express-validator';
import * as breedController from '../controllers/breedController.mjs';
import { handleValidationErrors } from '../middleware/validationErrorHandler.mjs';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Breeds
 *   description: Horse breed management endpoints
 */

/**
 * @swagger
 * /api/breeds:
 *   post:
 *     summary: Create a new horse breed
 *     description: Creates a new horse breed with name and optional description
 *     tags: [Breeds]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 description: Breed name
 *                 example: "Arabian"
 *     responses:
 *       201:
 *         description: Breed created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Breed'
 *                 message:
 *                   type: string
 *                   example: "Breed created successfully"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       409:
 *         description: Breed name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post(
  '/',
  [
    body('name')
      .isString()
      .withMessage('Breed name must be a string.')
      .trim()
      .notEmpty()
      .withMessage('Breed name cannot be empty after trimming.')
      .isLength({ min: 2, max: 255 })
      .withMessage('Breed name must be between 2 and 255 characters.'),
  ],
  handleValidationErrors,
  breedController.createBreed,
);

/**
 * @swagger
 * /api/breeds:
 *   get:
 *     summary: Get all horse breeds
 *     description: Retrieves a list of all available horse breeds, sorted alphabetically by name
 *     tags: [Breeds]
 *     responses:
 *       200:
 *         description: List of breeds retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Breed'
 *                 count:
 *                   type: integer
 *                   description: Number of breeds returned
 *                   example: 5
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', breedController.getAllBreeds);

/**
 * @swagger
 * /api/breeds/{id}:
 *   get:
 *     summary: Get a horse breed by ID
 *     description: Retrieves a specific horse breed by its unique identifier
 *     tags: [Breeds]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Breed ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Breed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Breed'
 *       400:
 *         description: Invalid breed ID
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get(
  '/:id',
  [param('id').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer.')],
  handleValidationErrors,
  breedController.getBreedById,
);

export default router;
