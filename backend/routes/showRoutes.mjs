/**
 * Show Routes (Epic BACKEND-A)
 *
 * BA-2: POST /api/v1/shows/create     — create a player-run show
 * BA-3: GET  /api/v1/shows            — browse shows (paginated)
 * BA-3: POST /api/v1/shows/:id/enter  — enter a horse in a show
 * BA-4: POST /api/v1/shows/execute    — admin/cron overnight execution
 *
 * Auth applied at authRouter level in app.mjs.
 */

import express from 'express';
import {
  createShow,
  getShows,
  enterShow,
  executeClosedShows,
} from '../controllers/showController.mjs';

const router = express.Router();

// Static routes before :id parameterised routes
router.post('/create', createShow);
router.post('/execute', executeClosedShows);

router.get('/', getShows);
router.post('/:id/enter', enterShow);

export default router;
