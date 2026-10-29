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
  levelForXp,
  levelProgress,
} from './services/userModelService.mjs';

// Equoria-81uop: account erasure is gone (owner rulings 2026-09-22/25: no account is
// ever deleted — not self-service, not on request, not by an operator).
