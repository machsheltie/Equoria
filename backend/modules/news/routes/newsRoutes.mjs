/**
 * News routes for players (Equoria-wbt8l): GET /api/v1/news.
 * Mounted on the authRouter, so every logged-in player can read News.
 */

import express from 'express';
import { query, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { getNews } from '../controllers/newsController.mjs';
import { newsCursorPattern, newsPageSizeMax } from '../services/newsFeedService.mjs';

const router = express.Router();
// Declared here as well as on the authRouter mount, so the guard travels with
// the file (the clubRoutes convention, Equoria-jk9oj.2).
router.use(authenticateToken);

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Invalid news request' });
  }
  return next();
};

router.get(
  '/',
  [
    query('before').optional().isString().matches(newsCursorPattern),
    query('limit').optional().isInt({ min: 1, max: newsPageSizeMax }),
    handleValidation,
  ],
  getNews,
);

export default router;
