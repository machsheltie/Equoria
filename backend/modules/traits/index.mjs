/**
 * Equoria module public API barrel — Equoria-(r9we2 / efonm / pfe6x / rdtcb slice).
 *
 * Cross-module imports MUST go through this barrel. Direct deep imports
 * are deprecated and will be lint-blocked once consumers have migrated.
 *
 * Public API: exports from controllers, routes, services, tests.
 */

export * from './controllers/epigeneticFlagController.mjs';
export * from './controllers/traitController.mjs';
export * from './routes/advancedEpigeneticRoutes.mjs';
export * from './routes/epigeneticFlagRoutes.mjs';
export * from './routes/epigeneticTraitRoutes.mjs';
export * from './routes/traitDiscoveryRoutes.mjs';
export * from './routes/traitRoutes.mjs';
export * from './routes/ultraRareTraitRoutes.mjs';
export * from './services/epigeneticTraitQueries.mjs';
export * from './services/legacyScoreTraitCalculator.mjs';
export * from './services/temporaryFlagSystem.mjs';
export * from './services/traitHistoryService.mjs';
export * from './services/traitInteractionMatrix.mjs';
export * from './services/traitRevelationAnalyticsService.mjs';
export * from './services/traitTimelineService.mjs';
export * from './services/ultraRareTraitEvaluationService.mjs';
export * from './services/ultraRareTraitQueries.mjs';
