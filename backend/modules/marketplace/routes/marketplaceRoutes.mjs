/**
 * Marketplace Routes — Epic 21
 *
 * All routes require authentication via authenticateToken middleware.
 */

import express from 'express';
import { authenticateToken } from '../../../middleware/auth.mjs';
import {
  browseListings,
  listHorse,
  delistHorse,
  buyHorse,
  myListings,
  saleHistory,
  buyStoreHorse,
} from '../controllers/marketplaceController.mjs';

const router = express.Router();

// All marketplace routes require authentication
router.use(authenticateToken);

// Browse listings
router.get('/', browseListings);

// Seller flow
router.post('/list', listHorse);
router.delete('/list/:horseId', delistHorse);

// My listings and history (static segments before :horseId)
router.get('/my-listings', myListings);
router.get('/history', saleHistory);

// Store flow — static path before :horseId to avoid route conflict
router.post('/store/buy', buyStoreHorse);

// Buyer flow (user-to-user)
router.post('/buy/:horseId', buyHorse);

export default router;
