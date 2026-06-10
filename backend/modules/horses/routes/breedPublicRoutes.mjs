/**
 * Public (read-only) breed routes.
 *
 * SECURITY (Equoria-7p4xe): breed CREATION is an administrative write and must
 * NOT be reachable without admin auth + CSRF. This router exposes ONLY the
 * read endpoints that the onboarding flow needs BEFORE a user logs in. It is
 * the router mounted publicly at `/api/v1/breeds` in app.mjs.
 *
 * The write path (POST / createBreed) lives in `breedRoutes.mjs`, which is
 * mounted on the authenticated router and gates the write behind
 * `requireRole('admin')` (plus the authRouter's `authenticateToken` +
 * `csrfProtection`). Keeping the public router GET-only means an anonymous
 * `POST /api/v1/breeds` has no matching route here and falls through to the
 * authenticated `/breeds` mount, where `authenticateToken` rejects it (401).
 *
 * Do NOT add a write route to this file.
 */
import express from 'express';
import { param } from 'express-validator';
import * as breedController from '../controllers/breedController.mjs';
import { handleValidationErrors } from '../../../middleware/validationErrorHandler.mjs';

const router = express.Router();

/**
 * @swagger
 * /api/v1/breeds:
 *   get:
 *     summary: Get all horse breeds
 *     description: Retrieves a list of all available horse breeds, sorted alphabetically by name. Public — usable during onboarding before login.
 *     tags: [Breeds]
 *     responses:
 *       200:
 *         description: List of breeds retrieved successfully
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', breedController.getAllBreeds);

/**
 * @swagger
 * /api/v1/breeds/{id}:
 *   get:
 *     summary: Get a horse breed by ID
 *     description: Retrieves a specific horse breed by its unique identifier. Public.
 *     tags: [Breeds]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Breed retrieved successfully
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

/**
 * GET /api/v1/breeds/:id/conformation-averages
 * Returns average conformation scores across all horses of the given breed. Public.
 */
router.get(
  '/:id/conformation-averages',
  [param('id').isInt({ min: 1 }).withMessage('Breed ID must be a positive integer.')],
  handleValidationErrors,
  breedController.getConformationAverages,
);

export default router;
