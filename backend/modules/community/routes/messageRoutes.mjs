/**
 * Message Routes (19B-2)
 * All direct message endpoints under /api/messages.
 *
 *   GET   /inbox          → inbox for authenticated user
 *   GET   /sent           → sent messages for authenticated user
 *   GET   /unread-count   → count of unread messages
 *   GET   /:id            → single message detail (auto-marks as read)
 *   POST  /               → compose + send a message
 *   PATCH /:id/read       → explicitly mark message as read
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import logger from '../../../utils/logger.mjs';
import {
  getInbox,
  getSent,
  getUnreadCount,
  getMessage,
  sendMessage,
  markRead,
} from '../controllers/messageController.mjs';

const router = express.Router();

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(`[messageRoutes] Validation errors: ${JSON.stringify(errors.array())}`);
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

router.get('/inbox', getInbox);
router.get('/sent', getSent);
router.get('/unread-count', getUnreadCount);
router.get('/:id', getMessage);

router.post(
  '/',
  [
    body('recipientId').notEmpty().withMessage('recipientId is required'),
    body('subject').trim().notEmpty().withMessage('subject is required').isLength({ max: 200 }),
    body('content').trim().notEmpty().withMessage('content is required'),
    body('tag').optional().isString(),
    handleValidation,
  ],
  sendMessage,
);

router.patch('/:id/read', markRead);

export default router;
