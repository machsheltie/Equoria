/**
 * Backwards-compat shim — real implementation in modules/horses/controllers/horseXpController.mjs
 *
 * Equoria-94z3m: re-export through the horses module barrel (index.mjs) to
 * satisfy the cross-module public-API boundary rule (no-restricted-imports /
 * Equoria-fy2tx). Named exports mirror the controller's public surface.
 */
export {
  getHorseXpStatus,
  allocateStatPoint,
  getHorseXpHistory,
  awardXpToHorse,
} from '../modules/horses/index.mjs';
