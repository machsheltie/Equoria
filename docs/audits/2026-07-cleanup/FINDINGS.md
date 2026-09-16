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
