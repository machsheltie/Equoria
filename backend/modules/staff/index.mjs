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
export {
  accountStanding,
  cachedAccountStanding,
  postingCooldownRefusal,
  postingCooldownUntil,
  recordLoginSighting,
  refuseSignIn,
  standingRefusal,
} from './services/conductEnforcementService.mjs';
export {
  accountLimitRefusal,
  createAccountWithinDeviceLimit,
} from './services/deviceAccountLimitService.mjs';
export { registerQuarantinedShowTools } from './services/quarantinedShowToolsPort.mjs';
export { registerGroomPayrollRun } from './services/groomPayrollPort.mjs';
// Equoria-puj1e.3: a steward's horse rename asks the horses module's name rule by port.
export { registerHorseNameRule } from './services/contentRulesPort.mjs';
// Equoria-puj1e.3 (owner rulings q380/q381): the forum asks the word lists whether a
// new thread or reply is refused (blocked) or held for a moderator (review).
export { blockedWordRefusal, forumWordVerdict } from './services/forumWordService.mjs';
// Equoria-brh8c: payroll failures are recorded by the grooms and riders modules and
// re-run through a port the app layer fills (staff cannot import either module).
export { recordPayrollFailure } from './services/payrollFailureLog.mjs';
export { registerPayrollReplays } from './services/payrollReplayPort.mjs';
export {
  retireStaffCheckinCodesTx,
  revokeStaffTrustedDevicesTx,
} from './services/staffChallengeRetirement.mjs';
// Equoria-n256i (owner ruling q289): every admin route asks for the emailed check-in.
export { hasStaffCheckin, requireStaffCheckin } from './middleware/requireStaffCheckin.mjs';
export { purgeStaleStaffCheckinRecords } from './services/staffCheckinRetentionService.mjs';
export { purgeSettledEmails, runEmailOutbox } from './services/ticketEmailOutbox.mjs';
// Equoria-puj1e.5 (owner ruling q377): every scheduled job reads the durable hold,
// under the nightly-job barrier lock (Codex r2 #1).
export { admitJobRunTx } from './services/jobHoldService.mjs';
// Equoria-puj1e.5 (owner ruling 2026-10-12): a time-back owes players the bank weeks an
// outage covered; the bank pays them from this settings key with the weekly claim.
export { owedWeeklyClaimsKey } from './services/timeBackBankClaims.mjs';
