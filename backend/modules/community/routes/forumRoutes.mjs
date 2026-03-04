/**
 * Forum Routes (19B-1)
 * All forum endpoints under /api/forum.
 *
 *   GET    /threads              → list threads (paginated, section-filtered)
 *   GET    /threads/:id          → thread detail with posts
 *   POST   /threads              → create thread + first post
 *   POST   /threads/:id/posts    → reply
 *   POST   /threads/:id/view     → increment view count
 *   PATCH  /threads/:id/pin      → toggle pin (admin only)
 */

import express from 'express';
import { body, query, validationResult } from 'express-validator';
import logger from '../../../utils/logger.mjs';
import { requireRole } from '../../../middleware/auth.mjs';
import {
  getThreads,
  getThread,
  createThread,
  createPost,
  incrementView,
  pinThread,
} from '../controllers/forumController.mjs';

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[forumRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

const VALID_SECTIONS = ['general', 'art', 'sales', 'services', 'venting'];

router.get(
  '/threads',
  [
    query('section').optional().isIn(VALID_SECTIONS).withMessage('Invalid section'),
    query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
    handleValidation,
  ],
  getThreads,
);

router.get('/threads/:id', getThread);

router.post(
  '/threads',
  [
    body('section')
      .isIn(VALID_SECTIONS)
      .withMessage('section must be one of: ' + VALID_SECTIONS.join(', ')),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('title is required')
      .isLength({ max: 200 })
      .withMessage('title max 200 chars'),
    body('content').trim().notEmpty().withMessage('content is required'),
    body('tags').optional().isArray().withMessage('tags must be an array'),
    handleValidation,
  ],
  createThread,
);

router.post(
  '/threads/:id/posts',
  [body('content').trim().notEmpty().withMessage('content is required'), handleValidation],
  createPost,
);

router.post('/threads/:id/view', incrementView);

router.patch('/threads/:id/pin', requireRole('admin'), pinThread);

export default router;
