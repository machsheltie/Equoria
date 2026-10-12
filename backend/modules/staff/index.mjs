/**
 * Staff module public API barrel (Equoria-puj1e.2).
 *
 * Cross-module imports go through this barrel only.
 */

export * from './capabilities.mjs';
export * from './middleware/requireStaffCapability.mjs';
export { default as staffRoutes } from './routes/staffRoutes.mjs';
