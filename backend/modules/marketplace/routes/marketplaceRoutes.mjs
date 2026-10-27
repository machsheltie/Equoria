/**
 * Marketplace Routes — Epic 21
 *
 * All routes require authentication via authenticateToken middleware.
 */

import express from 'express';
import { authenticateToken } from '../../../middleware/auth.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
// Equoria-zz1ii: rate-limit the buy endpoints — a financial mutation without
// rate-limiting allows a 50-parallel-request script to flood the DB even when
// the atomic-claim correctly rejects all-but-one. mutationRateLimiter is the
// standard write-mutation limiter (semantically the AC's "standardRateLimiter").
import { mutationRateLimiter, queryRateLimiter } from '../../../middleware/rateLimiting.mjs';
import { allowOnlyBodyFields } from '../../../middleware/bodyFieldAllowList.mjs';
import {
  listHorse,
  delistHorse,
  buyHorse,
  myListings,
  saleHistory,
  buyStoreHorse,
} from '../controllers/marketplaceController.mjs';
import { searchHorses } from '../controllers/horseSearchController.mjs';

const router = express.Router();

// All marketplace routes require authentication
router.use(authenticateToken);

// Equoria-q4uem.9.1: the all-horses search (for sale and/or at stud).
router.get('/search', queryRateLimiter, searchHorses);

// Seller flow
// CWE-639: requireOwnership with from:'body' validates horseId from req.body,
// returning 404 for both not-found and not-owned to prevent enumeration.
router.post('/list', requireOwnership('horse', { idParam: 'horseId', from: 'body' }), listHorse);
router.delete('/list/:horseId', requireOwnership('horse', { idParam: 'horseId' }), delistHorse);

// My listings and history (static segments before :horseId)
router.get('/my-listings', myListings);
router.get('/history', saleHistory);

// Store flow — static path before :horseId to avoid route conflict
// Equoria-gu8jk: the body is allow-listed to { breedId, sex }. Any other field —
// a protected trait field such as `temperament` or `epigeneticModifiers`
// included — is refused with 400 (owner ruling 2026-10-20: players never write
// traits). The store draws temperament itself and sells horses with no traits.
router.post(
  '/store/buy',
  mutationRateLimiter,
  allowOnlyBodyFields(['breedId', 'sex']),
  buyStoreHorse,
);

// Buyer flow (user-to-user)
router.post('/buy/:horseId', mutationRateLimiter, buyHorse);

export default router;
