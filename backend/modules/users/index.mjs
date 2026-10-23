/**
 * users module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

export {
  getAllDocuments,
  getDocument,
  getDocumentationAnalytics,
  getTableOfContents,
  getUserDocumentationService,
  searchDocumentation,
} from './services/userDocumentationService.mjs';
export {
  addXpToUser,
  addXpToUserCore,
  createUser,
  getStableLevel,
  getUserById,
  getUserWithHorses,
} from './services/userModelService.mjs';

// Operator erasure (GDPR). No production importer outside this module; consumed by other
// modules' erasure-behaviour tests (breeding studRequestLifecycle, horses
// horseDeletionEndpointClosed, staff staffErasureKeepsRecords / staffLogActorsAuthz /
// staffTicketEmailOutbox), which erase a fixture user to prove their own data survives.
// Equoria-7t1tn: kept pending an owner ruling on moving those tests vs keeping the name.
export { eraseUserAccount } from './services/gdprAccountService.mjs';
