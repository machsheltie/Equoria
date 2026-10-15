/**
 * Bank Routes — the player's transaction history under the /users prefix
 *
 * GET /transactions — mounted by backend/app/routers.mjs at /users, so the URL stays
 *                     GET /api/v1/users/transactions.
 *
 * Equoria-q4uem.4 (WS4 S4, controller ruling 2c): this route used to be registered in
 * modules/users/routes/userRoutes.mjs with the bank controller imported as a domain
 * capability. The bank module owns its HTTP handler, so the route lives here. The chain
 * is the same as before (queryRateLimiter, authenticateToken, getTransactionHistory);
 * this router registers no path-less `router.use` and routers.mjs mounts it immediately
 * BEFORE userRoutes so `/users/transactions` keeps matching here before userRoutes'
 * `GET /:id`, exactly as `/transactions` was registered ahead of `/:id` at base.
 * The app-level mounting sentinel pins the order, the prefix and the inventory.
 */

import express from 'express';
import { getTransactionHistory } from '../controllers/bankController.mjs';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { queryRateLimiter } from '../../../middleware/rateLimiting.mjs';

const router = express.Router();

router.get('/transactions', queryRateLimiter, authenticateToken, getTransactionHistory);

export default router;
