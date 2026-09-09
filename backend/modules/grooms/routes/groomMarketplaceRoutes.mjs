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
// Equoria-ypb7d.2: the grooms-for-hire POOL — real groom rows other players have
// released, as distinct from the procedural per-player offers the handlers above
// generate. See groomFreeAgentController.mjs for why both exist.
import { listFreeAgentGrooms, hireFreeAgent } from '../controllers/groomFreeAgentController.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * GET /api/groom-marketplace/free-agents
 * The grooms-for-hire pool: grooms released by any player, hireable by anyone.
 *
 * Registered before the parameterless routes below only for readability — this
 * router has no `/:id` catch-all, so ordering is not load-bearing here. If one is
 * ever added, it must come AFTER these two (route order is behavior in Express).
 *
 * Response:
 * - 200: { grooms, total, pagination }
 * - 500: Server error
 */
router.get('/free-agents', listFreeAgentGrooms);

/**
 * POST /api/groom-marketplace/free-agents/hire
 * Engage an existing free-agent groom. Creates no groom: it opens a new
 * engagement on one that already exists, with their history intact.
 *
 * Body:
 * - groomId (integer, required)
 *
 * Response:
 * - 201: Groom hired successfully
 * - 400: Invalid groomId, roster cap reached, or insufficient funds
 * - 404: That groom is not available for hire
 * - 409: Another player hired them first
 * - 500: Server error
 */
router.post('/free-agents/hire', hireFreeAgent);

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
