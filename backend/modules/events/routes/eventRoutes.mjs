// backend/modules/events/routes/eventRoutes.mjs
//
// Real-time event stream routes — ADR-011 / Equoria-rgyv.
//
// Mounted on authRouter in app.mjs at `/events`, so every route here
// inherits the real `authenticateToken` + the global security pipeline
// (prototype-pollution guards, audit trail). CSRF's ignoredMethods
// includes GET, so the safe-method SSE stream is not blocked by CSRF.
//
// Only one route is registered (a GET catch for the stream); there is no
// `/:id` catch-all in this router, so route-ordering pitfalls do not apply.

import express from 'express';
import { streamUserEvents } from '../controllers/eventStreamController.mjs';

const router = express.Router();

/**
 * GET /api/v1/events/stream — authenticated per-user SSE event stream.
 * Auth enforced by authRouter's authenticateToken (cookie or Bearer).
 */
router.get('/stream', streamUserEvents);

export default router;
