/**
 * staff module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

export { can, isStaffRole, rolesWithCapability, satisfiesRole } from './capabilities.mjs';
// Equoria-ehlbj: the owner's quarantine tools live in the competition module. They
// write the staff audit record, and the staff routes reach them through a port
// the app layer fills (staff cannot import competition: that edge would be a cycle).
export { recordStaffActionTx, recordStaffFailure } from './services/staffActionLogService.mjs';
export { registerQuarantinedShowTools } from './services/quarantinedShowToolsPort.mjs';
export { retireStaffCheckinCodesTx } from './services/staffChallengeRetirement.mjs';
export { purgeStaleStaffCheckinRecords } from './services/staffCheckinRetentionService.mjs';
export {
  purgeSettledEmails,
  runEmailOutbox,
  scrubTicketEmailFilerTx,
} from './services/ticketEmailOutbox.mjs';
