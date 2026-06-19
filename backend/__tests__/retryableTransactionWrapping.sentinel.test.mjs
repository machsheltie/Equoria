/**
 * Doctrine sentinel — migrated $transaction sites stay wrapped (Equoria-7x9po).
 *
 * The shared `withRetryableTxMapping` util is centrally proven by
 * `retryableTransaction.test.mjs` (real forced P2028 -> 503). Per the
 * Equoria-7x9po testability note, each MIGRATED user-facing call site does NOT
 * get its own forced-timeout test (that would be a placebo re-proving the
 * already-proven shared classifier — OPTIMAL_FIX_DISCIPLINE §2). Instead this
 * LIGHTWEIGHT structural sentinel pins the wiring: it asserts that every
 * production file we migrated still (a) imports the shared util and (b) wraps
 * its interactive `prisma.$transaction(` call(s) in `withRetryableTxMapping` /
 * `runRetryableTransaction`. If a future edit un-wraps a migrated site (or a
 * refactor drops the import), this fails — closing the "silently reverts to a
 * 500-on-timeout" regression the migration fixed.
 *
 * Scope boundary (documented, intentional): only the call sites that SHOULD map
 * a transient timeout to a retryable 503 are listed in MIGRATED. The KNOWN
 * UNWRAPPED list below names the production `prisma.$transaction(` sites left
 * as-is ON PURPOSE (read-only paginated queries, server-side cron/executor
 * paths with no client to retry, and a best-effort refund inside a catch) so a
 * reviewer can see they were a deliberate decision, not an oversight. Test
 * files and scripts are out of scope.
 *
 * This sentinel is a STRUCTURAL check, not a behavioural one — it does not run
 * a transaction. The behavioural proof lives in retryableTransaction.test.mjs.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(__dirname, '..');

function read(relPath) {
  return readFileSync(resolve(BACKEND_ROOT, relPath), 'utf8');
}

// Files migrated under Equoria-7x9po. Each entry pins TWO counts:
//   wrapped: how many `prisma.$transaction(` sites MUST be wrapped, and
//   totalTx: the TOTAL `prisma.$transaction(` sites in the file (wrapped +
//            intentionally-unwrapped, e.g. array-form reads / executor paths).
// Pinning totalTx means adding a NEW unwrapped $transaction to one of these
// files trips the sentinel (totalTx grows but wrapped doesn't), forcing a
// conscious decision: wrap it or move it to KNOWN_UNWRAPPED + bump totalTx.
// The horseFeedService proof-of-pattern (Equoria-55m83) is included so a
// regression there is caught too.
const MIGRATED = [
  ['modules/horses/services/horseFeedService.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/bank/controllers/bankController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/auth/controllers/profileController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/auth/controllers/passwordController.mjs', { wrapped: 2, totalTx: 2 }],
  ['modules/auth/controllers/onboardingController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/crafting/controllers/craftingController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/economy/vet/controllers/vetController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/economy/tackShop/controllers/tackShopController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/economy/farrier/controllers/farrierController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/riders/controllers/riderMarketplaceController.mjs', { wrapped: 2, totalTx: 2 }],
  ['modules/trainers/controllers/trainerMarketplaceController.mjs', { wrapped: 2, totalTx: 2 }],
  ['modules/grooms/controllers/groomRosterController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/grooms/controllers/groomMarketplaceController.mjs', { wrapped: 1, totalTx: 1 }],
  // createShow + enterShow wrapped; executeClosedShows' 2 executor-path
  // $transactions intentionally unwrapped (KNOWN_UNWRAPPED) → totalTx 4.
  ['modules/competition/shows/showController.mjs', { wrapped: 2, totalTx: 4 }],
  // createThread wrapped; array-form createPost unwrapped → totalTx 2.
  ['modules/community/controllers/forumController.mjs', { wrapped: 1, totalTx: 2 }],
  // createClub wrapped; array-form transferLeadership unwrapped → totalTx 2.
  ['modules/community/controllers/clubController.mjs', { wrapped: 1, totalTx: 2 }],
  ['modules/economy/feedShop/controllers/feedShopController.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/users/services/gdprAccountService.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/competition/services/competitionRouteQueries.mjs', { wrapped: 1, totalTx: 1 }],
  ['modules/grooms/services/groomLegacyService.mjs', { wrapped: 1, totalTx: 1 }],
];

// marketplaceController is asserted separately: it has 2 wrapped sites
// (buyHorse + buyStoreHorse) PLUS a deliberately-unwrapped best-effort refund
// $transaction inside the buyStoreHorse catch (KNOWN_UNWRAPPED), so it pins
// wrapped>=2 and totalTx=3.
const MIGRATED_PARTIAL = [['modules/marketplace/controllers/marketplaceController.mjs', { wrapped: 2, totalTx: 3 }]];

const WRAP_RE = /\b(withRetryableTxMapping|runRetryableTransaction)\s*\(/g;
const TX_RE = /\bprisma\.\$transaction\s*\(/g;
const IMPORT_RE = /from\s+['"][^'"]*utils\/retryableTransaction\.mjs['"]/;

function count(re, src) {
  return (src.match(re) || []).length;
}

describe('Equoria-7x9po — migrated $transaction sites stay wrapped', () => {
  for (const [relPath, { wrapped, totalTx }] of MIGRATED) {
    it(`${relPath}: imports the util, wraps ${wrapped} site(s), has ${totalTx} total $transaction site(s)`, () => {
      const src = read(relPath);
      expect(IMPORT_RE.test(src)).toBe(true);
      const txCount = count(TX_RE, src);
      const wrapCount = count(WRAP_RE, src);
      // totalTx pinned: a NEW unwrapped $transaction grows txCount past totalTx
      // and trips the sentinel. wrapped pinned: removing a wrap drops wrapCount.
      expect(txCount).toBe(totalTx);
      expect(wrapCount).toBeGreaterThanOrEqual(wrapped);
    });
  }

  for (const [relPath, { wrapped, totalTx }] of MIGRATED_PARTIAL) {
    it(`${relPath}: imports the util, wraps >= ${wrapped} site(s), has ${totalTx} total $transaction site(s)`, () => {
      const src = read(relPath);
      expect(IMPORT_RE.test(src)).toBe(true);
      expect(count(WRAP_RE, src)).toBeGreaterThanOrEqual(wrapped);
      expect(count(TX_RE, src)).toBe(totalTx);
    });
  }

  // Sentinel-positive: prove the detector actually fires on an UNWRAPPED site,
  // not just that it passes when everything is wrapped (OPTIMAL_FIX §2).
  it('detector FIRES on a synthetic unwrapped $transaction (sentinel-positive)', () => {
    const planted = `
      import prisma from 'x';
      const r = await prisma.$transaction(async tx => { return tx.user.findMany(); });
    `;
    // No util import, and a bare $transaction → both checks must FAIL for this.
    expect(IMPORT_RE.test(planted)).toBe(false);
    expect(count(TX_RE, planted)).toBe(1);
    expect(count(WRAP_RE, planted)).toBe(0);
  });

  it('detector PASSES on a synthetic wrapped $transaction (sentinel-negative)', () => {
    const planted = `
      import { withRetryableTxMapping } from '../utils/retryableTransaction.mjs';
      const r = await withRetryableTxMapping(prisma.$transaction(async tx => tx.user.findMany()), { message: 'x' });
    `;
    expect(IMPORT_RE.test(planted)).toBe(true);
    expect(count(TX_RE, planted)).toBe(1);
    expect(count(WRAP_RE, planted)).toBe(1);
  });
});

/**
 * Documentation block (asserted as a no-op so the list lives in the test file,
 * not in evaporating prose). These production `prisma.$transaction(` sites are
 * intentionally NOT wrapped — surfacing a 503 to a client is not meaningful for
 * them. If you migrate one later, move it into MIGRATED and update the count.
 */
const KNOWN_UNWRAPPED = [
  // Read-only paginated $transaction([findMany, count]) — not a mutation; a
  // 503-vs-500 on a read query is low value and the array form is not the
  // interactive-timeout target.
  'modules/community/controllers/messageController.mjs (getInbox, getSent)',
  'modules/community/controllers/forumController.mjs (createPost — array form)',
  'modules/community/controllers/clubController.mjs (transferLeadership — array form)',
  // Server-side cron / executor paths — no user request waiting to retry.
  'modules/competition/shows/showController.mjs (executeClosedShows: per-result payout + fee settle)',
  'modules/grooms/services/groomSalaryService.mjs (weekly salary cron run)',
  'utils/cronLock.mjs (advisory-lock infra; timeout IS the intended skip path)',
  // Best-effort recovery inside a catch — not the primary mutation path.
  'modules/marketplace/controllers/marketplaceController.mjs (buyStoreHorse refund tx)',
  // Deferred to follow-up (caller-catch treatment needed) — Equoria follow-up.
  'modules/competition/services/conformationShowService.mjs (show execute)',
  'utils/tokenRotationService.mjs (refresh — own CONCURRENT_ROTATION/retry semantics)',
  'utils/emailVerificationService.mjs (returns {success:false} shapes, not throws)',
];

describe('Equoria-7x9po — known-unwrapped sites are documented', () => {
  it('the KNOWN_UNWRAPPED list is non-empty and self-documenting', () => {
    expect(KNOWN_UNWRAPPED.length).toBeGreaterThan(0);
    for (const entry of KNOWN_UNWRAPPED) {
      expect(typeof entry).toBe('string');
      expect(entry.length).toBeGreaterThan(0);
    }
  });
});
