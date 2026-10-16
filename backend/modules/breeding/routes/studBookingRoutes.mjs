/**
 * Stud booking routes (Equoria-q4uem.9), mounted at /api/v1/studs by
 * backend/app/routers.mjs on the authRouter (authenticateToken + CSRF; the
 * global body/query pollution guards run in app.mjs).
 *
 * POST /:sireId/bookings — book the caller's mare to another player's PUBLIC
 * stud; the stud fee moves mare owner -> stallion owner in the same
 * transaction that starts the pregnancy (owner rulings 2026-10-12/15/16).
 *
 * The body carries no owner field: the requester is the session, and the
 * controller reads only damId and expectedStudFee.
 */
import express from 'express';
import { body, param } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { handleValidationErrors } from '../../../middleware/validationErrorHandler.mjs';
import { foalRateLimiter, mutationRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { bookPublicStud } from '../controllers/studBookingController.mjs';

const router = express.Router();
// Declared at the router that owns these mutations (Equoria-jk9oj.2 pattern);
// idempotent with the authRouter mount.
router.use(authenticateToken);

router.post(
  '/:sireId/bookings',
  mutationRateLimiter,
  foalRateLimiter,
  [
    param('sireId').isInt({ min: 1 }).withMessage('sireId must be a positive integer').toInt(),
    body('damId').isInt({ min: 1 }).withMessage('damId must be a positive integer').toInt(),
    body('expectedStudFee')
      .exists()
      .withMessage('expectedStudFee is required')
      .bail()
      .isInt({ min: 0 })
      .withMessage('expectedStudFee must be a non-negative integer')
      .toInt(),
  ],
  handleValidationErrors,
  bookPublicStud,
);

export default router;
