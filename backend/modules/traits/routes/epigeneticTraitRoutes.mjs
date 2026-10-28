/**
 * Epigenetic Trait Routes
 *
 * Read-only API endpoints for the epigenetic trait system: definitions, trait
 * history and the development summary.
 *
 * Equoria-a7f1p: POST /evaluate-milestone/:horseId (owner ruling 2026-10-27:
 * traits reveal only through the daily grooming-day ladder) and
 * GET /breeding-insights/:horseId (owner ruling 2026-10-07: no advice) are gone.
 */

import express from 'express';
import { param, query, validationResult } from 'express-validator';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
// No route here writes trait history (Equoria-gu8jk; owner ruling 2026-10-20:
// players must never write traits for themselves). POST /log-trait, which let
// an owner insert any TraitHistoryLog row, was removed; only the nightly foal
// job logs trait events (traitHistoryService.logTraitAssignment).
import {
  getTraitHistoryPage,
  getTraitDevelopmentSummary,
} from '../services/traitHistoryService.mjs';
// Equoria-oey96.33: the flag roster served here is the CANONICAL one from the
// live engine's single source of truth (config/epigeneticFlagDefinitions.mjs) —
// NOT the stale utils/epigeneticFlags.mjs EPIGENETIC_FLAGS roster (which listed
// antisocial/social/sensitive, flags the live engine never assigns). This makes
// /epigenetic-traits/definitions agree with /flags/definitions. GROOM_PERSONALITIES
// (not a flag roster) still comes from the legacy reference table.
import { EPIGENETIC_FLAG_DEFINITIONS } from '../../../config/epigeneticFlagDefinitions.mjs';
import { GROOM_PERSONALITIES } from '../../../utils/epigeneticFlags.mjs';
import logger from '../../../utils/logger.mjs';
import { InvalidCursorError } from '../../../utils/paginationHelper.mjs';

const router = express.Router();

/**
 * GET /api/epigenetic-traits/definitions
 * Get all epigenetic flag and groom personality definitions
 */
router.get('/definitions', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        epigeneticFlags: EPIGENETIC_FLAG_DEFINITIONS,
        groomPersonalities: GROOM_PERSONALITIES,
        flagCount: Object.keys(EPIGENETIC_FLAG_DEFINITIONS).length,
        personalityCount: Object.keys(GROOM_PERSONALITIES).length,
      },
    });
  } catch (error) {
    logger.error('Error fetching epigenetic trait definitions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch definitions',
    });
  }
});

/**
 * GET /api/epigenetic-traits/history/:horseId
 * Get trait development history for a horse
 *
 * Security: Validates horse ownership using requireOwnership middleware (atomic, prevents CWE-639)
 */
router.get(
  '/history/:horseId',
  authenticateToken,
  [
    param('horseId').isInt().withMessage('Horse ID must be an integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
    query('sourceType').optional().isIn(['groom', 'milestone', 'environmental', 'genetic']),
    query('isEpigenetic').optional().isBoolean(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  requireOwnership('horse', { idParam: 'horseId' }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { horseId } = req.params;
      const horse = req.horse; // Cached by middleware

      // Get trait history
      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        sourceType: req.query.sourceType || null,
        isEpigenetic: req.query.isEpigenetic ? req.query.isEpigenetic === 'true' : null,
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
      };

      const {
        items: history,
        pageInfo,
        total,
      } = await getTraitHistoryPage(parseInt(horseId), {
        ...options,
        cursor: req.query.cursor || null,
      });

      res.json({
        success: true,
        data: {
          horseId: parseInt(horseId),
          horseName: horse.name,
          history,
          // The true number of entries under these filters, not the page length.
          totalEntries: total,
          pageInfo,
          options,
        },
      });
    } catch (error) {
      if (error instanceof InvalidCursorError) {
        return res.status(400).json({ success: false, error: error.message });
      }
      logger.error('Error fetching trait history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch trait history',
      });
    }
  },
);

/**
 * GET /api/epigenetic-traits/summary/:horseId
 * Get trait development summary for a horse
 *
 * Security: Validates horse ownership using requireOwnership middleware (atomic, prevents CWE-639)
 */
router.get(
  '/summary/:horseId',
  authenticateToken,
  [param('horseId').isInt().withMessage('Horse ID must be an integer')],
  requireOwnership('horse', { idParam: 'horseId' }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        });
      }

      const { horseId } = req.params;
      const horse = req.horse; // Cached by middleware

      // Get development summary
      const summary = await getTraitDevelopmentSummary(parseInt(horseId));

      res.json({
        success: true,
        data: {
          horseName: horse.name,
          summary,
        },
      });
    } catch (error) {
      logger.error('Error fetching trait development summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch development summary',
      });
    }
  },
);

export default router;
