/**
 * News Desk routes (Equoria-wbt8l): staff write News.
 *
 * Mounted at /api/v1/admin/news on the adminRouter, which already applies
 * authenticateToken + requireRole('admin') + requireAdminMfa + CSRF;
 * requireRole asks satisfiesRole, so the owner (Head Admin) passes too
 * (Equoria-4tleh). The desk service then re-reads the writer's role and asks
 * the staff capability policy per post type (news.post to use the desk,
 * news.<postType> to write a type): the owner writes seasonal events, Head
 * Admin letters, updates and contests; an Admin writes their own letter;
 * moderators and players are refused.
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { allowOnlyBodyFields } from '../../../middleware/bodyFieldAllowList.mjs';
import {
  createPost,
  deletePost,
  getDesk,
  updatePost,
  uploadImage,
} from '../controllers/newsController.mjs';
import { NEWS_IMAGE_MAX_BYTES } from '../services/newsImageStorage.mjs';

const router = express.Router();

const POST_FIELDS = ['postType', 'title', 'body', 'tiles', 'month', 'closesOn'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Invalid News Desk request' });
  }
  return next();
};

const textFields = [
  body('title').optional().isString(),
  body('body').optional().isString(),
  body('tiles').optional().isArray(),
  body('month').optional().isString(),
  body('closesOn').optional({ values: 'null' }).isString(),
];

router.get('/', getDesk);

// The picture itself is the body (Content-Type image/*), parsed only here.
router.post(
  '/images',
  express.raw({ type: IMAGE_TYPES, limit: NEWS_IMAGE_MAX_BYTES }),
  [query('filename').isString().isLength({ min: 1, max: 200 }), handleValidation],
  uploadImage,
);

router.post(
  '/',
  allowOnlyBodyFields(POST_FIELDS),
  [body('postType').isString(), ...textFields, handleValidation],
  createPost,
);

router.put(
  '/:id',
  allowOnlyBodyFields(POST_FIELDS),
  [param('id').isInt({ min: 1 }), body('postType').optional().isString(), ...textFields],
  handleValidation,
  updatePost,
);

router.delete('/:id', [param('id').isInt({ min: 1 }), handleValidation], deletePost);

export default router;
