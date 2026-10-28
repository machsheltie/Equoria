/**
 * Hall of Fame routes (Equoria-vb1n0, owner rulings 2026-10-28), under
 * /api/v1/hall-of-fame:
 *
 *   GET  /                      the open rounds' nominees (with the player's own
 *                               vote) and every inducted horse with its date
 *   GET  /horses/:horseId       the owner's standing for one horse (the button)
 *   POST /nominations           { horseId } nominate a retired horse, once ever
 *   POST /votes                 { candidateId } the player's one vote this round
 *
 * The rules live in services/hallOfFameService.mjs.
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import logger from '../../../utils/logger.mjs';
import {
  HallOfFameRefusal,
  castHallOfFameVote,
  getHallOfFame,
  getHorseHallOfFameStatus,
  nominateHorse,
} from '../services/hallOfFameService.mjs';

const router = express.Router();
router.use(authenticateToken);

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

/** A refusal answers its own status and authored message; anything else is a 500. */
const answer = (label, fn) => async (req, res) => {
  try {
    const { status, data } = await fn(req);
    return res.status(status).json({ success: true, data });
  } catch (error) {
    if (error instanceof HallOfFameRefusal) {
      return res
        .status(error.status)
        .json({ success: false, message: error.message, code: error.code });
    }
    logger.error(`[hallOfFameRoutes.${label}] ${error.message}`);
    return res.status(500).json({ success: false, message: 'The Hall of Fame is unavailable' });
  }
};

router.get(
  '/',
  queryRateLimiter,
  answer('get', async req => ({ status: 200, data: await getHallOfFame(req.user.id) })),
);

router.get(
  '/horses/:horseId',
  queryRateLimiter,
  [param('horseId').isInt({ min: 1 }).toInt(), handleValidation],
  answer('horseStatus', async req => ({
    status: 200,
    data: await getHorseHallOfFameStatus(req.params.horseId, req.user.id),
  })),
);

router.post(
  '/nominations',
  mutationRateLimiter,
  [
    body('horseId').isInt({ min: 1 }).withMessage('horseId must be a positive integer').toInt(),
    handleValidation,
  ],
  answer('nominate', async req => ({
    status: 201,
    data: await nominateHorse(req.body.horseId, req.user.id),
  })),
);

router.post(
  '/votes',
  mutationRateLimiter,
  [
    body('candidateId')
      .isInt({ min: 1 })
      .withMessage('candidateId must be a positive integer')
      .toInt(),
    handleValidation,
  ],
  answer('vote', async req => ({
    status: 201,
    data: await castHallOfFameVote(req.body.candidateId, req.user.id),
  })),
);

export default router;
