/**
 * 🔒 SECURITY ROUTER COMPOSITION (Equoria-515lv)
 *
 * Three-tier router system for granular authentication control, extracted
 * from app.mjs so the composition root reads as assembly rather than a wall
 * of `.use()` mounts:
 *   - publicRouter: No authentication required (health, docs, auth endpoints)
 *   - authRouter:   Authenticated users only (all game features)
 *   - adminRouter:  Admin role required (system administration)
 *
 * IMPORTANT — middleware/mount ORDER is behavior in Express. The order in
 * `buildRouters()` mirrors the original app.mjs exactly. Do not reorder
 * casually; auth, CSRF, and route precedence all depend on it.
 *
 * Route BEHAVIOR is unchanged: every `.use(path, router)` here is a verbatim
 * relocation of the corresponding line that previously lived in app.mjs.
 */

import express from 'express';

// Authentication / CSRF middleware
import { authenticateToken, requireRole } from '../middleware/auth.mjs';
import { csrfProtection } from '../middleware/csrf.mjs';
import { createNotFoundHandler } from '../middleware/notFoundHandler.mjs';
import logger from '../utils/logger.mjs';

// Health / readiness / api-info handlers
import { healthHandler, readyHandler, apiInfoHandler } from '../config/healthHandlers.mjs';

// Route imports — Equoria-q4uem.4 (WS4 S4): the composition root imports every
// route module directly. Module barrels (modules/<x>/index.mjs) are named-export
// service contracts and no longer surface routes or controllers, so a module that
// imports another module's barrel never evaluates its Express routers. This file
// (outside backend/modules/) is the one place that wires routes; the per-module
// ESLint boundary governs importers under backend/modules/ and is unchanged.
// The former backend/routes/*.mjs compat shims were retired under Equoria-v8l96.1.
import pingRoute from '../modules/health/routes/ping.mjs';
import authRoutes from '../modules/auth/routes/authRoutes.mjs';
import authenticatedAuthRoutes from '../modules/auth/routes/authenticatedAuthRoutes.mjs';
import horseRoutes from '../modules/horses/routes/horseRoutes.mjs';
import breedRoutes from '../modules/horses/routes/breedRoutes.mjs';
// Equoria-7p4xe: GET-only public breed router for the unauthenticated
// onboarding mount. The full breedRoutes (which contains the admin-gated
// POST createBreed) rides the authRouter only.
import breedPublicRoutes from '../modules/horses/routes/breedPublicRoutes.mjs';
import userRoutes from '../modules/users/routes/userRoutes.mjs';
import gdprAccountRoutes from '../modules/users/routes/gdprAccountRoutes.mjs';
import nextActionsRoutes from '../modules/users/routes/nextActionsRoutes.mjs';
import wyagRoutes from '../modules/users/routes/wyagRoutes.mjs';
// Equoria-rgyv (ADR-011): authenticated SSE real-time event stream.
import eventRoutes from '../modules/events/routes/eventRoutes.mjs';
import trainingRoutes from '../modules/training/routes/trainingRoutes.mjs';
import competitionRoutes from '../modules/competition/routes/competitionRoutes.mjs';
import competitionResultsRoutes from '../modules/competition/routes/competitionResultsRoutes.mjs';
import showRoutes from '../modules/competition/shows/showRoutes.mjs';
import foalRoutes from '../modules/breeding/routes/foalRoutes.mjs';
import studBookingRoutes from '../modules/breeding/routes/studBookingRoutes.mjs';
import traitRoutes from '../modules/traits/routes/traitRoutes.mjs';
import epigeneticFlagRoutes from '../modules/traits/routes/epigeneticFlagRoutes.mjs';
import advancedEpigeneticRoutes from '../modules/traits/routes/advancedEpigeneticRoutes.mjs';
import groomRoutes from '../modules/grooms/routes/groomRoutes.mjs';
import groomCareRoutes from '../modules/grooms/routes/groomCareRoutes.mjs';
import groomMarketplaceRoutes from '../modules/grooms/routes/groomMarketplaceRoutes.mjs';
import enhancedGroomRoutes from '../modules/grooms/routes/enhancedGroomRoutes.mjs';
import groomAssignmentRoutes from '../modules/grooms/routes/groomAssignmentRoutes.mjs';
import groomHandlerRoutes from '../modules/grooms/routes/groomHandlerRoutes.mjs';
import groomSalaryRoutes from '../modules/grooms/routes/groomSalaryRoutes.mjs';
import dynamicCompatibilityRoutes from '../modules/grooms/routes/dynamicCompatibilityRoutes.mjs';
import leaderboardRoutes from '../modules/leaderboards/routes/leaderboardRoutes.mjs';
// Equoria-q4uem.4 (WS4 S1): the former labs module was dissolved into traits,
// horses and admin.
import personalityEvolutionRoutes from '../modules/horses/routes/personalityEvolutionRoutes.mjs';
import apiOptimizationRoutes from '../modules/admin/routes/apiOptimizationRoutes.mjs';
import memoryManagementRoutes from '../modules/admin/routes/memoryManagementRoutes.mjs';
import documentationRoutes from '../modules/docs/routes/documentationRoutes.mjs';
import userDocumentationRoutes from '../modules/docs/routes/userDocumentationRoutes.mjs';
import adminRoutes from '../modules/admin/routes/adminRoutes.mjs';
import riderRoutes from '../modules/riders/routes/riderRoutes.mjs';
import trainerRoutes from '../modules/trainers/routes/trainerRoutes.mjs';
import vetRoutes from '../modules/economy/vet/routes/vetRoutes.mjs';
import tackShopRoutes from '../modules/economy/tackShop/routes/tackShopRoutes.mjs';
import farrierRoutes from '../modules/economy/farrier/routes/farrierRoutes.mjs';
import feedShopRoutes from '../modules/economy/feedShop/routes/feedShopRoutes.mjs';
import inventoryRoutes from '../modules/economy/inventory/routes/inventoryRoutes.mjs';
import forumRoutes from '../modules/community/routes/forumRoutes.mjs';
import messageRoutes from '../modules/community/routes/messageRoutes.mjs';
import helpRoutes from '../modules/community/routes/helpRoutes.mjs';
import clubRoutes from '../modules/community/routes/clubRoutes.mjs';
import hallOfFameRoutes from '../modules/community/routes/hallOfFameRoutes.mjs';
import marketplaceRoutes from '../modules/marketplace/routes/marketplaceRoutes.mjs';
import bankRoutes from '../modules/bank/routes/bankRoutes.mjs';
import craftingRoutes from '../modules/crafting/routes/craftingRoutes.mjs';
// Equoria-wbt8l: News — the players' feed and the staff News Desk.
import newsRoutes from '../modules/news/routes/newsRoutes.mjs';
import newsDeskRoutes from '../modules/news/routes/newsDeskRoutes.mjs';
// Imported directly, never through the staff barrel: this file is the only
// allowed importer of the staff Router (STAFF-CR-05, check-staff-routes-mount).
import staffRoutes from '../modules/staff/routes/staffRoutes.mjs';
// Equoria-ehlbj: the owner's quarantined-show tools are the competition module's;
// the staff routes reach them through a port only this layer can fill (staff
// cannot import competition without a cycle).
import { registerQuarantinedShowTools } from '../modules/staff/index.mjs';
import {
  diagnoseQuarantinedShow,
  previewQuarantinedShow,
  runQuarantinedShow,
} from '../modules/competition/index.mjs';
// Equoria-q4uem.4 (WS4 S3): application-level cross-domain reads. This router
// holds the /horses routes that compose data from more than one domain
// (overview, history, trainable horses, training history, breeding data, trait
// card). It shares a prefix with the module router and mounts BEFORE
// horseRoutes (see the mount block below). Every URL, executed chain and
// first-match position is unchanged; the domains no longer import each other
// for these reads. (The users half, GET /users/dashboard/:userId, was retired
// by Equoria-oey96.40.)
import horseQueryRoutes from './queries/horseQueryRoutes.mjs';
// Equoria-q4uem.9 (owner ruling q90): GET /horses/:id/visit, any horse seen as a
// visitor (public facts and revealed traits only). Its one two-segment path has
// no competing pattern in horseQueryRoutes or horseRoutes.
import horseVisitRoutes from './queries/horseVisitRoutes.mjs';
// Equoria-a0fim: GET /horses/:id/discipline-scores, the owner's Discipline Scores
// (the show scorer's flat score and its level). Its one two-segment path has no
// competing pattern in the routers around it.
import horseDisciplineScoresRoutes from './queries/horseDisciplineScoresRoutes.mjs';
// Equoria-q4uem.4 (WS4 S4): GET /users/transactions is bank's handler on the users
// prefix; bank owns the route module (imported directly, like every route module
// below after S4) and routers.mjs mounts it at /users ahead of userRoutes.
import bankUserTransactionsRoutes from '../modules/bank/routes/bankUserTransactionsRoutes.mjs';

/**
 * Build the three security routers with all routes mounted. Returns them for
 * the composition root to attach in the documented order.
 */
export function buildRouters() {
  registerQuarantinedShowTools({
    diagnoseQuarantinedShow,
    previewQuarantinedShow,
    runQuarantinedShow,
  });

  // Public router - No authentication required
  const publicRouter = express.Router();

  // Authenticated router - Requires valid JWT token
  const authRouter = express.Router();
  authRouter.use(authenticateToken);
  // Apply CSRF protection to all state-changing operations (POST/PUT/DELETE/PATCH)
  authRouter.use(csrfProtection);

  // Admin router - Requires valid JWT token + admin role
  const adminRouter = express.Router();
  adminRouter.use(authenticateToken, requireRole('admin'));
  // Apply CSRF protection to all state-changing operations (POST/PUT/DELETE/PATCH)
  adminRouter.use(csrfProtection);

  // PUBLIC ROUTES (No authentication)
  // Public auth endpoints (login, register, password reset, CSRF token) — no JWT required
  publicRouter.use('/api/v1/auth', authRoutes);
  // Documentation endpoints
  publicRouter.use('/docs', documentationRoutes);
  publicRouter.use('/api/docs', documentationRoutes);
  publicRouter.use('/user-docs', userDocumentationRoutes);
  // Backward compatibility for tests hitting /api/user-docs/*
  publicRouter.use('/api/user-docs', userDocumentationRoutes);

  // Public health / readiness / ping / api-info endpoints.
  // Health check endpoint — keep lightweight for Railway liveness probes.
  // Database readiness is exposed separately at /ready so health probes do not
  // consume scarce Supabase Session-mode pool clients.
  publicRouter.get('/health', healthHandler);
  // Readiness endpoint — performs a real DB ping for operators and deploy smoke tests.
  publicRouter.get('/ready', readyHandler);
  // Ping endpoint
  publicRouter.use('/ping', pingRoute);
  // API documentation endpoint
  publicRouter.get('/api-info', apiInfoHandler);

  // AUTHENTICATED ROUTES (Valid JWT required)
  // Authenticated auth mutations (profile, logout, change-password, onboarding, preferences)
  // — live on authRouter so they inherit authenticateToken + csrfProtection.
  authRouter.use('/auth', authenticatedAuthRoutes);

  // Core game features
  // Equoria-q4uem.4 (WS4 S3): the application query router shares a prefix with
  // the module router. Its relative order reproduces the base first-match
  // behaviour exactly and is pinned by backend/__tests__/
  // appQueryRoutesMounting.sentinel.test.mjs:
  //   /horses — query router FIRST. Its paths (/trainable/:userId, /:id/<sub>)
  //     have no competing two-segment pattern in horseRoutes, and at base they
  //     were reached before any other two-segment route could match.
  //   /users  — bank's GET /transactions FIRST (at base userRoutes registered
  //     /transactions ahead of GET /:id; mounting the bank router before
  //     userRoutes keeps /users/transactions from being claimed by /:id).
  authRouter.use('/horses', horseQueryRoutes);
  authRouter.use('/horses', horseVisitRoutes);
  authRouter.use('/horses', horseDisciplineScoresRoutes);
  authRouter.use('/horses', horseRoutes);
  authRouter.use('/users', bankUserTransactionsRoutes);
  authRouter.use('/users', userRoutes);
  // Equoria-rgyv (ADR-011): GET /api/v1/events/stream — per-user SSE stream.
  authRouter.use('/events', eventRoutes);
  authRouter.use('/account', gdprAccountRoutes);
  authRouter.use('/training', trainingRoutes);
  // Equoria-oey96.28: the literal /competition/results prefix is mounted
  // BEFORE the broader /competition router, so route precedence cannot depend
  // on competitionRoutes happening to have no matching path.
  authRouter.use('/competition/results', competitionResultsRoutes);
  authRouter.use('/competition', competitionRoutes);
  authRouter.use('/breeds', breedRoutes);
  authRouter.use('/foals', foalRoutes);
  // Equoria-q4uem.9: stud bookings (public stud; private requests follow).
  authRouter.use('/studs', studBookingRoutes);
  authRouter.use('/traits', traitRoutes);

  // Rider and trainer systems
  authRouter.use('/riders', riderRoutes);
  authRouter.use('/trainers', trainerRoutes);
  authRouter.use('/vet', vetRoutes);
  authRouter.use('/tack-shop', tackShopRoutes);
  authRouter.use('/farrier', farrierRoutes);
  authRouter.use('/feed-shop', feedShopRoutes);
  authRouter.use('/inventory', inventoryRoutes);
  authRouter.use('/forum', forumRoutes);
  authRouter.use('/messages', messageRoutes);
  authRouter.use('/help', helpRoutes);
  authRouter.use('/clubs', clubRoutes);
  authRouter.use('/hall-of-fame', hallOfFameRoutes);
  authRouter.use('/marketplace', marketplaceRoutes);
  authRouter.use('/next-actions', nextActionsRoutes);
  authRouter.use('/while-you-were-gone', wyagRoutes);
  authRouter.use('/shows', showRoutes);
  authRouter.use('/bank', bankRoutes);
  authRouter.use('/crafting', craftingRoutes);
  authRouter.use('/news', newsRoutes);

  // Groom management system
  // Daily care ("groom horse") is mounted before /grooms so its paths are never
  // claimed by a groom-id route.
  authRouter.use('/grooms/care', groomCareRoutes);
  authRouter.use('/grooms', groomRoutes);
  authRouter.use('/grooms/enhanced', enhancedGroomRoutes);
  authRouter.use('/groom-assignments', groomAssignmentRoutes);
  authRouter.use('/groom-handlers', groomHandlerRoutes);
  authRouter.use('/groom-salaries', groomSalaryRoutes);
  authRouter.use('/groom-marketplace', groomMarketplaceRoutes);

  // Advanced game features
  authRouter.use('/flags', epigeneticFlagRoutes);
  authRouter.use('/leaderboards', leaderboardRoutes);

  // Advanced epigenetic and genetics features
  authRouter.use('/', advancedEpigeneticRoutes); // Mounts horse-specific routes at /horses/:id/...
  // Equoria-a7f1p: /epigenetic-traits/* and the enhanced trait reports
  // (trait history, timeline, stable report, comparison, export) were removed
  // (owner ruling 2026-10-28, q152: no trait reports for players).

  // Performance optimization and environmental systems
  // Equoria-rvmse (SECURITY P1): /optimization and /memory expose operational
  // telemetry (memory/resource/status, optimization/compression/cache metrics)
  // — diagnostics for operators, NOT player features. They were authenticated
  // but not role-gated, so any authenticated non-admin (a beta tester) could
  // read process-internal health/resource data. Gate the whole mount with
  // requireRole('admin') so the gate covers every current and future sub-route
  // (the destructive POST /memory/gc + /memory/cleanup were already admin-only
  // per-route under Story 21S-8; this closes the read-side gap). URLs are
  // unchanged (/api/v1/optimization/*, /api/v1/memory/*) — admin-only, not moved.
  authRouter.use('/optimization', requireRole('admin'), apiOptimizationRoutes);
  authRouter.use('/memory', requireRole('admin'), memoryManagementRoutes);
  // Equoria-oey96.37 (owner ruling 2026-07-07): clusters no screen uses are
  // admin-gated. /compatibility has no frontend consumer; the routes and their
  // tables stay (q143 parks the compatibility tables), only players lose access.
  authRouter.use('/compatibility', requireRole('admin'), dynamicCompatibilityRoutes);
  authRouter.use('/personality-evolution', personalityEvolutionRoutes);

  // ADMIN ROUTES (Admin role required)
  // Equoria-wbt8l: the News Desk; per-type rules live in the news module.
  adminRouter.use('/news', newsDeskRoutes);
  adminRouter.use('/', adminRoutes);

  // STAFF ROUTES (Equoria-puj1e.1) — the Steward's Office API. Deliberately
  // NO requireRole here: a non-staff caller must get the ordinary unknown-route
  // 404, which the per-route staff guards (requireStaffRole /
  // requireStaffCapability) decide after re-reading the role from the DB.
  const staffRouter = express.Router();
  staffRouter.use(authenticateToken);
  staffRouter.use(csrfProtection);
  staffRouter.use('/', staffRoutes);
  // Nothing under /api/v1/staff falls through to the /api/v1 authRouter
  // (STAFF-CR-05): an unmatched staff path ends here with the same handler
  // app.mjs mounts as its catch-all, so the answer is the ordinary 404.
  staffRouter.use(createNotFoundHandler({ spaHtml: null, logger }));

  return { publicRouter, authRouter, adminRouter, staffRouter };
}

// Equoria-7p4xe: the public `/api/v1/breeds` mount (no auth — needed for
// onboarding before login) serves the GET-only `breedPublicRoutes`. Breed
// CREATION (POST) is NOT public: it lives on the authRouter `/breeds` mount
// above and is gated by `requireRole('admin')` + CSRF in breedRoutes.mjs.
// An anonymous POST /api/v1/breeds finds no route on this GET-only public
// router and falls through to the authRouter `/breeds` mount, where
// `authenticateToken` rejects it (401). Re-exported under the original name so
// the composition root mounts it without re-importing the route module.
export { breedPublicRoutes as breedRoutes };
