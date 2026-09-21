**Codebase correctness and security audit — 2026-09-05**

Audited checkout: `7b2376ec858d77321e830f966237200847bee509`, including the existing working tree. Seven findings: six P1 and one P2. Application code and tests were not modified.

This was a risk-based audit of API authentication/authorization, horse creation and XP, inventory and bank state, marketplace transfers, rider assignments, account identity, and frontend authentication. Breeding, training, competition, community routes, and database constraints were also sampled. It is not an exhaustive certification of every module or deployment configuration.

Reproductions used the actual Express app, authentication and CSRF middleware, Prisma, and the configured local PostgreSQL database under `NODE_ENV=test`. Concurrency probes temporarily delayed real database reads inside the probe process to produce specific request interleavings; they did not replace database results. Temporary users, horses, riders, assignments, and sales were removed with fixture-scoped cleanup. The MFA frontend finding combines a reproduced API response with source tracing; it was not browser-tested.

**1. [P1] Inventory updates can erase the weekly claim marker and mint additional coins**

Evidence: `backend/modules/economy/inventory/controllers/inventoryController.mjs:203-208`. `equipItem` reads `User.settings`, changes horse tack separately, and then replaces the entire settings document using its earlier snapshot. `backend/modules/bank/controllers/bankController.mjs:53-78` stores the weekly claim marker in the same JSON document while incrementing the wallet. The bank's conditional update does not protect the marker from a later stale write by another endpoint.

Reproduction: start an authenticated `POST /api/v1/inventory/equip` for an owned item and horse, pause after its user/settings read, then complete `POST /api/v1/bank/claim`. Resume equip, then claim again. All three mutations returned HTTP 200. The first claim credited 5,000 coins; equip removed `lastWeeklyClaimDate`; the second claim credited another 5,000. The fixture's balance increased from 0 to 10,000 in one week.

Fix direction: update only the intended JSON path and make horse/item changes atomic. Where a read/modify/write is required, lock the user row before reading it and retain the lock through the transaction. Check sibling settings replacements, including unequip and profile updates; adding an ordinary read-committed transaction around a stale snapshot alone does not prevent this failure.

**2. [P1] Any player can create additional horses without paying**

Evidence: `backend/modules/horses/routes/horseRoutes.mjs:296-304` exposes horse creation to every authenticated player. `backend/modules/horses/services/createHorseService.mjs:187-206` accepts the requested breed, age, and sex and calls `createHorse` without a purchase debit, entitlement consumption, onboarding guard, or count limit. The model writes directly through the default Prisma client at `backend/modules/horses/services/horseModelService.mjs:195`. By comparison, the Horse Trader path charges 1,000 coins at `backend/modules/marketplace/controllers/marketplaceController.mjs:637-641`.

Reproduction: an ordinary `role=user` account with completed onboarding and zero coins submitted two `POST /api/v1/horses` requests, each with a distinct name, an existing Thoroughbred breed ID, `sex: "Mare"`, and `age: 3`. Both returned HTTP 201 and persisted horses. The wallet remained at zero. A player can repeatedly obtain breeding/sale stock through this route without using the paid acquisition path.

Fix direction: remove generic creation from the player API or restrict it to the intended privileged workflow. Player acquisition should require a server-owned entitlement or payment that is consumed in the same transaction as creation.

**3. [P1] The admin/system XP endpoint lets players award themselves XP and stat points**

Evidence: `backend/modules/horses/routes/horseXpRoutes.mjs:131-140` protects `/:id/award-xp` with ownership checks but no privileged-role check. `backend/modules/horses/controllers/horseXpController.mjs:340-371` accepts the caller's positive `amount` and arbitrary `reason`, then passes them to `addXpToHorse`. Owning the horse therefore grants authority to manufacture progression.

Reproduction: an ordinary `role=user` account called `POST /api/v1/horses/<owned-id>/award-xp` with `{"amount":1000,"reason":"audit fixture"}`. The response was HTTP 200. Real database values changed from `horseXp=0, availableStatPoints=0` to `horseXp=1000, availableStatPoints=10`, without training or competition.

Fix direction: remove the manual-award route from the player surface or place it behind the complete admin authorization policy. Gameplay XP should come from validated server events, with any event-replay protection enforced transactionally.

**4. [P1] A delayed purchase can take a relisted horse and pay the previous owner**

Evidence: `backend/modules/marketplace/controllers/marketplaceController.mjs:347-348` snapshots the seller and price, but the transfer predicate at `:362-365` checks only the horse ID, `forSale=true`, and that the current owner is not the buyer. It does not require the original seller, price, or listing version to still match. The subsequent debit and seller credit use the old snapshot. The local database reported `read committed` isolation.

Reproduction: seller A lists a horse for 100 coins. Buyer B begins buying and pauses after reading the listing. Buyer C buys it for 100 and relists it for 700. B resumes. C's purchase, C's relisting, and B's purchase all returned HTTP 200. B received the horse for 100; both sale records credited A. Starting balances `[A=0, B=1000, C=1000]` became `[A=200, B=900, C=900]`: C lost the horse and received no sale proceeds.

Fix direction: lock the listing/horse row before taking the authoritative seller/price snapshot, or use a conditional claim that binds the exact seller, price, and listing version. Reject stale requests before transferring ownership or moving funds. The existing simultaneous-buyer test passes because it does not include a completed purchase followed by relisting.

**5. [P1] Profile email changes retain verification and require no fresh authentication**

Evidence: `backend/modules/auth/controllers/profileController.mjs:263-269` immediately replaces `User.email` while leaving `emailVerified` and `emailVerifiedAt` unchanged. Its route in `backend/modules/auth/routes/authenticatedAuthRoutes.mjs` requires the current session and CSRF token, but no password, recent-authentication proof, or verification of the replacement address. The sibling user-update path explicitly resets verification at `backend/modules/users/controllers/userController.mjs:606-608`; the profile path bypasses that protection.

Reproduction: give a temporary account verified-email state, then submit `PUT /api/v1/auth/profile` with only a different `email`, using its existing session. The API returned HTTP 200; the email changed and both verification fields were retained. No password or email proof was supplied.

Failure scenario: someone with a stolen authenticated session can redirect the account's recovery email and, for an account without MFA, use password recovery to establish lasting access. Separately, a player can present an unverified replacement address as verified. Password-reset delivery to the current stored address was source-traced in `backend/modules/auth/controllers/passwordController.mjs`; recovery emails were not sent during this probe.

Fix direction: require fresh authentication for changing recovery identity, stage the replacement address until verified, and reset/invalidate verification state and outstanding identity-related tokens consistently across all update paths.

**6. [P1] A previous owner can clear the current owner's rider through a historical assignment**

Evidence: `backend/modules/riders/controllers/riderController.mjs:184-196` authorizes deletion using only the assignment's stored `userId`, accepts inactive assignments, and unconditionally clears the related horse's `rider` by horse ID. It never verifies current horse ownership or whether that assignment still supplies the horse's current rider. Marketplace transfers leave the old assignment records available.

Reproduction: A assigns a rider, sells the horse, and the final buyer B assigns B's own rider. B's assignment deactivates A's old assignment. A then calls `DELETE /api/v1/riders/assignments/<old-assignment-id>`. The API returned HTTP 200. The horse still belonged to B, but its rider changed from B's rider object to `null`. B's assignment row and the horse's rider representation are now inconsistent.

Fix direction: check current horse ownership and the active assignment identity inside the same transaction as unassignment. A historical or inactive assignment must not clear a replacement rider. Horse transfer should also reconcile seller-owned staff assignments.

**7. [P2] MFA-enabled accounts cannot complete login in the frontend**

Evidence: `frontend/src/pages/LoginPage.tsx:51-56` navigates after every successful login mutation without inspecting the response. `frontend/src/lib/api/auth.ts:38-44` models login as returning a user, while `backend/modules/auth/controllers/authController.mjs:312-329` returns `{mfaRequired: true, mfaChallengeToken}` and intentionally issues no session for MFA-enabled accounts. No MFA challenge handling or `/mfa/challenge` call exists in `frontend/src`.

Reproduction/evidence: the real login API returned HTTP 200 with `mfaRequired=true`, no user, and no access-token cookie for an MFA-enabled fixture. Source tracing shows this response reaches the ordinary success redirect. On a fresh browser session, protected routes still see no authenticated user, and the login page has no second-factor input or challenge submission path. An enrolled account therefore cannot finish browser login, even with valid credentials and its authenticator.

Fix direction: model the login response as a session-or-challenge union, retain the challenge token, collect a TOTP or recovery code, and call the challenge endpoint before entering the authenticated app.

**Verification results and limits**

| Check                                     | Result                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| `npm run typecheck`                       | Passed                                                |
| Selected backend regression suites        | 5 suites, 62 tests passed                             |
| Selected frontend regression suites       | 6 suites, 80 tests passed                             |
| `npm run lint`                            | Failed: 800 errors, 352 warnings across the root scan |
| `bash scripts/doctrine-checks/run-all.sh` | Failed: 1 of 40 checks; the other 39 passed           |
| Doctrine backend lint/format check        | Passed                                                |

The failing doctrine check is `check-design-system-ratchet.mjs`: eight exceptions in `docs/design-system/EXCEPTIONS.md:25-32` expired on 2026-09-01. This is recorded as a failing required gate, not a style/security finding. On Windows the successful gate invocation required an explicit Git Bash `/usr/bin` PATH; the initial environment-broken invocation ran zero checks and was not counted as a pass.

Backend suites run: `buyHorseConcurrentRace.integration.test.mjs`, `inventoryController.test.mjs`, `csrfPerUserBinding.test.mjs`, `mfaReplayProtection.test.mjs`, and `requestBodySecurity.test.mjs`, through the root backend project with `--runInBand`.

Frontend suites run: `api-client.test.ts`, `authSessionState.test.ts`, `useAuth.test.tsx`, `useSessionGuard.test.tsx`, `training.test.ts`, and `leaderboards.test.ts`, through `npm run test:frontend` with the configured two-worker limit.

The full test suites and Playwright beta-readiness gate were not run. Production deployment settings, distributed Redis behavior, and dependency vulnerability advisories were not independently validated. Passing selected regression suites does not cover the reproduced cases above.

**Implementation handoff for Claude Code — Fable**

Requested by the owner after the audit. This handoff explains how to implement and verify the seven findings above. The preceding audit is the dated evidence; the instructions below are proposed implementation work, not a claim that fixes exist. Use the current issue/task system for work status. Retire this handoff with the audit after the campaign is triaged and its work is transferred.

Fable, your job is to restore the security and gameplay guarantees described below. You have concrete reproductions to work from. Take one change through reproduction, implementation, and verification before expanding it. If a test result surprises you, follow the actual request and database writes until you can explain it.

**Start here**

1. Read `CLAUDE.md`, `AGENTS.md`, and the applicable path-scoped rules. For backend/test work, read `.claude/rules/CONTRIBUTING.md`. Read the audit above, then inspect the named live files; line numbers describe the audited revision and may move.
2. Check the current checkout and working-tree changes. The audited revision was `7b2376ec858d77321e830f966237200847bee509`. Existing owner changes include product/design files and local tooling. Preserve other people's work and accommodate changes made since the audit.
3. Map the seven finding numbers to the current task/issue system. Do not invent issue IDs, mark issues closed, or treat this Markdown file as a replacement backlog.
4. For each finding, write down the intended invariant and its request-to-database path before editing. Add a regression that demonstrates the original failure where practical, then implement the correction. As the implementer, add or update meaningful tests under the repository's test rules.
5. Use the live scripts and configurations identified by `AGENTS.md` for commands. Keep the configured worker and heap limits. Run backend, frontend, and E2E suites sequentially; `.claude/rules/CONTRIBUTING.md` explicitly forbids running those suites concurrently.

Suggested order: close the unrestricted creation and XP entry points, findings **2 and 3**; repair the shared-settings and transfer transactions, **1 and 4**; finish assignment ownership, **6**; then implement the identity-change and MFA flows, **5 and 7**. This order reduces easy abuse first and lets the rider correction build on the transfer transaction. Complete all seven; the order does not make the later security work optional.

Do not deploy, run migrations against an environment, rotate secrets, rewrite history, push, or close issues based only on this handoff. Those operations retain the owner's authorization requirements. Preparing reviewable code and a migration, if necessary, is different from applying that migration to an environment.

**The transaction detail to understand before coding**

A transaction makes its own writes commit or roll back together. At the observed PostgreSQL `read committed` isolation level, it does not automatically make an earlier read stay current.

For example, reading `{inventory: [...]}`, letting a bank claim add `lastWeeklyClaimDate`, and then writing the earlier object still deletes the claim marker. Wrapping only that final write in a transaction changes nothing. Reading inside an ordinary transaction without locking can still lose a concurrent update.

Use one of the mechanisms appropriate to the operation: an atomic update of the intended JSON path; a row lock acquired before reading the state used to decide the mutation; or a conditional write that checks the exact expected state/version and rejects a mismatch. Every dependent write must use the same `tx` client. Watch for helpers whose default argument silently falls back to global `prisma`.

Plan lock ordering across the affected flows. Inventory, staff assignment, horse sales, and financial helpers can all touch users and horses. Introducing a user-first lock in one path while another holds a horse lock and waits for that user can create a deadlock. Use a consistent ordering for shared resources, including a deterministic ordering when multiple rows of the same kind are locked. Keep network calls outside locked transactions.

Inspect `backend/utils/retryableTransaction.mjs` before relying on it: `withRetryableTxMapping` translates recognized transaction failures into an HTTP error; it does not rerun a transaction. Do not assume its name gives you retry or idempotency behavior.

**Finding 2 — Close free horse creation while preserving legitimate acquisition**

Start with `backend/modules/horses/routes/horseRoutes.mjs`, `services/createHorseService.mjs`, and `services/horseModelService.mjs`. Trace callers of `horsesApi.create` in `frontend/src/lib/api/horses.ts`. Compare the actual registration/onboarding implementation under `backend/modules/auth/` with `buyStoreHorse` in the marketplace controller.

The distinction you must enforce is between a trusted server workflow creating a horse and a player requesting arbitrary new assets. The generic model function is useful to registration, paid purchases, and foaling. Removing that function wholesale would break legitimate gameplay.

Implementation steps:

1. Identify every live caller of the generic HTTP creation endpoint. An exported client helper or an old test is not proof that players are entitled to unrestricted creation.
2. If there is no legitimate player use, remove or restrict the HTTP entry point. If privileged creation is genuinely needed, use the complete existing admin security policy, including the applicable MFA and CSRF protections. Do not add a new admin feature merely to preserve a legacy route.
3. Route real player acquisition through its existing server-controlled workflow. Preserve the current Horse Trader price and starter-horse rules. Do not invent a new price, starter allowance, or development bypass.
4. Make the changed acquisition mutation atomic: payment or entitlement consumption, horse creation, required initialization, and dependent ledger writes must share the transaction. Pass `tx` through the involved model/helper calls.
5. Update affected consumers and contracts. If old tests obtained fixtures through the now-forbidden player endpoint, use the established scoped fixture helpers for setup and retain explicit tests of the new authorization contract. Do not turn all users in those tests into admins.

Required evidence:

- A normal player with zero coins cannot reproduce the two free HTTP 201 creations; horse count, balance, and dependent state stay unchanged on rejection.
- Supplying `userId`, a role field, a starter-like name, or incomplete-onboarding state does not recreate the bypass.
- Actual registration/onboarding still provides its intended starter horse and customization flow.
- A real paid Horse Trader purchase still charges the existing amount once and creates one horse. Insufficient funds and a failed dependent write leave no partial purchase.
- Legitimate foaling and internal model callers remain functional.

**Finding 3 — Make XP awards server-authoritative**

Start with `backend/modules/horses/routes/horseXpRoutes.mjs`, `controllers/horseXpController.mjs`, and `services/horseXpModelService.mjs`. Check `frontend/src/lib/api/xp.ts` and `frontend/src/hooks/api/useAddXp.ts` and their live consumers.

The current ownership guard answers whether the player owns this horse. It does not answer whether the player may manufacture rewards. The reproduced request grants 1,000 XP and ten stat points just because the caller supplies those numbers.

Implementation steps:

1. Remove manual XP awards from the ordinary player API, or apply the complete existing privileged-route policy if manual grants have a real supported admin use. Keep ordinary XP reads and earned-stat allocation available to their rightful owners.
2. Trace legitimate training and competition awards. Those workflows should calculate the amount from server state and call the internal XP service. A frontend request naming a reward or claiming an event occurred must not become proof of that event.
3. If an administrative award remains, validate finite positive integer amounts against the schema and the approved contract, and record the acting identity and reason. An arbitrary low cap or stronger rate limit does not fix missing authorization.
4. Preserve the atomic relationship between XP, earned stat points, and their history. Inspect the existing atomicity tests before changing that service.

Required evidence:

- The audited `amount: 1000` request is rejected for `role=user`, even on an owned horse; XP, stat points, and history do not change.
- Anonymous and cross-owner attempts remain rejected, and client-supplied role/reason strings grant no authority.
- Real training/competition rewards still occur with their existing calculation and repetition/cooldown rules.
- Players can still spend legitimately earned stat points, and concurrent allocation cannot overspend them.

Useful existing tests include `horseXpController.test.mjs`, `horseXpIntegration.test.mjs`, and `addXpToHorseAtomicity.integration.test.mjs` under the horses module. Inspect their assertions and setup before selecting or updating them.

**Finding 1 — Preserve economy state during inventory and settings changes**

Start with `backend/modules/economy/inventory/controllers/inventoryController.mjs` and `backend/modules/bank/controllers/bankController.mjs`. Inspect the financial ledger helpers and every reachable writer that replaces `User.settings` from a prior read. Concrete adjacent places to inspect are the auth profile controller, user-update controller, onboarding controller, and inventory read-time initialization. These are locations to verify; the executed exploit specifically used equip.

Implementation steps:

1. Put equip and unequip ownership checks, inventory decisions, previous-horse changes, target-horse changes, and persisted item placement inside a coherent transaction.
2. Read authoritative item/horse state after acquiring the locks required by your chosen ordering. A `req.horse` populated by earlier middleware can support an initial check, but is not sufficient proof of current ownership at commit time.
3. Persist only the intended settings paths, or use a locked current document for a necessary read/modify/write. Preserve bank markers, materials, onboarding state, preferences, and other unrelated keys.
4. Close the same stale-document overwrite mechanism in the reachable sibling writers. Fixing only equip leaves the bank marker vulnerable to another settings endpoint.
5. Check the inventory GET fallback: it currently seeds inventory from tack and writes settings. If that mutation remains necessary, it needs the same concurrency guarantees; an ordinary read should not silently undo a completed claim.
6. Avoid an inventory-schema redesign unless current constraints make it necessary. A focused transactional correction is sufficient if it proves all the invariants.

Required evidence:

- Exercise equip and a weekly claim concurrently. Across valid interleavings, the marker survives, exactly one weekly credit is recorded, and a second claim is rejected. Starting from zero, the final balance is 5,000, not 10,000.
- Exercise the repaired sibling settings writers against the same marker and verify unrelated JSON fields survive.
- Two concurrent attempts to equip one item to different horses cannot leave it on both horses. Inventory placement and horse tack agree after completion.
- A failure in a required dependent write rolls back the whole equip/unequip operation.
- A horse transfer occurring during an inventory request cannot allow its former owner to mutate the new owner's tack.

Use the existing `inventoryController.test.mjs` and bank tests as starting points. This regression needs real shared database state and assertions about money, the marker, item placement, and ledger effects. A test that only checks HTTP 200 misses the failure.

**Finding 4 — Bind a purchase to the listing it actually buys**

Start with `buyHorse`, `listHorse`, and `delistHorse` in `backend/modules/marketplace/controllers/marketplaceController.mjs`. The failing predicate is `userId: { not: buyerId }`. It accepts a different seller after an intervening purchase and relisting, then pays the seller captured before that change.

Implementation steps:

1. Choose the concurrency mechanism explicitly. A row lock before the authoritative seller/price read can serialize listing operations. A conditional claim can instead compare the exact expected owner, price, sale state, and appropriate listing identity/version. Do not assume the horse's general `updatedAt` is a dedicated listing version.
2. Derive the transfer, debit, seller credit, sale record, and both ledger entries from that same validated listing state, within one transaction. Keep the conditional sufficient-funds debit.
3. Preserve a clear stale-listing/conflict response. Never catch a failed claim and continue with an old seller or price. Never silently charge a newly increased price as an incidental retry of an old listing request.
4. Check list and delist against the same protocol, then coordinate the staff reconciliation described in finding 6.
5. Keep post-commit notifications outside the financial transaction. Do not announce an uncommitted sale, or make notification delivery itself a prerequisite for committing the transfer.

Required evidence:

- Reproduce A lists at 100; B starts; C buys and relists at 700; B resumes. B must never receive the relisted horse for 100 while A receives C's sale proceeds.
- Account for the chosen mechanism in the test. With a conditional claim, C may complete first and B should conflict without side effects. With an early row lock, B may complete first while C waits and subsequently fails. Both can be correct; the ownership and ledger must describe the actual successful sale.
- Test delist/relist with a price change, multiple buyers, insufficient funds, and concurrent spending by one buyer.
- Assert final owner, all involved balances, sale-record seller/buyer/price, and ledger entries. Check rollback if a required write fails.

The existing `buyHorseConcurrentRace.integration.test.mjs` passed during the audit. Keep its protection and add the intervening-sale/relist case; simultaneous buyers of one unchanged listing do not exercise this bug.

**Finding 6 — Authorize rider changes against the horse's current owner**

Start with `backend/modules/riders/controllers/riderController.mjs`, the rider routes, the `RiderAssignment` schema, and the repaired marketplace transfer. Inspect assign, unassign, dismiss, and retirement paths where they update the same representations.

Implementation steps:

1. Authorize against both the assignment and the horse's current owner inside the transaction. Ownership of a historical assignment must never authorize modifying someone else's horse.
2. Confirm that the assignment being deactivated is the current active assignment before changing `horse.rider`. If a request names an already-inactive record, preserve any replacement rider. Follow the established unavailable-resource/idempotency response convention.
3. Commit assignment status and horse rider state together. A request must not successfully update one representation and leave the other stale.
4. In the sale transaction, reconcile seller-owned active staff associations according to the current product contract. Preserve useful history, and do not transfer the seller's separately hired staff to the buyer accidentally. Inspect equivalent associations only as needed to complete the horse-transfer invariant.
5. Use the same locking protocol in assignment and transfer paths so the ownership check cannot become stale before the horse update.

Required evidence:

- A assigns a rider, sells the horse, B assigns a replacement, then A deletes the old assignment ID. B's rider and active assignment survive unchanged.
- Repeating deletion of an old assignment after a replacement by the same owner also preserves the replacement.
- Legitimate unassignment still clears both representations correctly.
- Concurrent assignment/unassignment/transfer yields a consistent final state. Failure rolls back both representations.

Start with `riderController.integration.test.mjs` and the marketplace regressions. Assert the horse's rider object and the relevant assignment rows, not just the response.

**Finding 5 — Treat email changes as changes to account recovery identity**

Start with `backend/modules/auth/controllers/profileController.mjs`, its authenticated routes, `backend/modules/users/controllers/userController.mjs`, `backend/utils/emailVerificationService.mjs`, and the password-reset controller. Inventory all player-accessible ways to write the email field so a sibling route cannot bypass the corrected policy.

Two protections are needed: a stolen session alone must not replace the recovery address, and proof of ownership of one email address must not verify another address. Merely resetting `emailVerified` does not close session-to-recovery takeover.

Implementation steps:

1. Define the smallest concrete request/confirmation flow using existing account infrastructure. Require fresh authentication appropriate to the account before accepting a recovery-address change. Keep username, bio, and ordinary preference edits usable without unnecessarily requiring that proof.
2. Prefer staging a pending replacement while the currently confirmed recovery identity remains active. Bind confirmation to the account, exact normalized destination address, and this pending change. Check uniqueness and account state again at commit time.
3. Normalize and validate email consistently with the existing signup/login behavior. Do not invent provider-specific normalization rules.
4. Fix both update surfaces through shared policy. The sibling user controller resets flags today but must not remain an alternate path around fresh authentication or pending-address confirmation.
5. Inspect token consumption carefully. `verifyEmailToken` currently updates verification by `tokenRecord.userId`; it must not let a token for a previous address or an ordinary signup-verification token authorize an unrelated pending change. Enforce purpose/address binding and one-time consumption transactionally.
6. Revoke obsolete verification and password-reset proofs as the identity transitions. Define what happens to pending changes and sessions using the existing security policy. Keep tokens hashed at rest and secret values out of logs/responses except where the established delivery protocol requires them.
7. Reuse the established email delivery boundary. Do not hold database locks while sending email. Report delivery failure honestly and preserve a coherent pending state that can be retried safely.

If additional persistence is required, prepare a minimal reviewed schema/migration change and follow the migration instructions in `CLAUDE.md`; do not apply it to an environment without the required authorization. Preserve existing accounts and token data safely.

Required evidence:

- Both ordinary update routes reject a changed recovery email when only the existing session is supplied; the stored identity and verification state remain unchanged.
- A wrong password or invalid fresh-authentication proof cannot initiate the change; a legitimate request can complete the intended confirmation flow.
- Before confirmation, password recovery still targets the existing confirmed identity. After a successful change, it targets the confirmed replacement.
- Tokens for the old address, a superseded pending address, another account, the wrong purpose, an expired token, or an already-consumed token cannot verify the replacement.
- Concurrent confirmations and duplicate-address conflicts leave one coherent identity with no partial token/state updates.
- A no-op request using the same email does not reset verification unnecessarily; non-identity profile updates still work.

Use real database-backed token and account behavior. Isolate outbound delivery only at the third-party boundary permitted by `CLAUDE.md`. Do not fabricate a successful verification response as proof of the flow.

**Finding 7 — Finish MFA login before entering the game**

Start with `frontend/src/pages/LoginPage.tsx`, `frontend/src/hooks/useAuth.ts`, `frontend/src/lib/api/auth.ts`, `frontend/src/lib/http/apiClient.ts`, and `frontend/src/lib/authSessionState.ts`. Trace the real MFA challenge controller and `issueAuthenticatedSession` on the backend.

Implementation steps:

1. Model login as two distinct response shapes: a completed authenticated session or an MFA challenge. Use a discriminated TypeScript union and an explicit branch; do not cast a challenge into a user response.
2. On a challenge response, retain the challenge token only in transient memory, show the second-factor form, and stay on the login surface. Do not mark the profile authenticated or navigate to a protected destination yet.
3. Add the API call for the existing `/api/v1/auth/mfa/challenge` contract. Submit `mfaChallengeToken` with either the TOTP `token` or a `recoveryCode`. Keep TOTP input as a string so leading zeroes survive.
4. Inspect the shared client's generic HTTP 401 refresh logic. An incorrect second factor is an authentication error, and blindly trying to refresh a nonexistent session can replace the useful error with “Session expired.” Handle this narrowly for authentication operations while preserving legitimate protected-request refresh/retry behavior.
5. After successful challenge completion, use the same session-finalization behavior as normal login: accept the server's cookies, seed the newly user-bound CSRF token, refresh the profile, and apply the existing safe redirect. The first authenticated mutation must work.
6. Handle incorrect codes, expired/revoked challenges, lockout/rate limits, network errors, duplicate submission, and returning to the credentials form. Clear the previous challenge when switching accounts or restarting login. Do not keep passwords or challenge tokens in local storage, URLs, or logs.
7. Keep feedback inline and accessible. Provide labels, keyboard/focus behavior, a pending state, and an understandable recovery-code option. Do not expose raw tokens or internal implementation terms to players.

Before player-facing edits, read `PRODUCT.md`, `DESIGN.md`, and `GAME_UI_ART_DIRECTION.md` and satisfy their visual-change requirements. Use the existing login surface for the smallest coherent addition. Load the async-state doctrine for feedback behavior; do not add Sonner calls, Radix/shadcn dependencies, a new generic shell, or an unrelated authentication-page redesign. Existing imports are not approval for new ones.

Required evidence:

- In a fresh browser session, a real MFA-enabled account enters correct credentials, sees the second-factor step, completes it with a real TOTP, reaches its permitted destination, and performs an authenticated mutation with real CSRF.
- A recovery code completes login and cannot be reused. Incorrect, expired, and rate-limited attempts stay in an honest unauthenticated state with useful local feedback.
- Challenge response alone never navigates into the authenticated app. Non-MFA login remains functional.
- A malicious redirect target still falls back safely. Refreshing or leaving an incomplete challenge does not authenticate the user.

The audit only source-traced the frontend failure and reproduced its API response. Supply the missing real browser evidence. `LoginPage.test.tsx` and auth-hook tests can help locate existing expectations, but their legacy mocked paths are not substitutes for a Playwright flow through the real backend and database.

**How to make the concurrency regressions trustworthy**

Use uniquely identified fixture users and horses with explicit cleanup in dependency order. The local test configuration used the `equoria` database, so inspect the actual connection target before running tests; do not assume a name containing “test” or use broad cleanup.

Coordinate the important interleaving with real database locks/barriers or an established test harness that delays execution without replacing query results. Do not add production bypass headers, fake Prisma returns, primary-API route interception, or sleep-based tests that merely hope the race occurs. Keep any coordination bounded, and release barriers in `finally`.

Design the test so a correct lock-based implementation can finish. If the fixed purchase holds a row lock, waiting for a competing purchase to finish before releasing the first request would deadlock the test itself. Assert allowed serialization outcomes and the forbidden final states. Verify rollback and persisted invariants after all requests settle.

**Validation and delivery**

The pre-fix baseline is above: type checking passed; the selected backend and frontend suites passed; root lint reported 800 errors and 352 warnings; the doctrine run passed 39 of 40 checks. Its failure was eight expired design exceptions. These are dated results, not permission to ignore today's failures.

Run the smallest relevant regression set after each fix. At the end, run the required type, lint, doctrine, and affected broader tests from the live package/configuration sources. Run the real beta-readiness/browser coverage appropriate to the MFA flow and changed acquisition/security contracts, following `docs/testing/BETA_PROFILE.md`. Preserve the serial/two-worker resource rules.

Classify every failure. Repair failures introduced by these changes. For existing unrelated failures, retain exact evidence and identify the separate work needed; do not expand this security task into an unapproved chart/UI rewrite. Do not renew expired exceptions, move a baseline, relax assertions, skip tests, or silence checks just to obtain a green report. If a required gate remains red, say so and do not claim repository-wide readiness.

For each finding claimed fixed, supply an evidence block in the task/PR response with:

- Finding number and the concrete player/security failure it addresses.
- Changed files and the new authoritative check or transaction boundary.
- The reproduction/regression and why it detects the old defect.
- Actual verification invocation, result, and relevant persisted-state assertions.
- Remaining limitations, migration requirements, and broader-gate status.

For a permissions change, prove both the rejected player request and the legitimate retained workflow. For a race fix, show balances, ownership, markers, assignments, and history as relevant. For MFA, show the real browser-to-session-to-first-mutation flow. Never claim “all tests pass” when only selected suites ran.

Keep the audit's original evidence intact. Update implementation status through the current task/issue system and report all seven outcomes to the owner. Any unresolved finding needs a precise reason and next step. Do not close issues or mark this audit approved yourself; leave the reviewable implementation and evidence ready for the owner's next review.

AUDIT: CONCERNS

**2026-09-14 — Fable 5.1 implementation handoff: backend memory retention and repeated pre-push runs**

Requested by the owner. This section is a proposed implementation plan, not a claim that the leak has been reproduced or fixed today. It supplements the earlier, unrelated audit without changing its evidence. Load this section when implementing `Equoria-bu9c4`, `Equoria-k09r9`, and `Equoria-fusxf`; use those issues for execution status. Retire this handoff when the owner accepts the implementation and its evidence.

Inspection baseline: `c25d3dfea4778f3c12b57a770bf8b94165418c47`, plus the existing working tree. Installed locally: Node `v24.19.0`, V8 `13.6.233.17-node.51`, backend Jest/jest-runtime `30.4.2`, root jest-environment-node `30.4.1`, Prisma Client `6.8.2`. Backend lockfile also records Jest `30.4.2`. CI requests Node `22.x` at `.github/workflows/test.yml:40`. Resolve the actual environment package from the backend before experimentation; a root dependency inventory alone does not establish backend resolution. Record the exact CI patch version when collecting CI evidence.

Codex read the supplied `HANDOFF-prepush-gate.md`, the four issue records and the `Equoria-y8yrm` measurement comments, current runner/configuration/lifecycle/application source, and relevant official documentation. No Jest suites, migrations, application changes, or test changes were made for this plan. No active matching Jest/sharded-runner processes appeared in the single process snapshot taken during inspection. This is not proof that other sessions cannot start one later.

**1. Your assignment and what completion means**

Fable: determine what keeps memory alive after a test file finishes, remove the responsible retention where possible, and stop the test/push workflow from paying for the same avoidable contention repeatedly. Keep the real application and real PostgreSQL coverage intact. A faster green run does not by itself prove that memory retention is fixed.

Keep three outcomes separate throughout the work:

| Outcome                                 | Required evidence                                                                                                                                                          |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Memory cause identified and fixed       | A small failing reproduction, a concrete retaining path or lifecycle defect, and a comparable post-teardown/post-GC measurement that loses that growth after the fix.      |
| Resource use and gate duration improved | A complete passing run with unchanged suite coverage, measured wall time, combined process RSS, and connection counts within the accepted envelope.                        |
| Push contention handled                 | A bounded local Git concurrency test showing stale work is rejected before expensive validation and locally cooperating pushes cannot race through validation/publication. |

Do not close the memory issue merely because process recycling makes it survivable. If an upstream defect remains, document the minimal reproduction and call any recycling or isolation change containment. Leave the unresolved issue open for the owner.

**2. Corrections to the Opus handoff that must guide implementation**

1. The historical OOM is evidence of unreclaimed memory in that run, not identification of its retaining owner. A final GC that recovers little cannot distinguish a Node/V8 defect from an application listener, timer, native client, reporter, cached closure, or VM-global reference. In the currently installed `backend/node_modules/jest-runtime/build/index.js:2356`, `clearForReset()` explicitly clears `esModuleRegistry`; `resetModules()` invokes it at line 3775, and teardown clears registries at line 3827. Clearing a Map does not guarantee collection of everything it once referenced, but “Jest never clears its registry” is not an adequate diagnosis of this version. Do not edit node_modules as the fix.
2. The fast historical runs were not passing equivalents of today's gate. The original `Equoria-y8yrm` comment records 864 suites: 545 seconds with three failing suites, then 570 seconds with one failing suite. Both exited 1; both recycled workers about 58 times. The handoff's rounded suite/RSS figures differ from that original record. Treat this as evidence that parallel execution may be faster, not a proven correct profile, and do not extrapolate its time to today's larger suite.
3. The referenced comment does not actually include the full ordered 45-file manifest, the exact 21 completed paths, runtime versions, or raw profiling command. It describes a 45-file prefix of a prior two-worker completion order. Recover those artifacts if available; otherwise create and freeze a new baseline and label it new. Never invent the missing list or claim an identical historical comparison.
4. Per-file Prisma cleanup already exists. `backend/tests/config/PrismaCleanupEnvironment.mjs:8` drains registered clients and then calls the Node environment teardown. `packages/database/prismaClient.mjs:109` stores the extended client on the VM global and line 129 registers it. `packages/database/prismaTestLifecycle.mjs:75` disconnects and removes successful entries. This was introduced before the August measurement. Inspect whether anything escapes this lifecycle; do not add another setup-level `afterAll($disconnect)` that runs before suite-owned cleanup and recreates the old connection leak.
5. Global setup is itself a concurrency hazard. `backend/tests/globalSetup.mjs:35` imports the default client and lines 50, 83, 109, 139 and 162 delete known shared fixture patterns. A second Jest invocation using the same database can delete fixtures while the first is using them. Fixture uniqueness inside individual tests alone does not solve this. Every shard invocation executes its own global setup.
6. Neither shared bootstrap nor schemas are a free fix. Ordinary Jest globals created in globalSetup cannot be retrieved by test suites, and normal module imports do not share one live app across separate test environments. See the [Jest globalSetup contract](https://jestjs.io/docs/30.4/configuration#globalsetup-string). A host-process app bridge introduces state and realm concerns; an external HTTP service is a different test architecture. Do not implement either as a quick cache.
7. Eight serial shards at a 4096 MiB V8 old-space cap are a specific local exception, not permission for two 4096 MiB processes. The local regular profile uses 1536 MiB and two workers; CI overrides with 4096 MiB and 1500 MB recycling. The heap flag does not cap RSS or the sum of parent, workers, native allocations and child processes. `workerIdleMemoryLimit` acts between files; it cannot rescue a file that alone exceeds its heap cap.
8. The historical slope is not a suite-wide sizing law. Extrapolating 68.3 MB/file to approximately 110 files per shard would exceed even 4096 MB, while the handoff reports those shards passing. Different ordering, post-GC timing, retained versus transient allocations, runtime changes and workload mix need measurement. Do not use one prefix to assert exact safe shard sizes.

**3. Working rules that prevent another expensive loop**

Use one implementation owner and one running test experiment at a time. Do not launch frontend/E2E tests alongside backend diagnostics. Keep the current dirty working tree intact. Do not stop processes from other sessions, reset their files, regenerate a shared Prisma client, or install dependencies into junctioned node_modules. If using a worktree, verify dependency resolution, environment availability and nonzero test discovery before executing any suites.

Before each run, write four short items to the issue or the task: hypothesis, one changed variable, expected distinguishing result, and stop condition. Example: “Hypothesis: obsolete VM-global objects retain the app. Variable: globalsCleanup soft versus on. Evidence: lower post-GC growth with the same ordered files and PID. Stop: 120 seconds or the diagnostic RSS limit.” If you cannot say what new evidence a run can provide, do not run it.

Use these proposed diagnostic limits; they narrow the existing resource allowances:

| Stage                 | Initial scope                                 | Limit and next action                                                                                                                                                        |
| --------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery             | Config/manifest only                          | 30 seconds; unexpected resolution or zero suites is an infrastructure failure.                                                                                               |
| Micro-reproduction    | 3–6 explicit files                            | 120 seconds per attempt, one test process, 1536 MiB old-space ceiling. Stop and shrink the probe if it cannot finish.                                                        |
| Confirmation          | Fixed 21-file manifest, then 45 only if safe  | 300 seconds per attempt; check growth before extending. An incomplete run is a failing/censored sample, never a pass.                                                        |
| Focused regressions   | Changed lifecycle, runner and collision cases | Explicit file list, five-minute initial cap; isolate a slow/failing file before another attempt.                                                                             |
| Final full validation | All discovered canonical backend suites       | Only after earlier acceptance criteria pass. One planned run on the final candidate. A further full run requires changed code or an unresolved hypothesis with new evidence. |

For small probes, have an external supervisor sample combined owned-process RSS and available system memory. Use approximately 2 GiB combined RSS as the conservative historical local target; stop the diagnostic tree if it exceeds that target or approaches paging. Distinguish this new probe cutoff from the existing 4096 MiB serial-gate exception. Do not raise limits to obtain a sample. Heap snapshots add substantial temporary memory: capture them on the reduced reproduction at early checkpoints, never automatically at the 1536 MiB OOM boundary.

The supervisor must own its child PID/process tree, write bounded logs to a task-specific directory outside the repository, and terminate only that tree on deadline/cancellation. Verify descendants have exited. On Windows use one shell end-to-end and validate any temporary cleanup paths. Do not broadly kill every node.exe or every command containing “jest.” Existing `posttest` reaping applies to `npm test`; it does not prove cleanup for `test:backend:full` or an interrupted custom runner. Read the existing reaper before invoking it in a shared session.

Do not rerun a full suite after a non-fast-forward rejection during diagnosis. Stop the publication loop and finish the implementation and evidence locally. Do not push, force-push, disable hooks, or close issues unless the owner has authorized that action in the implementing session.

**4. Phase A — establish a trustworthy small measurement**

Read the live backend config, package profiles, custom environment, setup/global setup/teardown, Prisma wrapper/lifecycle/pool configuration and the existing lifecycle sentinel. Consult `.claude/rules/CONTRIBUTING.md` and `docs/devops-cicd.md` for the matching implementation work. Start from the source paths in this handoff; do not preload the documentation tree.

Record commit, dirty-file hashes for relevant inputs, executable path, exact Node/V8/Jest/environment/Prisma versions, backend-resolved module paths, sanitized database identity, coverage mode and selected files. Never print credentials or entire environment files. Compare the actual installed packages to their lockfiles before interpreting results.

Recover the historical manifest from the old profiling scratchpad if possible. Timebox that search to five minutes. If it is absent, construct a new ordered manifest that includes the following verified current paths plus representative small suites:

- `backend/modules/horses/__tests__/createFoalValidation.integration.test.mjs`
- `backend/modules/grooms/__tests__/groomBonusTraits.test.mjs`
- `backend/modules/horses/__tests__/foalCreationIntegration.test.mjs`
- `backend/modules/auth/__tests__/forgotPasswordTimingOracle.integration.test.mjs`
- `backend/tests/integration/health-monitoring-integration.test.mjs`

Use an explicit diagnostic sequencer to honor that manifest. Passing paths with `--runTestsByPath` selects tests but does not establish execution order; verify the emitted completion order. Avoid feeding two-worker completion order back in as if it were deterministic. Keep backend rootDir, aliases and real lifecycle hooks; diagnostic config must extend the backend config without accidentally widening discovery or removing security setup.

Implement a small supervised launcher/reporter under the existing backend script ownership if it will be retained, after checking the repository map. Use ESM and argument arrays with an explicit backend cwd/config. It must record monotonically timed rows containing file index/path, actual PID, post-suite heap used, external/array-buffer memory where available, combined RSS samples, elapsed time and result counts. Include worker restarts in the data. Stream output to files; do not retain every log line or test result object in a long-lived array.

Use Node's `--expose-gc` and Jest's `--logHeapUsage` for the comparable serial probe, but verify where the installed runner samples relative to environment teardown. If the normal measurement is too early, add bounded diagnostic instrumentation after teardown and an event-loop turn; keep it out of the product runtime. A setup afterAll heap measurement alone can still include a live test environment. Keep the same instrumentation in the before and after runs. Cross-check reporter overhead with a short uninstrumented control.

Measure a warmup separately, then compare the same subsequent files. Report raw checkpoint values and the total change over that interval, not just one mean delta. If a sample OOMs or times out, keep its last checkpoint and mark it incomplete. Do not intentionally reproduce the full 21-file OOM when three to six files already distinguish the failure.

Deliverable before Phase B: a reproducible small command/manifest and data showing either continued growth after teardown/GC, connection growth, or a different concrete bottleneck. If the historical leak is absent now, record that result and investigate current time by startup, test execution, teardown, GC and database waiting; do not “fix” a vanished historical defect.

**5. Phase B — identify the retaining owner, one experiment at a time**

Begin with the smallest causal layers. These are real executions, not mocked replacements for the acceptance suite:

| Probe                                                        | What it distinguishes                                                                                             |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Minimal ESM files with no Equoria imports                    | Baseline test-runtime/VM retention. A stripped diagnostic config here is only a control, never coverage evidence. |
| The same small-file pattern with canonical setup/environment | Additional cost of configuration, validation, MIME handling and lifecycle scaffolding.                            |
| Real Prisma wrapper, a real query, registered cleanup        | Prisma client/native engine/VM-global retention and pool cleanup.                                                 |
| Actual app import without an HTTP request                    | Import graph and app-construction side effects.                                                                   |
| Actual app plus real authenticated request/fixture cleanup   | Request resources, audit writes, timers, sockets and test-owned objects.                                          |

Start with only the rows necessary to isolate the observed jump. Use actual separate test files when studying per-file behavior; repeatedly importing a cached module inside one test does not reproduce separate VM creation. Do not append unique query strings to imports as a supposed fix: that deliberately creates new module identities.

The first small configuration candidate is `testEnvironmentOptions: { globalsCleanup: 'on' }`, preserving any other options and the custom Prisma environment. The installed Node environment recognizes it and defaults to soft mode; backend config does not currently set it. Jest documents that soft mode preserves global object properties, whereas on mode removes them after the file. Its mode is set by the first environment in a worker, so compare fresh processes and a config-level option, not mixed per-file annotations. Treat this as a hypothesis, and test lifecycle correctness as well as memory. See [Jest 30.4 globals cleanup](https://jestjs.io/docs/30.4/configuration#testenvironmentoptions-object).

If this materially improves memory, inspect what it released and confirm suite cleanup still completes before globals are invalidated. A warning disappearing is not proof. Never choose globalsCleanup off to silence evidence, never suppress JEST-01 warnings as the fix, and do not broadly delete globals manually.

If retention remains, capture two early heap snapshots from the reduced case and inspect increasing retained size/dominators and paths to GC roots. Identify which root owns the obsolete environment: process/native listener, timer callback, reporter collection, module loader reference, native client, or explicit global. Snapshot analysis needs a named retaining chain; a list of large objects is insufficient. If heap flattens but RSS grows, examine native/external memory and connection counts rather than claiming the JS heap explains everything.

Inspect the existing Prisma registry before changing it: successful disconnect removes registry entries, but the VM still has `__prisma`. That is a candidate reference to measure, not proof of a leak. Verify all independently created Prisma clients register or explicitly disconnect. Preserve suite-owned afterAll access and transaction behavior. Do not import another generated Prisma client copy to “share” a client across realms; the wrapper already documents a transaction-integrity failure from that approach.

Inspect actual app dependencies according to the retaining path. One useful bounded import-cost probe is `backend/config/sentry.mjs:17–18`: both Sentry packages import before the no-DSN return at line 30. Avoiding initialization does not avoid that graph's import cost. Determine whether the cost persists after GC before proposing lazy loading. Likewise inspect timers, process listeners, Redis, logger transports, resource management and app caches only where the evidence points. A full app factory that imports the same eager graph may save no memory.

If Equoria's minimal ESM-free control is stable but the minimal native-ESM control grows, compare the reproduction on the exact local runtime and a supported Node 22 patch matching CI, sequentially. Check official release notes for a narrowly relevant Node/Jest patch; test it in an isolated dependency installation. Do not perform a wholesale framework migration or major upgrade. [Jest issue 14605](https://github.com/jestjs/jest/issues/14605) tracks an upstream ESM leak, but its existence does not prove this installation has that same cause.

After three experiments that do not distinguish causes, reduce the reproduction further and inspect retaining paths. Do not respond by launching the full gate. Stop exploring a candidate once evidence rejects it.

**6. Phase C — implement the smallest demonstrated fix**

Choose only the branch justified by Phase B:

- **Global lifetime defect:** enable supported cleanup or release the specific owned reference after all suite cleanup. Keep failures observable and cleanup ordered. Extend the real lifecycle sentinel to prove a final suite hook can still query, then the client/owned resources are released.
- **Import/resource lifecycle defect:** move expensive optional initialization behind its existing real enablement condition, or give a resource explicit initialization/disposal. Keep production behavior and the full HTTP middleware/router chain intact. Verify both enabled and disabled paths; retain genuine integration coverage for any optional service boundary changed.
- **Reporter/instrumentation defect:** stop retaining complete suite objects/closures, stream scalar metrics, and verify the measurement apparatus itself remains bounded.
- **Dependency defect:** use a specifically justified supported patch with manifest/lockfile consistency and compatibility evidence. If no supported fix exists, preserve the minimal reproduction and root-cause evidence. Keep containment visibly separate from resolution.

Do not remove resetModules/resetMocks/restoreMocks/clearMocks just to reduce allocations; current doctrine requires them. Do not replace the app with a reduced test-only router that omits auth, ownership, CSRF, request validation or audit behavior. Do not share mutable fixtures, rate-limit state, mocks or transactions across test files as a shortcut.

Prove causality with a small red/green experiment: the old implementation fails the chosen memory/lifecycle contract; the proposed implementation passes; reverting the causal change restores failure. Prefer a stable resource-ownership sentinel plus a supervised memory trend check over a fragile exact-byte assertion. Restore every deliberate defect immediately and verify the final working tree contains only intended edits.

Suggested memory acceptance target: on the fixed manifest, at least 80% less warmup-adjusted growth than the new baseline, with no restart masking the comparison. This is a triage target, not sufficient proof of collection. Extend to 45 files and approximately a current shard's workload only after the smaller result is safe. Growth must stop behaving proportionally to completed files and leave practical headroom for a complete run. If the slope remains materially positive, report remaining retention even if the target is met.

**7. Phase D — isolate parallel execution only if it is still needed**

First measure whether the leak fix alone makes the serial gate acceptable. Parallelism is a separate implementation track, not a prerequisite for identifying the leak. If worthwhile, my recommended starting architecture is two bounded serial lanes, each owning one disposable database, with a run UUID in both identities. This fits the existing fresh-process runner better than immediately depending on Jest's worker scheduling/recycling lifecycle. Reuse fresh batches only if memory evidence still requires them; describe that honestly as containment.

Separate databases are the conservative default for the initial prototype. Schemas remain an option, but they require proof for all access paths and do not isolate database-wide advisory locks. Equoria uses `pg_advisory_xact_lock` in `backend/modules/grooms/services/groomEngagementService.mjs:147`; identical fixture IDs/keys in different schemas can still contend. A schema-only design must explain that behavior without weakening application locking. Investigate Redis keys, fixed ports, filesystem outputs, cron/distributed-lock names and hardcoded URLs too: DB isolation does not isolate those resources.

Follow this implementation sequence:

1. Build one explicit run manifest containing run ID, allowed local test server, owned database/lane names, bootstrap fingerprint and child ownership. Refuse missing/ambiguous ownership. `JEST_WORKER_ID` alone is not unique across runs and is `1` for serial Jest invocations. Never let two lanes silently fall back to the same default URL.
2. Provision a fresh disposable target from migrations and canonical seeds. Verify migration checksums and the fixture prerequisites, including the complete breed roster used by current tests. Do not copy the shared application's data, fabricate migration history, or use db push to erase a migration discrepancy. Benchmark creation/migration/seeding separately. Optimize with a clean, connection-free, fingerprinted template only after fresh provisioning works; include schema, seed code/data and dependency versions in invalidation.
3. Set the lane's database URL in its process environment before invoking Jest, so even globalSetup sees that target before its first Prisma import. Pass it to every spawned child. Existing dotenv calls are non-overriding; verify this with a real mismatch sentinel. Health/preflight/migration/seed utilities must inspect that same target rather than independently reloading the shared .env.test database.
4. If choosing schemas, configure Prisma's URL `schema` parameter, and configure raw pg connections separately for their own search path. Never rely on a one-off SET on one pooled connection. Verify actual queries on multiple connections, interactive transactions, raw SQL and secondary Prisma clients. Prisma's schema URL option is connector-specific; see the [Prisma PostgreSQL connector documentation](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql). Check hardcoded public references, extension installation, migration bookkeeping and introspection assumptions. Do not assume the URL alone isolates everything.
5. Make both lanes deliberately create the same fixture username/email/ID, hold synchronization barriers, query/update their own values and run cleanup. Both must succeed and neither can see/delete the other's fixture. Prove the test fails when routing is deliberately collapsed to one database. Use real DB operations and deterministic barriers with timeouts, not sleeps hoping a race occurs.
6. Prove globalSetup in lane B cannot remove a live matching-prefix fixture in lane A. Prove a recycled child continues to use its original lane target. Run the historical flaky suites plus fixture/lifecycle/transaction cases under this topology, initially on a small fixed manifest.
7. Destroy only targets named in the owned run manifest, after child termination and client disconnect. Reject production/nonlocal/shared database names and public/shared schemas. Never perform broad shared-DB deletes or drop a database inferred only from NODE_ENV. On failure/cancellation, retain actionable evidence and report cleanup failures. Reclaim interrupted owned targets using explicit ownership metadata, not wildcard deletion.

Run one lane first. Only after all routing/cleanup sentinels pass, allow two; no nested two-worker Jest beneath each lane. Start with 1536 MiB per Jest process and measure parent plus both children against the conservative combined local envelope. The old sequential 4096 MiB exception is inapplicable. Account for bootstrap/monitor/secondary-client connections, not just two times the default pool size. If isolation cannot operate inside the existing accepted limits, keep serial execution and present the measured blocker rather than broadening the budget.

Update the canonical runner, package profile, hook integration and `check-backend-test-profiles.mjs` together only after the new topology is demonstrated. Preserve the gate's exact suite universe and fail-closed checks. Do not weaken doctrine to get a prototype accepted.

**8. Phase E — eliminate avoidable repeated validation and false greens**

The current hook runs doctrine, DB probe/health and the full profile, but has no remote-ref freshness check or cross-session admission control. A freshness check is useful but cannot alone prevent the remote changing during validation.

Design one local, cross-worktree validation admission lock and one publication coordination mechanism. Their scopes differ: the resource lock applies to overlapping local test runs, while the publication lock must cover synchronization, validation and the actual push. A lock acquired and released only inside pre-push ends before Git updates the remote; it does not cover the whole race. Use a wrapper that owns the publication interval if this workflow is implemented. All local agents must use it; it cannot lock another machine or a noncooperating client.

Use a stable machine/repository lock identity shared by worktrees, atomic acquisition, owner PID plus creation time/run token, bounded wait, and safe stale-owner checks. Do not poll forever or silently delete another live lock. Mark legitimate nested invocation so the wrapper and hook do not deadlock. Locking should serialize resource-intensive work without blocking ordinary editing or read-only inspection.

Before expensive tests, inspect the actual proposed ref updates, not merely HEAD or origin/master. A pre-push hook receives remote name/location and local/remote refs/OIDs. Handle existing branch updates, new branches, tags, deletions and multiple refs explicitly. Check ancestry against the advertised/current remote OID where relevant. Stale/diverged history must stop with a concrete explanation before testing. Refresh after acquiring publication ownership. If the remote changes during validation despite local coordination, fail/reconcile explicitly; do not auto-rebase and blindly loop through another full run.

Keep validation tied to the exact proposed source state. A hook tests working-tree files, which may differ from the commit being pushed. Use an immutable candidate checkout or fail if tracked files relevant to the gate differ from the candidate, and guard against edits during validation. Do not discard current uncommitted work to manufacture a clean state.

Do not add a pass cache in the first patch. A credible cache would need commit/tree identity, relevant untracked/dirty inputs, config and lockfiles, runtime, schema/seed fingerprints, environment contract and trustworthy complete results. That is a separate correctness problem. The no-bypass full hook remains authoritative unless an explicit replacement contract has been reviewed.

Harden the runner's result accounting while changing it. At `backend/scripts/run-suite-sharded.mjs:193–213`, parsed JSON plus exit 0 currently determines a batch PASS; hash-shard mode skips the initial file manifest at line 124. Jest normally supplies failures for invalid discovery, but the wrapper should independently establish complete coverage before declaring its own success. Require a precomputed discovery manifest, unique completed suite paths equal to the expected set, valid numeric totals, zero failures/runtime errors and no unexplained pending/todo/disabled suites. Missing/malformed JSON, timeout, signal exit, absent shard, duplicate shard, zero-test execution or missing discovered path must fail. Preserve any already accepted exclusions explicitly; do not demand a hardcoded historical suite count.

The runner passes `--retryTimes=1` at line 173, but inspection found no corresponding CLI handling in the installed CLI/config files. Verify the actual retry contract with a tiny dedicated failing sentinel before relying on that comment. Jest exposes retry behavior through its test API; do not introduce retries to disguise order dependence. Record retries separately from first-attempt passes.

For ordinary deterministic failures, a pre-push run may fail promptly after saving the first failure instead of finishing unrelated shards; a failed invocation is never approval. If adding fail-fast behavior, stop scheduling new work, terminate/drain only owned running children, keep diagnostics, and leave a distinct explicitly requested exhaustive diagnostic mode. Never automatically rerun failed batches until green.

Exercise Git coordination with temporary local bare repositories and tiny executable gate fixtures: two cooperating push attempts, stale ancestry, remote advancement during validation, stale/live locks, cancellation, dirty candidate mismatch, new branch, deletion and multiple refs. These harness fixtures test process/Git orchestration, not mock substitutes for Equoria integration coverage. No real remote push is needed to prove the workflow.

**9. Integration order, file ownership and validation ladder**

Keep the work reviewable in this order; do not intermingle all tracks before obtaining measurements:

| Change                            | Likely ownership                                                                         | Required proof before next step                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Measurement and supervisor        | Existing `backend/scripts/` ownership; temporary evidence outside repo                   | Known-growth probe fails the resource/trend check; bounded control passes; timeout leaves no owned children. |
| Demonstrated memory fix           | `backend/jest.config.mjs`, custom environment/lifecycle or the specific retaining source | Same-PID, same-manifest before/after; lifecycle red/green; real API/transaction behavior unchanged.          |
| Optional isolation                | Runner, test bootstrap, preflight consumers and narrowly scoped DB test utilities        | Two-lane routing, cleanup, shared-fixture and restart sentinels; resource measurements.                      |
| Admission/publication correctness | `.husky/pre-push`, supporting scripts and profile doctrine                               | Local Git concurrency/failure tests; no bypass; complete result accounting.                                  |
| Canonical profile adoption        | Backend/root package profiles and matching doctrine sentinels; CI only where needed      | Doctrine passes; same suite manifest; one full passing candidate run inside measured budgets.                |

Use the existing `backend/__tests__/prismaCleanupLifecycle.sentinel.test.mjs`, `backendTestProfiles.sentinel.test.mjs`, `jestMemoryBudgetDoctrine.sentinel.test.mjs` and `ciShardExclusivity.sentinel.test.mjs` as starting points, reading their assertions before changing them. Extend contracts only for a demonstrated behavior change; never weaken old assertions to accommodate a workaround. Preserve unrelated tests and worktree edits.

Run syntax checks and the relevant small sentinels first. Run focused affected API/DB suites next. Run the repository doctrine command, `bash scripts/doctrine-checks/run-all.sh`, with the working Windows Git Bash environment; verify that it executes checks and exits zero. An environment failure or zero checks is not success. Use current package scripts for normal verification and the explicit bounded launcher only for diagnosis.

Before final full validation, explain why it is now expected to fit: demonstrated memory trend, passing lifecycle/isolation tests if applicable, resource headroom, stable candidate identity and no conflicting run. Set a finite total deadline based on measured stage costs, not eight independent ten-minute allowances with no overall budget. The performance objective is a complete gate below ten minutes on this machine if feasible, with a material reduction from the reported 21 minutes; this is a target, not a fabricated guarantee. Include provisioning/seed/cleanup time and compare like-for-like warm/cold cache conditions.

A full run remains necessary for final backend coverage. Schedule it once on the completed candidate; if an authorized final push will perform that exact validation, use its result rather than immediately running an identical full suite beforehand. A rebase/merge changes the candidate and invalidates the prior proof; coordinate publication before paying again. If the full run fails, extract the first cause and return to an explicit small reproduction. Do not press retry on the whole gate as the debugging strategy.

**10. Required final evidence to the owner**

Provide a compact evidence block for each claimed outcome, with:

- Exact cause and source line or dependency reproduction; separate observations from hypotheses.
- Changed files and why the change releases the demonstrated owner or prevents the demonstrated race.
- Baseline/candidate commit and runtime, ordered probe manifest, raw log locations, actual command, exit status, suite/test counts, time, heap trend, combined RSS, connection high-water mark and restart count.
- The deliberate red result, restored green result, and proof that no defect injection remains.
- Full-gate discovery-versus-execution comparison, all required doctrine results, and any retries/skips/exclusions explained.
- Timeout/cancellation/cleanup results and any residual owned processes or disposable databases.
- A candid status for each of memory repair, runtime improvement and publication coordination; list anything still open rather than collapsing all three into “fixed.”

The minimum acceptable conclusion is evidence-led. “All tests pass,” “we lowered the workers,” “we shared the app,” or “we added schemas” cannot substitute for explaining what retained memory and demonstrating the effect of the fix. Update the existing issues with the actual measurements and next steps; leave closure and final acceptance to the owner.

## 2026-09-16 — Interrupted push, missing dependencies, and debugging recovery plan

Owner request: review the pasted Claude conversation, identify the underlying issues, and provide a thorough implementation handoff. This is a read-only investigation apart from this requested report. No application files, tests, instructions, dependencies, processes, databases, or Git refs were changed. No tests, installs, or pushes were run.

### Diagnosis and evidence boundaries

The immediate blocker is an incomplete installed dependency tree: frontend Prettier cannot load its missing modules. The agent repeatedly confused that environment failure with test failures, resource contention, and hypotheses about a deleting process. Those are separate investigations. The actor responsible for unexplained file loss is STILL UNIDENTIFIED. Do not replace that uncertainty with another confident suspect.

The historical memory/performance work may be valid: the transcript reports three reconciled full runs around seven minutes. This audit did not reproduce those measurements or audit the retention fix. Preserve that work unless new evidence contradicts it. The last push failed at doctrine/dependency loading, before backend suite execution; rerunning 907 suites cannot explain a missing Prettier module.

Current observations at HEAD `a915a592f20ae838e2e05efaf68f0c25d696c6c4`:

- `frontend/node_modules/prettier/index.mjs` and `plugins/postcss.mjs` are absent. Root `node_modules/js-yaml/dist/js-yaml.mjs` and backend `node_modules/@eslint-community/eslint-utils/index.js` are present. This is a point-in-time observation, not proof that deletion is continuing.
- The `Equoria-wt/2ti1j` root and frontend dependency directories are junctions into the main checkout. Four paths reporting the same timestamp can therefore be ONE physical event, not four independent deletions or evidence of a machine-wide sweep.
- `git status` reports tracked deletions outside dependencies: multiple Impeccable scripts, game artwork, audio files, and two documentation files. Some may be intentional owner work. Classify them before restoration; neither attribute them to the incident nor overlook them. Never run blanket `git restore`/`reset`/`clean`.
- The CIM query returned no process for historical PIDs 33036 or 27020 during this audit. Do not execute the transcript's stale `taskkill` command; PID reuse could target an unrelated process.

**A stronger lead for the runaway Python process:** the other session's subagent log contains an actual `python3 -` launch with an unterminated heredoc. Source: `C:/Users/heirr/.claude/projects/C--Users-heirr-Desktop-Equoria/a136f042-b1ef-4b23-ae67-f93c6819cd78/subagents/agent-a2bbd3da5ff0f0996.jsonl:32`. The tool request is timestamped 2026-09-15 13:15:56 UTC; its 120-second timeout arrives at 13:18:26 UTC at line 37, closely matching the transcript's parent process creation at 09:16:24 Eastern. The task ID is `b2isjx4k5`. The agent switched to a sed command at line 46 and completed its review without recording termination of the background task.

The task output at `C:/Users/heirr/AppData/Local/Temp/claude/c--Users-heirr-Desktop-Equoria/a136f042-b1ef-4b23-ae67-f93c6819cd78/tasks/b2isjx4k5.output:1` confirms the missing `EOF` warning. The subsequent Node fallback reports a malformed `C:\c\Users\...` path. Its last-write timestamp is September 16 at 09:00:29. This is strong evidence of an abandoned diagnostic command, and a much more specific lead than plugin installation or high I/O counts. It is not a proven PID-to-task mapping, and this command contains no demonstrated package deletion operation. The exact CPU-loop mechanism is unproven.

### Where the investigation went wrong

Transcript references below use line numbers in the supplied `pasted-text.txt` attachment.

1. **Unsupported attribution:** lines 374–381 move from damaged install to antivirus to “root cause is now clear” without a process/file event. Later the transcript calls the Python process a memory hook without recovering its launch command. CPU and Write/Other operation counts do not identify paths or prove deletion.
2. **Invalid exclusions:** line 504 treats empty Defender logs as ruling Defender out. That result means no matching events were found in that query, not that every possible cause has been excluded. Directory modification times also do not identify a deleted filename or its actor.
3. **Contaminated experiments:** tripwires were planted inside directories then replaced by `npm ci`. npm explicitly removes an existing node_modules directory before installation: https://docs.npmjs.com/cli/commands/npm-ci/. Their disappearance was expected investigator activity. Repeated reinstalls and concurrent checks destroyed a stable baseline.
4. **Overstated causal test:** “kill it; if deletions stop, that was it” is invalid for an intermittent event. A quiet interval after stopping a process is supporting evidence only. Killing the suspected writer before collecting attribution can also lose evidence.
5. **Validation against moving files:** transcript lines 126–141 show new lane code/tests being written while the prior commit's push gate ran; that gate then discovered the newly written sentinel. The gate was no longer evidence solely about the pushed commit. Freeze the candidate during validation.
6. **Resource claims exceed enforcement:** two 768 MiB old-space limits are not a hard 2 GiB process-tree RAM limit. Native allocations, child runtimes, and orchestration consume additional memory. The runner applies heap limits at `backend/scripts/run-suite-sharded.mjs:255`; it contains no combined-RSS enforcement. Historical sampler results establish measurements for those runs, not a permanent ceiling.

### Concrete code findings — separate from the missing-file cause

**P1 — A contender can steal an initializing or newly replaced lock.** `backend/scripts/gate-lock.mjs:69` exclusively creates a file, then writes its metadata at line 77. A second process can read the empty file during that interval; lines 59–61 classify it as corrupt, and lines 110–117 remove it. Both processes can then enter the gate. Independently, two stale-lock reclaimers can both observe the old lock, after which the slower reclaimer deletes a fresh lock acquired by the faster one. Atomic creation alone does not make the whole acquisition/reclamation protocol atomic. Failure scenario: concurrent pushes start four Jest children despite the intended two-child ceiling.

**P1 — Signal handling relinquishes ownership before children and databases are cleaned up.** `backend/scripts/gate-lock.mjs:159` installs signal callbacks that release the lock and call `process.exit(130)` at lines 161–162. `backend/scripts/run-suite-sharded.mjs:356` installs these callbacks, while its asynchronous database cleanup is at lines 399–408 and its spawned Jest child is local to `runBatch` at line 252. The handler neither stops/waits for children nor awaits that finally block. Failure scenario: terminate the runner, a waiting runner acquires its released lock, and surviving test children overlap; lane databases may remain. Exact platform child survival needs a bounded reproduction, but the cleanup bypass is explicit in source.

**P2 — The lock covers only part of the claimed workflow.** `.husky/pre-push:80` runs doctrine before the runner is called at line 169. The runner itself performs Jest discovery at `backend/scripts/run-suite-sharded.mjs:174` before acquiring its lock at line 355. `backend/package.json:19` starts targeted Jest directly. Dependency installs and worktree cleanup also do not participate in this lock. Failure scenario: a full gate, a targeted test, and an install through a junction can still overlap. Treat this as limited runner serialization, not full workstation protection or dependency ownership.

### Execution plan for Claude — complete phases in order

**Phase 0: Establish one owner and preserve the incident.**

- Keep scope to environment recovery and the evidenced gate defects. No Sentry work, Docker, new SaaS, performance redesign, test weakening, or instruction-file edits. No push without the owner's instruction for the current candidate.
- Coordinate one maintenance owner across existing windows. No installs, gate runs, cleanup scripts, or worktree removal during evidence capture. Do not terminate another session merely because it is busy.
- Record current HEAD, working-tree status, lockfile hashes, physical dependency targets, and process identities. Preserve current modified/deleted tracked files as owner work pending classification. Save small evidence logs in a dedicated scratch directory outside dependency trees; append conclusions here.
- Record outcomes separately: dependency integrity, runaway diagnostic task, gate correctness, and publication. A green result in one cannot close another.

Exit: a stable baseline and no cooperating writer is changing the experiment. If an uncoordinated writer remains, continue read-only attribution; do not repair a live shared tree underneath it.

**Phase 1: Attribute file loss with a bounded capture.**

- First inspect the actual subagent task above and its owning session. If a similar process is still alive, match PID AND creation time, full command, parent chain, and task ID. Treat the malformed heredoc/Windows launcher behavior as its own resource incident; do not rerun that malformed command.
- Inventory only the known affected package files plus representative missing tracked files. Record existence, size and hashes when available. Avoid whole-disk recursive scans. Classify owner-intended tracked deletions separately.
- Obtain a short local Process Monitor trace filtered to affected physical directories and relevant worktree paths, without initially filtering to a favored PID. Include filesystem mutations, rename/delete details, and process creation/identity. Capture to a bounded local backing file and stop after one relevant event or a stated interval, for example ten minutes. Process Monitor provides filesystem activity and process details: https://learn.microsoft.com/en-us/sysinternals/downloads/procmon. If driver elevation is unavailable, report that exact limitation; a filesystem watcher alone does not supply actor attribution.
- Prefer observing existing files first. If reproduction requires restoration, log one narrowly scoped restoration as an intervention with its timestamp, after securing exclusive maintenance ownership. Capture all subsequent activity and distinguish your own writes from unexpected ones.
- Search relevant agent commands near the observed event for installers, format/cleanup tasks, and recursive worktree deletion. One historical command in the other session uses junction removal followed by `rm -rf` (`a136f042-b1ef-4b23-ae67-f93c6819cd78.jsonl:3256`); that is a candidate to investigate, not evidence it caused this incident. Never repeat it as a probe against real shared paths.

Exit: identify process + creation time + successful mutation of a known path, linked to a command/script, OR explicitly report “no event captured; cause unresolved.” Ten quiet minutes do not prove a permanent fix. Never claim the memory plugin or Defender caused it without attributable evidence.

**Phase 2: Contain the demonstrated actor and repair once.**

- Stop/cancel a confirmed abandoned task through its owning session after verifying current identity. For the suspected runaway, preserve the task output first. If its process is already gone, record that fact and make no stale-PID kill attempt.
- If an installer/cleanup script is responsible, fix its ownership/path handling. If a plugin or security tool is actually responsible, address that specific demonstrated behavior. Do not add broad antivirus exclusions speculatively.
- Before recursive move/removal, use native PowerShell, resolve absolute paths, inspect reparse points, and verify containment. Do not feed enumerated paths into another shell. Dependency targets shared through junctions are shared mutable state even when lockfiles match.
- Restore the damaged dependency tree once from its unchanged lockfile, using the physical owner checkout. Repair additional trees only if checks show damage. Run installs sequentially with consumers stopped. Read lifecycle scripts first; document any required generation step. Do not hand-patch arbitrary package internals or upgrade packages to hide damage.
- Check every formerly missing representative file immediately after installation and again after a bounded observation interval. Classify tracked deletions before any targeted recovery; recover from the correct version or owner backup, never assume HEAD contains their latest work.

Exit: dependencies load, expected files remain present, lockfile hashes are unchanged, and any unresolved actor attribution is stated honestly. Repair without attribution may unblock work, but must be reported as recovery, not root-cause closure.

**Phase 3: Repair gate ownership in a separate small change.**

- First demonstrate each lock defect with tiny real child processes and temporary paths, without Jest or database setup. Use barriers to force the initializing-lock and competing-reclaimer interleavings. An ordinary repeated green acquisition test is insufficient.
- Make lock acquisition/reclamation one race-safe protocol. Incomplete/unreadable metadata must never authorize immediate deletion of a potentially live owner. Use a unique acquisition token; verify process creation identity where supported, and fail closed on ambiguity. A second unsafe stale-lock check or an extra sleep is not a fix.
- Apply the wait deadline to every retry path, including corrupt/unreadable locks. Existing code reaches its deadline check only for a live, parsed holder. Owner release must match the acquisition token, not just PID; a delayed old handle must not release a newer acquisition in the same process.
- Track all owned child processes. On cancellation, stop scheduling, terminate owned children, await their exit with a finite escalation deadline, disconnect/drop owned lane databases, then release ownership. Report cleanup failures and nonzero exit. Never release the lock first or terminate arbitrary node processes.
- Establish the admission boundary before expensive discovery/preflight/test activity. Ensure targeted profiles and dependency maintenance cannot silently collide with full gates under the actual supported workflow. Avoid nested lock deadlock by defining which outer operation owns the lock. Keep ordinary editing available except while validating a frozen candidate.
- Preserve the existing worker/heap limits. Explicitly distinguish measured RSS from enforced RSS. If enforcing an aggregate limit, include the owned process tree and use the accepted budget; abort owned work cleanly on breach. Do not increase limits to make a run pass.

Exit: real-process demonstrations prove mutual exclusion during initialization/reclamation, bounded failure on ambiguous ownership, safe cancellation, no owned children left behind, and correct release. Existing tests must not be weakened or edited to fit new behavior; follow current test-integrity rules for any added coverage.

**Phase 4: Validate from cheapest to most expensive.**

1. Confirm local Prettier/ESLint entry points and affected plugin imports load, with no package installation fallback. Capture true exit status; a shell ending with `echo`/`grep` can report success after an earlier failure.
2. Run the exact lint/format check that originally failed, once. On failure, inspect its first actionable error instead of rerunning doctrine blindly.
3. For gate fixes, run the bounded process harness and only affected existing sentinel suites through targeted package scripts, sequentially. For application defects, use their affected real-functionality suite. No database mocks or relaxed assertions.
4. Run `bash scripts/doctrine-checks/run-all.sh` once after prerequisites pass. Require nonzero discovered checks and exit zero; retain the exact failure if it stops.
5. Do not run a full backend gate to verify a dependency reinstall. For an owner-authorized final publication, freeze the exact candidate and its dependencies, reconcile dirty files/ref updates, and let the required hook validate that candidate once. Do not edit test discovery inputs during it. Record the actual push result independently from the background wrapper's exit code.

Exit: each result corresponds to the same stated candidate/environment. If any phase fails, return to that phase's smallest reproduction. A code change, newly missing file, or changed candidate can justify retesting; an unchanged failure cannot justify another full gate.

### Required handoff and stop conditions

For each experiment record: observation; hypothesis; what would disprove it; exact intervention; expected result; actual exit/status/log; conclusion; remaining uncertainty. Do not start the next experiment until this row is complete. Keep one mutation and one test experiment active at a time; no background retry queue.

Stop immediately when an unexpected file disappears, ownership becomes ambiguous, an unrelated process would need termination, or a required resource threshold is exceeded. Preserve evidence and explain the precise missing input. Do not switch suspects, reinstall again, or restart a push in the same breath.

Final report must distinguish: (a) recovered dependencies, (b) attributed or unattributed file loss, (c) confirmed or suspected runaway origin and its cleanup, (d) lock fixes and their proofs, and (e) pushed versus only locally validated. “Everything fixed” is not an acceptable replacement.

AUDIT: CONCERNS

### 2026-09-16 12:15 ET — Phases 0–1 evidence (session fc30d3d9, read-only)

Raw captures: session scratchpad `evidence-2026-09-16/` (files 00–09, SUMMARY.md). No installs, kills, pushes, restores, or repo changes during capture, apart from this append.

- Baseline: HEAD a915a592f, 4 unpushed commits (3 owner, 1 agent); lockfiles unchanged vs HEAD; all 21 worktrees junction their four dependency directories onto the main checkout, so one physical tree exists. Frontend `prettier/index.mjs` (dir mtime 08:26:27) and `plugins/postcss.mjs` (08:28:13) missing; root and backend representative files present after the 08:58 reinstall.
- Tracked deletions (18) span 07:25:13 (docs/SENTRY_SETUP.md) to 08:31:49 (lofi1-3, systemconstraint.md); artwork/backgrounds 08:28–08:30; six impeccable scripts 07:53–08:23. Left untouched pending owner classification.
- Runaway python: confirmed from the other session's subagent log — a `python3 -` heredoc with no terminator at 2026-09-15 13:15:56Z; task b2isjx4k5 timed out at 13:18:26Z and was never stopped. Consistent with the 24h interpreter (5 MB working set, ~20k tiny operations/s) spinning on a dead stdin. Not evidence of deletion. Process is gone (owner killed it).
- Command scan of every Claude session log for this project, 11:15Z–12:40Z: 44 commands, all from this session; the only mutating ones are the logged restore/npm ci interventions. Codex first ran at 09:21:53 today; its sandbox log has nothing in the window. Commit a915a592f 07:30:44, push 07:42:48; the first deletion (07:42:28) coincides with neither hook, and no hook or doctrine script contains a removal.
- Correlations only, not causation: the 07:47:42, 07:49:13 and 07:50:46 package-file losses each fall within a minute of this session's restore/reinstall commands; root package.json has no workspaces, so a root install does not rewrite the frontend tree.
- Limits: Process Monitor is not installed; Defender protection history and quarantine need administrator rights; the readable Defender operational log is empty for the window.
- Incident during this capture: this session's own append command briefly reproduced the heredoc-in-backticks hazard (bash command substitution inside double quotes started a stdin-reading shell tree); the task was stopped, the tree exited, and the audit file was verified unmodified before this append.

**Phase 1 exit: no attributable filesystem event captured; cause unresolved. No suspect is asserted.** Phase 2 (single repair under exclusive ownership) awaits the owner.

### 2026-09-16 12:36–13:01 ET — Phases 2–4 (session d7603f35)

Raw captures: session scratchpad `phase2/`, `phase3/`, `phase4/`, `classification/`. Continues the
Phases 0–1 append above. Exclusive maintenance ownership was established before any dependency
write: no Equoria npm/Jest/Vite/Playwright-test or Python process was running (only Codex and
Playwright MCP node processes, which do not consume this dependency tree), and both installs were
performed while HOLDING the repository's own local gate lock, so no cooperating runner could start
beside them.

**(a) Recovered dependencies — two trees, one install each.**

- `frontend`: `npm ci` (692 packages, 14 s, exit 0) from the unchanged lockfile. `prettier/index.mjs`,
  `plugins/postcss.mjs`, `plugins/typescript.mjs`, `plugins/estree.mjs`, `plugins/babel.mjs` and
  `standalone.mjs` restored. Damage shape before repair: `.d.ts` files survived while most `.js`/`.mjs`
  siblings were gone — a selective file loss, not a version mismatch.
- `packages/database`: damage found only after the repair, by running a real suite. `@prisma/client`
  was missing 16 of its declared export files, including `runtime/library.js`. Directory mtime
  `2026-09-16 08:23` places the loss inside the incident window (07:25–08:31), while every surviving
  file in it carries the original April install date — i.e. pre-existing incident damage, NOT caused
  by the 12:37 frontend install. Repaired with one `npm ci` (10 packages) plus the documented
  generation step `npm run generate` (`prisma generate`, v6.8.2, exit 0), because `npm ci` removes
  `node_modules/.prisma`. The generate wrapper's process kill is narrow (node processes with a
  `query_engine` module loaded); it reported "No processes were holding the DLL" and killed nothing.
- All four lockfiles byte-identical to HEAD before and after. Entry points verified by real import:
  prettier, its five plugins, eslint and typescript all load, and `prettier.format` returns formatted
  output. The originally failing check, `npm run format:check` in `frontend`, now passes (exit 0).
- Re-observed at 13:00 (≈23 min after the frontend install, ≈15 min after the database install): all
  files still present, lockfiles still unchanged. **This is not proof the cause is gone.** A quiet
  interval is supporting evidence only.

**(b) File loss — still UNATTRIBUTED.**

No attribution capture was possible: Process Monitor is not installed and its driver needs
elevation, and Defender history/quarantine need administrator rights. That limitation is recorded
rather than resolved; recovery proceeded without it, and the cause remains open. No suspect is
asserted. The newly found `packages/database` damage extends the known blast radius of the same
window to a third tree but adds no attribution.

**(c) Runaway diagnostic task.** Unchanged from the Phases 0–1 append: origin confirmed in the other
session's subagent log, process already gone, no stale-PID action taken.

**(d) Tracked deletions — classified, 19 of them (one more than the 18 seen earlier).**

Restored from HEAD (12, explicit paths only, each verified byte-identical to HEAD) — evidenced as
incident damage because live code contradicts the deletion:

- `frontend/public/images/bg-{1.1,21.9,3.2,4.3}.webp` — `frontend/src/hooks/useResponsiveBackground.ts`
  documents six generic fallbacks as "files that DO exist"; exactly four were deleted and two
  (`bg-16.9`, `bg-9.16`) survive. A deliberate removal would not break a documented set by two-thirds
  and leave the comment intact.
- `frontend/public/equoriacelestial.png`, `frontend/public/assets/art/equoriacelestial.png` —
  referenced by the live `PRODUCT.md`.
- the six `.github/skills/impeccable/scripts/*` files — exactly 6 missing of 107 tracked in that
  subtree; no CI workflow references them (checked `.github/workflows/`, not only source); the
  untracked mirror trees `.claude`/`.agents`/`.gemini` are each missing a different, scattered subset,
  which is not the shape of a restructure.

NOT restored — 7 preserved untouched, pending the owner's ruling:

- `systemconstraints.md` — evidenced as deliberate consolidation: its content (Netlify/Railway/Supabase
  allowlist, Docker/Sentry ban) now appears in the working-tree `CLAUDE.md` edit. Side effect: three
  live doctrine citations now name a file that does not exist —
  `backend/scripts/gate-lock.mjs:2`, `backend/scripts/run-suite-sharded.mjs:37`,
  `backend/__tests__/gateLock.sentinel.test.mjs:2`.
- `systemconstraint.md` — typo duplicate, added and deleted the same day.
- `docs/SENTRY_SETUP.md` — evidenced as deliberate: it was referenced at HEAD by `docs/DOCUMENTATION.md`,
  `docs/README.md` and `docs/SECURITY_TESTING.md`, and the owner's own working-tree edits removed all
  three references. **But it breaks a test.**
  `backend/__tests__/authRateLimitDocDrift.sentinel.test.mjs:170` reads `docs/SENTRY_SETUP.md` and
  asserts its auth-failure alert threshold. Verified, not assumed: that suite now fails
  `ENOENT ... docs\SENTRY_SETUP.md`, 1 failed / 4 passed. The test was NOT edited. This needs an owner
  ruling — restore the doc, or explicitly change the contract the sentinel guards.
- `lofi1`, `lofi2`, `lofi3`, `_bmad-output/visual-production/equoria-shell-style-study-v1.png` —
  genuinely ambiguous. They have no live references, which reads as cleanup, but they were deleted in
  the same 08:28–08:31 batch that took the load-bearing artwork above. Same window, mixed content, so
  intent cannot be inferred from timing. Left in place.

**(e) Lock fixes and their proofs.**

New sentinel `backend/__tests__/gateLockRaces.sentinel.test.mjs` (real filesystem, real child
processes, temporary paths, no mocks and no database). Every case was watched failing against the old
implementation before the fix, and the pre-existing `gateLock.sentinel.test.mjs` was NOT modified —
verified by an empty `git diff` on it — and still passes. 12 tests pass across both files.

- P1 initializing-lock theft — FIXED. Unreadable metadata no longer authorizes deletion; it is
  tolerated for `CORRUPT_GRACE_MS` (500 ms) and the timer resets whenever the lock reads cleanly.
  RED proof: contender resolved (stole the gate) instead of rejecting.
- P1 competing reclaimers — FIXED. Reclamation is serialized by a reclaim slot and is fail-closed:
  a lock is removed only while provably still the same lock that was observed abandoned. The race is
  forced deterministically through the already-published `log` callback, which the implementation
  calls exactly between judging a lock stale and removing it — no test-only production code, no
  reliance on scheduling luck. (A first attempt using two barrier-synchronised child processes passed
  against the buggy code and was discarded as proving nothing.)
- Deadline coverage — FIXED. The bounded wait now applies to the unreadable and lost-reclaim paths,
  with a distinct error naming the unproven lock.
- Token-bound release — FIXED. `releaseGateLock` compares an acquisition token; a stale handle no
  longer frees a newer acquisition in the same process. RED proof: old code returned `true` and
  deleted the live lock.
- P1 cancellation order — FIXED. `cancelGateOwnership` runs owned-resource cleanup steps and only then
  releases; `stopOwnedChildren` signals, awaits real exit, escalates to SIGKILL on a finite deadline
  and reports what would not die. The runner registers every Jest child it spawns and cancels in the
  order stop-scheduling → owned-children → lane-databases → release. Proof asserts the gate was still
  held while each cleanup step ran, and that the owned child really exited.
- P2 admission boundary — FIXED for the runner. `jest --listTests` discovery moved out of module
  import and inside the gate (`discoverAndPlan()`), so two runners can no longer both do full
  discovery before either is admitted. `Wall time` is re-based after planning so it still means
  provisioning + execution and excludes time queued behind another gate.
- Limits untouched: no worker count, heap limit, timeout or retry count was raised.

**(f) Validation — cheapest first, no full gate.**

Entry-point imports (exit 0) → `frontend` `format:check` (exit 0) → both gate-lock sentinels,
12 passed → bounded single-lane runner smoke (`--lanes=1 gateLock`: 2 discovered, 2 executed,
reconciled, 12 tests passed, exit 0) → eslint + prettier clean on all three changed files →
`bash scripts/doctrine-checks/run-all.sh`: **43 checks discovered, all passed, exit 0**. No full
backend gate was run to verify a dependency reinstall. No orphaned Equoria/Jest node processes remain
(verified 0).

**(g) Publication.** NOT pushed. Still 4 unpushed commits on `fix/2026-09-08-followups` (3 owner,
1 agent); this session added working-tree changes only and pushed nothing.

Open, needing the owner: the `docs/SENTRY_SETUP.md` sentinel conflict; the four ambiguous deletions;
the three dangling `systemconstraints.md` doctrine citations; and file-loss attribution, which remains
unresolved for want of an elevated capture.

#### 2026-09-16 13:0x ET — owner rulings applied (session d7603f35)

The three open classification questions were put to the owner and answered in-session:

1. **`docs/SENTRY_SETUP.md` / the sentinel conflict.** Ruling: _"We do not use sentry at all so get
   rid of it."_ The doc stays deleted. Under that ruling the dependent assertion in
   `backend/__tests__/authRateLimitDocDrift.sentinel.test.mjs` was RETIRED, not weakened.
   - Old contract: `docs/SENTRY_SETUP.md` must still read `Auth Failures | 5 events | 15 minutes` —
     a negative-space guard so an over-eager "fix all the 5/15s" edit could not silently rewrite a
     different subsystem's threshold.
   - New ruling: Sentry is not used at all and the document is deliberately retired, so the behaviour
     that guard specified no longer exists.
   - The removed case is quoted verbatim in a comment at the end of that file, with the date and the
     ruling. The four auth rate-limiter assertions — the actual subject of the sentinel — are
     unchanged. Suite now passes 4/4.
   - **Scope flagged, NOT done.** Sentry is wired into the application well beyond that doc.
     A first enumeration here undercounted it (a `head -20` truncated the list at the backend
     files and hid the whole frontend side). The complete count over Equoria-owned source,
     excluding `node_modules`, archives, caches and lockfiles, is **31 files**: 23 backend,
     6 frontend, of which 15 are tests.
     - Backend runtime: `config/sentry.mjs`, `app.mjs`, `jest.setup.mjs`, `middleware/auditLog.mjs`,
       `middleware/rateLimiting.mjs`, `modules/auth/services/onboardingService.mjs`,
       `services/jobs/cronJobMonitor.mjs`, `services/jobs/impl/showExecutionReaper.mjs`,
       `tests/helpers/csrf-production-probe.mjs`, `.env.example`.
     - Frontend runtime: `src/lib/sentry.ts`, `src/App.tsx`, `.env.example`.
     - Dedicated Sentry suites that would be deleted outright, not edited:
       `backend/__tests__/sentryConfig.test.mjs`,
       `backend/__tests__/sentryDsnBoot.integration.test.mjs` (added by commit 381bda70c), and
       `frontend/src/lib/__tests__/sentry.test.ts`. A further nine suites reference Sentry
       incidentally (audit-log, cron, OWASP, ownership, CSRF, marketplace, trainers, XP history).
     - Dependencies: `@sentry/node`, `@sentry/profiling-node` (backend), `@sentry/react` (frontend).

     Removing this is a multi-file refactor of error handling, middleware and cron jobs across both
     packages, plus dependency removal and the deletion of three test suites. It is deliberately NOT
     attached to this recovery, whose Phase 0 scope says "no Sentry work". It needs its own task and
     its own verification; it must not be bolted onto a dependency repair.

2. **The four ambiguous deletions.** Ruling: restore all four. `lofi1`, `lofi2`, `lofi3` and
   `_bmad-output/visual-production/equoria-shell-style-study-v1.png` restored from HEAD, each verified
   byte-identical to HEAD. All 19 tracked deletions are now resolved: 16 restored, 3 left deleted
   (`docs/SENTRY_SETUP.md`, `systemconstraints.md`, `systemconstraint.md`) as deliberate owner work.

3. **The dangling `systemconstraints.md` citations.** Ruling: leave them alone. The three comments in
   `backend/scripts/gate-lock.mjs`, `backend/scripts/run-suite-sharded.mjs` and
   `backend/__tests__/gateLock.sentinel.test.mjs` keep their historical reference and were not edited.

Re-validated after the rulings: `authRateLimitDocDrift.sentinel.test.mjs` 4/4 passed; eslint and
prettier clean on the edited file; `bash scripts/doctrine-checks/run-all.sh` — 43 checks discovered,
all passed, exit 0. Still not pushed.

### 2026-09-16 — Gate ownership/cancellation repair after Codex REVISE (session d7603f35)

Codex rejected the first gate fix. Two of its findings were defects I had not caught: the
`.reclaim` file was deleted on AGE, recreating the competing-reclaimer race inside the protection
against that race; and cancellation spliced `laneDbs` so `main()`'s `finally` saw an empty list,
released the lock and exited while database destruction was still in flight. Both are fixed below.

**Reproduced before fixing.** Against the rejected implementation, the new ownership sentinel
produced `ENTERED A` and `ENTERED B` — two contenders holding the gate simultaneously — and a
contender took the gate from an owner stalled between file creation and metadata publication.
Evidence: scratchpad `codex/01-ownership-RED.log`.

**Item 1 — safe exclusion replaces timeout-based reclamation.** Owner ruling 2026-09-16:
"retire both, adopt the safe-exclusion contract".

- Locks are published ATOMICALLY: metadata is written to a temp file and hard-linked into place
  (`publishAtomically`), so exclusive creation and publication are one step and the half-created
  state Codex exploited no longer exists. A `legacyCreate` fallback covers filesystems without
  hard links, and the protocol treats its brief unreadable window as ambiguous.
- `CORRUPT_GRACE_MS` (500 ms), `RECLAIM_LOCK_STALE_MS` (10 s), `observeLock`, `acquireReclaimSlot`
  and `reclaimAndCreate` are DELETED. Nothing reclaims a lock automatically any more.
- Held, leftover and unreadable locks all cause bounded waiting then a clear error naming the lock
  path and the manual maintenance step. The deadline is checked on every retry path.
- Release remains bound to the acquisition token.
- Crash recovery is now explicitly a separate, controlled maintenance step, documented in the
  module docblock: after a SIGKILL or power loss the lock survives and every later gate refuses to
  start until a human removes the file. This trade — no automatic recovery, in exchange for never
  admitting two owners — was the owner's explicit decision.

TWO PRE-EXISTING TESTS RETIRED under that ruling, neither weakened nor silently deleted; each
carries its old contract, the ruling, and a pointer to replacement coverage:
`gateLock.sentinel.test.mjs` — 'a lock left by a dead pid is reclaimed' and 'a corrupt lock file is
treated as stale rather than blocking forever'. Both asserted automatic reclamation, which the new
contract removes. The conflict was escalated and ruled on BEFORE either test was touched.

One test in that same file was UPDATED rather than retired: the runner source-contract case now
matches `installCancellationHandlers(` instead of the renamed `installReleaseOnExit(`. Its
assertion is unchanged — only the symbol moved.

`gateLockRaces.sentinel.test.mjs` (authored earlier in THIS session, never an owner contract) was
deleted: every case is superseded, and it referenced the removed `cancelGateOwnership` export.

**Item 2 — one cancellation state, one memoized cleanup.** `createOwnershipLifecycle` replaces
`cancelGateOwnership` + `installReleaseOnExit`. `cleanup()` is memoized, so a signal and `finally`
join the SAME promise and it can never run twice. Every step is attempted even after one fails, and
failed resource identities are preserved in the report. Ownership is released ONLY when every step
succeeded; otherwise the lock is RETAINED and reported, because an error message followed by an
unsafe release admits the next runner anyway. The unconditional `process.on('exit')` release is
gone, and nothing calls `process.exit()` with cleanup pending — the runner sets `process.exitCode`
after the coordinated shutdown instead.

**Item 3 — provisioning is inside ownership.** The runner now registers the intended database
identity (`laneName(runId, lane)`) BEFORE `createLaneDatabase()` starts, tracks the in-flight
provisioning promise, awaits it before destroying anything so creation and destruction cannot race
the same database, and checks cancellation before each lane and each batch.
LIMITATION, stated rather than papered over: `test-lane-db.mjs` provisions through `execFileSync`
(lines 136 and 146), a SYNCHRONOUS subprocess. It cannot be tracked as a child handle or
interrupted; cancellation takes effect at the next await point. Codex asked for provisioning
subprocesses to be in the shutdown design — this one structurally cannot be, without converting
that module to async spawning, which is outside this repair.

**Item 4 — runner wiring proven, with the limits labelled.**
`gateRunnerShutdown.sentinel.test.mjs`:

- REAL RUNNER: a real `run-suite-sharded.mjs` child cannot begin discovery while another process
  holds the gate — asserted by the ABSENCE of its "[shard] N test files in M batches" line — then
  proceeds and exits 0 once admitted. Its lock is isolated by pointing the child's TEMP/TMP at a
  scratch directory (DEFAULT_LOCK_PATH derives from os.tmpdir()), so the machine-wide lock is never
  touched and NO production seam was added for testability.
- REAL RUNNER: a completed run leaves no lock and prints no retention warning.
- HANDLER WIRING (real child process, `process.emit('SIGTERM')`): owned child stopped and awaited,
  lock still held during cleanup, released only after, `process.exitCode` set to 130 with no
  `process.exit()`. Labelled accurately: this exercises the REGISTERED HANDLER, not Windows OS
  signal delivery — on Windows `child.kill('SIGTERM')` calls TerminateProcess and no handler runs.
- Cleanup held at a barrier: lock still held mid-flight; a joining caller does not re-run cleanup.
- Failed step: lock RETAINED, remaining resources still attempted, failure reported.

`gateLockLifecycle.sentinel.test.mjs` adds the provisioning-cancellation case. It is labelled in
the test itself as MODELLING the runner's control flow, not the runner: the real provisioning path
needs LANES>1 and therefore a live database, which these bounded demonstrations avoid.

**Item 5 — admission scope, UNRESOLVED and documented.** Inventory in the `gate-lock.mjs` docblock.
Exactly ONE entry point participates: `test:backend:full` -> `run-suite-sharded.mjs`, which
`.husky/pre-push:169` invokes. Not participating: the pre-push doctrine checks (they run BEFORE the
gate is taken), `test:backend:targeted` (the command CLAUDE.md tells contributors to use),
`test:backend`, `test:backend:ci`, `test:backend:diagnostic`, `test:integration`, `test:security`,
`test:performance`, `test:auth*`, `test:changed`, the root equivalents, `test:frontend`,
`test:e2e*`, and dependency maintenance. This is LIMITED RUNNER SERIALIZATION, not workstation-wide
protection and not dependency ownership. Blanket adoption is not a drop-in: the pre-push hook would
nest doctrine inside the gate it later acquires, and a targeted run that acquired the gate would
deadlock against the runner it spawns — `gateRunnerShutdown.sentinel.test.mjs` does exactly that,
from inside a targeted run. Resolving it needs an explicit decision about which outer operation
owns the lock.

**Item 6 — the two Sentry coverage gaps closed.**

- `frontend/src/components/__tests__/ErrorBoundary.test.tsx` (3 cases): children render normally; a
  throwing descendant yields the fallback instead of a blank page; the caught error is reported so
  it stays diagnosable.
- `showExecutionReaper.integration.test.mjs` gains an ALERT case on the REAL stranded-show path,
  observed through a real winston transport on the real logger (the house pattern from
  `logger-metadata-emission.test.mjs`) rather than an API spy. It asserts error level, the
  stranded show id, and the identifying context. It is placed LAST in the suite deliberately: it
  drives a reap to completion, which leaves the shared fixture horses in a post-competition
  cooldown, and running it earlier starved a sibling case (caught and fixed, not worked around).

**Item 7 — validation, cheapest first.** Ownership/cancellation demonstrations (real processes,
temporary paths) -> 21 tests across the 4 gate sentinels green -> ErrorBoundary 3 green -> reaper
suite 5 green -> eslint + prettier clean on every changed file -> `run-all.sh` 43 checks, ALL
PASSED, exit 0. One doctrine failure was found and fixed in the code, not the baseline: a
`.catch(() => {})` unhandled-rejection guard in the new lifecycle test now CAPTURES the rejection
and asserts it. A bounded single-lane real-runner smoke (`--lanes=1`) reconciled and exited 0.
No full backend gate was run. Chromium and the TypeScript config were left alone, their failures
still separate and still open. 0 orphaned processes; the machine gate lock is free.

Changed: `backend/scripts/gate-lock.mjs`, `backend/scripts/run-suite-sharded.mjs`,
`backend/__tests__/gateLock.sentinel.test.mjs`,
`backend/__tests__/showExecutionReaper.integration.test.mjs`,
`backend/services/jobs/impl/showExecutionReaper.mjs`. Added:
`backend/__tests__/gateLockOwnership.sentinel.test.mjs`,
`backend/__tests__/gateLockLifecycle.sentinel.test.mjs`,
`backend/__tests__/gateRunnerShutdown.sentinel.test.mjs`,
`frontend/src/components/ErrorBoundary.tsx`,
`frontend/src/components/__tests__/ErrorBoundary.test.tsx`. Removed:
`backend/__tests__/gateLockRaces.sentinel.test.mjs`. Nothing committed, nothing pushed.

### 2026-09-16 — Round 3: the four REVISE items on the gate repair (session d7603f35)

Codex's second review confirmed the lock-theft and competing-cleanup defects fixed and named four
remaining issues. All four are addressed; each is recorded as failing scenario → intervention →
passing evidence → remaining limitation.

**P1 — runner tests bypassed the resource ceiling.** `gateRunnerShutdown.sentinel.test.mjs` spawned a
real runner (and therefore a Jest child) from inside a Jest suite; during a two-lane gate that is a
third Jest process at 768 + 768 + 1536 MiB. Changing TEMP isolates a lock, not memory.
Intervention: the two real-runner cases moved to `backend/scripts/verify-gate-admission.mjs`, a
separately scheduled harness (`npm run verify:gate-admission`, backend) that ACQUIRES THE MACHINE
GATE LOCK for its whole run — explicit resource coordination: no cooperating gate can start beside
it, and the nested runner is the only Jest process it owns. The nested runner's own lock lives under
an isolated TEMP. The Jest sentinel now spawns only tiny node children and no Jest. Evidence: harness
8/8 checks pass twice (`codex2/03-harness.log`, `06-harness-final.log`); machine lock absent after.

**P1 — failed assertions could leave diagnostic children running.** A busy-wait owner in
`gateLockOwnership.sentinel.test.mjs` was only killed after every preceding assertion passed, so the
exact regression the case exists to catch would orphan it. Intervention, applied to every new
sentinel: every child is spawned with its own finite deadline (`timeout` + `killSignal: 'SIGKILL'`),
registered on spawn, and terminated and AWAITED in `afterEach` inside try/finally — unconditional,
independent of assertion outcome. The busy loop is a sleep-poll. Guard verified, not assumed: a
scratchpad harness proved spawn `timeout` SIGKILLs a hung child on this platform in 721 ms and the
pid is gone (`codex2/00-spawn-timeout-guard.txt`). The pre-existing `gateLock.sentinel.test.mjs`
was NOT modified for this (its holder is not mine to rework without a ruling).

**P2 — cancellation could finish with exit 0.** `main()` overwrote the handler's 130 from test
results alone. Intervention: `resolveExitStatus({cancelled, cleanupFailed, runFailed})` in
`gate-lock.mjs` is the ONE decision; `installCancellationHandlers` takes an `exitStatus` callback
and the runner passes the same `finalExitStatus()` it uses on its own completion path, with
`runFailed`/`cleanupReport` held at module level so both callers see the same inputs. Reproduced
then fixed: the new handler-wiring case emits SIGTERM during barrier-held final cleanup after a
green run and asserts `RUNNER_FINAL_STATUS=130`, `SETTLED_STATUS=130`, child exit 130 — Codex's
`130 → 0` sequence now yields 130. Labelled: real lifecycle, real handler, real decision; main()'s
call site modelled because the runner cannot be imported without its top-level side effects.

**P2 — provisioning shutdown was unbounded.** `test-lane-db.mjs:136,146` ran `execFileSync` with
no timeout; a hung migration or seed made the runner unable to handle cancellation at all.
Intervention: `runSupervisedStep` — supervised async spawn, registered in the exported
`activeProvisioningChildren` while alive, bounded by `PROVISIONING_STEP_TIMEOUT_MS` (10 min,
SIGKILL), rejecting only on real exit with the signal/deadline named. `runPrisma`, `runSeedScript`,
`runSeed` and `createLaneDatabase` are async end to end. The runner's owned-children step stops
Jest children AND provisioning children, awaited, BEFORE any database is destroyed. Evidence:
`laneProvisioningSupervision.sentinel.test.mjs` (real children, no DB) — a hung step is killed at
its deadline and deregistered; a live step is stopped by `stopOwnedChildren` and gone before the
caller proceeds; healthy and failing steps resolve/reject correctly. `testLaneIsolation.sentinel`
(real database) passes against the async conversion.

**Ratchet consequence, fixed by extraction not exception.** The additions took
`run-suite-sharded.mjs` to 627 lines (threshold 600). The cleanup steps were extracted into
`backend/scripts/gate-ownership-steps.mjs` (`buildOwnershipSteps`), a cohesive owned module; the
runner is 584 lines. No baseline entry was added.

**Validation, cheapest first.** spawn-timeout guard → 24 tests / 5 gate sentinels green (33/6 when
`testLaneIsolation` is included) → eslint + prettier clean on every changed file →
`verify:gate-admission` 8/8 → `run-all.sh` 43/43, exit 0. No full backend gate. Chromium and the
TypeScript config untouched.

Changed: `backend/scripts/gate-lock.mjs`, `backend/scripts/run-suite-sharded.mjs`,
`backend/scripts/test-lane-db.mjs`, `backend/package.json` (one script),
`backend/__tests__/gateLockOwnership.sentinel.test.mjs`,
`backend/__tests__/gateLockLifecycle.sentinel.test.mjs`,
`backend/__tests__/gateRunnerShutdown.sentinel.test.mjs`. Added:
`backend/scripts/verify-gate-admission.mjs`, `backend/scripts/gate-ownership-steps.mjs`,
`backend/__tests__/laneProvisioningSupervision.sentinel.test.mjs`. Nothing committed or pushed.

### 2026-09-16 — Round 4: cancellation propagated into provisioning (session d7603f35)

Codex confirmed the four round-3 items and reported one narrower P2: the cleanup snapshot at
`gate-ownership-steps.mjs` stops only children that already exist, so a signal landing while
`createLaneDatabase()` awaited the database still let migration and seeds launch afterwards
(reproduced by Codex: `startedAfterCancellation: true`, "late provisioning ran"). Continued work
after cancellation, under a lock that was correctly retained.

**Intervention — cancellation reaches into the orchestration, not the registry.**

- `createOwnershipLifecycle` (`gate-lock.mjs`) owns an `AbortController`; `requestCancellation`
  aborts it and the lifecycle exposes `signal`. The runner passes `signal: ownershipLifecycle.signal`
  into `createLaneDatabase`.
- `test-lane-db.mjs`: `throwIfCancelled(signal, where)` is checked before creation, AFTER the async
  database wait, before `migrate deploy`, before each seed, and before sequence resync. Every
  subprocess launch goes through `runSupervisedStep`, which refuses to launch on an aborted signal
  and passes the signal to `spawn()` so a running migration/seed is killed on abort. Rejections
  carry `code = PROVISIONING_CANCELLED` and name the boundary. On cancellation the database that
  creation left behind is dropped through the same failure path.
- No registry polling; no timeout raised.

**A second defect found and fixed while proving the first.** The supervised step used
`events.once(child, 'exit')`, which rejects the moment the emitter emits `'error'`. On abort Node
emits `AbortError` (`ABORT_ERR`) BEFORE the exit, so a raw `ABORT_ERR` escaped ahead of the
cancellation report — caught by the new mid-step test, which failed with `code: "ABORT_ERR"`.
Replaced with explicit `'exit'`/`'error'` listeners under a settled guard: settlement happens on
the child's real exit, and `AbortError` on `'error'` is deliberately ignored because the exit that
follows reports it.

**Regression coverage** (`laneProvisioningSupervision.sentinel.test.mjs`, real children, no DB):

- barrier-driven: cancellation lands DURING the database wait → rejection `PROVISIONING_CANCELLED`
  "after creating"; a 5 ms sampler observed `activeProvisioningChildren` at 0 throughout (no
  migration or seed ever launched); the created database is dropped. The Postgres admin boundary
  (CREATE/DROP) is modelled with a barrier through the injectable `databaseOps`; every provisioning
  step is the real code path, so if the defect were present the real `prisma migrate deploy` would
  launch and the rejection would not carry the cancellation code.
- cancelled before creation → nothing created, nothing dropped, nothing launched.
- cancelled mid-step → running child terminated, reported as cancelled, deregistered.
- already-cancelled signal → launch refused outright.

Honest note on TDD: the barrier case was not watched failing against the pre-patch code. Before
the patch `createLaneDatabase` ignored the injected boundary and would have created and fully
provisioned a REAL lane database on the test server with no drop on the success path. Codex's
harness reproduction stands as the RED evidence. The mid-step case WAS watched failing (ABORT_ERR).

**Also in this round:** `AbortController` declared as a Node global in `backend/eslint.config.mjs`
beside the existing hand-declared `fetch`/`URL` (the house pattern; no per-file directive), which
had failed both eslint and the doctrine lint gate. The consolidated handoff's claim that directory
timestamps prove the Prisma damage preceded my install was softened to "consistent with, not
proof", per Codex.

**Validation, cheapest first:** eslint + prettier clean on every changed file → 37 tests / 6 suites
green, including `testLaneIsolation.sentinel` against the REAL database on the changed
`createLaneDatabase` signature → `verify:gate-admission` 8/8 → `run-all.sh` 43/43, exit 0.
No full backend gate. Nothing committed or pushed.

Changed: `backend/scripts/gate-lock.mjs`, `backend/scripts/test-lane-db.mjs` (466 lines),
`backend/scripts/run-suite-sharded.mjs` (588), `backend/eslint.config.mjs` (one global),
`backend/__tests__/laneProvisioningSupervision.sentinel.test.mjs` (+4 cases).

## 2026-09-21 — Disposition record for Equoria-av27e (SECURITY.md residual claim sweep)

The 2026-07-06 middleware/doc-drift audit deferred six SECURITY.md sections outside the five
line-verified middleware areas to Equoria-av27e. The sweep finished the same day and its
dispositions were recorded on the issue, but the appendix the acceptance criteria asked for was
never written into the audit report, and that report (`docs/audits/2026-07-06-middleware-doc-drift-audit.md`,
commit 9a21ad51a) was retired on 2026-08-24 by the "consolidate guidance and retire legacy
clutter" commit (fee265d07). This section is the durable in-repo record; the issue notes and git
history carry the same content.

| SECURITY.md claim                                  | Disposition           | Where                                                                                                    |
| -------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| XSS input sanitisation                             | CONFIRMED             | `sanitizeInput()` used in the profile controller                                                         |
| CORS policy (no-origin gate + allow-list)          | CONFIRMED             | `backend/middleware/corsPolicy.mjs`, mounted in `backend/app.mjs`                                        |
| Refresh-token rotation                             | CONFIRMED             | `tokenRotationService.mjs`, wired in the auth controller, with tests                                     |
| IP / suspicious-activity monitoring                | DRIFT                 | detector is dead code — Equoria-hjnrc (doc-drift half kept open 2026-09-21)                              |
| Data-integrity middleware                          | DRIFT, since resolved | `gameIntegrity.mjs` was unmounted — removed and SECURITY.md corrected under Equoria-oey96.30 (7f3d0c0eb) |
| Financial transactions (atomic SQL, audit logging) | CONFIRMED             | bank controller                                                                                          |

Stale-issue reconciliation from the same sweep: Equoria-49dzc and Equoria-pey97 are documented in
SECURITY.md §A03-Injection; Equoria-xbir9 (Bearer CSRF) is documented in the CSRF section.

Owner ruling 2026-09-21: record here and close; the retired report is not resurrected.
