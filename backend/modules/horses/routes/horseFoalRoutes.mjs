/**
 * Horses foal-creation sub-router (Equoria-y8u2j god-file split).
 *
 * Mounted under the parent `horseRoutes.mjs` at `/horses`, so the route below
 * resolves to:
 *   POST /horses/foals
 *
 * `/foals` is a specific (single-segment) sibling of the parent's `GET /:id`
 * but they differ by VERB (POST vs GET) so Express will not confuse them.
 * Mount order between this sub-router and the parent's `/:id` is therefore
 * not load-bearing.
 *
 * Security: dual ownership validation on sireId + damId via
 * `findOwnedResource` (CWE-284 Equoria-b4q6 + CWE-639 disclosure resistance —
 * same 404 'Sire not found' / 'Dam not found' for both not-found and
 * not-owned cases). Mirrors the dual-ownership pattern at
 * groomRoutes.mjs `POST /assign`.
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { findOwnedResource } from '../../../middleware/ownership.mjs';
import { foalRateLimiter } from '../../../middleware/rateLimiting.mjs';
import logger from '../../../utils/logger.mjs';
import { horseNameBodyRule } from './_validators.mjs';

const router = express.Router();

/**
 * Discard client-supplied ownership fields before ANY handler can read them
 * (Equoria-6w3ur).
 *
 * The route already re-derived the owner from `req.user.id`, so a forged
 * `userId` was inert — but "inert because a later line overwrites it" is one
 * refactor away from being trusted, and it is the exact shape the 2026-09
 * audit closed twice (Findings 2 and 3: client-supplied `userId` on creation
 * routes). Deleting the key here makes the guarantee structural: no handler
 * downstream can see a caller-chosen owner, and the ownership middleware below
 * scopes both parents to the authenticated session.
 */
function stripClientOwnerFields(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    delete req.body.userId;
    delete req.body.ownerId;
  }
  next();
}

/**
 * Validation middleware for foal creation.
 *
 * The chain stays inline (rather than moving wholesale to `_validators.mjs`)
 * because the `isValidHorseSex` / `HORSE_SEX_VALUES` imports are dynamic —
 * moving them would force every other validator in that file to load the schema
 * constants for no gain. The `name` rule alone IS imported from
 * `_validators.mjs` (Equoria-qkgfh.1), because a horse name must obey one policy
 * on every path that accepts one.
 */
const validateFoalCreation = [
  // Equoria-6w3ur: `name` and `breedId` are OPTIONAL pending intent, not
  // requirements. Since the Phase-B delayed-foaling redesign the player breeds
  // a PAIR — the foal itself is materialised 7 days later by the foaling job,
  // which derives the missing values (`foalingService.createFoalFromPregnancy`:
  // name -> the dam-derived fallback, breed -> dam.breedId). `createFoal` has
  // treated both as optional since that redesign; this chain had not caught up,
  // so the real breeding surface — which posts only the chosen sire and dam —
  // got a hard 400 "Breed ID must be a positive integer" and no player could
  // breed. Keep the FORMAT rules: a supplied value must still be sane, and the
  // controller separately verifies a supplied breedId exists.
  //
  // Equoria-qkgfh.1: the name's FORMAT rule is now the shared one, so
  // PUT /horses/:id and PATCH /horses/:id/name cannot diverge from this path on
  // what a valid horse name is. `optional: true` preserves Equoria-6w3ur's
  // requiredness contract exactly — absent `name` passes, a supplied one is held
  // to the full policy. This `name` also lands in `Horse.pendingFoalName` and
  // later becomes the foal's own name, so it is a horse-name path twice over.
  //
  // RESOLVED MERGE HAZARD — kept deliberately in past tense, because a hazard
  // that was real once and is now invisible is how it comes back.
  //   WHAT IT WAS. Equoria-qkgfh.1 was authored on a base PREDATING
  //   Equoria-6w3ur, where `name` and `breedId` were both still required. On that
  //   branch this exact region read `horseNameBodyRule(),` with no `optional`, so
  //   a merge resolved in its favour would have deleted `.optional()` from both
  //   fields and broken the beta-live /breeding page — whose only client posts
  //   `{ sireId, damId }` and no name. Two reviewers reported opposite facts
  //   about these lines, and both were right: they were reading the two trees.
  //   HOW IT WAS RESOLVED. Rebased onto the campaign branch and resolved in
  //   favour of Equoria-6w3ur's contract — both fields stay optional — with the
  //   shared name rule applied to a SUPPLIED value only.
  //   HOW WE KNOW. `foalCreationMinimalPayload.test.mjs` is the regression guard,
  //   and it was proved non-inert by re-planting the hazard: dropping `optional`
  //   here fails 12 of its cases. If it ever goes red, start in this region.
  horseNameBodyRule({ optional: true }),
  body('breedId').optional().isInt({ min: 1 }).withMessage('Breed ID must be a positive integer'),
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
  // No `userId` validator: the body has no owner field. The owner is the
  // authenticated session, and any client-supplied `userId` is discarded by
  // `stripClientOwnerFields` below before validation runs (Equoria-6w3ur;
  // same shape the audit closed in Findings 2 and 3).
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
 * Create a new foal with epigenetic traits applied at birth.
 */
router.post(
  '/foals',
  foalRateLimiter,
  authenticateToken,
  stripClientOwnerFields,
  validateFoalCreation,
  // Dual ownership validation middleware (CWE-284 + CWE-639)
  async (req, res, next) => {
    try {
      const { sireId, damId } = req.body;
      const userId = req.user.id;

      // Validate sire ownership — 404 byte-identical for both not-found and
      // cross-user (CWE-639 disclosure resistance).
      const sire = await findOwnedResource('horse', sireId, userId);
      if (!sire) {
        return res.status(404).json({
          success: false,
          message: 'Sire not found',
        });
      }

      // Validate dam ownership.
      const dam = await findOwnedResource('horse', damId, userId);
      if (!dam) {
        return res.status(404).json({
          success: false,
          message: 'Dam not found',
        });
      }

      // Attach validated resources for the controller (createFoal still
      // re-fetches via getHorseById for breed checks etc., but having them
      // here lets future refactors skip the re-fetch).
      req.sire = sire;
      req.dam = dam;
      next();
      return null;
    } catch (error) {
      logger.error('[horseFoalRoutes POST /foals] ownership validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  },
  async (req, res) => {
    try {
      // No owner is written into the body: `createFoal` reads only
      // { name, breedId, sireId, damId } and takes the owner from `req.user`
      // through the ownership middleware above. The previous
      // `req.body.userId = req.user.id` line was dead once
      // `stripClientOwnerFields` guaranteed the field's absence, and leaving a
      // write of an owner field here would only invite someone to trust it.
      //
      // Dynamic import for ES module (matches pre-extraction shape; static
      // import here would create a circular path through horseController.mjs).
      const { createFoal } = await import('../controllers/horseController.mjs');
      await createFoal(req, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Internal server error during foal creation',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  },
);

export default router;
