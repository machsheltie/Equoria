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
import { authenticateToken, requireRole, requireAdminMfa } from '../middleware/auth.mjs';
import { csrfProtection } from '../middleware/csrf.mjs';

// Health / readiness / api-info handlers
import { healthHandler, readyHandler, apiInfoHandler } from '../config/healthHandlers.mjs';

// Route imports
import pingRoute from '../routes/ping.mjs';
import authRoutes from '../routes/authRoutes.mjs';
import authenticatedAuthRoutes from '../modules/auth/routes/authenticatedAuthRoutes.mjs';
import horseRoutes from '../routes/horseRoutes.mjs';
import userRoutes from '../routes/userRoutes.mjs';
// Equoria-rgyv (ADR-011): authenticated SSE real-time event stream.
import { eventRoutes } from '../modules/events/index.mjs';
import gdprAccountRoutes from '../routes/gdprAccountRoutes.mjs';
import trainingRoutes from '../routes/trainingRoutes.mjs';
import competitionRoutes from '../routes/competitionRoutes.mjs';
import breedRoutes from '../routes/breedRoutes.mjs';
// Equoria-7p4xe: GET-only public breed router for the unauthenticated
// onboarding mount. The full breedRoutes (which contains the admin-gated
// POST createBreed) rides the authRouter only.
import breedPublicRoutes from '../modules/horses/routes/breedPublicRoutes.mjs';
import foalRoutes from '../routes/foalRoutes.mjs';
import traitRoutes from '../routes/traitRoutes.mjs';
import traitDiscoveryRoutes from '../routes/traitDiscoveryRoutes.mjs';
import groomRoutes from '../routes/groomRoutes.mjs';
import groomMarketplaceRoutes from '../routes/groomMarketplaceRoutes.mjs';
import enhancedGroomRoutes from '../routes/enhancedGroomRoutes.mjs';
import groomAssignmentRoutes from '../routes/groomAssignmentRoutes.mjs';
import groomHandlerRoutes from '../routes/groomHandlerRoutes.mjs';
import groomSalaryRoutes from '../routes/groomSalaryRoutes.mjs';
import groomPerformanceRoutes from '../routes/groomPerformanceRoutes.mjs';
import epigeneticTraitRoutes from '../routes/epigeneticTraitRoutes.mjs';
import epigeneticFlagRoutes from '../routes/epigeneticFlagRoutes.mjs';
import enhancedMilestoneRoutes from '../routes/enhancedMilestoneRoutes.mjs';
import leaderboardRoutes from '../routes/leaderboardRoutes.mjs';
import ultraRareTraitRoutes from '../routes/ultraRareTraitRoutes.mjs';
import advancedEpigeneticRoutes from '../routes/advancedEpigeneticRoutes.mjs';
import enhancedReportingRoutes from '../routes/enhancedReportingRoutes.mjs';
import dynamicCompatibilityRoutes from '../routes/dynamicCompatibilityRoutes.mjs';
import personalityEvolutionRoutes from '../routes/personalityEvolutionRoutes.mjs';
import apiOptimizationRoutes from '../routes/apiOptimizationRoutes.mjs';
import memoryManagementRoutes from '../routes/memoryManagementRoutes.mjs';
import documentationRoutes from '../routes/documentationRoutes.mjs';
import userDocumentationRoutes from '../routes/userDocumentationRoutes.mjs';
import advancedBreedingGeneticsRoutes from '../routes/advancedBreedingGeneticsRoutes.mjs';
import environmentalRoutes from '../routes/environmentalRoutes.mjs';
import adminRoutes from '../routes/adminRoutes.mjs';
import riderRoutes from '../routes/riderRoutes.mjs';
import trainerRoutes from '../routes/trainerRoutes.mjs';
import vetRoutes from '../routes/vetRoutes.mjs';
import tackShopRoutes from '../routes/tackShopRoutes.mjs';
import farrierRoutes from '../routes/farrierRoutes.mjs';
import feedShopRoutes from '../routes/feedShopRoutes.mjs';
import inventoryRoutes from '../routes/inventoryRoutes.mjs';
import forumRoutes from '../routes/forumRoutes.mjs';
import messageRoutes from '../routes/messageRoutes.mjs';
import clubRoutes from '../routes/clubRoutes.mjs';
import marketplaceRoutes from '../routes/marketplaceRoutes.mjs';
import nextActionsRoutes from '../routes/nextActionsRoutes.mjs';
import wyagRoutes from '../routes/wyagRoutes.mjs';
import showRoutes from '../routes/showRoutes.mjs';
import bankRoutes from '../routes/bankRoutes.mjs';
import craftingRoutes from '../routes/craftingRoutes.mjs';

/**
 * Build the three security routers with all routes mounted. Returns them for
 * the composition root to attach in the documented order.
 */
export function buildRouters() {
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
  // Optional policy (Equoria-te21j): when ADMIN_MFA_REQUIRED is enabled, an
  // admin must have MFA enrolled to use admin routes. No-op when the flag is
  // off (default) so existing admins are not locked out on deploy.
  adminRouter.use(requireAdminMfa);
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
  authRouter.use('/horses', horseRoutes);
  authRouter.use('/users', userRoutes);
  // Equoria-rgyv (ADR-011): GET /api/v1/events/stream — per-user SSE stream.
  authRouter.use('/events', eventRoutes);
  authRouter.use('/account', gdprAccountRoutes);
  authRouter.use('/training', trainingRoutes);
  authRouter.use('/competition', competitionRoutes);
  authRouter.use('/breeds', breedRoutes);
  authRouter.use('/foals', foalRoutes);
  authRouter.use('/trait-discovery', traitDiscoveryRoutes);
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
  authRouter.use('/clubs', clubRoutes);
  authRouter.use('/marketplace', marketplaceRoutes);
  authRouter.use('/next-actions', nextActionsRoutes);
  authRouter.use('/while-you-were-gone', wyagRoutes);
  authRouter.use('/shows', showRoutes);
  authRouter.use('/bank', bankRoutes);
  authRouter.use('/crafting', craftingRoutes);

  // Groom management system
  authRouter.use('/grooms', groomRoutes);
  authRouter.use('/grooms/enhanced', enhancedGroomRoutes);
  authRouter.use('/groom-assignments', groomAssignmentRoutes);
  authRouter.use('/groom-handlers', groomHandlerRoutes);
  authRouter.use('/groom-salaries', groomSalaryRoutes);
  authRouter.use('/groom-performance', groomPerformanceRoutes);
  authRouter.use('/groom-marketplace', groomMarketplaceRoutes);

  // Advanced game features
  authRouter.use('/epigenetic-traits', epigeneticTraitRoutes);
  authRouter.use('/flags', epigeneticFlagRoutes);
  authRouter.use('/milestones', enhancedMilestoneRoutes);
  authRouter.use('/ultra-rare-traits', ultraRareTraitRoutes);
  authRouter.use('/leaderboards', leaderboardRoutes);

  // Advanced epigenetic and genetics features
  authRouter.use('/', advancedEpigeneticRoutes); // Mounts horse-specific routes at /horses/:id/...
  authRouter.use('/', enhancedReportingRoutes); // Enhanced reporting endpoints
  authRouter.use('/', advancedBreedingGeneticsRoutes); // Advanced breeding mechanics

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
  authRouter.use('/environment', environmentalRoutes);
  authRouter.use('/compatibility', dynamicCompatibilityRoutes);
  authRouter.use('/personality-evolution', personalityEvolutionRoutes);

  // ADMIN ROUTES (Admin role required)
  adminRouter.use('/', adminRoutes);

  return { publicRouter, authRouter, adminRouter };
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
