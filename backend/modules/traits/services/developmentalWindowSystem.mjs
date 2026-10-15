/**
 * Developmental Window System Service (back-compat barrel)
 *
 * Implements critical developmental periods for trait expression.
 * Manages age-sensitive windows where specific traits can be developed
 * or modified through targeted interventions and environmental factors.
 *
 * Business Rules:
 * - Critical developmental window identification and timing
 * - Age-based trait expression sensitivity calculations
 * - Window-specific trait development opportunities
 * - Developmental milestone tracking and evaluation
 * - Window closure effects on trait expression potential
 * - Multi-window coordination and conflict resolution
 * - Environmental sensitivity during critical periods
 * - Long-term developmental outcome prediction
 *
 * Equoria-urqic.5: this 1306-line module was split along its three concerns
 * into focused sibling modules. This file now re-exports the public surface
 * so every existing importer is unaffected. Equoria-q4uem.4 (WS4) moved the
 * whole cluster from modules/horses/services into modules/traits/services; it
 * is imported by the traits routers advancedEpigeneticRoutes.mjs and
 * enhancedReportingRoutes.mjs and by the developmental-window tests
 * (modules/traits/__tests__ and backend/tests/services). No module barrel
 * re-exports it any more:
 *   - developmentalWindows.mjs       — window identification / sensitivity /
 *                                       closure / coordination / critical-period
 *                                       analysis / trait-opportunity evaluation
 *   - developmentalMilestones.mjs    — milestone tracking + progress assessment
 *   - developmentalForecast.mjs      — long-term developmental forecast
 *   - developmentalWindowDefinitions.mjs — shared window + milestone constants
 */

export {
  identifyDevelopmentalWindows,
  calculateWindowSensitivity,
  evaluateTraitDevelopmentOpportunity,
  assessWindowClosure,
  coordinateMultiWindowDevelopment,
  analyzeCriticalPeriodSensitivity,
} from './developmentalWindows.mjs';

export {
  trackDevelopmentalMilestones,
  assessMilestoneProgress,
} from './developmentalMilestones.mjs';

export { generateDevelopmentalForecast } from './developmentalForecast.mjs';
