/**
 * Staff module public API barrel (Equoria-puj1e.2).
 *
 * Cross-module imports go through this barrel only. The staff Router is
 * deliberately NOT exported here: only backend/app/routers.mjs may import
 * routes/staffRoutes.mjs, so nothing else can register on the mounted Router
 * (STAFF-CR-05; enforced by scripts/doctrine-checks/check-staff-routes-*.mjs).
 */

export * from './capabilities.mjs';
export * from './middleware/requireStaffCapability.mjs';
export { recordStaffActionTx, recordStaffFailure } from './services/staffActionLogService.mjs';
export { retireStaffCheckinCodesTx } from './services/staffChallengeRetirement.mjs';
export { purgeStaleStaffCheckinRecords } from './services/staffCheckinRetentionService.mjs';
