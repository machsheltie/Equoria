/**
 * Club Routes (19B-3)
 * All club + election endpoints under /api/clubs.
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import logger from '../utils/logger.mjs';
import {
  getClubs,
  getMyClubs,
  getClub,
  createClub,
  joinClub,
  leaveClub,
  getElections,
  createElection,
  nominate,
  vote,
  getElectionResults,
} from '../controllers/clubController.mjs';

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[clubRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

// Static election routes BEFORE /:id to avoid route conflicts
router.post(
  '/elections/:id/nominate',
  [body('statement').optional().isString(), handleValidation],
  nominate,
);

router.post(
  '/elections/:id/vote',
  [
    body('candidateId').isInt({ min: 1 }).withMessage('candidateId must be a positive integer'),
    handleValidation,
  ],
  vote,
);

router.get('/elections/:id/results', getElectionResults);

// Club CRUD
router.get(
  '/',
  [query('type').optional().isIn(['discipline', 'breed']), handleValidation],
  getClubs,
);
router.get('/mine', getMyClubs);
router.get('/:id', getClub);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('name is required').isLength({ max: 100 }),
    body('type').isIn(['discipline', 'breed']).withMessage('type must be discipline or breed'),
    body('category').trim().notEmpty().withMessage('category is required'),
    body('description').trim().notEmpty().withMessage('description is required'),
    handleValidation,
  ],
  createClub,
);

router.post('/:id/join', joinClub);
router.delete('/:id/leave', leaveClub);
router.get('/:id/elections', getElections);

router.post(
  '/:id/elections',
  [
    body('position').trim().notEmpty().withMessage('position is required'),
    body('startsAt').isISO8601().withMessage('startsAt must be a valid date'),
    body('endsAt').isISO8601().withMessage('endsAt must be a valid date'),
    handleValidation,
  ],
  createElection,
);

export default router;
