/**
 * Backwards-compat shim — real implementation in modules/health/controllers/pingController.mjs
 *
 * Equoria-94z3m: re-export through the health module barrel (index.mjs) to
 * satisfy the cross-module public-API boundary rule (no-restricted-imports /
 * Equoria-fy2tx). Named exports mirror the controller's public surface.
 */
export { handlePing, handleHealthCheck, handleRedisHealthCheck } from '../modules/health/index.mjs';
