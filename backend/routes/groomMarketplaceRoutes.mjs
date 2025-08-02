/**
 * Groom Marketplace Routes
 * API endpoints for the groom marketplace system
 *
 * Routes:
 * - GET /api/groom-marketplace - Get available grooms
 * - POST /api/groom-marketplace/refresh - Refresh marketplace
 * - POST /api/groom-marketplace/hire - Hire groom from marketplace
 * - GET /api/groom-marketplace/stats - Get marketplace statistics
 */

import express from 'express';
import {
  getMarketplace,
  refreshMarketplace,
  hireFromMarketplace,
  getMarketplaceStats,
} from '../controllers/groomMarketplaceController.mjs';
import { authenticateToken } from '../middleware/auth.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/groom-marketplace
 * Get available grooms in marketplace
 *
 * Response:
 * - 200: Marketplace data with available grooms
 * - 500: Server error
 */
router.get('/', getMarketplace);

/**
 * POST /api/groom-marketplace/refresh
 * Refresh marketplace with new grooms
 *
 * Body:
 * - force (boolean, optional): Force refresh even if it costs money
 *
 * Response:
 * - 200: Marketplace refreshed successfully
 * - 400: Insufficient funds or refresh not needed
 * - 500: Server error
 */
router.post('/refresh', refreshMarketplace);

/**
 * POST /api/groom-marketplace/hire
 * Hire a groom from the marketplace
 *
 * Body:
 * - marketplaceId (string, required): ID of groom to hire
 *
 * Response:
 * - 201: Groom hired successfully
 * - 400: Invalid request or insufficient funds
 * - 404: Groom not found
 * - 500: Server error
 */
router.post('/hire', hireFromMarketplace);

/**
 * GET /api/groom-marketplace/stats
 * Get marketplace statistics and configuration
 *
 * Response:
 * - 200: Marketplace statistics
 * - 500: Server error
 */
router.get('/stats', getMarketplaceStats);

export default router;
