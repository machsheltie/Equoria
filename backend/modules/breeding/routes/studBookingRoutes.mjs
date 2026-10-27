/**
 * Stud booking routes (Equoria-q4uem.9), mounted at /api/v1/studs by
 * backend/app/routers.mjs on the authRouter (authenticateToken + CSRF; the
 * global body/query pollution guards run in app.mjs).
 *
 *   POST /:sireId/bookings          book a PUBLIC stud (completes at once)
 *   POST /:sireId/requests          ask a PRIVATE stud's owner
 *   GET  /requests                  the caller's queue (incoming | outgoing; sireId / damId narrow it)
 *   POST /requests/:id/approve      stallion owner accepts (pinned fee moves)
 *   POST /requests/:id/reject       stallion owner refuses
 *   POST /requests/:id/cancel       mare owner withdraws
 *
 * Owner rulings 2026-10-12 / 2026-10-15 / 2026-10-16. No body carries an owner
 * field: the requester is the session, and the controllers read only the
 * fields validated here.
 */
import express from 'express';
import { body, param, query } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { handleValidationErrors } from '../../../middleware/validationErrorHandler.mjs';
import {
  foalRateLimiter,
  mutationRateLimiter,
  queryRateLimiter,
} from '../../../middleware/rateLimiting.mjs';
import { bookPublicStud } from '../controllers/studBookingController.mjs';
import { requestPrivateStud, approveStudRequest } from '../controllers/studRequestController.mjs';
import {
  rejectStudRequest,
  cancelStudRequest,
  listStudRequests,
} from '../controllers/studRequestQueueController.mjs';

const router = express.Router();
// Declared at the router that owns these mutations (Equoria-jk9oj.2 pattern);
// idempotent with the authRouter mount.
router.use(authenticateToken);

const sireAndMare = [
  param('sireId').isInt({ min: 1 }).withMessage('sireId must be a positive integer').toInt(),
  body('damId').isInt({ min: 1 }).withMessage('damId must be a positive integer').toInt(),
  body('expectedStudFee')
    .exists()
    .withMessage('expectedStudFee is required')
    .bail()
    .isInt({ min: 0 })
    .withMessage('expectedStudFee must be a non-negative integer')
    .toInt(),
];

const requestIdParam = [
  param('id').isInt({ min: 1 }).withMessage('id must be a positive integer').toInt(),
];

router.get(
  '/requests',
  queryRateLimiter,
  [
    query('role')
      .isIn(['incoming', 'outgoing'])
      .withMessage("role must be 'incoming' or 'outgoing'"),
    query('status')
      .optional()
      .isIn(['PENDING', 'COMPLETED', 'DECLINED', 'CANCELLED'])
      .withMessage('status must be PENDING, COMPLETED, DECLINED or CANCELLED'),
    // Owner ruling q105 (2026-10-27): the requests button sits on one horse's page.
    query('sireId').optional().isInt({ min: 1 }).withMessage('sireId must be a positive integer'),
    query('damId').optional().isInt({ min: 1 }).withMessage('damId must be a positive integer'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100'),
  ],
  handleValidationErrors,
  listStudRequests,
);

router.post(
  '/requests/:id/approve',
  mutationRateLimiter,
  foalRateLimiter,
  requestIdParam,
  handleValidationErrors,
  approveStudRequest,
);
router.post(
  '/requests/:id/reject',
  mutationRateLimiter,
  requestIdParam,
  handleValidationErrors,
  rejectStudRequest,
);
router.post(
  '/requests/:id/cancel',
  mutationRateLimiter,
  requestIdParam,
  handleValidationErrors,
  cancelStudRequest,
);

router.post(
  '/:sireId/bookings',
  mutationRateLimiter,
  foalRateLimiter,
  sireAndMare,
  handleValidationErrors,
  bookPublicStud,
);
router.post(
  '/:sireId/requests',
  mutationRateLimiter,
  sireAndMare,
  handleValidationErrors,
  requestPrivateStud,
);

export default router;
