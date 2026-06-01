/**
 * Backwards-compat shim — real implementation in modules/competition/shows/showController.mjs
 *
 * Equoria-94z3m: re-export through the competition module barrel (index.mjs)
 * to satisfy the cross-module public-API boundary rule (no-restricted-imports
 * / Equoria-fy2tx). Named exports mirror the controller's public surface.
 */
export {
  createShow,
  getShows,
  enterShow,
  executeClosedShows,
} from '../modules/competition/index.mjs';
