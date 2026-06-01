/**
 * Backwards-compat shim — real implementation in modules/grooms/controllers/groomMarketplaceController.mjs
 *
 * Equoria-94z3m: re-export through the grooms module barrel (index.mjs) to
 * satisfy the cross-module public-API boundary rule (no-restricted-imports /
 * Equoria-fy2tx). Named exports mirror the controller's public surface.
 */
export {
  getMarketplace,
  refreshMarketplace,
  hireFromMarketplace,
  forceExpireMarketplace,
  getMarketplaceStats,
} from '../modules/grooms/index.mjs';
