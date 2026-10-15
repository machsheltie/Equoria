/**
 * economy module public API (named-export service contract).
 *
 * Equoria-q4uem.4 (WS4 S4): this barrel lists exactly the names other modules, the
 * application layer (backend/app) and repository scripts import. Route modules are
 * wired only by backend/app/routers.mjs and are not exported here; HTTP controllers
 * are not domain capabilities and are not exported for production use. Cross-module
 * imports still go through this file (ESLint, CONTRIBUTING.md "Module public API
 * boundaries"); add a name here when a consumer genuinely needs it, never `export *`.
 */

export { FEED_CATALOG } from './feedShop/services/feedCatalog.mjs';
export {
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
  SYSTEM_ACCOUNT_SHOW_ESCROW,
  creditSystemAccount,
  debitMoneyOrThrow,
  debitSystemAccountOrThrow,
  getTransactionsForUser,
  recordTransaction,
  recordTransactionTx,
} from './services/financialLedgerService.mjs';
export { TACK_INVENTORY, resolveTackBonus } from './tackShop/services/tackInventory.mjs';

// Test-consumed only (other modules' tests; Equoria-7t1tn tracks moving those tests
// into the owning module, after which these lines go).
export { purchaseTackItem, unequipDecoration } from './tackShop/controllers/tackShopController.mjs';
