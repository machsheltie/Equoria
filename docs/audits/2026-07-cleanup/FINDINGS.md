**Codebase correctness and security audit — 2026-09-05**

Audited checkout: `7b2376ec858d77321e830f966237200847bee509`, including the existing working tree. Seven findings: six P1 and one P2. Application code and tests were not modified.

This was a risk-based audit of API authentication/authorization, horse creation and XP, inventory and bank state, marketplace transfers, rider assignments, account identity, and frontend authentication. Breeding, training, competition, community routes, and database constraints were also sampled. It is not an exhaustive certification of every module or deployment configuration.

Reproductions used the actual Express app, authentication and CSRF middleware, Prisma, and the configured local PostgreSQL database under `NODE_ENV=test`. Concurrency probes temporarily delayed real database reads inside the probe process to produce specific request interleavings; they did not replace database results. Temporary users, horses, riders, assignments, and sales were removed with fixture-scoped cleanup. The MFA frontend finding combines a reproduced API response with source tracing; it was not browser-tested.

**1. [P1] Inventory updates can erase the weekly claim marker and mint additional coins**

**Status 2026-10-28: Done.** Settings writers (inventoryController equip/unequip and GET tack-seed CAS, profile, onboarding, user, crafting, feedShop, tackShop, horseFeedService) all write through backend/utils/userSettingsPaths.mjs updateUserSettingsPaths (jsonb_set path writes); bankController claim is a conditional jsonb_set on lastWeeklyClaimDate. Commits d5dcb7331, 011378c36; Equoria-6p398.1 closed (merge 48b5d4743).

Evidence: `backend/modules/economy/inventory/controllers/inventoryController.mjs:203-208`. `equipItem` reads `User.settings`, changes horse tack separately, and then replaces the entire settings document using its earlier snapshot. `backend/modules/bank/controllers/bankController.mjs:53-78` stores the weekly claim marker in the same JSON document while incrementing the wallet. The bank's conditional update does not protect the marker from a later stale write by another endpoint.

Reproduction: start an authenticated `POST /api/v1/inventory/equip` for an owned item and horse, pause after its user/settings read, then complete `POST /api/v1/bank/claim`. Resume equip, then claim again. All three mutations returned HTTP 200. The first claim credited 5,000 coins; equip removed `lastWeeklyClaimDate`; the second claim credited another 5,000. The fixture's balance increased from 0 to 10,000 in one week.

Fix direction: update only the intended JSON path and make horse/item changes atomic. Where a read/modify/write is required, lock the user row before reading it and retain the lock through the transaction. Check sibling settings replacements, including unequip and profile updates; adding an ordinary read-committed transaction around a stale snapshot alone does not prevent this failure.

**2. [P1] Any player can create additional horses without paying**

**Status 2026-10-28: Done.** backend/modules/horses/routes/horseRoutes.mjs router.post('/') now returns 403 for every caller regardless of payload; trusted creation stays internal (createHorse via foaling/Horse Trader). Regression horseCreationEndpointClosed.integration.test.mjs; commit a7d263641; Equoria-6p398.2 closed.

Evidence: `backend/modules/horses/routes/horseRoutes.mjs:296-304` exposes horse creation to every authenticated player. `backend/modules/horses/services/createHorseService.mjs:187-206` accepts the requested breed, age, and sex and calls `createHorse` without a purchase debit, entitlement consumption, onboarding guard, or count limit. The model writes directly through the default Prisma client at `backend/modules/horses/services/horseModelService.mjs:195`. By comparison, the Horse Trader path charges 1,000 coins at `backend/modules/marketplace/controllers/marketplaceController.mjs:637-641`.

Reproduction: an ordinary `role=user` account with completed onboarding and zero coins submitted two `POST /api/v1/horses` requests, each with a distinct name, an existing Thoroughbred breed ID, `sex: "Mare"`, and `age: 3`. Both returned HTTP 201 and persisted horses. The wallet remained at zero. A player can repeatedly obtain breeding/sale stock through this route without using the paid acquisition path.

Fix direction: remove generic creation from the player API or restrict it to the intended privileged workflow. Player acquisition should require a server-owned entitlement or payment that is consumed in the same transaction as creation.

**3. [P1] The admin/system XP endpoint lets players award themselves XP and stat points**

**Status 2026-10-28: Done.** backend/modules/horses/routes/horseXpRoutes.mjs POST /:id/award-xp answers 410 Gone for every caller; handler and frontend addXp/useAddXp removed. Regression horseXpAwardServerAuthoritative.integration.test.mjs; commit 081ea59b7; Equoria-6p398.3 closed.

Evidence: `backend/modules/horses/routes/horseXpRoutes.mjs:131-140` protects `/:id/award-xp` with ownership checks but no privileged-role check. `backend/modules/horses/controllers/horseXpController.mjs:340-371` accepts the caller's positive `amount` and arbitrary `reason`, then passes them to `addXpToHorse`. Owning the horse therefore grants authority to manufacture progression.

Reproduction: an ordinary `role=user` account called `POST /api/v1/horses/<owned-id>/award-xp` with `{"amount":1000,"reason":"audit fixture"}`. The response was HTTP 200. Real database values changed from `horseXp=0, availableStatPoints=0` to `horseXp=1000, availableStatPoints=10`, without training or competition.

Fix direction: remove the manual-award route from the player surface or place it behind the complete admin authorization policy. Gameplay XP should come from validated server events, with any event-replay protection enforced transactionally.

**4. [P1] A delayed purchase can take a relisted horse and pay the previous owner**

**Status 2026-10-28: Done.** marketplaceController buyHorse claim updateMany now binds {id, forSale:true, userId: sellerId, salePrice} (count===1 else 409); conditional buyer debit; delistHorse also binds salePrice. Commits f25a9cced, fc496169c; Equoria-6p398.4 closed.

Evidence: `backend/modules/marketplace/controllers/marketplaceController.mjs:347-348` snapshots the seller and price, but the transfer predicate at `:362-365` checks only the horse ID, `forSale=true`, and that the current owner is not the buyer. It does not require the original seller, price, or listing version to still match. The subsequent debit and seller credit use the old snapshot. The local database reported `read committed` isolation.

Reproduction: seller A lists a horse for 100 coins. Buyer B begins buying and pauses after reading the listing. Buyer C buys it for 100 and relists it for 700. B resumes. C's purchase, C's relisting, and B's purchase all returned HTTP 200. B received the horse for 100; both sale records credited A. Starting balances `[A=0, B=1000, C=1000]` became `[A=200, B=900, C=900]`: C lost the horse and received no sale proceeds.

Fix direction: lock the listing/horse row before taking the authoritative seller/price snapshot, or use a conditional claim that binds the exact seller, price, and listing version. Reject stale requests before transferring ownership or moving funds. The existing simultaneous-buyer test passes because it does not include a completed purchase followed by relisting.

**5. [P1] Profile email changes retain verification and require no fresh authentication**

**Status 2026-10-28: Done.** profileController and userController both call assertNoDirectEmailWrite from backend/utils/emailIdentityPolicy.mjs; changes go through POST /auth/email-change/request (step-up) and GET /auth/email-change/confirm with a purpose-bound one-time token. Commits d18143a13, 1e6f42643; Equoria-6p398.5 closed.

Evidence: `backend/modules/auth/controllers/profileController.mjs:263-269` immediately replaces `User.email` while leaving `emailVerified` and `emailVerifiedAt` unchanged. Its route in `backend/modules/auth/routes/authenticatedAuthRoutes.mjs` requires the current session and CSRF token, but no password, recent-authentication proof, or verification of the replacement address. The sibling user-update path explicitly resets verification at `backend/modules/users/controllers/userController.mjs:606-608`; the profile path bypasses that protection.

Reproduction: give a temporary account verified-email state, then submit `PUT /api/v1/auth/profile` with only a different `email`, using its existing session. The API returned HTTP 200; the email changed and both verification fields were retained. No password or email proof was supplied.

Failure scenario: someone with a stolen authenticated session can redirect the account's recovery email and, for an account without MFA, use password recovery to establish lasting access. Separately, a player can present an unverified replacement address as verified. Password-reset delivery to the current stored address was source-traced in `backend/modules/auth/controllers/passwordController.mjs`; recovery emails were not sent during this probe.

Fix direction: require fresh authentication for changing recovery identity, stage the replacement address until verified, and reset/invalidate verification state and outstanding identity-related tokens consistently across all update paths.

**6. [P1] A previous owner can clear the current owner's rider through a historical assignment**

**Status 2026-10-28: Done.** riderController unassign rejects inactive assignments (409 ASSIGNMENT_NOT_CURRENT) and non-owners (409 HORSE_NOT_YOURS), guarded updateMany on {id,userId,horseId,isActive:true} in one tx; sale tx reconciles staff via marketplace/services/horseTransferReconciliation.mjs. Commits 725122710, c96e0354a; Equoria-6p398.6 closed.

Evidence: `backend/modules/riders/controllers/riderController.mjs:184-196` authorizes deletion using only the assignment's stored `userId`, accepts inactive assignments, and unconditionally clears the related horse's `rider` by horse ID. It never verifies current horse ownership or whether that assignment still supplies the horse's current rider. Marketplace transfers leave the old assignment records available.

Reproduction: A assigns a rider, sells the horse, and the final buyer B assigns B's own rider. B's assignment deactivates A's old assignment. A then calls `DELETE /api/v1/riders/assignments/<old-assignment-id>`. The API returned HTTP 200. The horse still belonged to B, but its rider changed from B's rider object to `null`. B's assignment row and the horse's rider representation are now inconsistent.

Fix direction: check current horse ownership and the active assignment identity inside the same transaction as unassignment. A historical or inactive assignment must not clear a replacement rider. Horse transfer should also reconcile seller-owned staff assignments.

**7. [P2] MFA-enabled accounts cannot complete login in the frontend**

**Status 2026-10-28: Done.** frontend/src/pages/LoginPage.tsx branches on outcome.status==='mfa_required', holds mfaChallengeToken in React state and renders components/auth/SecondFactorForm; lib/api/auth.ts calls the challenge endpoint. Commits 19f6b812e, ca097a95f, 6d5435f79; Equoria-6p398.7 closed.

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

## 2026-10-13 — Staff/admin foundation adversarial code review

Scope: staff foundation ranges `e3ed7dc9d..c83ce17a8` and `69e63b583..6c573146c`, read at current HEAD `901b15fb2`, against binding contract `docs/features/staff-foundation.md`. Correctness and security only. Full implementer handoff: `C:\Users\heirr\AppData\Local\Temp\equoria-staff-foundation-claude-rework-handoff.md`.

### STAFF-CR-01 [P1] Check-in codes survive security changes and resend races

**Status 2026-10-28: Partly done, tracked in Equoria-8pzlg (tracked with STAFF-RR-01).** Covered by STAFF-RR-01: add a durable retirement mark and fix the same-millisecond comparison.

**Evidence:** `backend/modules/staff/services/staffCheckinService.mjs:158`; `backend/modules/staff/services/staffCheckinService.mjs:169`; `backend/modules/staff/services/staffCheckinService.mjs:193`; `backend/modules/staff/controllers/staffRolesController.mjs:111`; `packages/database/prisma/schema.prisma:2152`.

**Failure scenario:** A code requested before a password or verified-email change can still create a new trusted device afterward. Demote/re-promote revokes devices but leaves challenges usable. Verification can also select code A, race a resend that creates newer code B, and still consume A by ID. The final transaction never re-reads current role/email/password state, so a concurrent revocation can finish before device creation without stopping it.

**Recommended fix:** Bind challenges to a staff-security generation or equivalent timestamps, invalidate challenges on password/email/role changes, and serialize issuance/verification on the User row. Re-read current security state, prove the challenge is still newest, consume it, create the device, and log within the protected transaction. Add real-DB password/email/demote-resend and concurrency regressions.

### STAFF-CR-02 [P1] Tickets bypass the staff actionable-target rule

**Status 2026-10-28: Done.** staffTicketService.mjs resolvePlayer locks the target User row FOR UPDATE and calls assertActionableTarget inside the fileTicket transaction.

**Evidence:** `backend/modules/staff/services/staffTicketService.mjs:83`; `backend/modules/staff/services/staffTicketService.mjs:114`; shared guard `backend/modules/staff/capabilities.mjs:63`.

**Failure scenario:** A moderator can file a user-targeted ticket about themselves, another moderator, or the admin. Filing then creates the permanent ticket, admin bells, and a log entry for an expressly forbidden target.

**Recommended fix:** Resolve target role inside the transaction, call `assertActionableTarget`, and serialize against role changes. Cover self/moderator/admin via both username and ID plus a promotion race.

### STAFF-CR-03 [P1] The ticket list silently drops rows after 100

**Status 2026-10-28: Done.** staffTicketService.mjs listTickets(staff, status, cursor) keyset-pages on (createdAt,id) through staffTicketCursor.mjs; tested in staffTicketPagingAuthz.integration.test.mjs.

**Evidence:** `backend/modules/staff/services/staffTicketService.mjs:21`; `backend/modules/staff/services/staffTicketService.mjs:168`.

**Failure scenario:** Once 101 tickets match, the oldest disappears from the only staff UI with no cursor or older-results control. An unresolved moderation issue can become unreachable while remaining in the database.

**Recommended fix:** Add stable `(createdAt,id)` cursor pagination through backend and UI, retaining ownership/status filters. Prove traversal of more than 100 tied-timestamp rows without omission, duplication, or cross-moderator disclosure.

### STAFF-CR-04 [P1] The doctrine sentinel suite cannot run from the documented test command

**Status 2026-10-28: Done.** backend/**tests**/scripts/staffRoutesGuarded.sentinel.test.mjs resolves HERE from import.meta.url and its afterAll guards on tmp.

**Evidence:** `backend/__tests__/scripts/staffRoutesGuarded.sentinel.test.mjs:12`; `backend/__tests__/scripts/staffRoutesGuarded.sentinel.test.mjs:23`; `backend/__tests__/scripts/staffRoutesGuarded.sentinel.test.mjs:28`.

**Failure scenario:** The root backend test command resolves the checker at `C:\Users\heirr\Desktop\scripts\...`; all eight assertions fail before scanning, then teardown throws because `tmp` was never initialized. The normal backend project is red while the standalone shell gate is green.

**Recommended fix:** Resolve from `import.meta.url`, make teardown setup-failure-safe, and prove the sentinel passes via the exact root `npm run test:backend -- --runTestsByPath ...` invocation.

### STAFF-CR-05 [P1] The doctrine scanner certifies unguarded routes

**Status 2026-10-28: Partly done, tracked in Equoria-plbec (tracked with STAFF-RR-09).** Covered by STAFF-RR-09.

**Evidence:** `scripts/doctrine-checks/check-staff-routes-guarded.mjs:27`; `scripts/doctrine-checks/check-staff-routes-guarded.mjs:94`; `scripts/doctrine-checks/check-staff-routes-guarded.mjs:108`.

**Failure scenario:** The scanner reports no violation when a capability guard appears after the handler, is passed through a wrapper that discards it, or the Express Router is named anything except `router`. `run-all.sh` can therefore remain green while a staff endpoint is unguarded.

**Recommended fix:** Use AST-aware, fail-closed route analysis that recognizes every router registration and requires a direct approved guard before the handler. Add planted sentinel cases for order, wrapper/no-op, alias, computed/unsupported forms, and the real route tree.

### STAFF-CR-06 [P1] No fresh-code primitive exists for time-back

**Status 2026-10-28: Open, tracked in Equoria-puj1e.5.** Build the purpose-bound one-time fresh proof and requireFreshStaffProof guard per docs/features/admin-time-back.md before any time-back/jobs.hold route is mounted; the stopgap scan gap is STAFF-RR-13.

**Evidence:** `backend/modules/staff/middleware/requireStaffCapability.mjs:56`; `backend/modules/staff/middleware/requireStaffCapability.mjs:98`; `backend/modules/staff/capabilities.mjs:22`; `backend/modules/staff/services/staffCheckinService.mjs:189`. Contract: `docs/features/staff-foundation.md:57`.

**Failure scenario:** The supplied `time-back` capability can only be protected by a device trusted for up to 30 days. A future apply/reverse route has no foundation primitive that can enforce the required fresh code.

**Recommended fix:** Add a purpose-bound, short-lived, one-use fresh-check-in proof, invalidated by password/email/role changes and atomically consumed by apply/reverse. If delivery is assigned to the time-back project, mark it an explicit release blocker and do not mount the route beforehand.

### STAFF-CR-07 [P2] Horse/show/post ticket targets are not validated

**Status 2026-10-28: Partly done, tracked in Equoria-q4gt7 (tracked with STAFF-RR-03).** Covered by STAFF-RR-03 and STAFF-RR-04.

**Evidence:** `backend/modules/staff/controllers/staffTicketController.mjs:51`; `backend/modules/staff/services/staffTicketService.mjs:114`.

**Failure scenario:** Any nonblank string can become a horse, show, or post target, producing a permanent ticket, notifications, and log for an entity that never existed.

**Recommended fix:** Resolve every target against its authoritative model inside the filing transaction and add malformed, missing, deleted, and wrong-type regressions.

### STAFF-CR-08 [P2] Ticket status ignores the approved one-way state machine

**Status 2026-10-28: Done.** Owner ruling (b) 2026-10-13 allows any status to become any other. staffTicketService.mjs setStatus refuses same_status and uses a conditional updateMany, so only one racer wins (conflict).

**Evidence:** `backend/modules/staff/controllers/staffTicketController.mjs:142`; `backend/modules/staff/services/staffTicketService.mjs:238`. Contract: `docs/features/staff-foundation.md:86`.

**Failure scenario:** An admin can reopen terminal tickets, skip required intermediate state, or write the same state; the latter still creates a misleading log and bell despite no change.

**Recommended fix:** Enforce `open -> in_progress -> resolved|declined`, reject reverse/skip/same-state writes, preserve conditional concurrency, and test every edge plus simultaneous decisions.

### STAFF-CR-09 [P2] Ticket threads load every reply

**Status 2026-10-28: Done.** staffTicketService.mjs getTicket(staff, id, before) cursor-pages replies by REPLY_PAGE_SIZE=50.

**Evidence:** `backend/modules/staff/services/staffTicketService.mjs:182`.

**Failure scenario:** A long-lived ticket with thousands of maximum-size replies must be read and serialized in one response, risking slow requests, memory pressure, and proxy-size failure.

**Recommended fix:** Cursor-page replies with deterministic ordering and incremental UI loading; preserve former-author rendering.

### STAFF-CR-10 [P2] Required ticket email has no durable delivery ownership

**Status 2026-10-28: Partly done, tracked in Equoria-dqvg7 (tracked with STAFF-RR-02).** Covered by STAFF-RR-02, RR-06, RR-08. Erasure parts superseded (no account deletion ruling).

**Evidence:** `backend/modules/staff/services/staffTicketService.mjs:154`. Contract: `docs/features/staff-foundation.md:91`.

**Failure scenario:** The ticket commits and returns 201, then a process exit/redeploy before the detached promise runs permanently loses the required admin email. No durable retry record exists.

**Recommended fix:** Insert an idempotent outbox job in the ticket transaction and deliver/retry from a worker, with visible terminal failure and crash/idempotency tests.

### STAFF-CR-11 [P2] Revoked moderators receive staff-ticket notifications

**Status 2026-10-28: Done.** staffTicketService.mjs filerStillStaff re-reads the filer's role FOR SHARE before belling in addReply/setStatus, and staffRolesController.mjs deletes unread STAFF_BELL_TYPES on demotion.

**Evidence:** `backend/modules/staff/services/staffTicketService.mjs:217`; `backend/modules/staff/services/staffTicketService.mjs:261`; `frontend/src/pages/messages/GameNotifRow.tsx:265`.

**Failure scenario:** After the filer is demoted to player, later replies/resolution still put ticket number/status into their normal notification feed and link them to the inaccessible office.

**Recommended fix:** Resolve recipients from fresh staff roles inside the transaction and define cleanup/visibility of unread staff-only bells on demotion.

### STAFF-CR-12 [P2] Capability authorization is mutable at runtime

**Status 2026-10-28: Done.** backend/modules/staff/capabilities.mjs keeps ROLE_CAPABILITIES private (not exported), freezes arrays, and capabilitiesFor/rolesWithCapability return frozen copies.

**Evidence:** `backend/modules/staff/capabilities.mjs:34`; `backend/modules/staff/capabilities.mjs:56`.

**Failure scenario:** An importer can call `ROLE_CAPABILITIES.moderator.add('roles.manage')`; the shallow-frozen object permits it and every subsequent guard grants the admin capability.

**Recommended fix:** Keep immutable policy data private and expose predicates/defensive projections, with a regression proving callers cannot mutate effective authorization.

### STAFF-CR-13 [P2] Editing a pending ticket can enable duplicate submissions

**Status 2026-10-28: Done.** frontend/src/components/staff/StaffTickets.tsx guards submit on file.isPending and disables every filing control while pending.

**Evidence:** `frontend/src/components/staff/StaffTickets.tsx:76`; `frontend/src/components/staff/StaffTickets.tsx:108`; `frontend/src/components/staff/StaffTickets.tsx:139`; `frontend/src/components/staff/StaffTickets.tsx:175`.

**Failure scenario:** On a slow request, editing the subject calls `file.reset()`, clears pending UI state, and can re-enable submit before request one finishes. A second submit produces duplicate tickets/logs/bells/emails and racing completion callbacks.

**Recommended fix:** Never reset an in-flight mutation, disable the filing controls while pending, guard submit by pending state, and add a deferred-network one-request test.

### STAFF-CR-14 [P2] Changing non-user target type retains the previous ID

**Status 2026-10-28: Done.** StaffTickets.tsx calls setTargetId('') when the target type changes.

**Evidence:** `frontend/src/components/staff/StaffTickets.tsx:62`; `frontend/src/components/staff/StaffTickets.tsx:73`; `frontend/src/components/staff/StaffTickets.tsx:108`.

**Failure scenario:** Enter post ID 42, switch to horse, and the form remains ready with ID 42. If both entities exist, the moderator files against a horse they never selected.

**Recommended fix:** Clear the ID on target-type change or maintain separately labelled state and require explicit entry; test every cross-type switch.

### STAFF-CR-15 [P2] Reply success leaves the visible action log stale

**Status 2026-10-28: Done.** The 10-20 re-review confirmed that the reply mutation in frontend/src/hooks/api/useStaff.ts invalidates the thread and the staff log keys. No later change undid it.

**Evidence:** `frontend/src/hooks/api/useStaff.ts:172`; comparison paths `frontend/src/hooks/api/useStaff.ts:160` and `frontend/src/hooks/api/useStaff.ts:181`.

**Failure scenario:** The backend atomically logs `ticket.reply`, but the hook invalidates only the thread. An already-visible Ledger omits the new permanent action until another refresh.

**Recommended fix:** Invalidate the ticket and all staff-log queries on success; cover query cache and a mounted thread/ledger screen.

### STAFF-CR-16 [P2] Former staff cannot be selected in the ledger actor filter

**Status 2026-10-28: Done.** useStaff.ts useStaffLogActors (staffKeys.logActors) feeds StaffActionLog.tsx, which labels off-list or erased actors as a former steward with a short reference; covered by staffLogActorsAuthz.integration.test.mjs.

**Evidence:** `frontend/src/components/staff/StaffActionLog.tsx:136`; `frontend/src/components/staff/StaffActionLog.tsx:148`; `frontend/src/components/staff/StaffActionLog.tsx:225`. Contract: `docs/features/staff-foundation.md:75`.

**Failure scenario:** Revoked/erased staff entries remain and display as former steward, but filter options come only from the current staff list. The admin cannot isolate that actor’s permanent history.

**Recommended fix:** Populate an admin-only actor source from distinct ledger actors, with current name or former/short-ID fallback, independent of the currently loaded log page.

### STAFF-CR-17 [P2] The hidden client route is distinguishable from an unknown path

**Status 2026-10-28: Partly done, tracked in Equoria-jqdho (tracked with STAFF-RR-10).** Covered by STAFF-RR-10 and STAFF-RR-11.

**Evidence:** `frontend/src/App.tsx:69`; `frontend/src/App.tsx:102`; `frontend/src/pages/StewardsOfficePage.tsx:37`. Contract: `docs/features/staff-foundation.md:64`.

**Failure scenario:** A non-staff `/steward` visit redirects home, an anonymous visit encounters protected-route behavior, and an arbitrary unknown URL has no matching route. The known path therefore does not behave like a page that does not exist.

**Recommended fix:** Establish one client not-found behavior and make unauthorized/anonymous steward results identical in DOM, URL/history, and auth side effects.

### STAFF-CR-18 [P2] Check-in secrets/devices have no retention cleanup

**Status 2026-10-28: Done.** backend/services/jobs/staffCheckinRetentionJob.mjs runs staffCheckinRetentionService.mjs on a schedule; covered by staffCheckinRetention.integration.test.mjs.

**Evidence:** `backend/modules/staff/services/staffCheckinService.mjs:132`; `backend/modules/staff/services/staffCheckinService.mjs:201`; `packages/database/prisma/schema.prisma:2152`; `packages/database/prisma/schema.prisma:2166`.

**Failure scenario:** Every expired/used code and expired/revoked device remains forever. Normal use grows both tables without bound and retains obsolete secret-derived data beyond operational need.

**Recommended fix:** Define retention and schedule idempotent indexed cleanup. Preserve audit facts in `StaffActionLog`, not obsolete challenge/device rows; add boundary tests.

### Verification

- Focused staff backend: four suites / 74 tests passed; doctrine sentinel suite failed eight tests before assertions because of STAFF-CR-04, making the combined command exit 1.
- Focused frontend: two files / 41 tests passed, but lacks coverage for STAFF-CR-13 through STAFF-CR-15.
- Doctrine: all 47 standalone checks passed; direct planted probes still demonstrated STAFF-CR-05.
- Later commit `1940999e3` correctly resolved former-staff erasure persistence and is not an active finding.
- No application or test source was modified by this review. Existing unrelated working-tree changes were preserved.

VERDICT: REVISE

## 2026-10-21 — Equoria-g3n8c / Equoria-eb6yb adversarial review

Scope: the six landed g3n8c commits `0e6a99dbb`, `9d7b94499`,
`4ee8b0f5d`, `60bddab94`, `59ac5d684`, and `699a8170f`; current master
`bc5d5519f`; the seven still-red E2E cases; the proposed eb6yb test-only
change; owner decisions 22/23/24; and
`%TEMP%\equoria-g3n8c-eb6yb-handoff.md`. Correctness and security only.

Decisive state check: none of the remaining issue paths changed between the
handoff baseline `b527a81a3` and current HEAD. The latest Test workflow on
current HEAD, run `39488123868`, still failed in `E2E Tests (Playwright)` while
lint, backend shards, frontend tests, Security Gate, Beta Readiness, and the
production build passed. The remaining work is unimplemented, not awaiting
review.

### Adversarial lens

#### ADV-01 — Prize history never attempts the owner-required offline request

**Status 2026-10-28: Done.** frontend/src/hooks/api/usePrizeHistory.ts useQuery sets networkMode: 'always'; usePrizeHistory.test.tsx offline case asserts isError and fetchStatus not 'paused' via onlineManager. Commit 90184dd34 (Equoria-g3n8c).

- **Location:** `frontend/src/hooks/api/usePrizeHistory.ts:79-86`
- **Trigger:** A date-filter change creates a cold query while the browser is offline.
- **Concrete failure:** TanStack's default online network mode pauses the query instead of rejecting, so `isError` and the retry card never arrive.
- **Required fix:** Set `networkMode: 'always'` on this hook only and verify the real retry policy reaches error.

#### ADV-02 — Prize statistics treat unresolved as successful zeroes

**Status 2026-10-28: Done.** frontend/src/pages/PrizeHistoryPage.tsx stats section renders StatCardSkeleton when !isSuccess and real StatCards only on isSuccess. Commit 90184dd34.

- **Location:** `frontend/src/pages/PrizeHistoryPage.tsx:192,251-288`
- **Trigger:** The query is pending/paused with no data, `isLoading=false`, and `isError=false`.
- **Concrete failure:** The player sees zero prize money, zero competitions, and zero win rate before any response exists.
- **Required fix:** Use `isPending` for unresolved rendering and gate real stat cards on `isSuccess`.

#### ADV-03 — Prize history treats unresolved as a successful empty list

**Status 2026-10-28: Done.** PrizeHistoryPage.tsx passes PrizeTransactionHistory transactions={isSuccess ? transactions : []} with isLoading={!isSuccess}, so the empty state is reachable only via success; 'the honest empty state is reachable only via a successful, genuinely-empty fetch' test. Commit 90184dd34.

- **Location:** `frontend/src/pages/PrizeHistoryPage.tsx:299-306`
- **Trigger:** The query is pending/paused with `transactions` undefined.
- **Concrete failure:** `transactions ?? []` renders `No transactions yet` although the server never returned an empty list.
- **Required fix:** Mount `PrizeTransactionHistory` only on `isSuccess` and pass server-derived data.

#### ADV-04 — Existing component tests miss the exact paused state

**Status 2026-10-28: Done.** PrizeHistoryPage.test.tsx 'an unresolved query with no data renders neither zero stats nor the empty state' uses the real hook in its disabled unresolved state (isSuccess/isError/isLoading all false) and asserts no empty text and no stat cards.

- **Location:** `frontend/src/pages/__tests__/PrizeHistoryPage.test.tsx:553-606`
- **Trigger:** The page regresses to `!isError` gating while ordinary loading, HTTP error, and success tests still pass.
- **Concrete failure:** The false-empty bug returns without a component test failing.
- **Required fix:** Add a real-hook unresolved/paused case asserting no empty state and no zero stats.

#### ADV-05 — Bank's query also pauses offline

**Status 2026-10-28: Done.** frontend/src/hooks/api/useTransactionHistory.ts sets networkMode: 'always'; useTransactionHistory.test.ts 'an offline fetch runs and reaches the error state instead of pausing'. Commit 90184dd34 (Equoria-0isqi).

- **Location:** `frontend/src/hooks/api/useTransactionHistory.ts:43-53`
- **Trigger:** A transaction-history request is attempted offline.
- **Concrete failure:** The query pauses indefinitely instead of reaching BankPage's owner-required error card.
- **Required fix:** Set `networkMode: 'always'` on this hook and add an offline hook regression.

#### ADV-06 — The bank E2E loses at the lazy-route boundary

**Status 2026-10-28: Done.** tests/e2e/bank-transactions.spec.ts 'a failed transaction fetch renders an error + retry, never a false empty' opens The Vault online (h1 asserted, first 200 ledger response awaited) before setOffline(true).

- **Location:** `tests/e2e/bank-transactions.spec.ts:56-68`
- **Trigger:** Networking is disabled before the lazily imported BankPage chunk loads.
- **Concrete failure:** The app ErrorBoundary shows `Something went wrong`; BankPage never mounts.
- **Required fix:** Load and prove BankPage online before disabling networking.

#### ADV-07 — Online-first alone still does not trigger a failed bank request

**Status 2026-10-28: Done.** Same spec uses a different deterministic trigger than the suggested Refresh control: page.clock.install, goBack, fastForward('06:00') past the 5-minute gcTime, setOffline, goForward, so the ledger query is cold and must fetch offline. Bead Equoria-g3n8c close reason records the spec passing (42 passed run on 94d8a1f71).

- **Location:** `tests/e2e/bank-transactions.spec.ts:49-53,59-68`
- **Trigger:** BankPage loads successfully, then the browser goes offline, with no user refetch action.
- **Concrete failure:** The two-minute-fresh transaction query remains cached, so no error request occurs and the alert times out.
- **Required fix:** Add and exercise a deterministic real user refetch trigger after going offline; the recommended implementation is an accessible ledger Refresh control wired to `refetchTransactions`.

#### ADV-08 — The anonymous onboarding test asserts the retired contract

**Status 2026-10-28: Done.** tests/e2e/onboarding-flow.spec.ts 'unauthenticated user visiting /onboarding is sent to /login, not the wizard' asserts toHaveURL(/\/login/) and that the 'Welcome to Equoria' wizard h1 has count 0. Commit a47e358a3 (Equoria-bvddn.36). It checks the URL, not a login-form element.

- **Location:** `tests/e2e/onboarding-flow.spec.ts:29-35`
- **Trigger:** A logged-out visitor opens the now-protected `/onboarding` route.
- **Concrete failure:** The test waits for wizard UI on `/login`.
- **Required fix:** Assert the exact login redirect and login surface, with the wizard absent.

#### ADV-09 — Step-one onboarding test is never authenticated

**Status 2026-10-28: Done.** onboarding-flow.spec.ts step-1 test calls registerFreshPlayer(page) (real registration sets auth cookies, then opens /onboarding). Commit a47e358a3.

- **Location:** `tests/e2e/onboarding-flow.spec.ts:70-93`
- **Trigger:** The suite-wide empty storage state is used.
- **Concrete failure:** The test lands on `/login` and never observes step one.
- **Required fix:** Register/authenticate a fresh onboarding-incomplete player first.

#### ADV-10 — Step-two onboarding test is never authenticated

**Status 2026-10-28: Done.** Step-2 test 'onboarding wizard step 2 shows Choose Your Horse' calls registerFreshPlayer first and exercises the breed-selector radiogroup. Commit a47e358a3.

- **Location:** `tests/e2e/onboarding-flow.spec.ts:95-119`
- **Trigger:** The suite-wide empty storage state is used.
- **Concrete failure:** The test times out before it can exercise the breed selector.
- **Required fix:** Register/authenticate a fresh onboarding-incomplete player first.

#### ADV-11 — Step-three onboarding test is never authenticated

**Status 2026-10-28: Done.** Step-3 test calls registerFreshPlayer and drives breed, Mare, horse-name-input and Continue to "You're Ready!". Commit a47e358a3.

- **Location:** `tests/e2e/onboarding-flow.spec.ts:121-169`
- **Trigger:** The suite-wide empty storage state is used.
- **Concrete failure:** None of the breed, gender, horse-name, or confirmation path is exercised.
- **Required fix:** Register/authenticate a fresh onboarding-incomplete player first.

#### ADV-12 — Onboarding progress test is never authenticated

**Status 2026-10-28: Done.** 'onboarding progress dots reflect current step' calls registerFreshPlayer and asserts the progressbar aria-valuenow 1 then 2. Commit a47e358a3.

- **Location:** `tests/e2e/onboarding-flow.spec.ts:171-192`
- **Trigger:** The suite-wide empty storage state is used.
- **Concrete failure:** The progressbar never mounts and the test fails at the welcome heading.
- **Required fix:** Register/authenticate a fresh onboarding-incomplete player first.

#### ADV-13 — The tempting seeded-player fixture creates the wrong state

**Status 2026-10-28: Done.** Wizard tests use the local registerFreshPlayer helper (no advance/complete-onboarding); createSeededPlayerSession in tests/e2e/fixtures/seededPlayer.ts is not used in onboarding-flow.spec.ts.

- **Location:** `tests/e2e/fixtures/seededPlayer.ts:186-214`
- **Trigger:** Claude reuses `createSeededPlayerSession` for wizard cases.
- **Concrete failure:** The helper advances and completes onboarding, so `/onboarding` redirects away from the wizard.
- **Required fix:** Use a separate helper that authenticates but deliberately does not advance/complete onboarding.

#### ADV-14 — Registration can bypass onboarding without failing its test

**Status 2026-10-28: Open, tracked in Equoria-vrt5o.** Require /onboarding and a wizard element (h1 'Welcome to Equoria') after registration; this tightens, not changes, the specified behavior. registerFreshPlayer self-navigates to /onboarding so it cannot cover the redirect.

- **Location:** `tests/e2e/onboarding-flow.spec.ts:60-67`
- **Trigger:** A regression redirects a newly registered user to `/`.
- **Concrete failure:** The regex accepts both `/` and `/onboarding`, and the only other assertion is “not register.”
- **Required fix:** Require `/onboarding` and a wizard-specific visible assertion.

#### ADV-15 — The Prisma sentinel assumes server teardown is synchronous

**Status 2026-10-28: Done.** backend/**tests**/prismaCleanupLifecycle.sentinel.test.mjs connectionGoneWithin polls connectionExists every 25 ms with a 5000 ms deadline (backendExitBoundMs); the pre-cleanup connectionExists === true assertion is kept. Commit 055b602e0, bead Equoria-eb6yb closed; owner ruling equoria-flaky-tests-may-be-fixed-typefaces-in-design.md allows it.

- **Location:** `backend/__tests__/prismaCleanupLifecycle.sentinel.test.mjs:176-186`
- **Trigger:** PostgreSQL retains the backend row briefly after `$disconnect()` resolves.
- **Concrete failure:** Correct cleanup fails nondeterministically in CI.
- **Required fix:** Poll the exact backend about every 50 ms with a hard approximately five-second deadline, clear failure text, and the pre-cleanup assertion preserved.

### Edge-case hunter lens

The edge-case pass independently reproduced ADV-01, ADV-02/03, ADV-05,
ADV-06/07, ADV-08-12, and ADV-15. It also found four directly reachable gaps
in the already-landed fixes:

#### EDGE-01 — Malformed hire success can leak a rider

**Status 2026-10-28: Done.** tests/e2e/core-game-flows.spec.ts AC5 entry flow checks Number.isInteger(hiredRiderId) && > 0 before assignment and runs on a disposable createSeededPlayerSession player, so a malformed hire cannot leak into the shared account. Commit bbaff7e3e.

- **Location:** `tests/e2e/core-game-flows.spec.ts:298-316`
- **Trigger:** The hire route returns 201 but omits or corrupts `rider.id`.
- **Concrete failure:** Assignment receives `undefined`, and cleanup is skipped because `hiredRiderId` was never established.
- **Required fix:** Validate a positive integer id before assignment and use isolated/scoped fixture ownership that remains cleanable on malformed output.

#### EDGE-02 — A persisted show entry poisons Playwright retry

**Status 2026-10-28: Done.** The AC5 entry test creates a fresh disposable player (and starter horse) on every attempt, so a retry never meets ALREADY_ENTERED. Commit bbaff7e3e (Equoria-0vhop).

- **Location:** `tests/e2e/core-game-flows.spec.ts:372-416`
- **Trigger:** Entry commits, then the response is lost or later cleanup/assertion fails.
- **Concrete failure:** Retry uses the same horse/show and receives `ALREADY_ENTERED` rather than testing the original flow.
- **Required fix:** Prefer a disposable seeded player per attempt or track and fail-loud clean the exact ShowEntry.

#### EDGE-03 — Rider cleanup does not undo the shared-account debit

**Status 2026-10-28: Done.** The rider hire and fee now land on the disposable player from createSeededPlayerSession, not the shared global-setup account. Commit bbaff7e3e.

- **Location:** `tests/e2e/core-game-flows.spec.ts:294-317`
- **Trigger:** The test hires then dismisses a rider against the shared E2E account.
- **Concrete failure:** The one-week upfront cost and ledger debit remain, so retries/repeated runs drain shared funds and pollute later money tests.
- **Required fix:** Run this flow as a disposable player rather than mutating the shared account.

#### EDGE-04 — Prize fixture creation is not atomic

**Status 2026-10-28: Done.** tests/e2e/fixtures/prizeHistory.ts creates the Show with a nested competitionResults create in one prisma.show.create (atomic), checks for exactly one result, and removeSeededPrizeResult fails loudly on a delete count mismatch. Commit bbaff7e3e.

- **Location:** `tests/e2e/fixtures/prizeHistory.ts:62-90`
- **Trigger:** CompetitionResult creation fails after Show creation succeeds.
- **Concrete failure:** An orphaned completed show remains in the shared lane database.
- **Required fix:** Create both rows in one Prisma transaction and retain exact fail-loud cleanup.

### Verification-gap lens

**Status 2026-10-28: Done.** All six verification gaps below are closed: offline and unresolved-query tests now exist in usePrizeHistory.test.tsx, PrizeHistoryPage.test.tsx and useTransactionHistory.test.ts, the bank E2E reaches the error state through a cold offline query, and each onboarding wizard case authenticates through registerFreshPlayer (commits 90184dd34, a47e358a3).

The verification pass independently reproduced ADV-04, ADV-07, ADV-14,
ADV-15, and the onboarding authentication gap. Its evidence boundaries are:

- `frontend/src/pages/__tests__/PrizeHistoryPage.test.tsx:220-233,554-598`
  covers active loading, terminal error, and success, but not
  `isSuccess=false/isError=false/isLoading=false`.
- A repository-wide search for `onlineManager`, `networkMode`, and paused
  `fetchStatus` found no PrizeHistoryPage regression for that state.
- `frontend/src/hooks/api/__tests__/useTransactionHistory.test.ts:51-116`
  covers online success, disabled, and pagination only.
- `frontend/src/pages/__tests__/BankPage.test.tsx:127-146` produces an online
  HTTP 500, not an offline network-mode failure.
- `tests/e2e/bank-transactions.spec.ts:41-55` itself documents that both the
  current path and the proposed warm-only path fail to reach the intended
  branch without a deterministic refetch.
- `tests/e2e/onboarding-flow.spec.ts:18-19` installs anonymous storage state for
  every wizard case, while `tests/e2e/fixtures/seededPlayer.ts:186-214`
  completes onboarding and cannot substitute unchanged.

### Recommended implementer handoff

The controlling, step-by-step Claude handoff is
`C:\Users\heirr\AppData\Local\Temp\equoria-g3n8c-eb6yb-handoff.md`. It now
includes the bank refetch correction, the four cleanup gaps from the landed
work, exact state-machine requirements, bounded-poll approval, negative plants,
verification order, shared-checkout rules, and definitions of finished.

### Canonical findings JSON

```json
[
  {
    "lens": "adversarial",
    "location": "frontend/src/hooks/api/usePrizeHistory.ts:79-86",
    "trigger_condition": "An offline filter change starts a cold query under the default online network mode.",
    "guard_snippet": "Add networkMode: 'always' to this hook only and verify the real retry path reaches error.",
    "potential_consequence": "The query pauses and the required error card never appears."
  },
  {
    "lens": "adversarial",
    "location": "frontend/src/pages/PrizeHistoryPage.tsx:192,251-288",
    "trigger_condition": "The query is unresolved with isLoading=false, isError=false, and no data.",
    "guard_snippet": "Render unresolved from isPending and resolved stats only from isSuccess.",
    "potential_consequence": "The page fabricates zero prize statistics before a response exists."
  },
  {
    "lens": "adversarial",
    "location": "frontend/src/pages/PrizeHistoryPage.tsx:299-306",
    "trigger_condition": "The query is unresolved and transactions is undefined.",
    "guard_snippet": "Mount PrizeTransactionHistory only on isSuccess and pass server-derived data.",
    "potential_consequence": "The page lies that there are no transactions without a successful empty response."
  },
  {
    "lens": "adversarial",
    "location": "frontend/src/pages/__tests__/PrizeHistoryPage.test.tsx:553-606",
    "trigger_condition": "The page regresses on paused/pending state while ordinary loading/error/success tests pass.",
    "guard_snippet": "Add a real-hook unresolved regression asserting no empty state and no zero stats.",
    "potential_consequence": "The exact false-empty bug can return undetected."
  },
  {
    "lens": "adversarial",
    "location": "frontend/src/hooks/api/useTransactionHistory.ts:43-53",
    "trigger_condition": "A transaction-history request is attempted offline.",
    "guard_snippet": "Add networkMode: 'always' and an offline hook regression.",
    "potential_consequence": "The bank query pauses instead of surfacing error and retry."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/bank-transactions.spec.ts:56-68",
    "trigger_condition": "Networking is disabled before the lazy BankPage chunk loads.",
    "guard_snippet": "Mount BankPage online and prove its h1 before disabling networking.",
    "potential_consequence": "The app ErrorBoundary replaces BankPage and the intended branch is never tested."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/bank-transactions.spec.ts:49-53,59-68",
    "trigger_condition": "BankPage is warmed online but no action refetches its two-minute-fresh query offline.",
    "guard_snippet": "Provide and exercise a deterministic real user refetch trigger after going offline.",
    "potential_consequence": "No failed request occurs and the alert assertion still times out."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/onboarding-flow.spec.ts:29-35",
    "trigger_condition": "A logged-out visitor opens the protected onboarding route.",
    "guard_snippet": "Assert exact /login redirect and login UI, with wizard absent.",
    "potential_consequence": "The test waits for a wizard that correctly cannot render."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/onboarding-flow.spec.ts:70-93",
    "trigger_condition": "The step-one case uses anonymous suite storage.",
    "guard_snippet": "Authenticate a fresh onboarding-incomplete player first.",
    "potential_consequence": "The test lands on login and never checks step one."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/onboarding-flow.spec.ts:95-119",
    "trigger_condition": "The step-two case uses anonymous suite storage.",
    "guard_snippet": "Authenticate a fresh onboarding-incomplete player first.",
    "potential_consequence": "The breed selector path remains unverified."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/onboarding-flow.spec.ts:121-169",
    "trigger_condition": "The step-three case uses anonymous suite storage.",
    "guard_snippet": "Authenticate a fresh onboarding-incomplete player first.",
    "potential_consequence": "The complete wizard path remains unverified."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/onboarding-flow.spec.ts:171-192",
    "trigger_condition": "The progress case uses anonymous suite storage.",
    "guard_snippet": "Authenticate a fresh onboarding-incomplete player first.",
    "potential_consequence": "The progressbar never mounts and its behavior is unverified."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/fixtures/seededPlayer.ts:186-214",
    "trigger_condition": "createSeededPlayerSession is reused for wizard tests.",
    "guard_snippet": "Use a helper that authenticates without advancing or completing onboarding.",
    "potential_consequence": "The helper creates completed state and redirects away from the wizard."
  },
  {
    "lens": "adversarial",
    "location": "tests/e2e/onboarding-flow.spec.ts:60-67",
    "trigger_condition": "Registration incorrectly redirects a new player to the home page.",
    "guard_snippet": "Require /onboarding and a wizard-specific visible assertion.",
    "potential_consequence": "Mandatory-onboarding bypass passes the current test."
  },
  {
    "lens": "adversarial",
    "location": "backend/__tests__/prismaCleanupLifecycle.sentinel.test.mjs:176-186",
    "trigger_condition": "Postgres retains the backend row briefly after Prisma disconnect resolves.",
    "guard_snippet": "Poll the exact backend every about 50 ms with a hard about-five-second deadline.",
    "potential_consequence": "Correct cleanup fails nondeterministically in CI."
  },
  {
    "lens": "edge-case-hunter",
    "location": "frontend/src/hooks/api/usePrizeHistory.ts:80-86",
    "trigger_condition": "A cold prize query starts while offline",
    "guard_snippet": "Add networkMode: 'always' to this useQuery only.",
    "potential_consequence": "The query pauses forever and never reaches the required error card"
  },
  {
    "lens": "edge-case-hunter",
    "location": "frontend/src/pages/PrizeHistoryPage.tsx:251-306",
    "trigger_condition": "A prize query is pending but paused, without isError",
    "guard_snippet": "Render data sections only when isSuccess; render loading from isPending.",
    "potential_consequence": "Offline users see fabricated zero statistics and a false empty history"
  },
  {
    "lens": "edge-case-hunter",
    "location": "frontend/src/hooks/api/useTransactionHistory.ts:48-53",
    "trigger_condition": "The bank transaction query runs after connectivity disappears",
    "guard_snippet": "Add networkMode: 'always' to the transaction-history query.",
    "potential_consequence": "The query pauses instead of exposing the bank error and retry state"
  },
  {
    "lens": "edge-case-hunter",
    "location": "tests/e2e/bank-transactions.spec.ts:56-69",
    "trigger_condition": "The test disables networking before BankPage's lazy chunk loads",
    "guard_snippet": "Load BankPage online and confirm its heading before disabling networking.",
    "potential_consequence": "The application ErrorBoundary renders instead of exercising BankPage's error branch"
  },
  {
    "lens": "edge-case-hunter",
    "location": "tests/e2e/bank-transactions.spec.ts:49-55",
    "trigger_condition": "BankPage loads online before the test disables networking",
    "guard_snippet": "Provide and exercise a deterministic in-page refetch trigger after going offline.",
    "potential_consequence": "Fresh cached transactions remain successful, so the expected error never appears"
  },
  {
    "lens": "edge-case-hunter",
    "location": "tests/e2e/onboarding-flow.spec.ts:29-35",
    "trigger_condition": "An unauthenticated visitor opens the protected onboarding route",
    "guard_snippet": "Assert the /login URL and login-page content instead of wizard content.",
    "potential_consequence": "The test waits for a wizard that correctly never renders"
  },
  {
    "lens": "edge-case-hunter",
    "location": "tests/e2e/onboarding-flow.spec.ts:70-192",
    "trigger_condition": "Wizard tests navigate with explicitly empty storage state",
    "guard_snippet": "Register and authenticate a fresh incomplete-onboarding user before each wizard test.",
    "potential_consequence": "All wizard tests redirect to login without exercising the wizard"
  },
  {
    "lens": "edge-case-hunter",
    "location": "backend/__tests__/prismaCleanupLifecycle.sentinel.test.mjs:176-186",
    "trigger_condition": "Postgres retains pg_stat_activity briefly after disconnect resolves",
    "guard_snippet": "Poll connectionExists every 50ms until false or a hard five-second deadline.",
    "potential_consequence": "Correct cleanup fails nondeterministically on slower CI scheduling"
  },
  {
    "lens": "edge-case-hunter",
    "location": "tests/e2e/core-game-flows.spec.ts:298-316",
    "trigger_condition": "A successful rider-hire response omits or corrupts rider.id",
    "guard_snippet": "Validate a positive integer id and establish recoverable scoped ownership.",
    "potential_consequence": "The hired rider leaks because cleanup is skipped"
  },
  {
    "lens": "edge-case-hunter",
    "location": "tests/e2e/core-game-flows.spec.ts:372-416",
    "trigger_condition": "Entry persists before a later assertion or teardown fails",
    "guard_snippet": "Use a disposable player or track and clean the exact entry in finally.",
    "potential_consequence": "Retry receives an already-entered conflict instead of testing the original flow"
  },
  {
    "lens": "edge-case-hunter",
    "location": "tests/e2e/core-game-flows.spec.ts:294-317",
    "trigger_condition": "The test hires then dismisses a rider against the shared account",
    "guard_snippet": "Run the flow as a disposable player rather than mutating shared money.",
    "potential_consequence": "Retries drain shared funds and pollute later ledger tests"
  },
  {
    "lens": "edge-case-hunter",
    "location": "tests/e2e/fixtures/prizeHistory.ts:62-90",
    "trigger_condition": "CompetitionResult creation fails after Show creation succeeds",
    "guard_snippet": "Create both rows inside one Prisma transaction.",
    "potential_consequence": "A failed fixture leaves an orphaned completed show"
  },
  {
    "lens": "verification-gap",
    "location": "frontend/src/pages/PrizeHistoryPage.tsx:251-305",
    "trigger_condition": "A paused pending query has no data while isError and isLoading are false.",
    "guard_snippet": "Gate resolved sections on isSuccess and add the missing paused-state regression.",
    "potential_consequence": "networkMode can make E2E green while the page remains wrong for other paused states.",
    "gap_shape": "regression-gap",
    "consumer": "PrizeHistoryPage stats and history branches at frontend/src/pages/PrizeHistoryPage.tsx:251-305",
    "evidence": "PrizeHistoryPage.test.tsx:220-233 covers active fetch; 554-598 covers terminal error/success; repository search found no paused page case."
  },
  {
    "lens": "verification-gap",
    "location": "tests/e2e/bank-transactions.spec.ts:56-68",
    "trigger_condition": "The test observes the app ErrorBoundary rather than the transaction-query branch.",
    "guard_snippet": "Mount BankPage and then use a deterministic real refetch trigger under offline transport.",
    "potential_consequence": "The proposed reorder can remain unable to verify the offline bank contract.",
    "gap_shape": "broken-verification-gap",
    "consumer": "BankPage ErrorState at frontend/src/pages/BankPage.tsx:196-201",
    "evidence": "The spec documents the lazy-chunk and warm-cache blockers at lines 41-55; BankPage.test.tsx only covers online HTTP 500."
  },
  {
    "lens": "verification-gap",
    "location": "frontend/src/hooks/api/useTransactionHistory.ts:48-53",
    "trigger_condition": "The hook has not adopted decision 24's offline failure contract.",
    "guard_snippet": "Add networkMode: 'always' and prove offline execution/error through onlineManager.",
    "potential_consequence": "All current unit tests stay green while cold offline queries pause.",
    "gap_shape": "missing-adoption-gap",
    "consumer": "BankPage useTransactionHistory consumer at frontend/src/pages/BankPage.tsx:37-43",
    "evidence": "useTransactionHistory.test.ts:51-116 covers only online success, disabled, and pagination."
  },
  {
    "lens": "verification-gap",
    "location": "tests/e2e/onboarding-flow.spec.ts:18-35,70-192",
    "trigger_condition": "Wizard cases clear authentication and visit an auth-required route.",
    "guard_snippet": "Keep the redirect case anonymous; authenticate incomplete users for wizard cases.",
    "potential_consequence": "Wizard regressions cannot be observed because tests fail at login.",
    "gap_shape": "broken-verification-gap",
    "consumer": "Authenticated onboarding wizard in tests/e2e/onboarding-flow.spec.ts:70-192",
    "evidence": "Suite storage is empty at lines 18-19; seededPlayer.ts:186-214 completes onboarding and is not a valid substitute."
  },
  {
    "lens": "verification-gap",
    "location": "tests/e2e/onboarding-flow.spec.ts:37-67",
    "trigger_condition": "Registration sends a new player to home rather than onboarding.",
    "guard_snippet": "Assert exact /onboarding and a wizard-specific surface.",
    "potential_consequence": "A mandatory-onboarding bypass passes verification.",
    "gap_shape": "regression-gap",
    "consumer": "Post-registration OnboardingGuard contract",
    "evidence": "Line 63 accepts both root and onboarding; lines 65-67 only reject register."
  },
  {
    "lens": "verification-gap",
    "location": "backend/__tests__/prismaCleanupLifecycle.sentinel.test.mjs:176-186",
    "trigger_condition": "The sentinel probes pg_stat_activity once immediately after disconnect.",
    "guard_snippet": "Use a bounded poll and prove it still fails when disconnect is planted out.",
    "potential_consequence": "Correct cleanup intermittently fails while real leaks remain distinguishable.",
    "gap_shape": "broken-verification-gap",
    "consumer": "Security Gate cleanup sentinel",
    "evidence": "Lines 184-186 contain cleanup followed by one immediate probe; issue evidence records a same-code retry pass."
  }
]
```

### Verification and limitations

- Read-only repository inspection, commit-range diff, current issue records,
  current CI metadata/logs, source call paths, and existing tests were reviewed.
- No local heavy test run was necessary or safe evidence for the missing
  implementation; current-HEAD CI already demonstrates the seven reds while
  the unit/backend/security jobs pass.
- No application or test source was modified. Repository writes are limited to
  this requested findings-ledger append; the requested temporary handoff was
  updated separately. Unrelated dirty worktree files were preserved.

VERDICT: REVISE

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

**Status 2026-10-28: Done.** Equoria-k09r9 close reason records the fixed small manifest measurement (25-file serial heap 714MB -> 52MB) and the finding that --logHeapUsage sampled before teardown (memory equoria-jest-esm-retention-two-roots.md); diagnostic launcher backend/scripts/diagnose-full-suite.mjs exists.

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

**Status 2026-10-28: Done.** Two named retainers identified: app-import host timers (rateLimiting.mjs MemoryStore intervals + Redis boot timeout) and V8 compilation cache pinning vm moduleRegistries (Equoria-k09r9 closed; memory equoria-jest-esm-retention-two-roots.md).

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

**Status 2026-10-28: Done.** backend/tests/config/PrismaCleanupEnvironment.mjs clears tracked timers after suite hooks and sets --no-compilation-cache; rateLimiting.mjs .finally clear; sentinel backend/**tests**/testEnvironmentTimerRelease.sentinel.test.mjs. Commits e987f0939, fb9f1c8cc; Equoria-k09r9 and Equoria-fusxf closed.

Choose only the branch justified by Phase B:

- **Global lifetime defect:** enable supported cleanup or release the specific owned reference after all suite cleanup. Keep failures observable and cleanup ordered. Extend the real lifecycle sentinel to prove a final suite hook can still query, then the client/owned resources are released.
- **Import/resource lifecycle defect:** move expensive optional initialization behind its existing real enablement condition, or give a resource explicit initialization/disposal. Keep production behavior and the full HTTP middleware/router chain intact. Verify both enabled and disabled paths; retain genuine integration coverage for any optional service boundary changed.
- **Reporter/instrumentation defect:** stop retaining complete suite objects/closures, stream scalar metrics, and verify the measurement apparatus itself remains bounded.
- **Dependency defect:** use a specifically justified supported patch with manifest/lockfile consistency and compatibility evidence. If no supported fix exists, preserve the minimal reproduction and root-cause evidence. Keep containment visibly separate from resolution.

Do not remove resetModules/resetMocks/restoreMocks/clearMocks just to reduce allocations; current doctrine requires them. Do not replace the app with a reduced test-only router that omits auth, ownership, CSRF, request validation or audit behavior. Do not share mutable fixtures, rate-limit state, mocks or transactions across test files as a shortcut.

Prove causality with a small red/green experiment: the old implementation fails the chosen memory/lifecycle contract; the proposed implementation passes; reverting the causal change restores failure. Prefer a stable resource-ownership sentinel plus a supervised memory trend check over a fragile exact-byte assertion. Restore every deliberate defect immediately and verify the final working tree contains only intended edits.

Suggested memory acceptance target: on the fixed manifest, at least 80% less warmup-adjusted growth than the new baseline, with no restart masking the comparison. This is a triage target, not sufficient proof of collection. Extend to 45 files and approximately a current shard's workload only after the smaller result is safe. Growth must stop behaving proportionally to completed files and leave practical headroom for a complete run. If the slope remains materially positive, report remaining retention even if the target is met.

**7. Phase D — isolate parallel execution only if it is still needed**

**Status 2026-10-28: Done.** Two serial lanes with disposable per-run databases (backend/scripts/test-lane-db.mjs, run-suite-sharded.mjs --lanes=2), isolation proven by backend/**tests**/testLaneIsolation.sentinel.test.mjs; commit ce736e4fd; Equoria-bu9c4 closed (6.6-7.0 min, counts reconciled to discovery).

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

**Status 2026-10-28: Partly done, tracked in Equoria-hqrqk.** No publication wrapper holding the lock across fetch + validation + the remote ref update (lock ends inside pre-push); no optional fail-fast shard mode in backend/scripts/run-suite-sharded.mjs; backend/scripts/verify-gate-admission.mjs not scheduled. Done = wrapper + fail-fast flag proven with local bare-repo fixtures, verify-gate-admission wired somewhere that runs. Owner question on candidate-state strictness is already queued in the decisions artifact; do not re-ask. Lower urgency while the owner's 10-26 ruling has pushes skip the full gate.

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

**Status 2026-10-28: Done.** The 12:15 ET Phases 0-1 evidence append records baseline HEAD a915a592f, lockfile hashes, junction targets and process identities, with tracked deletions left untouched for classification.

- Keep scope to environment recovery and the evidenced gate defects. No Sentry work, Docker, new SaaS, performance redesign, test weakening, or instruction-file edits. No push without the owner's instruction for the current candidate.
- Coordinate one maintenance owner across existing windows. No installs, gate runs, cleanup scripts, or worktree removal during evidence capture. Do not terminate another session merely because it is busy.
- Record current HEAD, working-tree status, lockfile hashes, physical dependency targets, and process identities. Preserve current modified/deleted tracked files as owner work pending classification. Save small evidence logs in a dedicated scratch directory outside dependency trees; append conclusions here.
- Record outcomes separately: dependency integrity, runaway diagnostic task, gate correctness, and publication. A green result in one cannot close another.

Exit: a stable baseline and no cooperating writer is changing the experiment. If an uncoordinated writer remains, continue read-only attribution; do not repair a live shared tree underneath it.

**Phase 1: Attribute file loss with a bounded capture.**

**Status 2026-10-28: Done.** Exit criterion explicitly allows 'no event captured; cause unresolved', and that is what was reported (Process Monitor absent, Defender history needs admin); runaway python traced to task b2isjx4k5, process already gone.

- First inspect the actual subagent task above and its owning session. If a similar process is still alive, match PID AND creation time, full command, parent chain, and task ID. Treat the malformed heredoc/Windows launcher behavior as its own resource incident; do not rerun that malformed command.
- Inventory only the known affected package files plus representative missing tracked files. Record existence, size and hashes when available. Avoid whole-disk recursive scans. Classify owner-intended tracked deletions separately.
- Obtain a short local Process Monitor trace filtered to affected physical directories and relevant worktree paths, without initially filtering to a favored PID. Include filesystem mutations, rename/delete details, and process creation/identity. Capture to a bounded local backing file and stop after one relevant event or a stated interval, for example ten minutes. Process Monitor provides filesystem activity and process details: https://learn.microsoft.com/en-us/sysinternals/downloads/procmon. If driver elevation is unavailable, report that exact limitation; a filesystem watcher alone does not supply actor attribution.
- Prefer observing existing files first. If reproduction requires restoration, log one narrowly scoped restoration as an intervention with its timestamp, after securing exclusive maintenance ownership. Capture all subsequent activity and distinguish your own writes from unexpected ones.
- Search relevant agent commands near the observed event for installers, format/cleanup tasks, and recursive worktree deletion. One historical command in the other session uses junction removal followed by `rm -rf` (`a136f042-b1ef-4b23-ae67-f93c6819cd78.jsonl:3256`); that is a candidate to investigate, not evidence it caused this incident. Never repeat it as a probe against real shared paths.

Exit: identify process + creation time + successful mutation of a known path, linked to a command/script, OR explicitly report “no event captured; cause unresolved.” Ten quiet minutes do not prove a permanent fix. Never claim the memory plugin or Defender caused it without attributable evidence.

**Phase 2: Contain the demonstrated actor and repair once.**

**Status 2026-10-28: Done.** frontend and packages/database repaired with one npm ci each (plus prisma generate) from unchanged lockfiles; 19 tracked deletions classified and resolved by owner ruling (lofi1, equoriacelestial.png, shell-style study present; SENTRY_SETUP.md deliberately gone). File-loss actor stays unattributed, as the exit allows.

- Stop/cancel a confirmed abandoned task through its owning session after verifying current identity. For the suspected runaway, preserve the task output first. If its process is already gone, record that fact and make no stale-PID kill attempt.
- If an installer/cleanup script is responsible, fix its ownership/path handling. If a plugin or security tool is actually responsible, address that specific demonstrated behavior. Do not add broad antivirus exclusions speculatively.
- Before recursive move/removal, use native PowerShell, resolve absolute paths, inspect reparse points, and verify containment. Do not feed enumerated paths into another shell. Dependency targets shared through junctions are shared mutable state even when lockfiles match.
- Restore the damaged dependency tree once from its unchanged lockfile, using the physical owner checkout. Repair additional trees only if checks show damage. Run installs sequentially with consumers stopped. Read lifecycle scripts first; document any required generation step. Do not hand-patch arbitrary package internals or upgrade packages to hide damage.
- Check every formerly missing representative file immediately after installation and again after a bounded observation interval. Classify tracked deletions before any targeted recovery; recover from the correct version or owner backup, never assume HEAD contains their latest work.

Exit: dependencies load, expected files remain present, lockfile hashes are unchanged, and any unresolved actor attribution is stated honestly. Repair without attribution may unblock work, but must be reported as recovery, not root-cause closure.

**Phase 3: Repair gate ownership in a separate small change.**

**Status 2026-10-28: Partly done, tracked in Equoria-hqrqk.** Decide which outer operation owns the machine lock (without the nested-doctrine and targeted-spawns-runner deadlocks the docblock names) and make test:backend:targeted, other backend profiles and npm ci/install cooperate; done = docblock no longer UNRESOLVED and a sentinel shows a targeted run waits on (or refuses beside) an admitted gate.

- First demonstrate each lock defect with tiny real child processes and temporary paths, without Jest or database setup. Use barriers to force the initializing-lock and competing-reclaimer interleavings. An ordinary repeated green acquisition test is insufficient.
- Make lock acquisition/reclamation one race-safe protocol. Incomplete/unreadable metadata must never authorize immediate deletion of a potentially live owner. Use a unique acquisition token; verify process creation identity where supported, and fail closed on ambiguity. A second unsafe stale-lock check or an extra sleep is not a fix.
- Apply the wait deadline to every retry path, including corrupt/unreadable locks. Existing code reaches its deadline check only for a live, parsed holder. Owner release must match the acquisition token, not just PID; a delayed old handle must not release a newer acquisition in the same process.
- Track all owned child processes. On cancellation, stop scheduling, terminate owned children, await their exit with a finite escalation deadline, disconnect/drop owned lane databases, then release ownership. Report cleanup failures and nonzero exit. Never release the lock first or terminate arbitrary node processes.
- Establish the admission boundary before expensive discovery/preflight/test activity. Ensure targeted profiles and dependency maintenance cannot silently collide with full gates under the actual supported workflow. Avoid nested lock deadlock by defining which outer operation owns the lock. Keep ordinary editing available except while validating a frozen candidate.
- Preserve the existing worker/heap limits. Explicitly distinguish measured RSS from enforced RSS. If enforcing an aggregate limit, include the owned process tree and use the accepted budget; abort owned work cleanly on breach. Do not increase limits to make a run pass.

Exit: real-process demonstrations prove mutual exclusion during initialization/reclamation, bounded failure on ambiguous ownership, safe cancellation, no owned children left behind, and correct release. Existing tests must not be weakened or edited to fit new behavior; follow current test-integrity rules for any added coverage.

**Phase 4: Validate from cheapest to most expensive.**

**Status 2026-10-28: Done.** Rounds record cheapest-first validation (entry-point imports, format:check, sentinels, single-lane smoke, run-all.sh 43/43); the published candidate 2e6514d25 passed the gate 13378/13378, 918/918 reconciled (Equoria-hqrqk notes).

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

**Status 2026-10-28: Done.** Evidence-only round; its stated exit ('no attributable filesystem event captured; cause unresolved') was reached and later phases proceeded from it.

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

**Status 2026-10-28: Done.** Dependency recovery and deletion classification hold today (Sentry files and deps gone; restored artwork present). Its first lock fix (CORRUPT_GRACE_MS, reclaim slot, gateLockRaces sentinel) was rejected by Codex and replaced under the owner's safe-exclusion ruling in 2e6514d25; none of those symbols remain in gate-lock.mjs.

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

**Status 2026-10-28: Done.** docs/SENTRY_SETUP.md stays deleted and the flagged Sentry removal has since happened (backend/config/sentry.mjs and frontend/src/lib/sentry.ts gone, no @sentry deps in backend/frontend package.json); the four ambiguous files are restored (lofi1, \_bmad-output/visual-production/equoria-shell-style-study-v1.png).

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

**Status 2026-10-28: Partly done, tracked in Equoria-hqrqk.** Item 5 only: same work as the Phase 3 admission-boundary finding (backend/scripts/gate-lock.mjs scope). Track once, under hqrqk.

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

**Status 2026-10-28: Done.** backend/scripts/verify-gate-admission.mjs (npm run verify:gate-admission), gate-ownership-steps.mjs buildOwnershipSteps, resolveExitStatus in gate-lock.mjs, async runSupervisedStep in test-lane-db.mjs, laneProvisioningSupervision.sentinel.test.mjs; published in 2e6514d25, Codex APPROVED (Equoria-hqrqk notes).

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

**Status 2026-10-28: Done.** test-lane-db.mjs throwIfCancelled/cancellationError at each provisioning boundary with spawn signal, createOwnershipLifecycle exposes an AbortController signal; published in 2e6514d25 after Codex approval.

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

**Status 2026-10-28: Done.** Equoria-av27e closed by owner ruling 2026-09-21; the confirmed claims still hold (sanitizeInput in profileController, CORS now in backend/config/corsPolicy.mjs mounted in app.mjs, tokenRotationService wired in auth), gameIntegrity.mjs removed, and .claude/rules/SECURITY.md carries no suspicious-activity or integrity-middleware claim.

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
| IP / suspicious-activity monitoring                | DRIFT, since resolved | unmounted detector removed 2026-10-22, SECURITY.md carries no such claim — Equoria-hjnrc                 |
| Data-integrity middleware                          | DRIFT, since resolved | `gameIntegrity.mjs` was unmounted — removed and SECURITY.md corrected under Equoria-oey96.30 (7f3d0c0eb) |
| Financial transactions (atomic SQL, audit logging) | CONFIRMED             | bank controller                                                                                          |

Stale-issue reconciliation from the same sweep: Equoria-49dzc and Equoria-pey97 are documented in
SECURITY.md §A03-Injection; Equoria-xbir9 (Bearer CSRF) is documented in the CSRF section.

Owner ruling 2026-09-21: record here and close; the retired report is not resurrected.

## 2026-10-09 — Platform technical architecture implementation audit

Scope: current on-disk implementation, including pre-existing uncommitted changes; base commit `62b852948ededc82431dfec53f69616563917048`. The completed architecture volume inventories 54 Prisma models, 6 enums, 101 migration directories, 420 explicit route registrations / 417 unique method-path combinations, 41 browser routes and 19 cron descriptors. These are static source counts, not production certification.

Output: `EquoriaBible/Findings/02_Platform_Technical_Architecture_Completed.docx`. The supplied original was open/locked, so the completed copy is saved beside it. Application source and tests were not edited by this audit.

### Open findings

#### ARCH-01 [P2] API discovery advertises removed routes

**Status 2026-10-28: Partly done, tracked in Equoria-ccjj7.** Rewrite the apiInfoHandler endpoint list to the real /api/v1 mounts (drop retired groups such as trait-discovery) and add a test that every advertised URL resolves (not the 404 'Route not found').

**Evidence:** `backend/config/healthHandlers.mjs:123`; `backend/app.mjs:354`.

**Failure scenario:** GET /api-info returns /api/auth, /api/horses and other unversioned URLs plus /api/v1/labs. The composition root mounts gameplay at /api/v1 and mounts labs-derived routes individually, without a /labs router. A client following the advertised horse URL receives 404 rather than the horse API.

**Recommended correction (not applied):** Update discovery from the actual mount tree and cover the advertised URLs with a contract check.

#### ARCH-02 [P2] Served Swagger JSON selects the wrong API base

**Status 2026-10-28: Open, tracked in Equoria-713fu.** loadSwaggerSpec should set the server to `${baseUrl}/api/v1` and swagger.yaml should drop the legacy /api server so served JSON and raw YAML agree; done = a test asserting the served spec's server + a sample path hits a mounted route.

**Evidence:** `backend/middleware/swaggerSetup.mjs:38`; `backend/docs/swagger.yaml:104`.

**Failure scenario:** loadSwaggerSpec overwrites the server list with API_BASE_URL plus /api, while specification paths include /auth/login. With API_BASE_URL set to the site origin, Swagger Try it out targets /api/auth/login; the implemented path is /api/v1/auth/login. The raw YAML and served JSON also expose different server lists.

**Recommended correction (not applied):** Align the served server base and root health paths with the mounted API, then verify generated request URLs.

#### ARCH-03 [P2] Query cache and rate limits use different Redis connection contracts

**Status 2026-10-28: Open, tracked in Equoria-5m00f.** initializeRedis should return null when REDIS_DISABLED=true and prefer REDIS_URL (as rateLimiting.mjs does) before host/port; done = test with REDIS_URL-only env connecting to that URL and REDIS_DISABLED=true never constructing a client.

**Evidence:** `backend/utils/cacheHelper.mjs:180`; `backend/utils/cacheHelper.mjs:197`; `backend/middleware/rateLimiting.mjs:276`.

**Failure scenario:** The query cache constructs ioredis from REDIS_HOST/PORT/PASSWORD/DB and never consumes REDIS_URL, whereas rate limiting accepts REDIS_URL. A deployment configured only with REDIS_URL can have working distributed rate limits but an unavailable localhost query cache and per-process fallback. initializeRedis also short-circuits only NODE_ENV=test, so REDIS_DISABLED=true does not itself prevent the cache connection attempt despite the helper reporting intentional disablement.

**Recommended correction (not applied):** Use a consistent cache connection resolver and enforce intentional disablement in the actual initialization path. Multi-replica fallback otherwise permits stale cache reads after writes on another process.

#### ARCH-04 [P2] Trait trends return a successful empty report

**Status 2026-10-28: Open, tracked in Equoria-zlq05.** Its 'predictions' output is advice, which the 10-07/10-28 no-advice rulings forbid, and nothing uses it: remove the route (it then answers 'Route not found' 404) and update its test case under those rulings, as a7f1p did. No new owner question needed.

**Evidence:** `backend/modules/horses/routes/horseRoutes.mjs:182`; `backend/modules/horses/routes/horseRoutes.mjs:204`.

**Failure scenario:** The authenticated self-scoped trait-trends route creates empty trends, patterns and predictions and returns success without querying trait history. A player with recorded trait events receives an empty report indistinguishable from having no events.

**Recommended correction (not applied):** Implement the history aggregation or return an explicit unavailable/partial capability response.

#### ARCH-05 [P2] Personality history is not persisted or reconstructed

**Status 2026-10-28: Superseded by owner ruling.** Owner ruling 2026-10-21/22 (equoria-temperaments-12-driven-willing.md): temperament only affects show matrix, groom bond and trainer fit; the history/triggers/stability/predict endpoints, personalityEvolutionController and personalityEvolutionSystem were deleted (commit 7bd2a5da8, Equoria-5d8ba) and now 404.

**Evidence:** `backend/modules/horses/services/personalityEvolutionSystem.mjs:364`; `backend/modules/labs/controllers/personalityEvolutionController.mjs:296`.

**Failure scenario:** The mounted history controller delegates to a helper that always returns totalEvolutions=0 and empty event, timeline, trajectory and stability arrays. After an evolution action, this API still reports no evolution history. There is no PersonalityEvolutionLog model in the current schema.

**Recommended correction (not applied):** Persist/reconstruct history before presenting it as a complete feature, or expose the missing capability explicitly.

#### ARCH-06 [P2] A CI build artifact step uploads directories the build does not produce

**Status 2026-10-28: Open, tracked in Equoria-udte9.** Point the step at ./frontend/dist/ only and set if-no-files-found: error (or remove the step); done = the workflow artifact contains frontend/dist/index.html.

**Evidence:** `.github/workflows/ci-cd.yml:91`; `.github/workflows/ci-cd.yml:92`; `frontend/package.json:11`; `backend/package.json:13`.

**Failure scenario:** Build Validation uploads backend/dist and frontend/build. The backend build only prints a completion message for its ESM source, and the frontend Vite build writes dist. After a successful build, the configured upload paths do not contain the intended client bundle, so that workflow cannot provide the advertised build artifact. Railway uses its separate build script.

**Recommended correction (not applied):** Point the artifact upload at real output paths and make missing expected files fail the step.

#### ARCH-07 [P2] Training eligibility can use stale stored age

**Status 2026-10-28: Open, tracked in Equoria-5b2nj.** canTrain (and getTrainableHorses / trainingEligibility.mjs) must refuse when either the stored age or the date-derived age is outside 3..20, or the DOB/age disagreement must be fixed at the source so one age is authoritative; done = integration test with a horse whose date-age is 21 but stored age is 20 being refused. The retirement-at-21 rule itself is unchanged (10-28 ruling).

**Evidence:** `backend/modules/training/controllers/trainingController.mjs:85`; `backend/services/jobs/dailyAgingJob.mjs:15`; `backend/utils/horseAge.mjs:157`.

**Failure scenario:** Training computes the date-derived age but then prefers Horse.age whenever it is present. At Eastern midnight a horse can display ageYears=21 while its stored age is still 20 until the 00:05 aging job updates it; a horse with no other training restrictions passes the age gate during that window. A failed aging job prolongs the mismatch. This is a source-traced scenario, not a live database reproduction.

**Recommended correction (not applied):** Use the canonical date-derived age for eligibility or reconcile the stored value atomically before accepting the action.

#### ARCH-08 [P2] Manual salary processing bypasses the admin MFA policy

**Status 2026-10-28: Superseded by owner ruling.** Owner ruling q18 (2026-10-23): commit 47c88e254 (Equoria-4tleh) removed ADMIN_MFA_REQUIRED and requireAdminMfa from code, config and tests; git grep on origin/master finds no requireAdminMfa/ADMIN_MFA_REQUIRED in backend. The setting the finding depends on no longer exists.

**Evidence:** `backend/modules/grooms/routes/groomSalaryRoutes.mjs:81`; `backend/app/routers.mjs:195`; `backend/modules/grooms/controllers/groomSalaryController.mjs:155`; `backend/middleware/auth.mjs:371`.

**Failure scenario:** With ADMIN_MFA_REQUIRED=true, an authenticated admin account without MFA enrollment is blocked from the guarded admin router but can POST /api/v1/groom-salaries/process with a valid CSRF token. This route has only an inline role check and inherits no requireAdminMfa guard; its controller invokes salary processing without a further MFA check. The account can therefore trigger this administrative financial operation despite the configured enrollment policy. This is source-traced, not a live mutation reproduction.

**Recommended correction (not applied):** Apply the shared role and admin-MFA guards to this route and extend coverage to inline role checks as well as requireRole calls.

### Verification performed

- `npm run typecheck`: PASS (exit 0).
- Doctrine `scripts/doctrine-checks/run-all.sh`: PASS, all 46 checks (exit 0), using installed Git for Windows bash because bare bash was unavailable.
- `npm run lint`: FAIL (exit 1), 480 errors and 352 warnings. No autofix.
- Selected backend tests: PASS, 11 suites / 188 tests. Covered game clock, horse age, cron registry, cookie security, DB pool configuration, JWT key ring, runtime secret policy, request-body security, SSE multi-instance guard, Railway migration fail-fast and beta-readiness environment sentinels. `NODE_ENV=test`, `REDIS_DISABLED=true`, and an intentionally unreachable local database URL avoided use of a shared database.
- `npm run test:frontend`: FAIL (exit 1), 354 files passed / 2 failed, 5915 tests passed / 5 failed. `frontend/src/components/breeding/__tests__/HorseSelector.test.tsx:173` expected 30 cooldown days and received 31. Four cases in `frontend/src/pages/horse-detail/genetics/__tests__/nonColorMeaning.test.tsx` failed on missing React Router context. These are observed test failures, not a claim that every case establishes a production bug.
- Full database-backed backend tests, E2E/beta-readiness, migrations/seeds, live load testing and production deployment checks were not run. Source-traced scenarios above have not been reproduced against production.
- DOCX structural checks passed: all schema fields and registered paths included, valid XML, source locations resolvable, repeating table headers and non-splitting rows, and only `word/document.xml` changed from the supplied template package. Visual pagination review could not run because the bundled renderer could not locate LibreOffice `soffice.exe`.

AUDIT: CONCERNS

## 2026-10-12 — Accounts onboarding and player identity implementation audit

Scope: current on-disk account implementation at base commit `9bd106ce0ac1e524cae464c189089ccef3511148`, compared with the owner-supplied intended-design volume. The original design document is preserved. Output: `EquoriaBible/Findings/03_Accounts_Onboarding_Player_Identity_DEEP.docx`. The implementation volume covers 46 account-related HTTP contracts, eight full schema records, 40 design topic/status comparisons, profile/settings screens, first-horse setup, progression, economy and account lifecycle. Application code and tests were not edited.

### New findings

#### ACC-01 [P1] Completed onboarding can rewrite an owned horse

**Status 2026-10-28: Done.** backend/modules/auth/controllers/onboardingController.mjs advanceOnboarding now refuses any horse payload with 409 unless completedOnboarding===false and onboardingStep===0; commit 0b09e14dd (Equoria-gu8jk), test onboardingStarterHorseLocked.integration.

**Evidence:** `backend/modules/auth/controllers/onboardingController.mjs:255`; `backend/modules/auth/controllers/onboardingController.mjs:332`; `backend/modules/auth/controllers/onboardingController.mjs:329`.

**Failure scenario:** An already-completed account can POST /api/v1/auth/advance-onboarding with another valid name, breed and gender plus its session/CSRF token. No completion or one-time customization predicate is checked. The oldest currently owned horse is rewritten with the submitted breed/sex, freshly generated starter stats and a rerolled temperament. Repeating this bypasses permanence and can erase trained stats; if the original starter was sold, another owned horse is selected instead. The handler leaves the completion state intact, so the operation remains repeatable.

**Correction direction (not applied):** Bind customization to a server-recorded starter ID and claim it once within the transaction; refuse replay after finalization. Source-traced scenario; not executed against a live account.

#### ACC-02 [P1] A recovery code has no atomic single use claim

**Status 2026-10-28: Open, tracked in Equoria-ov8ny.** mfaController.mjs challenge recovery branch: consume the code with a conditional claim (updateMany where mfaRecoveryCodes equals the read value, count===1) or a row-locked transaction; the loser of a race must get 401. Done = a concurrency integration test where two parallel challenges with one code yield exactly one session.

**Evidence:** `backend/modules/auth/controllers/mfaController.mjs:228`; `backend/modules/auth/controllers/mfaController.mjs:234`; `backend/modules/auth/services/mfaService.mjs:103`.

**Failure scenario:** Two concurrent MFA challenges for one account can read the same unused recovery-code JSON. Both await bcrypt comparison and receive valid=true before either whole-map update makes usedAt visible to the other. Each unconditional user.update can then commit and each request can reach session issuance. This violates the advertised single-use property even on one backend process; normal failed-attempt lockout does not stop two successful verifications.

**Correction direction (not applied):** Use a durable conditional consumption predicate or serialized transaction around verification and consumption. Source-traced interleaving; no live MFA login was attempted.

#### ACC-03 [P2] Player XP displays use a different opening level curve

**Status 2026-10-28: Done.** backend/modules/users/services/userModelService.mjs levelForXp/levelProgress use floor(xp/100)+1, matching frontend/src/lib/xp-utils.ts calculateLevel; userController getUserProgressAPI uses levelProgress. Commit fd375b128 (Equoria-smqn7).

**Evidence:** `backend/modules/users/services/userModelService.mjs:39`; `backend/modules/users/controllers/userController.mjs:97`; `frontend/src/lib/xp-utils.ts:28`; `frontend/src/components/XPLevelDisplay.tsx:68`.

**Failure scenario:** At total XP=100 the stored player remains level 1 and the progress API reports 100 XP remaining with 50 percent of the opening level complete. Profile XPLevelDisplay uses that level but renders its modulo-100 bar/text as 0 / 100 XP. A component that omits the level override computes level 2. The display can appear to reset without a real level-up and offers a different unlock expectation.

**Correction direction (not applied):** Resolve the intended curve explicitly, then make API and frontend use the same thresholds and progress response. Numeric inconsistency is directly established by the source formulas.

#### ACC-04 [P2] Saved notification and display switches have no applied behavior

**Status 2026-10-28: Open, tracked in Equoria-apfwp.** No runtime consumer for the three display switches (no root class/attribute applied), and createNotification ignores notification-category opt-outs. Done = each switch changes the UI and an off category is not created, or the switch is removed.

**Evidence:** `frontend/src/pages/SettingsPage.tsx:239`; `frontend/src/pages/settings/DisplaySection.tsx:26`; `backend/modules/auth/controllers/profileController.mjs:407`; `backend/utils/notificationService.mjs:98`.

**Failure scenario:** Turning off an in-app notification category persists a boolean but the shared notification producer does not consult that preference, so subsequent notifications still appear. Turning on high contrast, reduced motion or compact cards likewise only saves/readbacks the switch; no runtime consumer applies the stored preference to the document, motion or layout. OS prefers-reduced-motion support does not consume the account setting. Repository searches of the exact nine keys found controls/types/defaults/persistence but no behavior consumers.

**Correction direction (not applied):** Apply each supported switch to its producer/rendering behavior or clearly expose its incomplete status. These are implementation coverage failures, not a claim about unsupported medical/accessibility outcomes.

#### ACC-05 [P2] The final guided tour instruction is unreachable

**Status 2026-10-28: Open, tracked in Equoria-hlo5x.** onboardingController.advanceOnboarding: complete only when advancing past step 10 (newStep > 10), or let the Finish button call complete. Done = card 10 renders and Finish completes onboarding.

**Evidence:** `backend/modules/auth/controllers/onboardingController.mjs:256`; `frontend/src/components/onboarding/OnboardingSpotlight.tsx:88`; `frontend/src/components/onboarding/OnboardingSpotlight.tsx:123`.

**Failure scenario:** Next from spotlight step 9 calls advance-onboarding, which returns step 10 with completed=true. The overlay requires completedOnboarding=false, so it unmounts before the tenth instruction to open a horse Equip page appears. A player following normal Next navigation receives no final equipment instruction.

**Correction direction (not applied):** Align the completion boundary with the last rendered card, or make the intended nine-card tour explicit. Source-traced navigation; the existing handoff test covers entry into step 1, not this final transition.

#### ACC-06 [P2] Registration and reset forms accept passwords the server rejects

**Status 2026-10-28: Done.** frontend/src/lib/validation-schemas.ts passwordSchema uses passwordPolicy {minLength:12,maxLength:128} from lib/constants.ts; RegisterPage and ResetPasswordPage requirement checks use passwordPolicy.minLength. Commit e5dc8aee1 (Equoria-hh4dc, Equoria-oey96.39).

**Evidence:** `frontend/src/lib/validation-schemas.ts:80`; `frontend/src/pages/RegisterPage.tsx:46`; `frontend/src/pages/ResetPasswordPage.tsx:45`; `backend/modules/auth/validators/strongPasswordChain.mjs:18`.

**Failure scenario:** Abcdef1! passes the active browser password schema and its strength meter can label it strong. Registration/reset sends it, but the mounted server requires at least twelve characters and returns 400. The browser also has no shared 128-character maximum matching the backend. The player gets positive local validation followed by a server refusal.

**Correction direction (not applied):** Share or align the complete frontend/server write policy and requirement display. The isolated HTTP probe confirmed that Abcdef1! receives 400 with the 12-to-128-character rule. This finding concerns inconsistent feedback; the mounted backend maintains its stronger floor.

#### ACC-07 [P2 design gap] Verification is not an account access prerequisite

**Status 2026-10-28: Open, tracked in Equoria-voasj.** Policy choice. If gating is wanted: a guard on player mutation routes, or a login refusal, for unverified accounts. If not: record the ruling and close.

**Evidence:** `backend/modules/auth/controllers/authController.mjs:281`; `backend/modules/auth/controllers/authController.mjs:352`; `frontend/src/hooks/useSessionGuard.ts:103`; `frontend/src/components/auth/ProtectedRoute.tsx:70`.

**Failure scenario:** The supplied deep reference expects invalid or unverified accounts to be refused at login. A correctly password-authenticated User with emailVerified=false instead receives a full session; normal ProtectedRoute instances do not request verification and the authenticated backend router does not add a verification guard. The account can play before proving the mailbox. This is a requirement/implementation difference, rather than a claim that all games must gate this way.

**Correction direction (not applied):** Resolve the intended access policy and enforce any required verification at the server boundary, then align navigation and screen copy. Source-traced; no signup was performed against production.

#### ACC-08 [P2] Logout leaves a copied access token usable until expiry

**Status 2026-10-28: Open, tracked in Equoria-yrixa.** auth.mjs authenticateToken: add a revocation check (e.g. per-user tokensValidAfter/tokenVersion bumped at logout, cached like passwordChangedAt). Done = a Bearer access token copied before logout gets 401 after logout.

**Evidence:** `backend/modules/auth/controllers/authController.mjs:474`; `backend/middleware/auth.mjs:254`; `backend/utils/tokenCryptoHelpers.mjs:22`.

**Failure scenario:** An access JWT copied before logout can still be presented in the supported Bearer header afterward. Logout removes refresh rows and browser cookies but does not revoke the access JTI or stamp passwordChangedAt. authenticateToken checks signature/expiry/password age and does not consult the removed refresh family, so the copied JWT remains authorized for its remaining fifteen-minute lifetime. A new login that deletes older refresh rows has the same residual.

**Correction direction (not applied):** Document the residual lifetime accurately and add server-side session/JTI invalidation if immediate logout revocation is required. Source-traced; no user token was collected or replayed.

#### ACC-09 [P2] Signup can fail after its account state has committed

**Status 2026-10-28: Open, tracked in Equoria-nqky1.** authController.register: make token-pair/verification-token failure recoverable (create them in the user's transaction, or on failure return success and let login/resend issue them). Done = an injected token failure does not leave a committed account the player cannot reach.

**Evidence:** `backend/modules/auth/controllers/authController.mjs:174`; `backend/modules/auth/controllers/authController.mjs:212`; `backend/modules/auth/controllers/authController.mjs:217`; `backend/utils/tokenRotationService.mjs:77`.

**Failure scenario:** If refresh-token persistence or verification-token creation fails after user.create succeeds, registration forwards an error without rolling back the account or its successful starter writes. Retrying signup then receives duplicate email/username 409 even though the original form reported failure. The intended nonfatal starter/email-delivery policy does not make token-persistence errors recoverable by the signup caller.

**Correction direction (not applied):** Make signup ownership and recovery behavior explicit with an appropriate transaction/issuance boundary or a recoverable existing-account result. Source-traced failure scenario; no fault was injected into a live database.

#### ACC-10 [P2] The profile win card displays competition entries

**Status 2026-10-28: Done.** frontend/src/pages/ProfilePage.tsx 'Competitions Won' StatisticsCard now binds competitionStats.totalWins from useUserCompetitionStats, with an error and retry state; bead Equoria-4z3i9 closed.

**Evidence:** `frontend/src/pages/ProfilePage.tsx:234`; `frontend/src/pages/ProfilePage.tsx:235`; `backend/modules/users/services/userStatsService.mjs:64`.

**Failure scenario:** For a player whose horses have ten result entries and two wins, the ProfilePage Competitions Won card displays ten. The progress API explicitly binds totalCompetitions to the number of results, and the component binds that total to a wins label.

**Correction direction (not applied):** Return/use the actual win count for that card or label it as entries. Source-traced projection error; not a new balance decision.

#### ACC-11 [P2] Generic self identity responses include credential storage fields

**Status 2026-10-28: Open, tracked in Equoria-pt9dh.** getUser: omit password, mfaSecret, mfaRecoveryCodes (and other secrets) before responding; buildUserDataExport: also strip mfaSecret and mfaRecoveryCodes. Done = an integration test asserting none of these keys in either response. (The 10-28 'no data download for players' ruling may also retire /account/export.)

**Evidence:** `backend/modules/users/services/userModelService.mjs:130`; `backend/modules/users/controllers/userController.mjs:463`; `backend/modules/users/controllers/userController.mjs:464`; `backend/modules/users/services/gdprAccountService.mjs:93`.

**Failure scenario:** GET /api/v1/users/:id obtains the full User row and spreads it into the self response without a safe identity projection. A client holding a temporary session can retrieve the bcrypt password hash and persisted MFA fields, material that the narrower /auth/profile response omits. The export strips password only and therefore still includes MFA secret ciphertext and recovery-code hash records. Self-access prevents cross-user UUID substitution but does not remove this unnecessary credential-material disclosure to session-only callers.

**Correction direction (not applied):** Use explicit safe projections for identity responses and deliberately exclude credential/MFA storage material from account export. Source-traced response shapes; no real account credentials were read.

### Existing finding still source visible

**Status 2026-10-28: Open, tracked in Equoria-opdt7.** groomSalaryRoutes.mjs /process: put behind requireStaffCapability (email-code staff check) or delete the manual trigger since the Monday payday runs on its own. Done = a stale admin token without staff check-in gets refused.

`ARCH-08` from the 2026-10-09 platform audit remains present: `backend/modules/grooms/routes/groomSalaryRoutes.mjs:81` checks the admin role inline, without `requireAdminMfa`, under the ordinary authenticated mount at `backend/app/routers.mjs:195`. The salary processing controller still invokes the administrative operation. This is continuity, not a claim of a new fix or a second distinct finding.

### Verification performed

- `npm run typecheck`: PASS, exit 0.
- Selected frontend account checks: PASS, exit 0; 19 files / 301 tests. Login, MFA, registration, forgot/reset password, wizard handoff, onboarding guard, recovery-address form, auth context/cache/session guard, preference hook and XP/password utilities were exercised.
- `scripts/doctrine-checks/run-all.sh` using installed Git for Windows bash: PASS, exit 0; all 46 checks.
- Selected backend checks: exit 1 overall. Eight suites / 62 tests passed (human age, cookie security, JWT key ring, CSRF clearing, starter settings, starter inventory, MFA replay cache and admin MFA structural coverage). One test in `backend/modules/auth/__tests__/mfaSecretEncryptedAtRest.sentinel.test.mjs:40` failed during its account fixture creation because the audit database was intentionally unreachable; no assertion against real encrypted storage was verified.
- Backend execution set `NODE_ENV=test`, `REDIS_DISABLED=true` and `DATABASE_URL` to localhost port 1, avoiding access to the configured shared database. No integration account fixtures were created.
- Five direct HTTP probes against the actual Express app passed: signup with an under-13 DOB -> 400; missing DOB -> 400; eight-character `Abcdef1!` -> 400 with 12-to-128-character rule; anonymous self profile -> 401; anonymous export -> 401. These requests terminate before database writes.
- Full backend/full frontend suites, E2E/beta-readiness, live signup/recovery/onboarding/MFA concurrency, production SMTP/Redis, deployment data, migrations/seeds and load tests were not run. Repository lint was not rerun for this document-only account pass.
- DOCX package/structure validation passed: all eight schema field lists, 46 endpoint records, source references, required topic headings, repeated table headers and row geometry validated. Only body and footer text changed from the retained template package. Original source SHA256 remains `2dd313c73055eccf4d555127d441516973acaa107f8e79e85bc7886d23be7978`.
- Visual rendering was attempted through the packaged renderer, which cannot locate LibreOffice `soffice.exe`; the workspace bundle has no LibreOffice binary. No page/pagination visual QA is claimed.

AUDIT: CONCERNS

## 2026-10-12 — Navigation and world structure implementation audit

Scope: owner-requested current-implementation version of Volume 04, compared with `EquoriaBible/04_Navigation_World_Structure_DEEP.docx`. Base commit `9bd106ce0ac1e524cae464c189089ccef3511148`; on-disk working tree audited. Original design preserved; its embedded design instructions were treated as reference content, not commands to modify the game. Output: `EquoriaBible/Findings/04_Navigation_World_Structure_DEEP.docx`. This pass changed documentation only; application and test files were not edited by this audit. Concurrent/pre-existing working-tree changes were preserved.

Coverage: 41 registered client route patterns (six public, one protected setup outside the shell, 34 protected shell); 31 route-registry entries; 14 actual desktop/drawer links; five phone slots; ten World cards; four Community destinations; two Marketplace cards; 32 design/status comparisons; 23 supporting source groups. The report covers HUD, search, history, breadcrumbs, query/modal state, responsive layout, artwork and current intended-design gaps.

### Source-backed findings

#### NAV-01 [P2] Intended persistent realms and World menu are missing

**Status 2026-10-28: Open, tracked in Equoria-m5ml8.** Realm grouping (Home/World/Community/Marketplace/Compete) and a seven-place World menu are absent. Needs Stacey's direction on what replaces the flat list before building.

**Evidence:** `frontend/src/components/layout/navItems.ts:36`; `frontend/src/components/layout/navItems.ts:58`; `frontend/src/pages/WorldHubPage.tsx:14`.

**Failure scenario:** A phone player who needs World, Community or Marketplace must open More or the hamburger, while the supplied design requires HOME, WORLD, COMMUNITY, MARKETPLACE and COMPETE to remain visible in that order. World is a ten-card page with no Equoria Town, rather than the specified seven-place attached menu. This is a concrete requirement gap against the owner-supplied reference, not a finding that the sidebar is inherently unsafe.

**Correction direction (not applied):** Carry the intended five realms and exact World destinations into an explicit implementation change. Preserve existing service/staff/history entry points while regrouping them. No redesign was applied.

#### NAV-02 [P2] Horse action links drop the selected horse

**Status 2026-10-28: Open, tracked in Equoria-vlpz4.** Make TrainingDashboard and CompetitionBrowserPage accept horseId (or senders use horse). Done = clicking Train/Compete on a horse page or Next Actions preselects it.

**Evidence:** `frontend/src/pages/HorseDetailPage.tsx:459`; `frontend/src/pages/HorseDetailPage.tsx:463`; `frontend/src/components/hub/NextActionsBar.tsx:77`; `frontend/src/components/training/TrainingDashboard.tsx:178`; `frontend/src/pages/CompetitionBrowserPage.tsx:68`; `frontend/src/pages/CompetitionBrowserPage.tsx:158`.

**Failure scenario:** Follow Train or Compete from horse 42 or its suggested action. The sender emits horseId=42, but both destinations only read horse=42. Training does not select that horse; a competition modal can instead default to the first roster horse. The URL is registered, so a simple target-exists test misses the wrong-entity context. Source-traced handoff; no live entry was submitted.

**Correction direction (not applied):** Make sender and consumer use the same parameter and exercise the full horse-to-destination flow, including selection, ownership and consumed-query behavior.

#### NAV-03 [P2] Foal breadcrumbs lead to an unregistered parent

**Status 2026-10-28: Done on origin/master.** origin/master frontend/src/App.tsx routes /foals/:id to FoalLinkRedirect (pages/FoalLinkRedirect.tsx), sending old links to /horses/:id; FoalDetailPage no longer exists. Commit bef677bd6 (Equoria-jaeot, one horse page). The /foals crumb is never rendered.

**Evidence:** `frontend/src/components/layout/Breadcrumb.tsx:16`; `frontend/src/components/layout/Breadcrumb.tsx:83`; `frontend/src/App.tsx:98`.

**Failure scenario:** Open /foals/42 and activate the phone parent link or the intermediate desktop foals crumb. Both point to /foals, which has no route. An actual render of Breadcrumb produced these links and React Router rejected the parent path. The separate foal-page Back to stable link does not repair this shared control.

**Correction direction (not applied):** Give the foals segment an existing authoritative roster parent, or implement the intended list route. Verify both breakpoint presentations.

#### NAV-04 [P2] Unknown client URLs have no recovery page

**Status 2026-10-28: Done.** frontend/src/App.tsx registers <Route path="\*" element={<NotFoundPage />}>, an in-world not-found page with a way home; commit 62a969873 (Equoria-bvddn.35). Commit 05047d8a3 (Equoria-10z8l) keeps the JSON 404 for unknown /api paths.

**Evidence:** `frontend/src/App.tsx:66`; `backend/middleware/notFoundHandler.mjs:42`.

**Failure scenario:** A signed-in onboarded player opens a stale /search bookmark or follows /foals. Production can return the SPA index with HTTP success, but no React route matches and no Not Found route restores a navigation/recovery page. The route matcher confirmed /search, /town and /competition-results/7 are unmatched. This can leave a page without the matched game shell rather than a useful explanation.

**Correction direction (not applied):** Add a deliberate client missing-page route and decide which historic URLs warrant redirects. Retain JSON 404 behavior for unknown backend paths.

#### NAV-05 [P2] Navigation dialog leaves keyboard focus outside the modal

**Status 2026-10-28: Open, tracked in Equoria-ct39p.** NavPanel.tsx: move focus into the panel on open, trap Tab, make background inert, return focus to the menu button on close. Done = keyboard test passes.

**Evidence:** `frontend/src/components/layout/NavPanel.tsx:22`; `frontend/src/components/layout/NavPanel.tsx:61`; `frontend/src/components/MainNavigation.tsx:70`.

**Failure scenario:** A keyboard user opens the menu while focus remains on the header trigger. No effect focuses the panel, no Tab trap or background inerting exists, and closing has no focus restoration. Tab can traverse background controls although the panel announces itself as modal; Escape/scroll-lock alone does not prevent this. Source-established behavior; physical assistive-technology reproduction was not performed.

**Correction direction (not applied):** Use a dialog primitive or equivalent complete focus management, with a meaningful initial target, containment, background isolation and restoration to the opener.

#### NAV-06 [P2] HUD controls are below the specified touch target

**Status 2026-10-28: Open, tracked in Equoria-v0ng4.** Raise these controls to at least 44x44px hit area (size or padding) in MainNavigation.tsx and NavPanel.tsx.

**Evidence:** `frontend/src/components/MainNavigation.tsx:71`; `frontend/src/components/MainNavigation.tsx:114`; `frontend/src/components/MainNavigation.tsx:131`; `frontend/src/components/MainNavigation.tsx:149`; `frontend/src/components/layout/NavPanel.tsx:83`; `frontend/src/styles/tokens.css:430`.

**Failure scenario:** On a phone at the default 16 px root size, hamburger, bell, settings, Logout and drawer close controls have two-rem sides, about 32 by 32 px. They do not meet the supplied 44 by 44 px minimum, and small adjacent HUD targets make selecting the intended utility less reliable. The 44 px token is not applied to them. This is a source-size comparison; no physical tap accuracy measurement is claimed.

**Correction direction (not applied):** Apply at least the intended target dimensions while preserving safe-area and small-screen layout. Validate hit areas and reflow at phone widths.

#### NAV-07 [P2] Per competition result deep links are not registered

**Status 2026-10-28: Open, tracked in Equoria-iz7eu.** Register /competition-results/:competitionId to CompetitionResultsPage. Done = /competition-results/7 opens that result after refresh.

**Evidence:** `frontend/src/pages/CompetitionResultsPage.tsx:206`; `frontend/src/pages/CompetitionResultsPage.tsx:282`; `frontend/src/nav-items.tsx:217`.

**Failure scenario:** The results component expects a competitionId path parameter to open its detail modal. Only /competition-results is mounted, so /competition-results/7 never renders that component; the base path provides no parameter either. The actual route matcher rejected the detailed URL. Refresh/share/bookmark cannot exercise the implemented parameter effect.

**Correction direction (not applied):** Register and validate a result-detail parameter path, or define and consume a query-based modal contract. Keep record authorization at the API boundary.

#### NAV-08 [P2] Hall of Fame navigation opens the profile tab

**Status 2026-10-28: Open, tracked in Equoria-631wc.** Let MyStablePage read a tab from the URL (e.g. ?tab=legacy) and point the card at it.

**Evidence:** `frontend/src/pages/CommunityPage.tsx:262`; `frontend/src/pages/CommunityPage.tsx:265`; `frontend/src/pages/MyStablePage.tsx:301`; `frontend/src/pages/MyStablePage.tsx:451`.

**Failure scenario:** Select Hall of Fame from Community. The destination is /my-stable and its local default is Stable Profile, while the advertised Hall of Fame content is the legacy tab. No URL parameter selects that tab, so the player must discover and select it again. The feature exists; the card does not land on its advertised content.

**Correction direction (not applied):** Define a shareable tab or route destination for Hall of Fame and use it from the hub.

#### NAV-09 [P2] Return summary competition cards lose the result and prize context

**Status 2026-10-28: Partly done, tracked in Equoria-jrgw9.** wyagController competition-result actionUrl: point at /competition-results (or the specific result once NAV-07's route exists).

**Evidence:** `backend/modules/users/controllers/wyagController.mjs:65`; `backend/modules/users/controllers/wyagController.mjs:67`; `frontend/src/components/hub/WhileYouWereGone.tsx:81`; `packages/database/prisma/schema.prisma:924`.

**Failure scenario:** After a real competition result with prizeWon=500 arrives, the return summary describes the prize through result.prize, which is not the CompetitionResult field, so it falls back to zero. Selecting the card navigates to the show browser /competitions, not /competition-results or the associated result. The client uses actionUrl directly and does not recover result metadata. This is a source/schema scenario; no live result was created.

**Correction direction (not applied):** Project the real prizeWon field and target a results surface with sufficient validated result/show context.

#### NAV-10 [P2] Responsive backgrounds advertise absent JPEG fallbacks

**Status 2026-10-28: Open, tracked in Equoria-uqk5y.** Drop the jpg entry from image-set() (or ship the jpgs).

**Evidence:** `frontend/src/components/layout/PageBackground.tsx:51`; `frontend/src/hooks/useResponsiveBackground.ts:69`; `backend/config/staticAssets.mjs:45`.

**Failure scenario:** A browser selecting the JPEG candidate in the generated image-set cannot find the corresponding file. All six generic and six auth same-basename .jpg paths are absent from frontend/public and the current dist, and no backend/public mirror exists locally. WebP assets exist, so normal supported browsers still show art; unsupported WebP falls back to the gradient instead of the claimed JPEG painting. No deployed host or unsupported browser was probed.

**Correction direction (not applied):** Ship the referenced alternate files or remove/change the fallback promise to match the delivered formats, then verify asset responses and image selection.

### Verification performed

- Selected frontend navigation run: PASS, exit 0; 14 files / 122 tests. Menus, contextual action host, Marketplace/Community hubs, competition URL-tab sync/results, Stable/listing filters, horse detail navigation, Next Actions, return summary and responsive art hook.
- Fresh `npm run typecheck`: PASS, exit 0.
- Fresh `scripts/doctrine-checks/run-all.sh` through Git for Windows bash: PASS, exit 0; all 46 checks, including backend/frontend ESLint and Prettier.
- AST inventory verified all 41 page imports exist. 137 production statically expressed navigation targets match a registered route pattern; tests/fixtures excluded. This does not validate runtime-computed links, query handoffs or API authorization.
- Eleven direct local probes rendered the actual Breadcrumb with MemoryRouter and used actual React Router matching. `/foals/42` generates unmatched `/foals` parent links. `/competition-results/7`, `/search` and `/town` do not match a page. Horse/detail/service/thread paths also exposed missing active-parent mappings.
- Asset existence checks: 34 candidate URLs; all 22 referenced World/static/generic/auth WebPs present; 12 generated JPEG alternates missing from frontend/public and current frontend/dist; backend/public absent locally. Deployed asset serving not verified.
- Full test suites, E2E/beta-readiness, live account/domain actions, shared-database fixture creation, deployment builds, migrations/seeds, load tests and physical-device or screen-reader behavior were not run. Root `npm run lint` was not separately invoked; doctrine ran backend/frontend lint/format checks.
- DOCX package/structure checks passed: 16 tables, all 41 route records, ten findings and required topic headings; source file/line validity; exact preserved section geometry; repeated table headers; no fixed row heights; output reopens. Only document body and footer text changed in the retained reference package.
- Original reference SHA256 remains `cb2f09b72948c6d5c40a31448dd77a69375429e2d4a39f4ca219ac7f0e003110`.
- Bundled renderer attempted on reference and output; unavailable because LibreOffice `soffice.exe` is not on PATH and not in the bundled runtime. No visual/pagination QA or page count is claimed.

AUDIT: CONCERNS

## 2026-10-12 — Stable Home collection and roster implementation audit

Scope: owner-requested implementation version of `EquoriaBible/05_Stable_Home_Collection_Roster_Management_DEEP.docx`, saved as `EquoriaBible/Findings/05_Stable_Home_Collection_Roster_Management_DEEP.docx`. Base commit `9bd106ce0ac1e524cae464c189089ccef3511148`; on-disk working tree audited. Embedded source instructions were treated as intended-design content, not commands to implement features. Original design retained. This audit changed documentation only and preserved concurrent/pre-existing application/test changes.

Coverage: three mounted stable surfaces, 42 design/status comparisons, 34 exact list-projection fields plus seven derived fields, three stable/facility schema records, 20 related HTTP contracts, 27 evidence groups and ten concrete findings. Includes cards, action lenses, filters/sorts, large-roster pagination, care, summaries, current-owner attribution, Stable Prestige, staff/capacity distinctions and active competition types versus individual show entries.

### Source-backed findings

#### STA-01 [P2] Roster query omits data required by mounted cards

**Status 2026-10-28: Partly done, tracked in Equoria-y9kdl.** Add lastGroomed to HORSE_LIST_SELECT and HorseListItemDto (or drop it from list counts). Done = a groomed-today horse is not counted as Needs Care on Home/aside.

**Evidence:** `backend/modules/horses/services/horseRouteQueries.mjs:26`; `backend/modules/horses/routes/horseRoutes.mjs:154`; `frontend/src/lib/api/horses.ts:54`; `frontend/src/components/horse/HorseCard.tsx:74`; `frontend/src/components/horse/HorseCard.tsx:235`; `frontend/src/pages/Index.tsx:331`.

**Failure scenario:** A pregnant mare with a real portrait, recent hoof/groom care and a future trainingCooldown loses imageUrl, inFoalSinceDate, lastShod, lastGroomed and trainingCooldown in the actual list projection. The un-enriched client receives no values, so the pregnancy badge disappears, portrait falls back, missing care becomes bad and the horse looks ready to train. horseXp/derived level is also absent. A read-only probe through the actual select/decorators/helpers confirmed ready false -> true, needs-care false -> true and pregnancy countdown -> null. Card fixture tests supply the fields directly and do not catch this transport failure.

**Correction direction (not applied):** Return the precise live fields required by the mounted collection and summaries, derive level deliberately if needed, and verify against the real serialized list contract rather than only component fixtures.

#### STA-02 [P2] Ready to Train counts cooldown readiness as full eligibility

**Status 2026-10-28: Open, tracked in Equoria-aycdv.** isReadyToTrain: also require age 3-20, displayed health not Bad, (and an assigned trainer, per the trainer-required ruling) matching the training gates.

**Evidence:** `frontend/src/lib/utils/care-status-utils.ts:62`; `frontend/src/pages/Index.tsx:331`; `frontend/src/components/layout/AsidePanel.tsx:13`; `backend/modules/training/controllers/trainingController.mjs:92`; `backend/modules/training/controllers/trainingController.mjs:98`.

**Failure scenario:** A foal at age two, a retired horse at age 21 or an injured horse with no active cooldown is counted as ready to train by Home/AsidePanel. The actual helper reads only trainingCooldown, whereas the mutation has age and injury gates. Direct helper probes returned true for both foal and retired fixtures. This remains a mismatch even after the missing cooldown projection is repaired.

**Correction direction (not applied):** Label this as cooldown availability or use an authoritative eligibility projection that matches the training action. Preserve distinct reasons for young, retired, injured and cooldown horses.

#### STA-03 [P2] Default roster fetch hides horses beyond the first 200

**Status 2026-10-28: Open, tracked in Equoria-6tda3.** horsesApi.list/useHorses: follow pageInfo.nextCursor (or use a total-aware contract) so StableView, Home and Stable Profile see every horse.

**Evidence:** `backend/modules/horses/routes/horseRoutes.mjs:72`; `backend/modules/horses/services/horseRouteQueries.mjs:76`; `frontend/src/lib/api/horses.ts:54`; `frontend/src/pages/StableView.tsx:173`; `frontend/src/pages/MyStablePage.tsx:378`.

**Failure scenario:** An account owning 250 horses receives only the newest 200 through the fixed client list request. StableView paginates that array into 17 pages and never requests another server offset. Fifty older horses are unreachable through this roster, and Home/Stable Profile local totals and categories exclude them. The endpoint limit is a read default, not an enforced horse capacity. This is source-traced pagination math, not a live 250-horse benchmark.

**Correction direction (not applied):** Use a total-aware paginated/filterable collection contract or fetch all required pages deliberately, and separate total-account counts from the currently loaded slice.

#### STA-04 [P2] Category page clamp makes Next skip a page

**Status 2026-10-28: Open, tracked in Equoria-t1vz2.** Base Prev/Next on safePage, or reset currentPage to 1 when the category changes.

**Evidence:** `frontend/src/pages/StableView.tsx:174`; `frontend/src/pages/StableView.tsx:351`.

**Failure scenario:** On All page 17, switch to a category containing 30 horses. safePage displays page one because stored currentPage is too large. Next increments the stale 17 and clamps to three, jumping from visible page one to page three and bypassing page two. A probe executing the actual source expressions confirmed this sequence. Numbered controls can recover, but ordinary Next is incorrect.

**Correction direction (not applied):** Reset or synchronize page state when the category/result count changes, or calculate Previous/Next from the displayed valid page.

#### STA-05 [P2] Stable Profile activity and breeding counters use inconsistent definitions

**Status 2026-10-28: Partly done, tracked in Equoria-7529m.** MyStablePage.tsx: activeRacers ageYears 3-20 (below retirementAgeYears); breedingAge 3-20 per breeding-ages ruling; optionally exclude Bad health.

**Evidence:** `frontend/src/pages/MyStablePage.tsx:350`; `frontend/src/pages/MyStablePage.tsx:351`; `frontend/src/pages/StableView.tsx:54`; `frontend/src/lib/utils.ts:44`.

**Failure scenario:** A horse aged 21 appears in the roster Retired tab yet is included in Active Racers because the profile checks only age >= 3. A naturally bred adult Colt and Filly appear in Stallions/Mares through sex-group matching but produce zero Breeding Pairs because that counter matches only literal Stallion/Mare. Conversely, literal sexes are counted without age, health or cooldown checks. The labels cannot be treated as eligible campaign/pair counts.

**Correction direction (not applied):** Define the intended metrics explicitly and use consistent sex/age/access/eligibility projections. If they are demographic counts, label them accordingly rather than implying actionable eligibility.

#### STA-06 [P2] Stable name editor changes the player account handle

**Status 2026-10-28: Open, tracked in Equoria-kgush.** Decide whether a stable has its own name; then either add a stable name field or relabel the input as the username, and show save errors.

**Evidence:** `frontend/src/pages/MyStablePage.tsx:113`; `frontend/src/pages/MyStablePage.tsx:392`; `frontend/src/pages/MyStablePage.tsx:396`; `backend/modules/auth/routes/authenticatedAuthRoutes.mjs:46`; `packages/database/prisma/schema.prisma:132`.

**Failure scenario:** Enter a valid new stable label such as RedBrookFarm in Stable profile name and save. The client submits username, so the account social handle changes and the displayed possessive stable name is regenerated. No independent Stable.name is changed. A space-containing barn name passes the local minimum but is rejected by the account username rule, and this editor supplies no mutation-error display. This is a source-traced identity side effect; no real account was renamed.

**Correction direction (not applied):** Either make the account-handle action explicit in the UI and expose validation failures, or implement the intended independent stable identity with its own contract.

#### STA-07 [P2] Hall of Fame help states rules the selector does not enforce

**Status 2026-10-28: Done on origin/master.** origin/master frontend/src/pages/MyStablePage.tsx now says 'Horses retire on their 21st birthday, and every retired horse joins your Hall of Fame' and 'Horses retire on their 21st birthday and join the Hall of Fame'; no level-8/level-10 text. Commit 90ef8e07b (Equoria-s9brd).

**Evidence:** `frontend/src/pages/MyStablePage.tsx:219`; `frontend/src/pages/MyStablePage.tsx:314`; `frontend/src/pages/MyStablePage.tsx:464`; `backend/constants/horseAgePolicy.mjs:18`.

**Failure scenario:** A player reads that level ten or 80–104 career weeks cause retirement and that level eight is required for Hall of Fame. The mounted selector actually includes every fetched age-21 horse, without a level-eight/ten gate. A young level-ten horse is not selected by this page, while an age-21 low-XP horse is. The copy contradicts the implemented policy and can misdirect collection planning.

**Correction direction (not applied):** Align the help text with the actual age-based selector/policy or obtain an explicit owner decision before changing those rules. Do not treat the old prose as implemented mechanics.

#### STA-08 [P2] Hall of Fame history errors appear as zero career achievements

**Status 2026-10-28: Partly done, tracked in Equoria-l8w4t.** Distinguish loading vs failed per entry with a retry, and only fetch histories when the Hall of Fame tab is open.

**Evidence:** `frontend/src/pages/MyStablePage.tsx:318`; `frontend/src/pages/MyStablePage.tsx:328`; `frontend/src/pages/MyStablePage.tsx:336`; `frontend/src/pages/MyStablePage.tsx:337`.

**Failure scenario:** One retired horse history request fails or has not resolved. The page builds its entry from data only, substitutes zero competitions/wins and can omit the champion frame without displaying a per-horse loading/error state. The separate account-statistics failure notice does not cover this request. Thus an unavailable career can be shown as an actual zero-win career. Requests also start for all retired horses on the default profile tab.

**Correction direction (not applied):** Model per-entry loading/failure independently from a true zero career, and load or aggregate histories according to the visible task rather than relying on undefined -> zero.

#### STA-09 [P2] Legacy dashboard counts do not describe trainable horses or pending entries

**Status 2026-10-28: Done.** The orphaned GET /users/dashboard/:userId endpoint, getDashboardData and its router were deleted (fbcdd2583, Equoria-oey96.40). There are no upcomingEntries references left in backend. The trainable list now applies the one age policy (c811ffc6b Equoria-2nacc).

**Evidence:** `backend/modules/users/controllers/userController.mjs:196`; `backend/modules/training/controllers/trainingController.mjs:733`; `backend/modules/users/controllers/userController.mjs:219`; `packages/database/prisma/schema.prisma:1941`.

**Failure scenario:** A user owns an underage foal alongside an eligible horse with an actual pending ShowEntry. getTrainableHorses returns its list including the foal, so the dashboard length is not a trainable-only count. Its upcomingEntries query looks for future CompetitionResult rows rather than the pending ShowEntry and can report zero despite an entry. The endpoint is mounted but unused by current Home; this is a backend-summary defect, not a claim that Home already renders those fields.

**Correction direction (not applied):** Count actual eligible horses and pending entry rows using the relevant ownership/window predicates, and scope run dates to the advertised user schedule.

#### STA-10 [P2] Stable recent activity always claims the feed is empty

**Status 2026-10-28: Open, tracked in Equoria-xsbit.** Feed it from a real source (e.g. recent results/notifications) with loading/empty/error states, or remove the block.

**Evidence:** `frontend/src/components/layout/AsidePanel.tsx:81`; `backend/modules/horses/routes/horseRoutes.mjs:157`; `backend/modules/users/controllers/userController.mjs:339`.

**Failure scenario:** After a real new competition result or XP event exists, the desktop stable aside still displays No recent activity because the text is unconditional and no activity query drives that block. The list can supply a latestEvent and the self activity API can return XP events, but neither changes this claim. The placeholder therefore describes an empty history even when records exist.

**Correction direction (not applied):** Wire a defined stable-life source with loading/empty/error states, or mark the section as unavailable instead of asserting no events.

### Existing audit continuity

`NAV-02` (horseId/horse handoff mismatch), `NAV-08` (Hall of Fame card default tab), `NAV-09` (return result context/prize) and `ACC-03` (opening player XP display curve) remain source-visible where relevant. They are referenced in this volume rather than counted again as distinct new findings.

### Verification performed

- Selected frontend stable tests: PASS exit 0; 15 files / 158 tests in 13.66 seconds. Stable categories/Profile stats, champion/color/pregnancy cards, narrative chips, Next Actions/return summary, cooldowns, native tabs, breed portrait resolver and horse list hook. A React act warning occurred in a passing Hall of Fame test; no tests were changed.
- Fresh `npm run typecheck`: PASS exit 0.
- Fresh `scripts/doctrine-checks/run-all.sh` through Git for Windows bash: PASS exit 0; all 46 checks, including backend/frontend ESLint and Prettier.
- Standard backend stable-level command attempted with `backend/jest.config.mjs` and `backend/modules/users/__tests__/getStableLevel.test.mjs`: exit 1 in global setup cleanup before suite assertions. `NODE_ENV=test`, `REDIS_DISABLED=true`, and a dummy `DATABASE_URL` at localhost port 1 prevented shared-database access. No backend assertions passed/failed and no real fixture cleanup occurred.
- Read-only source probes ran actual list select/decorators and frontend care/pregnancy/image/category helpers. A fully cared-for pregnant mare with a future cooldown became needs-care=true, ready=true, no pregnancy badge and breed-fallback portrait after projection. Actual pagination expressions produced visible page one then Next to page three from stale state 17 with 30 filtered horses.
- Default 200-record client fetch and local 12-record slicing verified in source. The 250-horse example is source pagination math, not a live DB/browser benchmark. Per-retired-horse history and per-horse aside timer costs are reported without a measured latency claim.
- No full suites, shared DB fixtures, live account mutations, E2E/beta-readiness, deployment, migrations/seeds, under-500-ms performance benchmark or physical-device/screen-reader run. Root `npm run lint` was not separately invoked; doctrine covered backend/frontend lint/format.
- DOCX structural/package checks passed: all required subject headings, field/model/API registers, findings/source lines, exact section geometry, repeating table headers, expanding unsplit rows and output reopening. Only body and footer text changed in the retained package.
- Original reference SHA256 unchanged: `3ba5d9db5292bbcfa0e51062de7fdd8771cb8ce89a14424d6d315a5209fe05ff`.
- Reference/output render attempted using bundled renderer; unavailable because LibreOffice `soffice.exe` is absent. No page images, pagination/appearance QA or page count is claimed.

AUDIT: CONCERNS

## Horse Profile and Core Horse Data Implementation Audit 2026-10-12

Owner-authorized documentation audit against `EquoriaBible/06_Horse_Profile_Core_Horse_Data_DEEP.docx`. Completed output: `EquoriaBible/Findings/06_Horse_Profile_Core_Horse_Data_DEEP.docx`. HEAD `9bd106ce0ac1e524cae464c189089ccef3511148` plus current working tree; pre-existing edits preserved. Embedded design directives were treated as requirements to compare, not instructions to change implementation. Original reference retained unchanged.

Coverage: thirteen mounted profile tabs, 45 design/status comparisons, 28 field/provenance groups, eight exact Prisma records, 38 scoped HTTP contracts, 35 source evidence groups and 15 concrete concerns. Distinguishes stored data, backend-only features, mounted components, incomplete wiring, placeholders and locked design discrepancies. No application/test edits or player-state mutations.

### Source backed findings

#### HP-01 [P2] Known parentage is discarded before pedigree rendering

**Status 2026-10-28: Open, tracked in Equoria-qi7rm.** normalizeHorseDetail: build parentIds from raw.sireId/raw.damId. Done = a bred horse shows linked sire and dam and the View Parents action.

**Type:** Correctness.

**Evidence:** `frontend/src/pages/HorseDetailPage.tsx:308`; `frontend/src/pages/horse-detail/PedigreeTab.tsx:13`; `backend/modules/horses/routes/horseRoutes.mjs:259`.

**Failure scenario:** A bred owned horse has sireId7 and damId8 on the real full-row GET, with no parentIds object. The actual page normalizer returns parentIds undefined. Pedigree labels both parents Store Horse and hides their links; the top View Parents action and genetics lineage lose known ancestors. The pure normalizer probe confirms this without any database mutation.

**Review direction (not applied):** Map canonical flat ancestry IDs into the profile model and distinguish unknown parentage from verified store origin; retain legitimate owner access rules on linked records.

#### HP-02 [P2] Profile health omits the authoritative combined band

**Status 2026-10-28: Done.** normalizeHorseDetail now carries vetHealth and displayedHealth (Equoria-u0jop, f38c4a623). HorseProfileCard's HealthBadge and label, HealthVetTab and OverviewTab all read horse.displayedHealth.

**Type:** Correctness.

**Evidence:** `frontend/src/pages/HorseDetailPage.tsx:299`; `frontend/src/pages/horse-detail/HorseProfileCard.tsx:136`; `backend/utils/horseHealth.mjs:162`.

**Failure scenario:** An unfed horse has healthStatus Excellent from a vet finding but feedHealth critical and displayedHealth critical. The server returns all bands, but the page carries only raw status and feedHealth; its header/HealthVet show Excellent and optional composite badge is absent. The actual decorator plus normalizer probe reproduces that misleading healthy display while server gates use critical.

**Review direction (not applied):** Carry derived vet/composite health and render the canonical combined band with its contributing care reasons.

#### HP-03 [P2] Profile uses stale stored age instead of derived game age

**Status 2026-10-28: Partly done, tracked in Equoria-55soj.** Switch OverviewTab, TrainingTab and HorseVisitorView to horse.ageYears (or set age from ageYears in the normalizer).

**Type:** Correctness.

**Evidence:** `frontend/src/pages/HorseDetailPage.tsx:291`; `backend/utils/horseAge.mjs:157`; `frontend/src/pages/horse-detail/TrainingTab.tsx:73`.

**Failure scenario:** After a birthday before the stored age column is synchronized, or for a legacy mismatched row, age is4 but dateOfBirth yields ageYears5. The API adds5 and the profile renders4; local training age uses the same stale value. A pure decorator/normalizer fixture confirms it. Backend authoritative checks may reject or allow actions differently from the displayed age.

**Review direction (not applied):** Prefer authoritative ageYears with a deliberate compatibility fallback; use one age contract in display and local eligibility.

#### HP-04 [P2] Active public stud listings cannot be managed from the profile

**Status 2026-10-28: Open, tracked in Equoria-zd12a.** normalizeHorseDetail: copy studStatus and studFee. Done = a listed stallion's page shows its standing, fee and unlist control.

**Type:** Correctness.

**Evidence:** `frontend/src/pages/HorseDetailPage.tsx:286`; `frontend/src/pages/horse-detail/StudSaleTab.tsx:37`; `backend/modules/horses/controllers/horseStudController.mjs:42`.

**Failure scenario:** The full owned row has At Public Stud and fee450, but the page does not copy either field. isAtStud becomes false, the fee and Remove from Stud control vanish, and Offer as Stud Service remains. A successful list/refetch repeats that same false state. The actual normalizer probe confirms both fields are omitted.

**Review direction (not applied):** Preserve listing state and fee across the detail adapter, and verify list/refetch/unlist through the real response shape.

#### HP-05 [P2] Epigenetic insights mapper reads trait names at the wrong depth

**Status 2026-10-28: Superseded by owner ruling.** origin/master: frontend/src/hooks/useHorseGenetics.ts (mapEpigeneticInsights) and TraitCard.tsx deleted in 81688cbb5 (Equoria-8tz7p, owner ruling q72): Genetics tab now shows traits plus color genetics; interaction/strength/rarity sections removed.

**Type:** Correctness.

**Evidence:** `frontend/src/hooks/useHorseGenetics.ts:219`; `backend/modules/labs/routes/enhancedReportingRoutes.mjs:164`; `backend/modules/traits/services/traitInteractionMatrix.mjs:95`; `frontend/src/pages/horse-detail/GeneticsTab.tsx:58`.

**Failure scenario:** The real insights payload places names at traitAnalysis.traitInteractions.traits. The card mapper instead reads traitAnalysis.traits and yields[]; authoritative classification enriches that empty set rather than recreating it. Executing actual pure backend analysis with three traits followed by the actual mapper gives three stored names and zero displayed cards. Source/discovery metadata is also not carried by the current card projection.

**Review direction (not applied):** Map the actual insights nesting and domain metadata; verify the transport shape with the real analysis output. Keep the separate working pair-mapper path distinct.

#### HP-06 [P2] Conformation breed comparison receives no breed ID

**Status 2026-10-28: Open, tracked in Equoria-uvgsz.** Pass breedId={horse.breedId} from HorseDetailPage and disable useBreedAverages for 0/falsy.

**Type:** Correctness.

**Evidence:** `frontend/src/pages/HorseDetailPage.tsx:512`; `frontend/src/components/horse/ConformationTab.tsx:42`; `frontend/src/hooks/api/useConformation.ts:96`.

**Failure scenario:** Open Conformation for an owned horse whose breedId is known. The parent passes only horseId, so the component asks for breed0 averages. The hook enables0 and the comparison condition still has no breedId; the breed-average toggle cannot display the intended comparison. Horse-specific percentile analysis remains separately available.

**Review direction (not applied):** Pass the live breedId and disable average queries for invalid IDs; distinguish designed breed means from population percentiles.

#### HP-07 [P2] Legacy missing conformation becomes a client exception

**Status 2026-10-28: Open, tracked in Equoria-nmjsr.** useHorseConformation: return response?.conformationScores ?? null. Done = legacy horse shows the no-data panel.

**Type:** Correctness.

**Evidence:** `backend/modules/horses/controllers/horseConformationController.mjs:30`; `frontend/src/hooks/api/useConformation.ts:49`; `frontend/src/components/horse/ConformationTab.tsx:89`.

**Failure scenario:** For a legacy horse without scores the server intentionally returns200 with data null. After client envelope unwrapping, the hook dereferences null.conformationScores and fails instead of supplying absent data to the component. The no-data panel exists but this successful missing-record path reaches the error panel. The null-dereference probe confirms the exception.

**Review direction (not applied):** Normalize nullable legacy responses before reading scores, and keep no-record status separate from request failure.

#### HP-08 [P2] Conformation words diverge from the locked five band scale

**Status 2026-10-28: Open, tracked in Equoria-y8vg9.** Map scores to Excellent/Very Good/Good/Fair/Poor once the score bands are approved.

**Type:** Design discrepancy.

**Evidence:** `frontend/src/lib/utils/conformation-utils.ts:47`; `frontend/src/components/horse/ConformationScoreCard.tsx:1`.

**Failure scenario:** A score65 is displayed Average and55 Below Average. The supplied later design permits Excellent, Very Good, Good, Fair and Poor only. The executed function emits six labels and no Fair. Numeric scoring can remain implemented while the requested verbal contract is unmet.

**Review direction (not applied):** Use an explicitly owner-approved mapping to the five locked terms; the audit does not invent new thresholds.

#### HP-09 [P2] Horse Points economy and display still implement legacy XP rules

**Status 2026-10-28: Partly done, tracked in Equoria-k1p62.9.** Conformation shows: award Horse Points 10/5/3/1 in conformationShowSettlement (owned by Equoria-k1p62.9, per owner item 14 2026-10-16). Seasonal-event double points belong to the seasonal events system (Equoria-286xv).

**Type:** Design discrepancy.

**Evidence:** `backend/modules/competition/services/competitionAwards.mjs:42`; `backend/modules/horses/services/horseXpModelService.mjs:25`; `frontend/src/components/horse/XpProgressBar.tsx:41`; `backend/modules/competition/services/conformationShowService.mjs:1`.

**Failure scenario:** A first-place ridden finish awards30 rather than the supplied10; participation20 rather than1. At100 accumulated XP an allocation becomes available instead of the locked1000. Conformation settles without a horseXp award, no seasonal double is selected, and Progression still shows universal Level/progress. Actual award-function probes confirm30/27/25/20. Renamed visible copy has not implemented the later economy or information-box contract.

**Review direction (not applied):** Align award/threshold/seasonal/classification/storage/UI contracts to the owner design together, with explicit treatment of existing balances. No migration or balance change was attempted.

#### HP-10 [P2] Spending an allocation makes the displayed level regress

**Status 2026-10-28: Done on origin/master.** origin/master frontend/src/components/horse/XpProgressBar.tsx rewritten: 'X / 1000 Points toward the next stat' with Allocate Stats; no availableStatPoints + 1 level or 'Level N reached'. Commit 43d689491 (Equoria-a0fim).

**Type:** Correctness.

**Evidence:** `frontend/src/components/horse/XpProgressBar.tsx:41`; `backend/modules/horses/services/horseXpModelService.mjs:209`.

**Failure scenario:** At currentXP150 and availableStatPoints1 the mounted expressions show Level2 and50 percent. Spend the allocation through the existing server endpoint; currentXP stays150 and the bank becomes0. The same expressions show Level1 and compute150 percent, which also feeds milestone logic. Bar fill clamping does not repair the derived level. The source-expression probe reproduces both states.

**Review direction (not applied):** Separate lifetime totals, earned entitlements and remaining allocations. Implement the requested information-only Points presentation; do not derive career level from a spendable bank.

#### HP-11 [P2] Competition history request failures are displayed as empty history

**Status 2026-10-28: Done on origin/master.** origin/master HorseDetailPage.tsx no longer mounts CompetitionHistory; Show Results tab uses horse-detail/ShowResultsTab.tsx, which handles isError with a retry button calling refetch(). Commit b264c3e0b (Equoria-q4uem.10.1).

**Type:** Correctness.

**Evidence:** `frontend/src/pages/HorseDetailPage.tsx:128`; `frontend/src/pages/HorseDetailPage.tsx:529`; `frontend/src/components/competition/CompetitionHistory.tsx:9`.

**Failure scenario:** The horse exists but its history GET fails after loading. The page destructures only data/loading, passes neither error nor refetch, and the presentation component receives undefined data with loading false. It can show No competitions yet for a horse with real results. The component already has an error/retry contract that the parent never supplies.

**Review direction (not applied):** Propagate query failure and retry independently of legitimate empty history; retain any available stale results deliberately.

#### HP-12 [P2] Clickable competition cards have no result action on this page

**Status 2026-10-28: Done on origin/master.** origin/master HorseDetailPage.tsx no longer mounts CompetitionHistory or its View details cards; ShowResultsTab.tsx renders a paged ledger with only retry/prev/next buttons. Commit b264c3e0b (Equoria-q4uem.10.1).

**Type:** Correctness.

**Evidence:** `frontend/src/pages/HorseDetailPage.tsx:526`; `frontend/src/components/competition/CompetitionHistory.tsx:358`.

**Failure scenario:** An owned horse has result rows. Each history card is a button with a View details label, but HorseDetailPage provides no onViewResults callback and mounts no result modal. Clicking a card does nothing. The optional callback is invoked safely, so tests supplying a callback can pass while this mounted control remains dead.

**Review direction (not applied):** Connect the card to a valid authorized result detail route or mounted modal; remove action semantics until a real action exists.

#### HP-13 [P2] Vet history and next check advice are fixed placeholders

**Status 2026-10-28: Done.** HealthVetTab (frontend/src/pages/horse-detail/HealthVetTab.tsx) builds vetHistory from horse.lastVettedDate, and the invented six-week recommendation was removed (7356bf493, Equoria-oey96.56).

**Type:** Correctness.

**Evidence:** `frontend/src/pages/horse-detail/HealthVetTab.tsx:21`; `frontend/src/pages/horse-detail/HealthVetTab.tsx:47`; `backend/utils/horseHealth.mjs:126`.

**Failure scenario:** After a real vet visit, HealthVet still reports No vet records on file because its history is a constant empty array. It always recommends6weeks regardless of lastVettedDate, even though a no-override horse starts declining after7days and is critical after29. This is not a calculated clinic recommendation or a queried medical record.

**Review direction (not applied):** Read actual veterinary history/care timestamps and the current schedule, or label the domain unavailable without presenting invented history/advice.

#### HP-14 [P2] Dam breeding cooldown is seven days rather than the supplied three weeks

**Status 2026-10-28: Superseded by owner ruling.** Owner ruling 2026-10-16 in equoria-stud-fee-is-player-chosen: 'Mare cooldown is 7 days', mares only. The list and detail now send a breedingCooldownEndsAt next-breedable date (c3e64b732, Equoria-q4uem.9).

**Type:** Design discrepancy.

**Evidence:** `backend/modules/horses/controllers/horseFoalingController.mjs:29`; `backend/modules/horses/controllers/horseFoalingController.mjs:149`.

**Failure scenario:** A healthy eligible mare conceived on dayD and has completed the seven-day pregnancy. The current guard permits another conception from Eastern dayD+7; the supplied locked three-week cooldown would block untilD+21. lastBredDate is not shown as a profile next-breedable date either. This is a verified constant/guard scenario, not a live conception test.

**Review direction (not applied):** Resolve the authoritative cooldown against the supplied later decision explicitly and expose the resulting next-breedable date; do not silently treat current code comments as a design revision.

#### HP-15 [P2] Training history invents gains and zero score values

**Status 2026-10-28: Done.** TrainingLog now stores scoreBefore and scoreAfter (schema.prisma). transformHistoryToTableFormat in frontend/src/components/training/ScoreProgressionPanel.tsx shows the recorded values or null and never invents +5 (94c77ae67 Equoria-ky2ob; a7098c645 Equoria-da2fw). The 10-28 ruling also removes Training History from Progression (Equoria-a0fim).

**Type:** Correctness.

**Evidence:** `backend/modules/training/services/trainingAnalyticsService.mjs:62`; `frontend/src/components/training/ScoreProgressionPanel.tsx:59`; `frontend/src/components/training/ScoreProgressionPanel.tsx:88`; `packages/database/prisma/schema.prisma:960`.

**Failure scenario:** The analytics service returns real TrainingLog rows with discipline/date but no score. The panel expects entry.score, so its radar stays0 and table rows report previous0/new0/gain+5 for each session, regardless of actual temperament/trait gain. A probe through both actual projection functions confirms this for two valid logs. This falsely describes the historical outcome and makes0to0show+5.

**Review direction (not applied):** Persist and return actual session outcomes if retrospective gain history is required, or show truthful session/date history and read current disciplineScores separately. Do not manufacture five-point historical gains.

### Other documented implementation gaps

**Status 2026-10-28: Partly done, tracked in Equoria-jyf8c (tracked with COMP-04).** Horse Prestige + ledger, ownership history, progeny success and staff/bond summaries absent; need Stacey to say which, if any, are wanted given 'no reports for players'.

Overall/per-discipline Horse Prestige and a Prestige Event Ledger are absent from current horse storage/consumers; titles, rider prestige and older legacy score are not substitutes. Active-type campaign slots and separate open show counts, entry-time class snapshots, deep progeny/descendant success, profile ownership journal, full veterinary history, ongoing staff/bond/compatibility summaries and complete scalable history remain absent or partial. Current model/group/Points labels marked OPEN in the supplied design remain unresolved.

### Existing audit continuity

`NAV-02` remains relevant to profile Train/Compete horseId links versus destination horse consumption; `NAV-07` covers the global missing result route, distinct from HP-12 callback wiring. `STA-01` covers list projection, distinct from this full-detail normalization. Stable Hall of Fame is a separate current surface. Prior concerns are not silently treated as resolved or recounted as new defects.

### Verification performed

- First selected frontend run: PASS exit 0, 19 files / 102 tests in 27.02 seconds.
- Additional focused frontend run: exit 1, 10 files / 160 tests: 156 passed, four failed. Four existing `nonColorMeaning.test.tsx` LineageSection tests render Link without a router; Link context destructuring fails before assertions. Dedicated router-backed LineageSection tests pass. No tests were changed.
- Combined: 29 distinct files / 262 tests, 258 passed and four failed. Relative supplementary paths in the first invocation matched no files; the second invocation corrected paths and ran all ten.
- Fresh `npm run typecheck`: PASS exit 0. Fresh Git for Windows bash doctrine suite: PASS exit 0; all 46 checks, including backend/frontend lint and format.
- Actual AST functions/initializers and actual pure backend analysis confirm flat-parent/stud/composite-health/age loss, three stored traits -> zero mapped cards, six verbal conformation bands, 150 XP with bank 1 -> 0 causing displayed Level 2 -> 1/progress 50 -> 150, ridden award table 30/27/25/20 and synthetic training rows 0 -> 0/+5.
- Backend Prisma dependency was replaced by an inert object for pure trait analysis only; no DB method, network mutation or player-state change ran. No backend integration suite was run in Volume 06; earlier global cleanup precondition is documented, not claimed as a new test result.
- No full suites, E2E/beta-readiness, live DB fixtures, conception/listing/transfer, production, migrations/seeds, performance/load, physical-device or screen-reader verification.
- DOCX package/structural QA passed: exact reference section/styles/theme/relations preserved; only body/footer changed; source lines, schema declarations, registered method paths, required headings, repeating headers, expanding unsplit rows and output reopening checked.
- Original reference SHA256 unchanged: `9c6dfb4096bd95f59b5aa197b585cf264a7d8a798a6ad39bc4351c63eb8a2868`.
- Reference/output renderer attempted; bundled LibreOffice `soffice.exe` missing. No page images, visual/pagination QA or page count claimed.

AUDIT: CONCERNS

## Genetics Color and Phenotype Implementation Audit 2026-10-12

Owner-authorized implementation audit against `EquoriaBible/07_Genetics_Color_Phenotype_DEEP.docx`. Completed output: `EquoriaBible/Findings/07_Genetics_Color_Phenotype_DEEP.docx`. HEAD `9bd106ce0ac1e524cae464c189089ccef3511148` plus current working tree. Embedded design directives were treated as intended requirements, not commands to alter the game. Original reference preserved; application/test/data/database changes were not made by this audit. Concurrent competition/schema changes were preserved.

Coverage: 37 design/status comparisons, 19 core loci/defaults/starter maps, all 312 operational breed source entries, five nonempty breed disallowed maps, current phenotype/dilution/pattern/shade logic, marking/modifier generation and inheritance, ten HTTP contracts, exact Breed model plus Horse genetics excerpt, 30 evidence groups and ten concrete concerns. Exploratory Snowdrop/mutation/discovery/registry policy remains open; no new biological facts or owner balance decisions inferred.

### Source backed findings

#### GEN-01 [P2] Equivalent reversed pairs change phenotype expression

**Status 2026-10-28: Open, tracked in Equoria-yp4sa.** breedingColorInheritanceService assembleAllelePair must emit one canonical order per locus (dominant first, e.g. Z/n not n/Z) so phenotypeCalculationService and enforceBreedRestrictions see the same form. Done = n/n sire x Z/Z dam foal reads Silver; regression test for each locus.

**Category:** Current correctness.

**Evidence:** `backend/modules/horses/services/phenotypeCalculationService.mjs:98`; `backend/modules/horses/services/phenotypeCalculationService.mjs:468`; `backend/modules/horses/services/breedingColorInheritanceService.mjs:184`.

**Failure scenario:** A valid n/n sire and Z/Z dam produce n/Z. The live inheritance function preserves that order, but phenotype recognizes only Z/n or Z/Z, so the foal is Bay. The preview sorts the pair and predicts Silver Bay at 100 percent. Actual functions reproduced this. Reversal probes also lose Champagne,Gray,Roan,LP,PATN1,Mushroom or pinto flags. Cream is already symmetric, so this is not a universal input convention.

**Review direction (not applied):** Choose a shared canonical allele-pair representation or evaluate locus token sets symmetrically in both live inheritance and forecast. Verify equivalent-parent-order outcomes, including flags and subtype/shape effects.

#### GEN-02 [P2] Breed whitelist replacement overwrites a valid parental result

**Status 2026-10-28: Open, tracked in Equoria-q39od.** enforceBreedRestrictions must compare canonical (order-free) pairs, and a replacement must be built only from alleles the parents carry. Done = e/E foal of an E/e-only breed keeps E/e; no foal gets an allele neither parent has.

**Category:** Current correctness.

**Evidence:** `backend/modules/horses/services/breedingColorInheritanceService.mjs:295`; `backend/data/breeds/American Quarter Horse.txt:4`; `backend/modules/horses/services/breedingColorPredictionService.mjs:32`.

**Failure scenario:** With the actual sanitized American Quarter Horse profile, e/e sire x E/E dam produces e/E. The allowed list contains E/e but not reversed e/E; the final restriction replaces it with first allowed e/e. Actual foal color is Chestnut while preview is Bay 100 percent. A separate fixture with both parents e/e and target allowed only E/E returns E/E, introducing an allele neither parent has. Exact membership and arbitrary fallback break the supplied Mendelian truth invariant.

**Review direction (not applied):** Canonicalize complete pairs before membership checks. For incompatible parent/target-breed data, enforce a policy that preserves parental possibility or refuses the cross instead of silently substituting unrelated alleles.

#### GEN-03 [P2] Founder generation trusts weights without enforcing forbidden pairs

**Status 2026-10-28: Open, tracked in Equoria-piiof.** generateGenotype must reject/reroll lethal and disallowed pairs and pairs outside allowedAlleles (or profiles must be validated when synced). Done = test with a profile weighting O/O never mints O/O.

**Category:** Reproduced profile guard gap.

**Evidence:** `backend/modules/horses/services/genotypeGenerationService.mjs:224`; `backend/modules/marketplace/controllers/marketplaceController.mjs:615`.

**Failure scenario:** An edited breed map with O/O weight1 produces O/O through actual generateGenotype even when O/O is explicitly disallowed; an edited Extension map can select e/e outside allowed_alleles. Founder/store/onboarding paths call this generator without the inheritance guard. The current 312 source profiles passed safety checks and a seeded5000AQHsample had0forbidden draws. This concern is missing runtime enforcement for inconsistent/future imported data, not evidence that current stock regularly receives lethal genotypes.

**Review direction (not applied):** Validate profiles at import/use and enforce allowed/nonforbidden founder output using the same shared invariants as breeding. Reject impossible maps rather than minting a prohibited result. Preserve realistic weights after conditioning.

#### GEN-04 [P2] Forecast cap omits remaining loci without telling the player

**Status 2026-10-28: Superseded by owner ruling.** breedingColorPredictionService.mjs (generateAllGenotypeProbabilities, predictBreedingColors) deleted on origin/master in 89792101b 'remove the foal colour prediction endpoint' (Equoria-m13fh), per owner ruling q91 (no foal preview). No remaining reference in backend/frontend source.

**Category:** Current correctness.

**Evidence:** `backend/modules/horses/services/breedingColorPredictionService.mjs:121`; `backend/modules/horses/services/breedingColorPredictionService.mjs:134`; `backend/modules/horses/services/breedingColorPredictionService.mjs:298`.

**Failure scenario:** A fixture with eleven valid heterozygous locus pairs crosses the 50,000 limit at 59,049 entries. Expansion breaks before O_FrameOvero is processed; that locus is absent, so its lethal outcomes cannot be filtered and phenotype fills defaults. The internal capped flag is not returned by predictBreedingColors. A caller receives an apparently complete color distribution. This is a pure computation reproduction, not a production load test.

**Review direction (not applied):** Avoid partial-genotype probability claims. Use complete bounded computation or return explicit incomplete/error metadata; apply resource limits before a full expansion allocation.

#### GEN-05 [P2] Lethal warning mistakes unique outcome counts for probability mass

**Status 2026-10-28: Superseded by owner ruling.** frontend LethalWhiteWarning.tsx deleted in e017dfe61 (Equoria-q4uem.9, Equoria-m13fh, Breeding Hall and foal predictions removed); the prediction service it read was deleted in 89792101b. No references remain on origin/master.

**Category:** Current correctness.

**Evidence:** `frontend/src/components/breeding/LethalWhiteWarning.tsx:46`; `backend/modules/horses/services/breedingColorPredictionService.mjs:48`; `backend/modules/horses/services/breedingColorPredictionService.mjs:146`.

**Failure scenario:** For O/n x O/n the normalized Punnett entries are O/O25percent,O/n50percent,n/n25percent. The response reports3entries and1lethal entry. Warning computes1/3and displays33percent, instead of25percent. Actual service output reproduces the count ratio. Its copy describes non-surviving births despite the actual prevention/reroll path, further confusing raw inheritance risk with game outcomes.

**Review direction (not applied):** Return removed probability mass separately from counts and label the conditioned forecast/prevention semantics accurately. Do not derive a risk percentage from nonuniform unique outcome counts.

#### GEN-06 [P2] Snowflake and Frost flags are generated without LP applicability

**Status 2026-10-28: Open, tracked in Equoria-tcata.** Once the owner rules, gate snowflake/frost in markingGenerationService on the ruled genetics (pass the genotype into generateMarkings/inheritMarkings). Done = a horse without the ruled gene never carries them.

**Category:** Appearance contract gap.

**Evidence:** `backend/modules/horses/services/markingGenerationService.mjs:170`; `backend/modules/horses/services/markingGenerationService.mjs:252`; `backend/modules/horses/services/phenotypeCalculationService.mjs:494`.

**Failure scenario:** Fresh generateMarkings(null,Bay,rng0) returns snowflakePresent and frostPresent true even on a solid no-LP baseline. The marking service does not receive genotype. The separate phenotype pattern names are LP-dependent, so the same visual concept is represented by unconstrained flags and constrained subtype names. The supplied document frames these concepts as exploratory and LP-dependent; code does not establish an approved new genetic system.

**Review direction (not applied):** Resolve the intended applicable genetics for these exploratory effects explicitly, and gate their flag generation/inheritance consistently with that decision. Keep age progression absent until an actual rule and implementation exist.

#### GEN-07 [P2] Coat tab reads the wrong Pangare modifier key

**Status 2026-10-28: Done on origin/master.** CoatTab.tsx deleted in fe3a92c89 'remove the Coat tab; colour and markings read in Horse Details' (Equoria-qzr6a). On origin/master the only frontend readers use hasPangare (MarkingsPanel.tsx, normalizeHorseDetail.ts, HorseDetailPageTypes.ts), matching markingGenerationService generateBooleanModifiers. isPangare survives only in backend/docs/swagger.yaml.

**Category:** Current correctness.

**Evidence:** `frontend/src/pages/horse-detail/CoatTab.tsx:64`; `backend/modules/horses/services/markingGenerationService.mjs:227`; `frontend/src/components/horse/MarkingsPanel.tsx:45`.

**Failure scenario:** Generated phenotype.modifiers.hasPangare is true and /color passes modifiers through. Coat filters its chip list by isPangare, which is absent, so the player sees no Pangare chip there. The header MarkingsPanel reads the real hasPangare key and may show it. This causes disagreement between two current views of one stored phenotype.

**Review direction (not applied):** Use the same canonical modifier key in generated data, API type and both renderers, and verify the real generator payload rather than a fixture inventing isPangare.

#### GEN-08 [P2] Inherited leg markings bypass the target breed cap

**Status 2026-10-28: Open, tracked in Equoria-2r7xv.** inheritMarkings must cap marked legs at markingBias.maxLegsMarked after inheritance. Done = Cleveland Bay (cap 1) foal of parents marked on different legs has at most one marked leg.

**Category:** Current correctness.

**Evidence:** `backend/modules/horses/services/markingGenerationService.mjs:130`; `backend/modules/horses/services/markingGenerationService.mjs:335`; `backend/data/breeds/Cleveland Bay.txt:52`.

**Failure scenario:** The actual Cleveland Bay profile caps marked legs at1. Each parent has one marked leg in a different slot and is individually within the cap. Independent40/40inheritance can pick both marks; the executed fixture produces two socks. There is no post-inheritance cap. A separate zero-cap fixture inherits four stockings. Fourteen current source profiles have caps below4, so this is a current target-breed boundary rather than only a speculative new field.

**Review direction (not applied):** Apply an explicit consistent target-breed bound after inheritance, using an owner-approved resolution when multiple valid parental marks exceed the cap. Do not silently change modifier balance.

#### GEN-09 [P2] Null phenotype backfill can replace an existing hereditary genotype

**Status 2026-10-28: Open, tracked in Equoria-k0d28.** The script must keep an existing colorGenotype (only derive phenotype from it) and generate a genotype only when colorGenotype is null, guarded in the UPDATE's WHERE. Done = horse with inherited genotype and null phenotype keeps its genotype.

**Category:** Operational correctness.

**Evidence:** `backend/scripts/backfill-horse-colors.mjs:24`; `backend/scripts/backfill-horse-colors.mjs:50`; `backend/scripts/backfill-horse-colors.mjs:58`.

**Failure scenario:** An existing horse has a valid inherited colorGenotype but phenotype is null after a partial/legacy write. The script selects the row solely by phenotype null, does not read its genotype, generates random alleles and overwrites colorGenotype. It changes hereditary identity while ostensibly filling missing color display. The scenario is source-traced; the script was not executed on any database.

**Review direction (not applied):** Preserve and validate existing genotype, derive only missing phenotype from it, and separately identify rows truly lacking genotype. Guard writes against changed candidate state and use the required transaction policy.

#### GEN-10 [P2] Zero shade weight still receives a selectable slot

**Status 2026-10-28: Open, tracked in Equoria-1fyfa.** expandShadesToArray must skip weights <= 0 (guard gap; no current profile has one). Done = unit test with a 0 weight never selects that shade.

**Category:** Reproduced shade guard gap.

**Evidence:** `backend/modules/horses/services/phenotypeCalculationService.mjs:42`; `backend/modules/horses/services/phenotypeCalculationService.mjs:649`.

**Failure scenario:** For a profile shade map never0,always1 the actual expansion allocates one never slot and ten always slots; actual selectShade at hash0 returns never. A deliberately excluded shade can therefore be selected, and small/negative weights gain at least one slot. No scanned current profile contains a zero shade entry, so this is a verified update/configuration guard gap rather than a claimed current zero-weight row.

**Review direction (not applied):** Exclude nonpositive weights and use a deterministic weighting method that honors the intended distribution and valid shade set. Preserve display compatibility for already stored phenotypes.

### Implemented scope and open boundaries

Working founder/inheritance/phenotype/marking/forecast services and mounted Coat/offspring forecast are documented. Current source profiles pass weight-sum, weighted-pair whitelist and positive forbidden-pair checks. Founder and shade guard concerns explicitly involve inconsistent/future configuration, not observed lethal source weights. Rendering remains imageUrl/breed-based rather than a genotype-aware coat renderer. No coat-carrier testing/journal, Snowdrop locus, dedicated coat mutation, community registry, crossbreed recognition or age-progressive Gray/Snowflake system found. Legacy/Prestige does not modify coat allele draws; adjacent title boost affects inherited conformation and is documented separately.

Volume 06 HP-01 and HP-05 remain relevant to profile ancestry and epigenetic card nesting and are referenced without duplication as new color defects.

### Verification performed

- Frontend selected run: PASS exit 0, six files / 45 tests in 6.87 seconds.
- Backend existing pure cases: PASS exit 0, five suites / 244 tests, 12 database integration cases excluded, 20.532 seconds. Temporary Jest config uses Node environment and omits global database setup/cleanup. Database URLs pointed to dummy localhost port 1; no shared DB fixtures ran. Tests unchanged. Earlier config attempt failed on Windows ESM path and was corrected before the successful run.
- Fresh `npm run typecheck`: PASS exit 0.
- Initial doctrine: exit 1, 45 of 46 checks passed. Backend lint/format failed on concurrently edited `backend/modules/competition/shows/showController.mjs:718` curly rule and `conformationShowController.mjs` formatting. No unrelated code was repaired. Final rerun after concurrent edits: PASS exit 0, all 46 checks.
- Actual pure modules and real sanitized source profiles reproduce order-dependent expression, AQH parental genotype -> forbidden-order fallback, omitted cap loci, 33% versus 25% warning calculation, solid no-LP advanced flags, Cleveland Bay cap-one parents -> two-marked-leg foal, and zero shade slot inclusion. Backfill overwrite scenario is source-traced; no script mutation executed.
- All 312 operational SQL profiles parsed through actual sanitizer: zero parse/weight-sum/weighted-whitelist errors; no positive forbidden pairs. Five nonempty disallowed maps, 19 weighted loci each. JSON fallback has 312 narrower non-coat profiles. Seed 1337 / 5,000 AQH founder draws: zero forbidden. No inference of deployed rows, exact population prevalence or independent biological validity.
- No normal backend database suite, full suites, E2E/beta-readiness, live DB census, conception/purchase/backfill/import, production/performance/device tests or independent genetics research.
- DOCX structural/package QA passed: all required topics and registered evidence, 312 source entries, 19 loci, model declarations, exact preserved section/style/theme/relations, repeating headers, expanding unsplit rows, XML validation and output reopening. Only document body/footer changed.
- Original SHA256 unchanged: `eba9721070f38869d1094a0bd98a1d06c4dd59a9f9fde598053cff9da1911d65`.
- Reference and output renderer attempted; bundled LibreOffice `soffice.exe` missing. No page images, visual/pagination assurance or page count claimed.

AUDIT: CONCERNS

## 2026-10-13 — Volume 08 breeding, pregnancy and foal reveal implementation audit

Owner requested a new current-implementation DOCX in `EquoriaBible/Findings`. Supplied document directives were design evidence, not commands to implement systems. Source original retained unchanged. Application/test files read-only; no live player-state mutation. Other tasks committed concurrent cache/runtime changes; source trace and pure probes refreshed. Initial HEAD `e3ed7dc9d52192ca1579d6f90bf7312fe1eb48f3`, final evidence HEAD `99ceadce59a8b18ea0f48b476a43c809a2c6511f` plus existing working tree.

Deliverable: `EquoriaBible/Findings/08_Breeding_Pregnancy_Foal_Reveal_DEEP.docx`. 8641 words, 56 coverage items, 25 relevant HTTP contracts, 33 evidence groups, exact Horse field excerpt plus complete FoalDevelopment/Notification models. Thirteen new findings follow; HP-14 cooldown and existing GEN concerns referenced without duplication.

### BRE-01 [P2] Displayed breeding charges are not authoritative

**Status 2026-10-28: Done.** BreedingPairSelection.tsx now shows 'Stud Fee: None' for an own pair (3e400411a, Equoria-q4uem.9/8doyo). horseFoalingController createFoal records BreedingRecord fee 0 per the own-pair-free ruling (equoria-stud-fee-is-player-chosen). Player-set stud fees are charged on the server through transferUserMoneyOrThrow in studBookingController and studRequestController (abb284b39).

Evidence locations: `frontend/src/pages/breeding/BreedingPairSelection.tsx:53`; `frontend/src/pages/breeding/BreedingPairSelection.tsx:317`; `frontend/src/components/breeding/BreedingConfirmationModal.tsx:279`; `backend/modules/horses/controllers/horseFoalingController.mjs:330`.

Concrete failure scenario: A player confirms an ordinary500 stud fee plus200 breeding fee, including with insufficient balance. The server starts pregnancy without checking or debiting funds. A stored studFee1800 still produces client500 when level is absent. The confirmation promise of immediate deduction is false.

Verification boundary: Actual fee helper probe plus complete conception request/write tracing; no live balance mutation.

Disposition: Connect a server-owned quote and transactional settlement after an explicit economics decision, and render that contract.

### BRE-02 [P2] Selector advertises unavailable or invalid breeding parents

**Status 2026-10-28: Done on origin/master.** HorseSelector (isMaleHorseSex/isFemaleHorseSex filter) was deleted in e017dfe61 (Equoria-q4uem.9, breeding moved to the stallion page). The new mare picker frontend/src/pages/horse-detail/stud/studBreeding.ts filters `horse.sex === 'Mare'` exactly plus ages 3-20, matching breedingPairRules ('Stallion'/'Mare').

Evidence locations: `frontend/src/lib/api/breedingHorse.ts:1`; `frontend/src/components/breeding/HorseSelector.tsx:30`; `backend/modules/horses/controllers/horseFoalingController.mjs:110`.

Concrete failure scenario: An age5 pregnant mare, a raw Critical horse or an age5 Colt passes the local helper. The adapter does not retain pregnancy/lastBredDate or derived care health, and the server subsequently rejects pregnancy, critical health or exact sex. A local cooldown cannot work from the actual response projection.

Verification boundary: Read-only helper probes and source/DTO tracing.

Disposition: Project and render the server eligibility state with consistent sex, pregnancy, health and cooldown rules; retain server enforcement.

### BRE-03 [P1] Nightly birth loses maternal inherited epigenetic traits

**Status 2026-10-28: Open, tracked in Equoria-3ab0k.** runFoalingJob's select (or the snapshot reload) must include epigeneticModifiers so damTraits and parentActiveTraits include the dam. Done = real-DB foaling-job test where only the dam carries a trait and the 25% roll can pass it on (and an active dam trait is born revealed).

Evidence locations: `backend/modules/horses/services/foalingService.mjs:552`; `backend/modules/horses/services/foalingService.mjs:596`; `backend/modules/horses/services/foalingService.mjs:95`; `backend/utils/applyEpigeneticTraitsAtBirth.mjs:155`.

Concrete failure scenario: A mare with athletic and a sire without it foals through the normal job. Candidate select omits epigeneticModifiers, so the passed dam snapshot produces no maternal traits while the sire is fully read. The newborn cannot inherit that maternal-only trait through Stage0.

Verification boundary: Select-object probe and actual pure at-birth seed1: full mother inherits athletic, job-equivalent missing mother does not.

Disposition: Include or reload maternal modifiers and exercise the actual scheduled service handoff.

### BRE-04 [P1] Birth ancestry deduplication disables duplicate-ancestor penalties

**Status 2026-10-28: Open, tracked in Equoria-jmxir.** gatherLineage must report repeat ancestors (or analyzeInbreeding must walk sire and dam lines separately), and the inbreeding outcome must use the roster traits the owner picks. Done = real pedigree with a shared grandparent triggers the inbreeding roll.

Evidence locations: `backend/modules/horses/services/foalingService.mjs:171`; `backend/utils/applyEpigeneticTraitsAtBirth.mjs:303`.

Concrete failure scenario: Both parents share ancestor3. The real ancestry walker returns IDs1,2,3,4,5, with3 once. The birth helper reports no inbreeding; the same lineage containing the second occurrence reports low severity. Thus the defined negative-risk stage cannot see the overlap removed upstream.

Verification boundary: Actual extracted walker with synthetic read-only family and real extracted analysis helper; no database access.

Disposition: Preserve pedigree path occurrences separately from cycle protection and align the approved risk model with actual birth inputs.

### BRE-05 [P2] Discipline specialization counts the same ancestor twice

**Status 2026-10-28: Superseded by owner ruling.** Owner ruling 2026-10-20 (equoria-traits-binary-no-stats-conformation-fixed): the discipline trait replaces the 23 affinities. The lineage rule is now 3 ancestors in 3 generations sharing their most-competed discipline, giving +2% on stats, and legacyTalent/disciplineAffinity traits are not on the roster (equoria-trait-roster-20-and-reveal-ladder).

Evidence locations: `backend/modules/horses/services/foalingService.mjs:210`; `backend/utils/applyEpigeneticTraitsAtBirth.mjs:340`.

Concrete failure scenario: Only sire and dam have Dressage scores80. The walker supplies each discipline and disciplineScores; analysis counts both for each horse, yielding4. The child becomes eligible for70% affinity and40%legacyTalent rolls without four distinct discipline ancestors.

Verification boundary: Same synthetic family probe returns specialization count4.

Disposition: Count one chosen discipline per eligible ancestor/path according to an explicit lineage rule.

### BRE-06 [P1] Performance inheritance forecast is not applied at birth

**Status 2026-10-28: Partly done, tracked in Equoria-fq9ob.** createFoalFromPregnancy must set all 12 stats from the parents per the owner's formula, then add the Equoria-fq9ob lineage bonus. The bible gives no explicit base formula (vol 08 lists prenatal formulas as OPEN), so the base rule needs confirming. Done = real foaling test showing nonzero inherited stats.

Evidence locations: `backend/modules/breeding/services/enhancedGeneticProbabilityService.mjs:177`; `backend/modules/horses/services/foalingService.mjs:442`; `backend/modules/horses/services/horseModelService.mjs:215`; `packages/database/prisma/schema.prisma:181`.

Concrete failure scenario: Both parents have speed80. Preview expects80 with range70â€“90, but newborn horseData omits speed and all eleven other base stats. Generic createHorse omits undefined stats and schema defaults them to0. The actual newborn can never match this displayed birth range on this path.

Verification boundary: Actual horseData AST evaluation confirms twelve missing stat fields; exact service/schema trace, no actual database newborn.

Disposition: Define and connect authoritative base-stat inheritance, or make preview accurately describe current outcomes pending that decision.

### BRE-07 [P2] Birth nutrition quality uses stale raw health rather than care

**Status 2026-10-28: Partly done, tracked in Equoria-jmxir.** foalingService assessFeedQualityFromMare should be removed or replaced by the owner's mare-condition rule (care-derived health grade and/or pregnancy feed tier). Done = birth roll reads only owner-ruled inputs.

Evidence locations: `backend/modules/horses/services/foalingService.mjs:121`; `backend/utils/horseHealth.mjs:1`; `backend/utils/applyEpigeneticTraitsAtBirth.mjs:181`.

Concrete failure scenario: A raw Excellent mare with bond80 and no feed history gets quality100 despite care-derived Critical health. At low stress she can receive favorable condition rolls while the independent counter roll describes missed-feed risk. Actual nutrition does not govern the older quality proxy.

Verification boundary: Actual proxy and care-health pure-function probe.

Disposition: Use the agreed current prenatal care inputs consistently and document how counters and condition risks compose.

### BRE-08 [P2] Pregnancy bonus can expose a trait that remains hidden

**Status 2026-10-28: Done on origin/master.** origin/master foalingService.mjs now calls pickFirstUnused(PREGNANCY_BONUS_POSITIVE_TRAITS, carriedTraits()) where carriedTraits() = positive + negative + hiddenTraits, and the bonus is born hidden unless a parent had it active (2733a7026, Equoria-2d55z). Pools are now ['resilient','peopleTrusting'] and ['fragile'], all on the 20-trait roster.

Evidence locations: `backend/modules/horses/services/foalingService.mjs:107`; `backend/modules/horses/services/foalingService.mjs:77`; `backend/utils/applyEpigeneticTraitsAtBirth.mjs:86`.

Concrete failure scenario: resilient is already hidden by the birth visibility stage and the positive list is empty. A successful bonus picks resilient as unused in the visible list and appends it visibly while retaining it hidden. It bypasses the discovery boundary and creates two representations of one trait.

Verification boundary: Actual pool/helper probe with hiddenresilient; source-traced final modifier assembly.

Disposition: Deduplicate across all trait buckets and apply the intended visibility policy when adding prenatal bonuses.

### BRE-09 [P2] First-breeding presentation milestone never persists

**Status 2026-10-28: Done.** 63ee72da9 (Equoria-5z9pl) removed the 'first breeding' presentation. BreedingPairSelection's onSuccess now fires one plain notify per successful breed and reads no firstBreed flag.

Evidence locations: `frontend/src/pages/breeding/BreedingPairSelection.tsx:180`; `frontend/src/pages/breeding/BreedingPairSelection.tsx:283`.

Concrete failure scenario: An account whose firstBreed milestone is absent confirms one pregnancy and later another. The page still reads the missing flag because no setter is present on this connected flow or in the source search, so both can receive the first-breed presentation.

Verification boundary: Repository search and current success-handler tracing; no account settings mutated.

Disposition: Persist a truthful one-time milestone through the authoritative successful conception flow.

### BRE-10 [P1] Conception and birth claims do not pin ownership

**Status 2026-10-28: Partly done, tracked in Equoria-x1t7q.** Foal owner must be read inside the claim (e.g. claim returns the mare's current userId, or claim on userId too), and the marketplace rule for pregnant mares must follow the owner's ruling. Done = test: mare sold between candidate read and claim, foal goes to the ruled owner.

Evidence locations: `backend/modules/horses/controllers/horseFoalingController.mjs:330`; `backend/modules/horses/services/foalingService.mjs:483`; `backend/modules/horses/services/foalingService.mjs:601`; `backend/modules/marketplace/controllers/marketplaceController.mjs:1`.

Concrete failure scenario: A mare sells after route ownership validation but before conception update; the old caller can still stamp pregnancy because owner is absent from the write predicate. Separately, a pregnant mare sells after nightly candidate read; the birth claim succeeds and assigns child/notice to snapshot old-owner. Sale permits pregnancy and preserves it.

Verification boundary: Actual claim AST confirms no userId; source-backed two-operation order. No live race or transfer was executed.

Disposition: Choose and persist pregnancy ownership/transfer terms, then check the intended owner/version at each transactional claim.

### BRE-11 [P2] Breeding event and birth-input history cannot be recovered

**Status 2026-10-28: Partly done, tracked in Equoria-wnlf0.** Add BreedingRecord.foalId (set in the foaling transaction) and keep the birth inputs (feed tiers, chances) on the record. Done = every foal born from a conception has a linked record.

Evidence locations: `packages/database/prisma/schema.prisma:144`; `backend/modules/horses/services/foalingService.mjs:490`; `backend/modules/horses/services/foalingService.mjs:522`.

Concrete failure scenario: After a mare foals, conception date, stored pregnancy sire, feeding aggregate and pending intent are cleared. The service returns but does not persist breedingAnalysis. A player/reviewer cannot retrieve immutable conception terms or nutrition/outcome inputs; a later conception overwrites the remaining lastBredDate.

Verification boundary: Exact schema and write-path trace; requirement gap against explicit reference deep contract.

Disposition: Create an immutable authorized event/input record and history projection when implementing that recovered requirement.

### BRE-12 [P2] Birth notice and foal page do not deliver the required reveal

**Status 2026-10-28: Partly done, tracked in Equoria-nzl9e.** FoalBornRow should link the foal name to /horses/{foalId}. Done = clicking the notice opens the newborn's horse page.

Evidence locations: `frontend/src/pages/messages/GameNotifRow.tsx:106`; `frontend/src/pages/FoalDetailPage.tsx:85`; `backend/modules/horses/services/foalingService.mjs:103`.

Concrete failure scenario: A real foal_born notice carries foalId but has no newborn link. Manually opening the owned foal page yields sex/age/parent ID labels and development rather than image, coat/genotype/markings and preserved prenatal outcome. Core information exists elsewhere but the required linked birth reveal is incomplete.

Verification boundary: Source-established render and payload comparison; no browser playthrough.

Disposition: Link notice to owned newborn and present persisted, knowable birth data with parents/pedigree/development navigation.

### BRE-13 [P2] Final confirmation contradicts actual pregnancy and cooldown

**Status 2026-10-28: Done.** frontend/src/components/breeding/BreedingConfirmationModal.tsx now says the mare rests one game year (7 real days, matching REAL_DAYS_PER_GAME_YEAR), the stallion has no cooldown, and the foal is born on the seventh night (0f435ede0, Equoria-7ga54). This matches createFoal's GESTATION_DAYS response.

Evidence locations: `frontend/src/components/breeding/BreedingConfirmationModal.tsx:295`; `frontend/src/components/breeding/BreedingConfirmationModal.tsx:304`; `backend/modules/horses/controllers/horseFoalingController.mjs:372`.

Concrete failure scenario: A player reads that both parents become unavailable30days and the foal is born immediately, then confirms. Server starts a7-Eastern-day pregnancy, imposes7days on the mare and no stallion cooldown. The final decision screen gives false timing and availability terms.

Verification boundary: Actual rendered source copy compared with connected controller constants/response; no request submitted.

Disposition: Render authoritative current timing and parent availability and separately resolve the three-week reference discrepancy HP-14.

### Verification and limitations

- Existing frontend: 17 files / 330 tests PASS, exit 0. Breeding pages/components, pregnancy panel and pregnancy chances. Executed-file manifest in DOCX; not every excluded story file counted.
- Existing backend isolated pure: 4 suites / 67 tests PASS, exit 0; refreshed after concurrent commits. Temporary config removes shared database setup/teardown and after-env cleanup; dummy DB URLs localhostport1. No backend integration assertion or shared DB fixture cleanup.
- Actual pure probes/AST helpers PASS after refresh: missing maternal traits, shared-ancestor deduplication, discipline count4 from two parents, stale raw-health quality100, fee500 versus stored1800, invalid local eligibility, twelve absent base stats, hidden/visible bonus duplication and ownerless birth claim. Synthetic family lookup only; no production DB.
- Fresh typecheck PASS, exit 0; refreshed doctrine PASS all46 checks, exit 0. Source hashes validated at publication.
- Source/transaction tracing of ownership-transfer windows and missing immutable history; no live HTTP/conception/feed/delivery/sale/race, E2E/beta-readiness, deployed scheduler/row census or device/performance testing.
- DOCX structural/package QA PASS: unchanged original SHA256 f33fb84c15f8d5971c08fbb212157a0e0259160944efb8f86735fe2169faeba1; only document.xml/footer1.xml differ, exact sectPr/style/theme/relationships preserved; XML, reopen, declarations, coverage/source references, repeating headers/unsplit expanding rows checked.
- Reference and final output rendering attempted: LibreOffice soffice.exe missing. Visual layout, pagination and page count remain unverified.

AUDIT: CONCERNS

## 2026-10-13 — Volume 09 foal development epigenetics bond and temperament audit

Owner requested a new implementation document in EquoriaBible/Findings. Embedded design directives were comparison evidence, not instructions to change game mechanics. Source original retained unchanged; application/test files read-only; no player-state or database mutation. Initial HEAD `6c573146c492ce659224f0db5397d812fa915c23`, final build HEAD `901b15fb2a598526ad2ba5150ffde3812dc66f67` plus existing working tree. Concurrent cache, mail and staff commits preserved; final references/schema refreshed, source hashes verified, pure probes rerun and typecheck/doctrine refreshed.

Deliverable: `EquoriaBible/Findings/09_Foal_Development_Epigenetics_Bond_Temperament_DEEP.docx`. 10861 words, 55 coverage items, 27 mounted interfaces, 35 source groups and seven exact persistent registers. Complete current catalogs: 22 executable day activities, 11 listed stage activities, 22 primary trait definitions, 12 nightly rules, nine permanent flags and all eleven temperament modifier sets. Catalog existence is distinguished from live execution.

### FOAL-01 [P1] Stage activity controls cannot satisfy the mounted completion contract

**Status 2026-10-28: Superseded by owner ruling.** Judged on origin/master 3ed999e19 (local master is 137 commits behind). Player-run stage activities, POST /foals/:id/activity and the day 0-6 table were removed (foalRoutes.mjs header, foalModel.mjs, Equoria-fr2kg); the groom does the foal's activity through POST /grooms/care/:horseId/groom with foalCareSchedule bands (groomCareService.chooseInteractionType, d315f2085). Ruling: equoria-foal-enrichment-is-the-grooms-job.

Evidence locations: `frontend/src/components/breeding/FoalDevelopmentTracker.tsx:119`; `backend/modules/breeding/routes/foalRoutes.mjs:84`; `backend/modules/horses/models/foalModel.mjs:383`; `backend/utils/foalAgeUtils.mjs:97`.

Concrete failure scenario: The player confirms Imprinting. The client sends activity and duration, while the mounted route requires activityType, so validation returns 400. Correcting the property still cannot complete imprinting because it is absent from the day table read by completeActivity. Ten of the eleven stage IDs have no executor match.

Verification boundary: Dry execution of the exact express-validator chains and actual extracted catalog functions; no HTTP request or player action.

Disposition: Connect one authoritative activity request and executor; render its actual eligibility, rewards and cooldowns.

### FOAL-02 [P1] Live timeline and graduation use the obsolete real-week calendar

**Status 2026-10-28: Superseded by owner ruling.** Graduation and the named life stages are gone (foalRoutes.mjs: /graduate removed; foalController.mjs: no life stage; Equoria-fr2kg). The foal page and FoalDevelopmentTracker/DevelopmentTracker were deleted and /foals/:id now redirects to the horse page (App.tsx FoalLinkRedirect, Equoria-jaeot). Rulings: equoria-foal-enrichment-is-the-grooms-job, equoria-one-horse-page-no-weather.

Evidence locations: `frontend/src/components/foal/DevelopmentTracker.tsx:219`; `frontend/src/components/breeding/FoalDevelopmentTracker.tsx:81`; `backend/utils/foalAgeUtils.mjs:40`.

Concrete failure scenario: A fourteen-day horse is server stage two_year_old, but the mounted tracker calls it newborn and offers newborn cards. The client requires 104 real weeks for graduation while the server reaches adulthood after twenty-one days. Server stage data is available but unused.

Verification boundary: Fixed-clock comparison of the real backend function and extracted client helper at ages zero through twenty-eight days.

Disposition: Use authoritative server stage and graduation data and the current game calendar throughout the mounted page.

### FOAL-03 [P2] Development read excludes two-year-old foals and the adult handoff page

**Status 2026-10-28: Done.** foalModel.getFoalDevelopment serves every horse under game age 3 (isFoalAge in constants/schema.mjs, Equoria-lu6xo), and the basic GET uses the same under-3 rule (foalController getFoalHandler). There is no longer an adult handoff to interrupt: graduation is removed and one horse page serves all ages (equoria-one-horse-page-no-weather).

Evidence locations: `backend/modules/horses/models/foalModel.mjs:71`; `backend/modules/breeding/controllers/foalController.mjs:317`; `backend/modules/horses/models/foalModel.mjs:701`.

Concrete failure scenario: A stored age-two horse is still a valid basic foal, yet its development read returns 404. At twenty-one days the basic record also returns 404 before the foal page can offer explicit graduation, although the separate owned graduation POST is valid. The youngstock and adult handoff is interrupted.

Verification boundary: Actual controller and model guard comparison; no live aged fixture.

Disposition: Reconcile read eligibility with development and handoff, including an accessible graduation action and retained history.

### FOAL-04 [P1] Displayed bond and stress are separate from values changed by enrichment

**Status 2026-10-28: Done.** foalModel.getFoalDevelopment returns bondingLevel from Horse.bondScore, the value grooming writes (Equoria-fr2kg Q16); the legacy 50/20 FoalDevelopment columns are no longer read. Stress was removed everywhere (297dc13b2, Equoria-b76x0; ruling equoria-no-stress-ever).

Evidence locations: `backend/modules/horses/models/foalModel.mjs:86`; `backend/modules/horses/models/foalModel.mjs:302`; `frontend/src/lib/api/breeding.ts:52`; `frontend/src/components/breeding/FoalDevelopmentTracker.tsx:148`.

Concrete failure scenario: A new Horse starts at bond zero and stress zero, but a development read initializes legacy values fifty and twenty and the UI displays them. Enrichment changes Horse bond and stress; the displayed legacy values remain unchanged. Milestones and nightly traits use Horse values, so visible numbers do not explain actual outcomes.

Verification boundary: Exact schema, source dataflow and normalizer probe; no database change.

Disposition: Use canonical care fields for the UI, actions and achievements, with an explicit migration or retirement of the legacy values.

### FOAL-05 [P2] Birth-day stacking and larger awards violate the daily care lock

**Status 2026-10-28: Done.** Player enrichment (completeEnrichmentActivity) was removed. The only bond writer, groomCareService.groomHorse, allows one groom per horse per Eastern game day (findTodaysInteraction under a FOR UPDATE row lock) and adds a flat dailyBondGain of +5, capped at bondScoreMax (rulings equoria-trait-reveal-by-grooming-days, equoria-grooms-need-daily-player-action).

Evidence locations: `backend/modules/horses/models/foalModel.mjs:471`; `packages/database/prisma/schema.prisma:1057`; `backend/utils/groomSystem.mjs:334`; `backend/config/groomConfig.mjs:49`.

Concrete failure scenario: A foal can receive all three different day-zero enrichment activities: minimum six and maximum sixteen total bond points. Uniqueness is per activity and day, rather than one daily opportunity. Groom care can award additional bond and its live formula allows up to ten points per session. No shared two-point daily cap or birth-day gate exists.

Verification boundary: Actual catalog/range probe, exact uniqueness key and connected groom-effect tracing.

Disposition: Enforce the approved daily opportunity and total bond gain across care systems through a shared transactional contract.

### FOAL-06 [P2] Trait discovery UI announces discoveries without showing authoritative traits

**Status 2026-10-28: Superseded by owner ruling.** The Reveal Traits button, POST /reveal-traits and the foal tracker UI were removed (Equoria-gu8jk, foalRoutes.mjs header). Revealed traits now glow once on the horse page (2e34b4668, Equoria-lylhb; traitSeenService). Ruling: equoria-one-horse-page-no-weather (a player-pressed reveal button is an invention).

Evidence locations: `frontend/src/components/breeding/FoalDevelopmentTracker.tsx:88`; `frontend/src/components/breeding/FoalDevelopmentTracker.tsx:91`; `backend/modules/breeding/controllers/foalController.mjs:341`; `backend/modules/breeding/controllers/foalController.mjs:467`.

Concrete failure scenario: Reveal Traits returns success even with no hidden traits or no new candidate, and the UI announces a discovery. A real revelation returns traits in mutation data, but the display reads foal.traits, which the basic GET does not provide. The visible list can remain absent after a real revelation.

Verification boundary: Connected response and render-effect source trace; no browser mutation.

Disposition: Announce newly revealed records and render the authoritative visible modifiers and flags.

### FOAL-07 [P2] Current enrichment is missing from the displayed history and availability

**Status 2026-10-28: Done.** The separate FoalTrainingHistory enrichment stream is gone. groomCareService.groomHorse writes GroomInteraction, FoalActivity and Horse.taskLog in one transaction, and availability comes from today's interaction plus foalCareToday (buildCareStatus canGroomToday / todaysActivity).

Evidence locations: `backend/modules/horses/models/foalModel.mjs:279`; `backend/modules/horses/models/foalModel.mjs:94`; `backend/modules/horses/models/foalModel.mjs:109`; `frontend/src/components/breeding/FoalDevelopmentTracker.tsx:276`.

Concrete failure scenario: Gentle Touch enrichment writes FoalTrainingHistory and changes Horse. The page log and counter read FoalActivity and development.completedActivities, so the action is missing. The development response offers Gentle Touch again because it does not consult saved enrichment history; a second click is rejected as already completed.

Verification boundary: Actual write/read-table comparison and pure activity-availability comparison.

Disposition: Project every authorized care stream with clear source labels and drive availability from recorded opportunities and completions.

### FOAL-08 [P1] Terminal development day can be evaluated repeatedly

**Status 2026-10-28: Done.** In foalTraitEvaluation.mjs, evaluateFoalTraits skips a foal once foalDevelopment.finalDayEvaluatedAt is set. claimDevelopmentDay claims day 6 by compare-and-swap on finalDayEvaluatedAt null, and days 0-5 by CAS on currentDay (Equoria-mwjst, Equoria-3i34b).

Evidence locations: `backend/services/jobs/impl/foalTraitEvaluation.mjs:138`; `backend/services/jobs/impl/foalTraitEvaluation.mjs:150`; `backend/services/jobs/impl/foalTraitEvaluation.mjs:230`.

Concrete failure scenario: A seven-day-old foal at currentDay six passes evaluation because six is below seven elapsed days. Advance returns six at its cap, leaving the same state eligible again. Two sequential calls on the same day both evaluate; subsequent nightly passes repeat while stored age remains zero or one. Ordinary day advancement does not consume the final opportunity.

Verification boundary: Actual extracted evaluator and advancement function invoked twice with a fixed-age synthetic foal and the real pure trait evaluator; no database writes.

Disposition: Record evaluation completion atomically, including the terminal day, and define catch-up behavior.

### FOAL-09 [P2] Empty newborn history qualifies for a permanent negative care flag

**Status 2026-10-28: Partly done, tracked in Equoria-a7f1p.** Land the batch-evaluate removal on master and delete flagEvaluationEngine/flagTriggerRules evaluateAloofTriggers (Equoria-1vep2).

Evidence locations: `backend/utils/flagEvaluationEngine.mjs:430`; `backend/utils/flagEvaluationEngine.mjs:239`; `backend/utils/carePatternAnalysis.mjs:217`.

Concrete failure scenario: A newborn with bond zero and no interactions meets aloof conditions: fewer than three interactions, bond at most thirty and at most two positive interactions. A permitted flag evaluation can append the permanent negative flag before a meaningful missed-care opportunity or grace period. This conflicts with the reference direction that missing days reduces opportunity.

Verification boundary: The actual trigger returns true for empty newborn patterns; eligibility and persistence are source-traced, without assigning a live flag.

Disposition: Reconcile negative missed-care effects and observation/grace eligibility before permanent assignment.

### FOAL-10 [P2] Permanent flag assignment ignores declared conflicts

**Status 2026-10-28: Partly done, tracked in Equoria-a7f1p.** Removing batch-evaluate and flagEvaluationEngine closes this; no conflict guard needed once the engine is gone.

Evidence locations: `backend/utils/flagEvaluationEngine.mjs:205`; `backend/config/epigeneticFlagDefinitions.mjs:331`.

Concrete failure scenario: A horse already carrying fragile later meets resilient triggers through supported stress recovery. Definitions declare those flags incompatible, but the assignment loop checks neither existing nor newly added flags for conflicts. It can append resilient permanently and leave both opposing effects active.

Verification boundary: Actual flagsConflict returns true and the recovered-care resilient trigger returns true; no resolver is called by the assignment loop.

Disposition: Apply the approved deterministic conflict policy during atomic permanent-flag assignment.

### FOAL-11 [P1] Milestone history window selects dates before birth

**Status 2026-10-28: Open, tracked in Equoria-gveno.** enhancedMilestoneEvaluationSystem getGroomCareHistory windows must anchor to dateOfBirth, or the milestone evaluation is retired with the old window table (trait reveal now runs on the grooming-day ladder).

Evidence locations: `backend/utils/enhancedMilestoneEvaluationSystem.mjs:274`; `backend/utils/enhancedMilestoneEvaluationSystem.mjs:275`; `backend/utils/enhancedMilestoneEvaluationSystem.mjs:159`.

Concrete failure scenario: A foal born on 5 October and evaluated on 13 October for the eight-to-fourteen-day curiosity window selects history from 29 September through 5 October. Care on 10 October is excluded, so quality, diversity and consistency can appear absent and care-gap penalties distort the logged result. The query counts backward from evaluation rather than forward from birth.

Verification boundary: Actual extracted history query with a fixed clock and a read-only capture: the post-birth care event is excluded.

Disposition: Anchor developmental history to that horseâ€™s DOB and the agreed calendar and settlement interval.

### FOAL-12 [P2] Age-one task trait awards are written to an unread modifier bucket

**Status 2026-10-28: Done.** 7358233b3 (Equoria-qw4kp) removed the age-1 task-tag evaluation, the task-to-trait maps and the 'epigenetic_tags' key it wrote. No backend source writes epigenetic_tags any more.

Evidence locations: `backend/utils/horseAgingSystem.mjs:237`; `backend/utils/epigeneticTraitKeyMap.mjs:117`; `backend/utils/bondingModifiers.mjs:56`.

Concrete failure scenario: The birthday evaluator awards mapped task tags and stores them under epigenetic_tags. Normal trait normalization, display, discovery and effect readers consume positive, negative and hidden arrays instead. An award such as bonded or showCalm can remain outside the visible and effective modifier representation.

Verification boundary: Repository consumer search and exact writer/reader tracing; no live birthday mutation.

Disposition: Persist task-derived traits using the authoritative definition, visibility and effect representation, with provenance.

### FOAL-13 [P1] Concurrent trait writers can overwrite discovery and outcome state

**Status 2026-10-28: Done.** The nightly foalTraitEvaluation no longer writes traits (Equoria-2d55z), and manual discovery handlers were removed (traitController header). traitRevealEngine updates under a horses FOR UPDATE lock with jsonb_set, and epigeneticModifiersWrites.appendEpigeneticTraits merges in one UPDATE against the current row (Equoria-m1sf8).

Evidence locations: `backend/services/jobs/impl/foalTraitEvaluation.mjs:184`; `backend/utils/traitDiscovery.mjs:443`.

Concrete failure scenario: Nightly evaluation reads hidden calm. Manual discovery moves calm to visible and saves it. The nightly writer then replaces the whole modifier JSON from its earlier read, restoring calm to hidden or discarding another concurrent trait change. Neither writer checks the prior JSON or version; nightly history, notification and day advancement are separate writes.

Verification boundary: Source-backed two-writer sequence; no live database race or crash experiment.

Disposition: Coordinate trait settlement with a transactional guarded merge or claim and its associated history and day state.

### FOAL-14 [P2] Older live recommendations do not find stored lowercase flags

**Status 2026-10-28: Done.** utils/enhancedMilestoneEvaluation.mjs and its recommendation route were deleted (Equoria-a7f1p; epigeneticFlags.mjs header). EPIGENETIC_FLAGS now has no runtime reader, and epigeneticTraitRoutes imports only GROOM_PERSONALITIES from that file.

Evidence locations: `backend/utils/enhancedMilestoneEvaluation.mjs:296`; `backend/utils/epigeneticFlags.mjs:18`; `backend/modules/traits/routes/epigeneticTraitRoutes.mjs:66`.

Concrete failure scenario: The canonical stored brave flag is looked up as EPIGENETIC_FLAGS["brave"], but the older map is keyed BRAVE. The mounted recommendation path reports flags yet adds zero Bold influence; uppercase BRAVE contributes 0.2. The correct canonical competition and training consumer is a different path.

Verification boundary: Actual extracted lookup with the real older map: lowercase returns zero and uppercase returns 0.2.

Disposition: Use canonical flag definitions and casing with approved influence values in every remaining recommendation consumer.

### FOAL-15 [P1] Effect-backed birth traits cannot be revealed without definitions

**Status 2026-10-28: Done.** applyEpigeneticTraitsAtBirth no longer emits reactive, lowImmunity or legacyTalent; off-roster parent traits are not inherited. peopleTrusting has a roster definition in epigeneticTraits.mjs TRAIT_DEFINITIONS. traitRevealSettings reads rarity/polarity per roster trait for traitRevealEngine (rulings equoria-trait-roster-20-and-reveal-ladder).

Evidence locations: `backend/utils/epigeneticTraits.mjs:472`; `backend/utils/traitDiscovery.mjs:407`; `backend/utils/applyEpigeneticTraitsAtBirth.mjs:86`; `backend/utils/traitEffects.mjs:218`.

Concrete failure scenario: Birth can store hidden peopleTrusting, lowImmunity, reactive or legacyTalent. These names have effect entries but primary getTraitDefinition returns null. Discovery refuses an unknown definition for every priority, so the owner cannot reveal those keys through this engine. Having effects does not establish complete discovery metadata.

Verification boundary: Actual definition lookup and selectTraitsToReveal across all four priorities return no selection; effect keys were confirmed. No database mutation.

Disposition: Reconcile all approved emitted trait keys in one catalog with type, rarity, visibility and discovery metadata.

### Verification and limitations

- Existing frontend: 23 files / 785 tests PASS, exit 0, 21.12 seconds. Includes reusable unmounted component cases as well as live page contract cases; their existence is not live integration proof.
- Existing backend isolated pure: 12 suites / 470 tests PASS, exit 0, 5.176 seconds. Explicit executed-file manifest in DOCX; no database fixture assertions. Temporary config removes shared DB setup/teardown/after-environment cleanup and uses dummy localhost port 1 DB URLs. Force-exit/open-handle guidance emitted.
- Actual pure/dry source probes PASS, refreshed after concurrent commits. Exact route validators, extracted catalog/normalizer/clock/query/evaluator helpers with synthetic read seams; no HTTP or DB mutation. Reproduces wrong activity property, UI clock drift, terminal-day replay, dropped milestones, newborn aloof, incompatible flags, excluded post-birth care, lowercase lookup failure and undiscoverable effect-only keys.
- Fresh typecheck PASS, exit 0. Final refreshed doctrine PASS all 47 checks, exit 0; current inventory increased from the prior chapter’s 46.
- No database integration suite, normal global fixture cleanup, live lifecycle action/discovery/grooming/flags/milestone evaluation, E2E/beta-readiness, production scheduler/row census, device/accessibility playthrough, race/crash experiment or performance assessment.
- DOCX structural/package QA PASS: source hash f55e4a0dadd86873788ff63caaf93997000ed783122d0eb069bd6b7811f21398 unchanged; only document.xml and footer1.xml changed; exact section/styles/theme/relationships retained; XML/reopen, all source/model/catalog/coverage references, repeating headers and unsplit expanding rows verified.
- Reference and final renderer attempted; bundled LibreOffice soffice.exe missing. Visual layout, pagination and page count remain unverified.

AUDIT: CONCERNS

## 2026-10-13 — Volume 10 care grooming health vetting and burnout audit

Owner requested a separate currently implemented game document under EquoriaBible/Findings. Embedded design directives were comparison evidence, not instructions to alter game rules. Original retained unchanged; application/tests read-only; no player state or DB mutation. HEAD `673d07c0da9a881223d92b897bed5a4b663951aa` plus existing working tree, unchanged during this audit. Preexisting edits preserved; source hashes verified at publication.

Deliverable: `EquoriaBible/Findings/10_Care_Grooming_Health_Vetting_Burnout_DEEP.docx`. 12237 words,60 coverage responsibilities,26 mounted interfaces,30 source groups and6 exact record registers. Complete current catalogs:5 feed tiers,4 vet and4 farrier services,17 groom tasks,33 visible tack items plus2 legacy aliases, base groom calculation tables and6 second personality configurations. Prior STA-01/HP-02/HP-13/FOAL-04/FOAL-05 cross referenced without duplicate findings.

### CARE-01 [P2] Default medical overrides bypass weekly vet decay

**Status 2026-10-28: Done.** horseHealth.getVetHealth now ignores the good stored words (Excellent/Very Good/Good/Fair) and grades by days since lastVettedDate (0-7/14/21/28, 29+ Bad); only a Bad-class finding overrides (208650020, Equoria-qwz60). A vet check writes lastVettedDate plus Excellent, which then decays normally (ruling equoria-vet-restores-excellent-fee-by-level).

Evidence locations: `backend/utils/horseHealth.mjs:130`; `packages/database/prisma/schema.prisma:212`; `backend/modules/economy/vet/controllers/vetController.mjs:104`.

Concrete failure scenario: A regularly fed horse with the default Excellent healthStatus and a visit thirty days ago still has excellent vet health. A null override for the same horse gives critical. Paid health checks and treatment also write persistent overrides, so the weekly decay intended by the helper stops after ordinary service.

Verification boundary: Actual pure thirty-one-day matrix and current schema/service writers; no deployed row census.

Disposition: Separate clinical findings from ordinary maintenance bands and implement the approved weekly decay/recovery representation.

### CARE-02 [P1] Normal show entry admits derived critical health

**Status 2026-10-28: Done.** competitionEntryRules.evaluateEntryRules applies healthRefusal -> hasBadHealth (derived displayed health) to ridden entries. entryEligibility.checkEntryEligibility runs it inside the entry transaction, with the same gate conformation uses (ruling equoria-no-burnout-health-is-only-consequence, Equoria-u0jop).

Evidence locations: `backend/modules/competition/shows/showController.mjs:316`; `backend/modules/competition/shows/showController.mjs:327`; `backend/modules/competition/routes/competitionRoutes.mjs:356`; `backend/modules/competition/controllers/conformationShowController.mjs:94`.

Concrete failure scenario: A three-year-or-older owned horse has Excellent raw status but no lastFedDate. The helper computes critical. Normal ridden/parade entry only rejects raw injured, so this medical gate passes while the corresponding conformation/breeding critical gate rejects. Feed/vet fields are absent from the normal entry projection.

Verification boundary: Actual pure critical derivation and source inspection of both mounted entry paths; no live entry or fee charged.

Disposition: Use the approved authoritative health inputs and rule consistently at normal entry and any required settlement boundary.

### CARE-03 [P2] Reached show scores ignore medical and emotional care

**Status 2026-10-28: Done.** competitionScoring applies healthScorePercent (rules/healthScoring.mjs, +5/+3/0/-3/-5%) as a percent term in the nightly scorer. Stress and burnout no longer exist (rulings equoria-no-stress-ever, equoria-no-burnout-health-is-only-consequence).

Evidence locations: `backend/modules/competition/shows/showController.mjs:453`; `backend/modules/competition/services/competitionScoring.mjs:101`; `backend/utils/traitEffects.mjs:521`.

Concrete failure scenario: Two horses have the same five stats and rider conditions. One is healthy with zero stress; the other has Poor health, stress one hundred and visible burnout. At identical luck the actual nightly scorer gives both fifty. It does not select or consume those care dimensions, despite the declared burnout performance effects.

Verification boundary: Actual scorer with deterministic luck plus executor projection; no claim that the unresolved older health percentages must be applied unchanged.

Disposition: Explicitly decide and connect approved health and emotional scoring rules, or align the player-visible effect descriptions with the intended formula.

### CARE-04 [P2] Locked competition injury rolls and records are absent

**Status 2026-10-28: Superseded by owner ruling.** Owner ruling equoria-no-burnout-health-is-only-consequence makes bad health the only consequence system. The sole competition authority (docs/features/13_Competitions_shows_Event_Scoring_DEEP.md, equoria-competition-bible-is-sole-authority) locks no injury odds; it only mentions a health/injury result 'if triggered'.

Evidence locations: `backend/modules/competition/shows/showController.mjs:418`; `backend/modules/competition/services/competitionScoring.mjs:101`; `packages/database/prisma/schema.prisma:920`.

Concrete failure scenario: A Fair or Poor horse finishes a current normal competition. No reached step rolls the recovered five/ten-percent medical risk and no result captures health-at-event or injury outcome. Trait injuryRisk declarations do not generate an event. The locked competition source is therefore not implemented.

Verification boundary: Bounded current repository entry/settlement/schema writer search; no statistical production experiment and no new injury odds inferred.

Disposition: Implement an approved transactional server event with health snapshot and replay-safe injury outcome while preserving zero training injury.

### CARE-05 [P1] Medical services can charge a former owner after transfer

**Status 2026-10-28: Done.** vetController.bookVetAppointment re-reads the horse with {id, userId} after the User-row debit lock and writes via updateMany where {id, userId}. A miss throws and rolls the debit back. farrierController does the same: updateMany where {id, userId, ...shoeableWhere}, and count !== 1 throws.

Evidence locations: `backend/modules/economy/vet/controllers/vetController.mjs:88`; `backend/modules/economy/vet/controllers/vetController.mjs:128`; `backend/modules/economy/farrier/controllers/farrierController.mjs:89`; `backend/modules/economy/farrier/controllers/farrierController.mjs:127`.

Concrete failure scenario: The seller passes the owned-horse check for a vet or farrier service. A sale then commits. The delayed service transaction debits the seller and updates the horse by ID only, applying care to the buyerâ€™s horse. Guarding wallet balance and lock order does not repeat ownership at the write.

Verification boundary: Source-backed precheck-transfer-write interleaving; no live sale race. Feed/equip and free decoration removal also have related ID-only write boundaries, documented separately from their daily guards.

Disposition: Repeat current ownership in the transaction and horse write predicate so transfer invalidates the whole purchase and debit.

### CARE-06 [P1] Concurrent groom requests bypass the daily limit

**Status 2026-10-28: Done.** groomCareService.groomHorse locks the horse row (SELECT ... FOR UPDATE) and re-reads today's interaction under that lock. It writes Horse, GroomInteraction, FoalActivity and synergy in one transaction. The old /grooms/interact and /grooms/enhanced/interact doors are retired (d315f2085, Equoria-l7xag).

Evidence locations: `backend/modules/grooms/controllers/groomInteractionController.mjs:103`; `backend/modules/grooms/controllers/groomInteractionController.mjs:291`; `backend/utils/groomSystem.mjs:230`; `packages/database/prisma/schema.prisma:755`.

Concrete failure scenario: Two requests for the same horse read no interaction today before either transaction opens. Both then write events. Their Horse updates use the same previous bond/stress/taskLog, so the second can overwrite the first and two FoalActivity rows can coexist with one cached task count. There is no unique horse/day claim.

Verification boundary: Source/schema interleaving and current transaction inspection; no database concurrency experiment. Existing FOAL-05 covers the distinct cross-stream global cap.

Disposition: Claim the legal care day atomically and derive applied changes from current guarded state with event/cache writes in that transaction.

### CARE-07 [P1] Flag modifiers produce invalid fractional bond writes

**Status 2026-10-28: Done.** The groom path no longer applies epigeneticFlagInfluence bond multipliers. groomCareService.groomHorse writes the integer min(bondScoreMax, bond + dailyBondGain), and the old groomInteractionController interact path is retired (ruling equoria-trait-reveal-by-grooming-days: +5 per groom).

Evidence locations: `backend/modules/grooms/controllers/groomInteractionController.mjs:244`; `backend/modules/grooms/controllers/groomInteractionController.mjs:252`; `backend/utils/epigeneticFlagInfluence.mjs:240`; `packages/database/prisma/schema.prisma:216`.

Concrete failure scenario: A groom session has base bondingChange five and the horse has affectionate. The actual flag helper returns six and a half. Starting from an ordinary integer bond below the cap, the controller passes a fractional total to the Prisma Int bondScore field without rounding. The expected result is a rejected transaction and 500 instead of completed care.

Verification boundary: Actual flag helper returns 6.5/3.5 for affectionate/aloof, confirmed unrounded live assignment and Int schema. Prisma/HTTP failure was not executed against a database.

Disposition: Choose the authoritative integer rounding and approved award cap, then persist and report the resulting applied delta consistently.

### CARE-08 [P1] Daily grooming has no reached player execution flow

**Status 2026-10-28: Done.** The horse page's CareArea (pages/horse-detail/CareArea.tsx) calls useGroomHorse -> POST /grooms/care/:horseId/groom, and hub/GroomingReminder lists ungroomed horses (d315f2085). dailyCareAutomation was deleted on purpose (ruling equoria-grooms-need-daily-player-action).

Evidence locations: `frontend/src/components/groom/GroomTaskPanel.tsx:23`; `frontend/src/components/groom/GroomAssignmentCard.tsx:272`; `frontend/src/lib/api/grooms.ts:34`; `backend/utils/dailyCareAutomation.mjs:378`; `backend/services/cronJobService.mjs:1`.

Concrete failure scenario: A player hires and assigns a groom expecting the daily care advertised on GroomsPage. The reached dashboard has no interaction command; the separate assignment/task card has no mounted page caller or action callback. No current production scheduler registers the automation handler. Routine brushing and the streak loop are therefore API-accessible but not a completed browser flow.

Verification boundary: Current frontend caller/mutation search and scheduler registration search; no assertion about external manually invoked jobs.

Disposition: Connect the approved care action or actual scheduled service to the existing transactional domain path and expose authoritative completion/availability.

### CARE-09 [P2] Legacy task IDs pass validation but fail execution

**Status 2026-10-28: Done.** POST /api/grooms/interact, which admitted the legacy IDs, is retired (groomRoutes.mjs retiredGroomDoor). groomBondingSystem.mjs has no production importer. The live route accepts only a foal activity from foalCareToday, or none for adults (groomCareService.chooseInteractionType; ff465ad60 camelCase task migration).

Evidence locations: `backend/modules/grooms/routes/groomRoutes.mjs:57`; `backend/utils/groomBondingSystem.mjs:194`.

Concrete failure scenario: A valid owned adult request submits daily_care, feeding, grooming, exercise or medical_check, each explicitly admitted by the route. The next eligibility helper rejects all five because only the seventeen newer IDs are eligible. A caller following the routeâ€™s stated list cannot complete the task.

Verification boundary: Actual pure eligibility probe for all five legacy strings and brushing at age five; no HTTP/database request.

Disposition: Use a single approved executable task contract or an explicit safe legacy translation, and distinguish groom feeding assistance from real inventory consumption.

### CARE-10 [P2] Care streaks do not count the same day as the care limit

**Status 2026-10-28: Done.** groomCareService.nextStreak computes the gap with gameDayIndex (the Eastern game day, the same clock as findTodaysInteraction/gameDayBounds) with careStreakGraceDays. The elapsed-hours helper in groomBondingSystem has no production caller.

Evidence locations: `backend/utils/groomBondingSystem.mjs:443`; `backend/utils/groomSystem.mjs:228`.

Concrete failure scenario: A player at streak six grooms at 23:59 Eastern and again at 00:01 on the next legal care day. The day limit permits the new date, but the elapsed-hours streak helper calls it sameDay and leaves the streak six. Repeated earlier daily care can similarly prevent progress toward seven.

Verification boundary: Actual pure helper with fixed timestamps returns unchanged six; current day-limit calendar inspected.

Disposition: Use the agreed game-day clock for streak progress and explicitly lock the interpretation of grace before implementing passive expiry.

### CARE-11 [P2] Immunity does not resolve the training blocking burnout trait

**Status 2026-10-28: Superseded by owner ruling.** Burnout was removed. trainingController has no burnout gate (only bad health), and traitEffects resolves a stored 'burnout' name to no effects (Equoria-0d4wa). Ruling: equoria-no-burnout-health-is-only-consequence.

Evidence locations: `backend/modules/grooms/controllers/groomInteractionController.mjs:301`; `backend/modules/training/controllers/trainingController.mjs:207`; `backend/utils/traitEffects.mjs:521`.

Concrete failure scenario: A horse carrying a visible burnout trait receives enough care counts for stored immune. Training still blocks because it reads the trait, not burnoutStatus. The current system has no connected rest/groom/bond/herb recovery that removes or reconciles the trait. A long missed-care interval also leaves the stored marker unchanged until another session.

Verification boundary: Current status writer, actual trait consumer and bounded trigger/recovery/expiry caller search; no live burned-out horse created. Exact OptionB remains OPEN.

Disposition: Define separate condition and resistance semantics and implement the approved trigger/recovery/expiry flow without inventing overtraining punishment.

### CARE-12 [P2] Paid parade presentation products do not affect the reached score

**Status 2026-10-28: Open, tracked in Equoria-dqnz1.** Until parades score, tackInventory.mjs decorations should be marked comingSoon like non-scoring saddles/bridles, or sold with no bonus claim; Glitter's 3 uses and Snowflake's winter tag need a ruling.

Evidence locations: `backend/modules/economy/tackShop/controllers/tackShopController.mjs:442`; `backend/modules/economy/tackShop/controllers/tackShopController.mjs:524`; `backend/modules/competition/shows/showController.mjs:453`; `backend/modules/competition/services/competitionScoring.mjs:110`.

Concrete failure scenario: A player buys Parade Blanket for 350 expecting its advertised plus five presentation. The resolver could supply that bonus, but actual parade settlement does not load tack or call it and uses the same five-stat score. Glitterâ€™s three uses and winter tackâ€™s season are also catalog metadata without current enforcement.

Verification boundary: Actual scorer unchanged with decorations at fixed luck and production caller/projection inspection. Product slots/rarities remain proposals; this finding targets an existing paid catalog promise.

Disposition: Connect the intended presentation component or correct the current purchase promises; implement finite-use/season rules only after an explicit product decision.

### CARE-13 [P2] Groom care events record nominal rather than applied bond

**Status 2026-10-28: Done.** groomCareService.groomHorse computes bondAdded = newBond - horse.bondScore after clamping. It records that applied delta in both GroomInteraction.bondingChange and FoalActivity.bondingChange in the same transaction.

Evidence locations: `backend/modules/grooms/controllers/groomInteractionController.mjs:252`; `backend/modules/grooms/controllers/groomInteractionController.mjs:314`; `packages/database/prisma/schema.prisma:755`.

Concrete failure scenario: A base ten session on an affectionate horse below the total cap produces an integer gain thirteen after flags, while GroomInteraction, FoalActivity and response bondingChange record ten. A near-cap horse can gain less than the logged amount. Care history cannot reconstruct the actual applied score change.

Verification boundary: Actual flag math plus event/response assignment tracing; no database event was inserted.

Disposition: Persist the final clamped/rounded before-and-after delta with necessary modifier provenance in both authoritative care records and feedback.

### Additional implemented behavior boundaries

**Status 2026-10-28: Done.** utils/groomPersonalityEffects.mjs (the second personality layer) has no importer, so its age/traits seams never run. A Horse Trader purchase (marketplaceController) still nulls lastVettedDate, but getVetHealth now reads null as Bad instead of letting the Excellent default override it, so health and the Vetted chip agree.

The second personality layer uses truthy game-year age with a 0–1095 ageRange: playful newborn 0 misses the youngstock condition while adult 5 matches. Its gentle/firm trait condition reads horse.traits, which the live grooming projection does not select. Source evidence: `backend/utils/groomPersonalityEffects.mjs:49`; `backend/utils/groomPersonalityEffects.mjs:156`; `backend/utils/groomPersonalityEffects.mjs:231`; `backend/utils/groomPersonalityEffects.mjs:206`. Actual pure probes captured both age outcomes and missing projected traits. Returned successRate/streakGrowth/burnoutRisk are not complete persisted outcome systems. No claim of live database reproduction.
Horse Trader sets Excellent then clears lastVettedDate; after actual feeding, the override still gives excellent vet health although the Vetted chip warns. Current birth/onboarding initialization and old Very Good seeds are distinguished from canonical health migrations. S29 supplies verified references.

### Verification and limitations

- Existing frontend12files/125tests PASS, exit0,15.60seconds. Reusable unmounted task panel assertions are not page integration proof.
- Existing backend6pure suites/98tests PASS, exit0,3.493seconds. Executed manifest in DOCX. Temp config removed shared DB setup/teardown/afterenv cleanup, dummy localhostport1 DB URLs at launch. Comprehensive pure suite assigns an unused fixture URL; no DB calls. Force-exit/open-handle guidance emitted.
- Initial same backend run from wrong cwd failed3 source-reading sentinels. Same unchanged98 tests passed from backend cwd. Preliminary malformed CLI corrected; no application/test fix claimed.
- Actual pure probes PASS:31-day health matrix/override, missingcare/retirement, Easternfeed checks, older lookup, affectionate/aloof fractional bond, elapsed-hour streak, grace, legacy task rejection, decorative resolver, actual settlement score invariance and second personality input seams. Actual catalogs extracted. No live requests, purchases, clinical outcomes or DB races.
- TypeScript PASS exit0; doctrine PASS all47 checks exit0.
- No integration/global fixture cleanup, production row/override/scheduler census, browser game-state mutation, race/crash experiment, full beta E2E, lint, accessibility/device/performance assessment.
- DOCX structural/package QA PASS. Source SHA256 218796b0d9579f40e347ca93ad82d282a2f54ced2a6f31423f4c943dc19a3b3d unchanged. Only document.xml and footer1.xml changed. Exact section/styles/theme/relationships, XML/reopen, source hashes/lines, catalog/schema completeness, repeating headers and expanding unsplit rows checked.
- Reference and final renderer attempted and diagnosed; bundled LibreOffice soffice.exe absent. Visual layout, pagination/page count remain unverified.

AUDIT: CONCERNS

## 2026-10-13 — Volume 11 training and development implementation audit

Owner requested a separate currently implemented game document in EquoriaBible/Findings. Embedded reference directives were comparison evidence, not instructions to change mechanics. Original unchanged; no application/test edits or player-state/database mutation. Snapshot HEAD `673d07c0da9a881223d92b897bed5a4b663951aa` plus existing working tree, unchanged during this audit. Preexisting and concurrent changes preserved; current source hashes verified before publication.

Deliverable: `EquoriaBible/Findings/11_Training_Development_DEEP.docx`. 11195 words, 59 coverage responsibilities, 21 mounted interfaces, 31 source groups and five exact record registers. All 23 discipline IDs/training pools/old competition maps, 33 consumed training-effect entries, additional unused training definitions, 11 temperament factors, nine flag probability adjustments and trainer caps/compatibility documented. Prior NAV-02, HP-03, HP-15, FOAL-01/02/03/05 and CARE-11 referenced without duplicate numbering. Fourteen new concerns follow.

### TRAIN-01 [P1] Profile slugs split scores and bypass the Gaited requirement

**Status 2026-10-28: Open, tracked in Equoria-i42xr.** TrainingTab.tsx handleConfirm must send the canonical discipline name (e.g. 'Dressage', 'Gaited'), or trainingController must normalize before breedAllowsDiscipline and the disciplineScores write.

Evidence locations: `frontend/src/pages/horse-detail/TrainingTab.tsx:143`; `frontend/src/components/training/DisciplinePicker.tsx:101`; `backend/modules/training/controllers/trainingController.mjs:120`; `backend/modules/training/controllers/trainingController.mjs:382`; `backend/modules/training/services/trainingSessionTx.mjs:95`.

Concrete failure scenario: Train Dressage from the profile: it sends dressage, stores a separate lowercase development key and uses the fallback speed/stamina/focus pool. Training Grounds uses Dressage and a different key/pool. A horse without positive gaited is blocked for Gaited but succeeds for the profile gaited slug, because that literal branch is skipped.

Verification boundary: Actual extracted controller with synthetic read/commit seams: lowercase dressage selects speed on a winning roll; title-case Gaited rejects while gaited succeeds. No HTTP or database write.

Disposition: Adopt one approved discipline identity and translate UI IDs at a validated boundary before eligibility, modifiers, persistence and history.

### TRAIN-02 [P2] Unrecognized disciplines receive rewards and consume the weekly action

**Status 2026-10-28: Open, tracked in Equoria-e131q.** trainingRoutes POST /train and /check-eligibility (or canTrain) must reject a discipline not in the catalog before commitTrainingSession.

Evidence locations: `backend/modules/training/routes/trainingRoutes.mjs:88`; `backend/modules/training/controllers/trainingController.mjs:29`; `backend/modules/training/controllers/trainingController.mjs:382`; `backend/modules/training/services/trainingSessionTx.mjs:86`.

Concrete failure scenario: An owned adult submits discipline Swimming. Presence/length validation passes, no canonical check rejects it, and the controller calculates development, user XP, optional fallback stat and cooldown under that arbitrary key. The next seven-day action is spent on a discipline not in the game catalog.

Verification boundary: Actual dry controller returns success for Swimming; exact route validators and raw-string JSON/log write traced. No live row created.

Disposition: Validate against the approved catalog after intentional ID normalization and reject unknown strings before any award or cooldown claim.

### TRAIN-03 [P1] Object stat bonuses can raise a stat directly to one hundred

**Status 2026-10-28: Done.** trainingSessionTx.mjs commitTrainingSession no longer writes any horse stat: the stat roll and baseStatBoost were removed (df33de0af, Equoria-576c0.1; owner ruling in equoria-horses-have-points-not-xp.md). The LEAST(NULL,100) stat write described in the serialization note no longer exists. The only raw SQL left is the discipline-score jsonb increment, which uses the constant 5.

Evidence locations: `backend/modules/training/controllers/trainingController.mjs:390`; `backend/utils/traitEffects.mjs:127`; `backend/modules/training/services/trainingSessionTx.mjs:107`.

Concrete failure scenario: A horse with visible athletic wins a stat roll on a stat at forty-two. Adding its object-valued baseStatBoost produces NaN. The installed Prisma client serializes that raw parameter as null. The current PostgreSQL expression then evaluates LEAST(NULL,100) to100, so the derived write outcome is a jump straight to one hundred instead of a bounded one-to-three bonus. The nominal result remains NaN: JSON sends a null amount and the message can display +NaN.

Verification boundary: Actual extracted controller produces NaN;actual installed Prisma6.8.2 engine-intercept probe emits [null] without connecting. The resulting SQL outcome is inferred from the exact write and official PostgreSQL null semantics in S31, not a performed database update. Twenty-three affinity effects also contain object boosts.

Disposition: Resolve the approved per-stat boost by selected stat and validate a finite bounded integer before committing the session.

### TRAIN-04 [P2] Training Center forecasts fictional traits and a zero starting score

**Status 2026-10-28: Partly done, tracked in Equoria-t6rdk.** getTrainingStatus must return the horse's disciplineScores value for that discipline so TrainingSessionModal currentScore is real.

Evidence locations: `frontend/src/components/training/TrainingSessionModal.tsx:127`; `frontend/src/components/training/TrainingSessionModal.tsx:136`; `frontend/src/components/training/disciplineTraitGrouping.ts:60`; `backend/modules/training/controllers/trainingController.mjs:633`.

Concrete failure scenario: A no-trait horse with Dressage development twenty opens the Center modal. The preview adds Intelligent +4 for every mental-discipline horse and defaults current score to zero because status has no score field. It shows expected nine while an unmodified real session would finish at twenty-five. Temperament/trainer effects are also absent from that preview.

Verification boundary: Actual static group helper returns net nine without horse input; real status shape and actual dry baseline +5 confirmed. No browser purchase or mutation.

Disposition: Use authoritative current score and an approved preview based on the actual horse/modifier snapshot, or state unavailable data honestly.

### TRAIN-05 [P2] Actual rewards differ from the supplied flat development baseline

**Status 2026-10-28: Done.** trainingController trainHorse uses TRAINING_DISCIPLINE_GAIN = 5 and a flat trainingPlayerXp = 5, with no temperament, trait or trainer scaling and no secondary stat roll (df33de0af, 791298e33, Equoria-576c0.1).

Evidence locations: `backend/modules/training/controllers/trainingController.mjs:289`; `backend/modules/training/controllers/trainingController.mjs:321`; `backend/modules/training/controllers/trainingController.mjs:405`; `backend/modules/horses/services/temperamentService.mjs:30`.

Concrete failure scenario: A successful unstaffed Calm session gives six development and a Lazy session gives four. User XP also varies, and an additional fifteen-percent base roll can grant one-to-three random stat points. The supplied baseline says exactly five selected development and does not lock this random capability mapping.

Verification boundary: Actual extracted controller results: no modifiers5, Calm6, Lazy4, winning secondary roll3. This is a source discrepancy; code comments cite later approval that was not independently verified here. It is not the identical old guaranteed +1 prototype.

Disposition: Explicitly reconcile the current modifiers and secondary stat formula with the owner supplied flat baseline and dedicated capability mechanics decision.

### TRAIN-06 [P2] Returned next training time is earlier than actual eligibility

**Status 2026-10-28: Done.** trainHorse sets nextEligibleClaim = now + MS_PER_WEEK. Horse.trainingCooldown is the one cooldown source for the gate, status, roster and overview (3b634d6cf, Equoria-w0qb7), and no trait shortens the week anymore (0cb9ce9b2, Equoria-fjgzp).

Evidence locations: `backend/modules/training/controllers/trainingController.mjs:232`; `backend/modules/training/controllers/trainingController.mjs:240`; `backend/modules/training/controllers/trainingController.mjs:138`; `backend/modules/training/controllers/trainingController.mjs:630`.

Concrete failure scenario: A visible fastLearner session returns and stores a six-day nextEligible value. On day six the advisory latest-log rule still enforces seven elapsed days, and status/roster readers report seven. The player follows the successful resultâ€™s date but receives cooldown rejection.

Verification boundary: Actual extracted controller computes a six-day claim; actual status function for its timestamp computes seven days. No live time advance or DB action.

Disposition: Use one approved cooldown rule and timestamp across response, persistent claim, history readers, roster and UI.

### TRAIN-07 [P1] The execution write does not preserve the authorized owner

**Status 2026-10-28: Open, tracked in Equoria-kiwe5.** commitTrainingSession's cooldown claim must include userId = authenticated caller (actor passed through from the route).

Evidence locations: `backend/modules/training/routes/trainingRoutes.mjs:55`; `backend/modules/training/controllers/trainingController.mjs:422`; `backend/modules/training/services/trainingSessionTx.mjs:74`; `backend/modules/training/services/trainingSessionTx.mjs:98`.

Concrete failure scenario: The seller passes route authorization and the controller reads owner/modifiers. A sale commits before the claim. Training then updates the buyerâ€™s horse by ID, consumes its cooldown and can award the former owner XP. A transfer before the later horse read can instead give the new owner XP while the unauthorized former caller still triggers the action.

Verification boundary: Source-backed read-transfer-write scenarios; no live sale or DB race. Cooldown concurrency protection does not assert caller ownership.

Disposition: Carry the authenticated actor through the service and guard ownership and approved execution eligibility inside the same transaction as the claim and awards.

### TRAIN-08 [P2] Ready displays omit retirement injury and other eligibility reasons

**Status 2026-10-28: Partly done, tracked in Equoria-6m8zv.** TrainingHistoryPanel must use the status eligible/reason, not only nextEligibleDate === null.

Evidence locations: `backend/modules/training/controllers/trainingController.mjs:661`; `frontend/src/components/training/TrainingDashboard.tsx:49`; `frontend/src/lib/utils/training-utils.ts:254`; `frontend/src/components/training/TrainingHistoryPanel.tsx:63`.

Concrete failure scenario: An injured adult or a twenty-one-year-old with no log cooldown appears with discipline choices; the dashboard helper checks only minimum age/cooldown and can render Ready/Train while the command rejects. Status cards similarly render Ready to train whenever nextEligibleDate is null even when the server returned eligible false.

Verification boundary: Actual dry roster/eligibility helpers and client helper confirm the retirement/injury split; exact readiness branch inspected. No physical player session.

Disposition: Return and render authoritative eligibility with complete reasons, preserving separate expired cooldown and permitted action states.

### TRAIN-09 [P2] Eligibility reports success for a training blocking burnout trait

**Status 2026-10-28: Superseded by owner ruling.** Owner ruling equoria-no-burnout-health-is-only-consequence.md (Equoria-0d4wa): burnout does not exist. trainHorse no longer has a trait block, so canTrain and trainHorse apply the same gates (trainingRefusalReason, trainerRefusalReason, breed, cooldown).

Evidence locations: `backend/modules/training/controllers/trainingController.mjs:68`; `backend/modules/training/controllers/trainingController.mjs:207`; `backend/modules/training/routes/trainingRoutes.mjs:40`.

Concrete failure scenario: An adult with no cooldown and visible burnout receives eligible true from canTrain/check-eligibility. The training command then returns failure because statGainBlocked is checked only inside trainHorse. The same serverâ€™s preflight cannot accurately describe whether that action will work.

Verification boundary: Actual extracted canTrain returns true and trainHorse returns false for the same synthetic visible burnout horse. No real burnout trait assigned.

Disposition: Apply the shared approved blocking state rules to both preflight/status and authoritative execution, without introducing overtraining burnout.

### TRAIN-10 [P2] Stat result and trainer bonus ignore the database cap

**Status 2026-10-28: Done.** Training writes no stat (trainingSessionTx commitTrainingSession), and the trainer session XP award was removed (Equoria-dea06; staff never gain XP per equoria-staff-are-fixed-npcs-no-xp.md). Stats are also uncapped by ruling (ec65bd880).

Evidence locations: `backend/modules/training/controllers/trainingController.mjs:397`; `backend/modules/training/services/trainingSessionTx.mjs:107`; `backend/modules/training/controllers/trainingController.mjs:486`.

Concrete failure scenario: A selected stat is already one hundred and the random roll requests +3. The SQL preserves one hundred, but statGain and success message still advertise +3 and statGainOccurred qualifies for the trainerâ€™s extra ten XP. A stat at ninety-nine applies only +1 while reporting +3.

Verification boundary: Actual nominal roll3 plus exact database cap and post-session award flag; no capped stat row mutated.

Disposition: Compute and persist/report the actual applied delta and use real movement for any dependent staff reward.

### TRAIN-11 [P2] Selected discipline development does not affect current show scoring

**Status 2026-10-28: Done.** competitionScoring.mjs adds disciplineTrainingPoints(horse.disciplineScores, discipline) (rules/disciplineRules.mjs), and showOrdering selects disciplineScores (b13292550, Equoria-k1p62.5).

Evidence locations: `backend/modules/competition/shows/showController.mjs:453`; `backend/modules/competition/services/competitionScoring.mjs:101`; `backend/modules/training/services/trainingSessionTx.mjs:93`.

Concrete failure scenario: A horse trains Dressage repeatedly without a secondary stat award and raises that development from zero to one hundred. Current nightly show scoring reads neither disciplineScores nor training history; with unchanged stats/rider/luck its Dressage result remains identical. The intended capability/suitability link is incomplete.

Verification boundary: Actual scorer fixed-luck probe gives50 for development0 and100; executor projection omits the field. Detailed future capability mapping remains OPEN; no formula invented.

Disposition: Define and connect the approved development-to-capability/affinity relationship in the actual reached scorer, or communicate the current effect boundary explicitly.

### TRAIN-12 [P2] Session history cannot reconstruct actual development and stat rewards

**Status 2026-10-28: Done.** TrainingLog now stores scoreBefore/scoreAfter from the in-transaction RETURNING (b0cf1ff79, 94c77ae67, Equoria-ky2ob). Training has no stat outcome or trainer contribution any more, and XP is a flat 5. The fee transaction metadata records trainerId, horseId and discipline.

Evidence locations: `packages/database/prisma/schema.prisma:966`; `backend/modules/training/services/trainingSessionTx.mjs:86`; `backend/modules/training/services/trainingAnalyticsService.mjs:22`.

Concrete failure scenario: Two sessions have different temperament/trainer/trait gains, and one also wins a stat. Both logs contain only horse, discipline and timestamp. Later reads cannot recover the real deltas, prior/next score, stat outcome, trainer contribution or cooldown. XpEvent has a textual reason but no session link. Existing HP-15 covers the distinct client fabrication from those sparse rows.

Verification boundary: Exact current schema, transactional insert and raw history response; no production history census or migration test.

Disposition: Persist approved per-session before/after and applied outcomes with stable XP/trainer provenance as part of the existing atomic transaction.

### TRAIN-13 [P2] Training XP does not refresh the cached player profile

**Status 2026-10-28: Done.** useTrainingSession onSuccess in frontend/src/hooks/api/useTraining.ts invalidates ['profile'] (the useAuth profile key) along with the horse and training keys (b08957927, Equoria-3kegj).

Evidence locations: `frontend/src/hooks/api/useTraining.ts:112`; `frontend/src/hooks/useAuth.ts:86`; `backend/modules/users/services/userModelService.mjs:297`; `frontend/src/hooks/api/useEventStream.ts:50`.

Concrete failure scenario: The player has a fresh cached profile and completes training that awards XP or reaches a new level. The mutation refreshes horses/training but not the profile; the core writer sends no progress notification and training emits no corresponding SSE event. A profile consumer can keep the previous XP/level until its next refresh despite the real award.

Verification boundary: Current query invalidation keys, five-minute profile freshness and event producer path inspected; no measured live cache delay. ACC-03 is the separate XP display curve concern.

Disposition: Invalidate the relevant player progress/profile keys or emit a supported committed progress event after the award.

### TRAIN-14 [P2] Concurrent assignment can leave two active trainers on one horse

**Status 2026-10-28: Done.** trainerController assignTrainer now locks the owned horse row (SELECT ... FOR UPDATE with userId) before deactivating and creating, so two assigns to one horse are serialized (1d2dcb3d8, Equoria-j8s5c).

Evidence locations: `backend/modules/trainers/controllers/trainerController.mjs:160`; `backend/modules/trainers/controllers/trainerController.mjs:170`; `packages/database/prisma/migrations/20260907120000_kccmt_partial_unique_active_staff_assignments/migration.sql:77`; `backend/modules/training/controllers/trainingController.mjs:250`.

Concrete failure scenario: A horse starts without a trainer. Two concurrent requests assign different available trainers. Each locks only its own trainer, each can deactivate zero old assignments before either insert commits, and both pair-unique rows are permitted. Training then uses findFirst without an ordering or resolution rule and can select either active trainerâ€™s modifiers/XP recipient.

Verification boundary: Source-backed empty-state interleaving and exact pair-scoped partial index. The existing race test covers one trainer assigned to different horses, not this opposite case. No real DB race run.

Disposition: Serialize or guard the approved one-active-trainer-per-horse invariant alongside the existing per-trainer protection, and enforce deterministic execution lookup.

### Serialization qualification for TRAIN-03

The final finding does not presume a rejected Prisma Int field. The current path uses raw SQL. An actual installed Prisma 6.8.2 client probe, with the engine request intercepted before any connection, serialized a NaN raw parameter as `[null]`. PostgreSQL LEAST ignores null arguments, so the exact current cap expression yields 100 for a selected stat below its cap. This database write outcome is an explicit inference from observed serialization and source SQL, not a performed mutation. The nominal returned amount remains NaN and JSON becomes null. The intercepted return row was deliberately synthetic zero and never used as SQL outcome evidence.

Primary semantics reference: [PostgreSQL Conditional Expressions section 9.18.4](https://www.postgresql.org/docs/current/functions-conditional.html#FUNCTIONS-GREATEST-LEAST). Local installed package version and source transaction references are recorded in DOCX S18/S12; no deployed version census.

### Additional implementation boundaries

**Status 2026-10-28: Done.** Trainer session XP is removed (Equoria-dea06, riderTrainerProgressionService). trainerMarketplace SPECIALTIES = DISCIPLINE_VALUES ('Cross Country'). The trainable roster level uses getHorseXpLevel(horse.horseXp) (245ef7b18, Equoria-fdwly).

Trainer session XP is a post-commit fail-soft award, not part of the primary horse/user transaction. It reads old experience and writes an absolute new value without a staff event linked to TrainingLog. Marketplace Cross-Country specialty spelling misses exact Cross Country matching. Roster level reads an integer horseXp as an object and falls back to one. These are described with S11/S16/S22/S23 references in the document; no live staff race or payout was exercised.

### Verification and limitations

- Existing frontend: 36 files / 818 tests PASS, exit 0, 40.79 seconds. Exact file manifest in DOCX. Includes reusable unmounted components and synthetic response contracts; not live integration proof.
- Existing backend pure: 4 suites / 108 tests PASS, exit 0, 0.791 seconds. statMap, traitEffects, epigeneticFlagInfluence and horseAge. Temporary config removed shared DB setup/teardown/afterenv cleanup; dummy localhost port 1 URLs. Force-exit/open-handle guidance emitted.
- Actual deterministic controller/pure helper probes PASS with synthetic read/commit seams. Verified base/modifier/RNG outputs, arbitrary discipline, profile slug/Gaited bypass, object bonus NaN, reduced-date mismatch, burnout false preflight, pregnancy allowed, retirement/injury readiness and normal score invariance. Added real installed-client serialization interception; no SQL or network connection.
- TypeScript PASS exit 0; doctrine PASS all 47 checks exit 0.
- No database integration/global cleanup, live horse/wallet/XP/trainer mutation, production row/deployment/override census, beta E2E, scheduler execution, concurrency/crash experiment, full lint/performance/device/accessibility assessment.
- DOCX structural/package QA PASS: original SHA256 9a8bf1a6d98a77b0887409800664838d9a13aa23433fb1ac5ec7a22cdc8e5c54 retained. Only document.xml and footer1.xml changed; exact section/styles/theme/numbering/relationships and all other parts retained; XML/ZIP/reopen, source hashes/lines, complete catalogs/models/coverage, repeated headers and expanding unsplit rows checked.
- Reference/final packaged render attempts diagnosed missing LibreOffice soffice.exe. Visual layout, pagination and page count remain unverified.

AUDIT: CONCERNS

# Volume 12 Riders Staff and Professional Services implementation audit

**Date:** 2026-10-14. Inspection and selected checks began 2026-10-13 at HEAD 673d07c0da9a881223d92b897bed5a4b663951aa. Final source snapshot HEAD 9a26ff8dbc187662deb0cf19b64b0a90f591e8c7. The intervening commit changes only an unrelated genetics test router wrapper; no audited staff implementation changed. Existing local changes preserved.

**Requested deliverable:** EquoriaBible/Findings/12_Riders_Staff_Professional_Services_DEEP.docx. Separate implementation audit; original design preserved. Current code is evidence, not canon approval. Embedded reference instructions were not executed as requests to implement features.

**Coverage:** 10816 words; 60 supplied requirements; 87 mounted staff-related API declarations; 17 schema models; 28 source groups / 114 source files; 15 talent definitions; 9 legacy perks; 8 workshop recipes. See DOCX for actual flows, configuration, persistence, cross-volume overlaps and exact test manifests. No game or repository test edits by this audit.

### STAFF-01 [P1] Normal competition entry does not require an eligible rider

**Status 2026-10-28: Partly done, tracked in Equoria-y2ksc.** riderController assignRider (assertHorseTakesNewStaffTx path) must refuse horses under 3 with a coded refusal.

- **Source:** backend/modules/competition/shows/showController.mjs:316; backend/modules/competition/services/competitionScoring.mjs:119; backend/modules/riders/controllers/riderController.mjs:160
- **Concrete failure:** An owned healthy adult enters an ordinary show with no rider; entry checks age, health and bracket but does not read or require a rider, and settlement scores missing rider as zero bonus and zero penalty. Separately, an owned foal can receive a rider assignment because the assignment lookup selects only id and applies no age-three rule. The dashboard says rider assignment is required.
- **Evidence boundary:** Mounted normal entry, deferred route and actual scorer traced; pure missing-rider modifier is 0/0. No live show entered.
- **Disposition:** Enforce the approved rider and age contract at the authoritative assignment and entry boundaries, and define the policy for rider retirement or reassignment before scoring.

### STAFF-02 [P2] Rider capacity and recurring fees differ from the reference

**Status 2026-10-28: Partly done, tracked in Equoria-r2wix.** Once ruled, riderController's 'Rider is already assigned to a horse' check follows the ruled capacity.

- **Source:** backend/modules/riders/controllers/riderController.mjs:170; backend/modules/riders/controllers/riderMarketplaceController.mjs:243; backend/modules/grooms/services/groomSalaryService.mjs:218
- **Concrete failure:** After assigning a rider to one horse, assigning the same rider to a second is rejected until unassigned. Hiring debits one weeklyRate once; the mounted weekly collector bills grooms only. No recurring rider fee collection or per-assigned-horse rate was found. Thus the recovered twenty-horse rider capacity and weekly assignment-based fees are not current gameplay.
- **Evidence boundary:** Source contract and repository search of rate/salary consumers; negative claim is scoped to inspected current code, not deployed data.
- **Disposition:** Reconcile capacity and salary behavior with the owner decision; document any approved superseding rule separately before changing economy.

### STAFF-03 [P2] Rider hiring interface quotes four weeks while the server charges one

**Status 2026-10-28: Done.** RiderList.tsx calculateHiringCost = weeklyRate, and both canAfford and the confirmation use it (7b8e63556, Equoria-yw6w1), per ruling equoria-rider-hire-one-week-at-a-time.md.

- **Source:** backend/modules/riders/controllers/riderMarketplaceController.mjs:243; frontend/src/components/RiderList.tsx:426; frontend/src/components/RiderList.tsx:123
- **Concrete failure:** A rookie costs 150 on the server while the marketplace calculates and presents 600 as four weeks upfront. A player with 200 can afford the real hire but is disabled by the client affordability check; a successful hire charges less than the confirmation promises.
- **Evidence boundary:** Actual caller cost helper and server arithmetic inspected; no wallet mutation.
- **Disposition:** Use the actual server hire quote consistently for button availability, confirmation and balance update.

### STAFF-04 [P2] Staff slot counters do not use stable level caps

**Status 2026-10-28: Open, tracked in Equoria-asmsy.** MyRidersDashboard/MyTrainersDashboard must take the cap from the server's stable-level hire caps.

- **Source:** frontend/src/components/MyRidersDashboard.tsx:62; frontend/src/components/MyTrainersDashboard.tsx:63; frontend/src/pages/RidersPage.tsx:74; frontend/src/pages/TrainersPage.tsx:64
- **Concrete failure:** A stable-level-one player sees five rider slots and four trainer slots, but the server permits two riders and one trainer. Pages do not pass the resolved stable-level cap. At stable level five, the defaults understate actual caps of six and five.
- **Evidence boundary:** Reached props and backend maps compared. Current hire guards correctly enforce the server cap.
- **Disposition:** Render server-provided or shared stable-level caps so the displayed remaining slots agree with hiring.

### STAFF-05 [P1] Automatic rider retirement can strand active assignments

**Status 2026-10-28: Done.** modules/riders/services/riderRetirementService retireRidersAtTheirAge locks the horses, ends the assignments and flips retired in one $transaction (Equoria-or2ua, Equoria-r9u5k). The Horse.rider JSON column was dropped (Equoria-97se), and scoring reads only isActive assignments (showOrdering).

- **Source:** backend/modules/trainers/services/riderTrainerRetirementService.mjs:62; backend/modules/trainers/services/riderTrainerRetirementService.mjs:68; backend/utils/riderBonus.mjs:155
- **Concrete failure:** The weekly retirement pass writes retired=true before independently ending assignments. If assignment update throws, the rider remains retired with an active assignment; retry skips it because the query selects retired=false. The pass also never clears Horse.rider JSON. A high-level retired rider on the stranded assignment still receives up to ten percent bonus while its penalty is eight percent, permitting a positive net score effect.
- **Evidence boundary:** Actual extracted retirement function with injected assignment-write failure leaves retired=true, active=true; retry retires zero. Pure modifier probe yields 10% bonus and 8% penalty. Synthetic seams only; no crash or SQL experiment.
- **Disposition:** Commit retirement, assignment termination and derived horse rider removal atomically, with current state guards; prevent retired staff from scoring as an active benefit.

### STAFF-06 [P2] Rider interface forecasts retirement after the actual retirement date

**Status 2026-10-28: Superseded by owner ruling.** Owner ruling equoria-riders-hidden-random-retirement.md: retirement is at a hidden random age with one week's notice. Implemented in 5c22a119f (Equoria-or2ua): the retirement timing was removed from every screen, and noticeRidersRetiringNextWeek sends the notice.

- **Source:** backend/modules/trainers/services/riderTrainerRetirementService.mjs:36; frontend/src/types/riderCareer.ts:70; frontend/src/types/riderCareer.ts:71
- **Concrete failure:** At career week 79 the rider UI reports 25 weeks remaining and no approaching-retirement warning, but the next weekly pass retires the rider at 80. The supplied design instead describes 8–16 real weeks and a one-to-two-week notice. The current backend neither sends rider notice nor implements the UI legacy extension.
- **Evidence boundary:** Actual backend threshold, reached helper and reference compared; scheduler not executed.
- **Disposition:** Choose the approved lifecycle, share its forecast contract with UI, and persist any intended warning and retirement history.

### STAFF-07 [P2] Rider discovery fabricates categories from one public specialty

**Status 2026-10-28: Open, tracked in Equoria-xlw03.** Build stored hidden rider affinities and serve only revealed ones (Equoria-xlw03).

- **Source:** backend/modules/riders/controllers/riderController.mjs:314; backend/modules/riders/controllers/riderController.mjs:324; backend/utils/discoverySlotReveal.mjs:46
- **Concrete failure:** A level-ten Dressage rider returns six discovered traits, all labelled Dressage Affinity, including temperament and gait categories. There are no stored independent rider strengths, weaknesses, gait affinities or per-trait reveal dates. Reveals depend on level thresholds 2,4,6,8,9,10 instead of 5,10,15 competition exposures.
- **Evidence boundary:** Actual extracted discovery handler with a synthetic rider returns six identical labels; schema and scorer inspected. No live rider read.
- **Disposition:** Represent approved hidden traits and their actual discovery events explicitly; keep labels, category values and scoring effects consistent.

### STAFF-08 [P2] Reached rider discovery panel always receives an empty profile

**Status 2026-10-28: Open, tracked in Equoria-xlw03.** MyRidersDashboard must render the real discovery data once Equoria-xlw03 stores affinities.

- **Source:** frontend/src/components/MyRidersDashboard.tsx:419; frontend/src/hooks/api/useRiders.ts:65
- **Concrete failure:** Open Discovery on a level-ten rider with server-reported discoveries. The reached dashboard constructs an empty profile rather than calling its available discovery hook, so the player sees no revealed traits. The panel exists and component tests can pass on supplied data without proving the dashboard uses it.
- **Evidence boundary:** Reached component and hook traced; no browser session or real rider mutation.
- **Disposition:** Connect the mounted panel to the authoritative disclosure query with loading, error and empty states.

### STAFF-09 [P1] Concurrent assignment can give one rider two horses

**Status 2026-10-28: Done.** riderController assignRider takes a guarded rider-row write (where {id, retired:false}) before the 'already assigned' read, inside the transaction that locks the horse (1d2dcb3d8 Equoria-j8s5c, Equoria-r9u5k).

- **Source:** backend/modules/riders/controllers/riderController.mjs:167; backend/modules/riders/controllers/riderController.mjs:180; packages/database/prisma/migrations/20260907120000_kccmt_partial_unique_active_staff_assignments/migration.sql:71
- **Concrete failure:** Two concurrent requests assign the same currently free rider to different owned horses. Both can read no active assignment, update different Horse rows and insert different rider/horse pairs. No rider-row write serializes them and the partial unique index covers the pair only. The final state violates the command one-horse rule even though each transaction is individually atomic.
- **Evidence boundary:** Source interleaving and exact database constraint; no live concurrent transactions were run. Different-rider same-horse writes serialize on the horse, a separate case.
- **Disposition:** Serialize assignment and retirement on the authoritative rider state, and enforce the approved capacity invariant at the write boundary.

### STAFF-10 [P2] Trainer roster response reveals stored hidden discovery content

**Status 2026-10-28: Open, tracked in Equoria-pzoxz.** trainerController getUserTrainers must select explicit fields or strip discoverySlots before responding.

- **Source:** backend/modules/trainers/controllers/trainerController.mjs:38; backend/modules/trainers/controllers/trainerController.mjs:50; backend/modules/trainers/controllers/trainerController.mjs:243
- **Concrete failure:** After opening a low-level trainer Discovery panel once, six content descriptors are persisted. The discovery endpoint redacts unrevealed slots, but the regular owner roster query selects the full Trainer row and spreads discoverySlots into its JSON. Network inspection can read all six hidden labels before level unlocks. No access to another player is alleged.
- **Evidence boundary:** Schema field and actual roster projection compared with redacted endpoint. Response inference from Prisma model projection; no production network capture.
- **Disposition:** Project public trainer roster fields explicitly and keep unrevealed slot content solely in the server disclosure path.

### STAFF-11 [P2] Most generated groom personalities cannot use talents or legacy perks

**Status 2026-10-28: Open, tracked in Equoria-y28dh.** Once the owner defines the personality list, key groomMarketplace PERSONALITIES, TALENT_TREES and LEGACY_PERKS to one set.

- **Source:** backend/modules/grooms/services/groomTalentService.mjs:210; backend/modules/grooms/services/groomLegacyService.mjs:275; backend/modules/grooms/services/groomMarketplace.mjs:66
- **Concrete failure:** A level-three gentle, patient or strict groom has no matching talent tree, so selection returns invalid_personality_tier. A retired level-seven groom of those personalities has no legacy perks; automatic legacy skips and manual creation selects undefined then reads selectedPerk.id. Only energetic overlaps with calm/energetic/methodical definitions.
- **Evidence boundary:** Actual exported catalogs show three of four generated personalities have no tree and zero legacy perks; validation and manual/automatic branches traced.
- **Disposition:** Reconcile personality domains across generation, UI, talent validation and inheritance; reject empty perk pools honestly.

### STAFF-12 [P2] Selected groom talents are stored without effects in live care

**Status 2026-10-28: Open, tracked in Equoria-cp60n.** After the owner defines bonuses, wire them into groomCareService (or retire talents); stress-based talents are moot.

- **Source:** backend/modules/grooms/services/groomTalentService.mjs:303; backend/modules/grooms/controllers/groomInteractionController.mjs:252; backend/modules/grooms/controllers/enhancedGroomController.mjs:275
- **Concrete failure:** A groom selects a bonding or stress talent through the mounted detail panel and server upsert. Neither reached care controller invokes applyTalentEffects; repository search finds only its definition/export outside tests. The advertised talent bonuses therefore do not affect the actual interaction. Many other effect keys are only descriptors even within the helper.
- **Evidence boundary:** Production caller search and two mounted care calculations inspected; unit tests of the helper do not prove wiring.
- **Disposition:** Apply the approved earned effects through the authoritative care transaction or accurately describe which talents are informational.

### STAFF-13 [P2] Groom relationship strength transfers through global horse bond

**Status 2026-10-28: Superseded by owner ruling.** Owner rulings make bond a horse property: it starts at 0 and gains +5 per daily 'groom horse' (equoria-trait-reveal-by-grooming-days.md), and it shows on every horse page (equoria-no-stress-ever.md). groomCareService writes Horse.bondScore.

- **Source:** backend/modules/grooms/controllers/groomInteractionController.mjs:252; backend/modules/grooms/controllers/enhancedGroomController.mjs:86; backend/modules/grooms/controllers/groomRosterController.mjs:528
- **Concrete failure:** A horse gains bond with groom A, then is viewed or groomed by groom B. Relationship tiers and compatibility consume Horse.bondScore, so B inherits that strength. GroomHorseSynergy is genuinely keyed by groom/horse, but it is a separate session score; GroomAssignment.bondScore is not updated by the live care command. This does not fulfill the reference nontransferable pair bond.
- **Evidence boundary:** Actual fields and consumers traced. No live reassignment performed; distinct global and pair records documented.
- **Disposition:** Define which bond is global and which belongs to the pair; use the approved pair measure consistently in relationships and handling.

### STAFF-14 [P1] Enhanced care can persist an interaction without horse effects

**Status 2026-10-28: Done.** POST /api/grooms/enhanced/interact now answers 410 (retiredGroomDoor in enhancedGroomRoutes.mjs; d315f2085, Equoria-l7xag). The one 'groom horse' path, groomCareService, locks the horse row and writes inside a single $transaction.

- **Source:** backend/modules/grooms/controllers/enhancedGroomController.mjs:278; backend/modules/grooms/controllers/enhancedGroomController.mjs:314; backend/modules/grooms/routes/enhancedGroomRoutes.mjs:63
- **Concrete failure:** The enhanced endpoint inserts GroomInteraction, then independently writes horse bond/stress and separately updates synergy. If the horse write fails, the interaction remains and the daily precheck blocks retry even though the horse gained no care. The path also omits the main command lastGroomed/streak/FoalActivity writes. Both paths share an advisory daily read with no atomic day claim, as already recorded in CARE-06.
- **Evidence boundary:** Mounted route and complete controller write sequence inspected. No failure injected into a real database. The main care transaction is a separate, stronger path.
- **Disposition:** Use one transactional care implementation and an authoritative daily claim, keeping the canonical horse state and all events consistent.

### STAFF-15 [P1] Groom assignment reuses stale ownership after transaction begins

**Status 2026-10-28: Open, tracked in Equoria-9e5ff.** groomAssignmentService createAssignment must recheck horse.userId and groom owner inside the transaction.

- **Source:** backend/modules/grooms/services/groomAssignmentService.mjs:162; backend/modules/grooms/services/groomAssignmentService.mjs:186; backend/modules/grooms/services/groomAssignmentService.mjs:206
- **Concrete failure:** A seller starts the priority assignment endpoint and passes horse ownership. A buyer completes the sale before the seller assignment transaction creates its row. The transaction rechecks groom capacity but never current horse ownership or current groom engagement. A new seller staff assignment can be inserted on the buyer horse after transfer cleanup. This is a stale authorization failure, not the already-fixed per-groom capacity race.
- **Evidence boundary:** Preflight and exact transaction predicates plus sale reconciliation traced. No live transfer/concurrency experiment.
- **Disposition:** Prove current horse ownership and staff engagement within the authoritative write, using the project lock order and conditional predicates.

### STAFF-16 [P2] Staff experience awards can be lost after successful gameplay

**Status 2026-10-28: Superseded by owner ruling.** Ruling equoria-staff-are-fixed-npcs-no-xp.md: staff never earn XP. The awards were removed from riderTrainerProgressionService (Equoria-dea06). Rider totalCompetitions/totalWins are incremented inside the payout transaction (showExecutionService).

- **Source:** backend/modules/trainers/services/riderTrainerProgressionService.mjs:96; backend/modules/trainers/services/riderTrainerProgressionService.mjs:105; backend/modules/competition/shows/showController.mjs:666
- **Concrete failure:** Two valid results for the same rider can read the same experience and later write absolute totals, losing one award. A completed payout can also outlive a failed staff XP update because award errors are logged and return null after the core transaction commits. Trainer awards use the same helper. Competition/win counters themselves are incremented in the payout transaction.
- **Evidence boundary:** Source interleaving and post-commit boundary. No parallel database award or recovery replay experiment.
- **Disposition:** Persist staff award identity and increment experience atomically with the approved gameplay transaction or a durable idempotent follow-up.

### STAFF-17 [P2] Legacy creation can bypass groom roster and one legacy per mentor checks

**Status 2026-10-28: Open, tracked in Equoria-bhoka.** Remove POST /:id/legacy/create (groomLegacyRoutes) per Equoria-bhoka.

- **Source:** backend/modules/grooms/services/groomLegacyService.mjs:180; backend/modules/grooms/services/groomLegacyService.mjs:211; packages/database/prisma/schema.prisma:1549
- **Concrete failure:** A player with ten active grooms and an eligible retired energetic mentor can create a new protege through the mounted legacy route without a roster count or cap guard, exceeding the normal hiring cap. Two concurrent requests can also both pass the existing-legacy precheck and create different logs because retiredGroomId is indexed, not unique. Each create is transactional but those rules are outside its guards.
- **Evidence boundary:** Actual route/service and model constraints inspected; no live legacy creation. A personality with no perk pool fails earlier under STAFF-11.
- **Disposition:** Guard cap and single mentor legacy in the same transaction and enforce uniqueness for the approved relationship.

### Verification and limitations

- Existing frontend: 21 files / 472 tests PASS, exit 0, 23.35 seconds. Component and synthetic API contracts include unmounted panels; not live integration proof.
- Existing backend: 7 pure suites / 214 tests PASS, exit 0, 3.116 seconds. Temporary config removed shared database setup/teardown and after-environment fixtures; dummy localhost port-one URLs. Force-exit/open-handle guidance emitted.
- Actual function probes with synthetic seams PASS: rider modifier independence from specialty, retired 10% bonus / 8% penalty, missing rider 0/0, wage count arithmetic, reveal levels, level thresholds, personality mismatch, deterministic trainer fallback. Extracted rider discovery returns six identical labels. Injected retirement assignment failure leaves retired=true/active=true and retry skips. No live database, wallet, horse, staff or scheduler mutation.
- TypeScript PASS; all 47 doctrine gates PASS. No beta E2E, full lint, production census, deployment/migration verification, live race/transfer/crash, scheduled wage/retirement execution, performance/device or comprehensive accessibility run.
- DOCX ZIP/XML/reopen, exact section/style/package preservation, original SHA256, source hashes/line anchors, requirement/model/catalog coverage, repeating headers and expanding unsplit rows PASS. Original hash 54133d9dbd526492ae7ff58aea2d04b52163c9c0e0ca2755d476b6790d23eba7. Only word/document.xml and footer1.xml changed from template.
- Reference and final render attempts diagnosed unavailable packaged LibreOffice soffice.exe. Current documents bundle 26.1011.11113 fails the same resolver. Visual layout, pagination and page count remain unverified.

AUDIT: CONCERNS

# Volume 13 Competitions Shows and Event Scoring implementation audit

**Date:** 2026-10-14. Initial inspection HEAD 9a26ff8dbc187662deb0cf19b64b0a90f591e8c7. Final source snapshot HEAD 14a95e47d8a48d841efd4329b14aa670a45728d4. The intervening commit comparison changes only frontend/public/privacy.html; no audited competition implementation changed. Existing local changes preserved.

**Requested deliverable:** EquoriaBible/Findings/13_Competitions_Shows_Event_Scoring_DEEP.docx. Separate implementation audit; original design preserved. Embedded document instructions were treated as design reference, not requests to change the game or finalize OPEN policy.

**Coverage:** 14895 words; 114 supplied requirements; 27 findings; 47 mounted related API declarations; 9 full schema models plus relevant Horse fields; 28 evidence groups / 104 source files; exact 23-discipline canonical comparison; conformation rewards/classes/synergy; required-but-absent Prestige factor/credential tables. No game or repository test edits by this audit.

### COMP-01 [P1] Ordinary shows ignore discipline weights and most preparation inputs

**Status 2026-10-28: Done.** backend/modules/competition/services/competitionScoring.mjs scoreShowEntries now uses weightedDisciplineBase (50/30/20) + disciplineTrainingPoints + tackPoints, times summed luck/rider/temperament/health percents, and records a breakdown (scoreInputs, Equoria-4q02c); traits add nothing per ruling equoria-tack-scoring-bonuses (commits a048a07c1, b13292550, 6c7d2bc16; epic Equoria-k1p62 still open for conformation/parade).

- **Source:** backend/modules/competition/services/competitionScoring.mjs:110; backend/modules/competition/shows/showController.mjs:453; backend/modules/competition/shows/showController.mjs:496
- **Concrete failure:** A horse excellent in focus/obedience and poor in speed/stamina receives the same base for Dressage and Racing. The live scorer always averages speed, stamina, agility, precision, boldness and does not consume discipline development, matching traits, tack, feed adjustments, health or general temperament. The input selection omits those fields. This defeats the supplied 50/30/20 discipline map and preparation strategy; advanced helper tests do not establish live wiring.
- **Evidence boundary:** Actual pure score probe gives 20 for all 24 helper discipline names and remains 20 after changing training, health, temperament, traits, tack and flags with no rider. Canonical creation has 23 names. No live show mutation.
- **Disposition:** Reconcile the authoritative scorer with approved discipline/preparation inputs and record the applied components/version; keep OPEN conversions explicitly undecided.

### COMP-02 [P2] Live luck is an additive nine points rather than a bounded percentage

**Status 2026-10-28: Done.** competitionScoring.mjs rollLuckPercent gives +1..+10 whole percent applied once via applyPercentTerms (ruling C1 in equoria-competition-bible-is-sole-authority); luckPercent stored in the scoreInputs breakdown.

- **Source:** backend/modules/competition/services/competitionScoring.mjs:111; backend/modules/competition/services/competitionScoring.mjs:112
- **Concrete failure:** At base 10 the live scorer produces 1 to 19 for RNG boundaries 0 and 1: a90% relative change. At base 100 the same range is 91 to 109. The comment calls it±9%, but the implementation adds nine score points, so low-stat fields are dominated more heavily than the design percentage range.
- **Evidence boundary:** Actual pure scorer boundary probes 1/10/19. RNG 1 is a mathematical endpoint seam; normal Math.random is below 1.
- **Disposition:** Apply the approved percentage or explicitly approved additive model consistently; expose the actual range in result evidence.

### COMP-03 [P1] Current horse XP and universal level conflict with Horse Points rules

**Status 2026-10-28: Partly done, tracked in Equoria-vtgeh.** Remove the level field from trainingModelService and its UI ('Level N'), and retire getHorseXpLevel if no other caller remains (Equoria-vtgeh).

- **Source:** backend/modules/competition/services/competitionAwards.mjs:43; backend/modules/competition/services/competitionAwards.mjs:51; backend/modules/horses/services/horseXpModelService.mjs:25; backend/utils/horseCompetitionLevel.mjs:36
- **Concrete failure:** An ordinary win awards 30 generic horse XP rather than 10 Horse Points; participation 20 rather than 1. Crossing 100 XP yields an allocation and a universal bracket level, instead of an allocation per 1, 000 Points and competition-type classification. A synthetic 95→125 award grants one allocation. Seasonal doubling and typed classification are absent; conformation does not award this XP at all.
- **Evidence boundary:** Actual exported award table and atomic XP core with synthetic writes; schema/entry level helper traced. No Horse Points balance created.
- **Disposition:** Keep Horse Points, player XP, money, Prestige and Legacy distinct; migrate only under an explicit policy and leave OPEN classification bands undefined.

### COMP-04 [P2] Canonical Horse Prestige and credential ledger are not implemented

**Status 2026-10-28: Open, tracked in Equoria-jyf8c.** Needs the owner's prestige formula before any build; then record prestige at show settlement.

- **Source:** backend/modules/competition/shows/showController.mjs:158; backend/modules/competition/services/conformationShowService.mjs:420; packages/database/prisma/schema.prisma:920
- **Concrete failure:** A valid forty-horse five-owner Level 1 regular win resolves money/XP but cannot award the locked 17 Prestige because there is no Horse Prestige total, per-discipline total, event-class weighting or PrestigeEvent record. Conformation titlePoints and Rider.prestige are separate systems and cannot satisfy the locked Horse ledger or résumé gates.
- **Evidence boundary:** Production Prestige/event-class search, schema and both settlement writers. Requirement discrepancy, not a performed production event.
- **Disposition:** Preserve the specified formula, validity, seven classes and durable credential sources; do not invent OPEN rank thresholds/title bonuses.

### COMP-05 [P1] Ordinary entry lacks an upper age limit and rider requirement

**Status 2026-10-28: Done.** utils/competitionEntryRules.mjs evaluateEntryRules refuses AGE_TOO_OLD (>20), missing/retired/not-employed rider and Bad health; run in-transaction by services/entryEligibility.mjs checkEntryEligibility from showEscrowTx (Equoria-576c0 B9, c811ffc6b); test entryEligibility.integration.test.mjs.

- **Source:** backend/modules/competition/shows/showController.mjs:316; backend/modules/competition/shows/showController.mjs:322; backend/modules/competition/routes/competitionRoutes.mjs:430
- **Concrete failure:** An owned age 40 horse with Good raw health and no rider is accepted by the current command. There is no maximum 20 age, retirement or eligible-rider guard, and only raw injured status is blocked. Critical display health from care can still pass, as CARE-02 already records.
- **Evidence boundary:** Actual extracted enterShow with synthetic lookup/commit seam returns 201 for age 40/riderless. The synthetic retired property was ignored; Horse has no persisted retirement Boolean. STAFF-01 overlaps the rider guard. No real entry/fee.
- **Disposition:** Enforce approved actor, horse and rider rules at the write boundary; distinguish ordinary age rules from OPEN conformation age policy.

### COMP-06 [P2] The three active competition types rule has no authoritative state

**Status 2026-10-28: Done.** competitionEntryRules.mjs loadActiveDisciplineTypes + DISCIPLINE_TYPE_LIMIT refusal, serialized under the User row lock in checkEntryEligibility; test disciplineTypeLimit.integration.test.mjs.

- **Source:** backend/modules/competition/shows/showEscrowTx.mjs:124; backend/modules/competition/services/competitionRouteQueries.mjs:188; packages/database/prisma/schema.prisma:1947
- **Concrete failure:** A horse can enter four different ordinary disciplines because neither entry transaction counts active types or stores a campaign classification. There is correctly no global three-show cap, but unlimited entry currently also lacks the source three-type restriction.
- **Evidence boundary:** Both mounted entry transactions/schema; no live four-discipline campaign created. Code-only absence in audited scope.
- **Disposition:** Implement the approved active-type policy without introducing a per-horse show-count cap; define how a type becomes active/inactive.

### COMP-07 [P2] Hosting has no weekly ten or one hundred show cap

**Status 2026-10-28: Done.** rules/showHostingLimits.mjs weeklyShowCreationLimit (10 per Eastern game week, one lookup for premium tiers) enforced atomically (141d352b8, Equoria-whfj4; test showWeeklyCreationLimit.integration.test.mjs); Arena hosting UI added in 5675485dc (Equoria-oey96.13); prize = 10x fee (ce24ae739) per ruling equoria-horse-levels-to-20-and-show-hosting.

- **Source:** backend/modules/competition/shows/showController.mjs:87; backend/modules/competition/shows/showController.mjs:94; backend/modules/competition/shows/showController.mjs:170
- **Concrete failure:** A basic authenticated user can create eleven zero-fee, zero-prize shows in one request sequence. No weekly count or premium entitlement is queried. Hosting is API only; a player-facing create/host form was not found. The 10/100 policy still needs fairness review in the reference, but neither allowance is enforced.
- **Evidence boundary:** Actual extracted creation function with synthetic transaction writes returns 201 eleven times; timing604800000ms, range 1–999, unlimited maxEntries. No rows created.
- **Disposition:** Reconcile hosting allowance and fairness decision, then enforce any approved weekly accounting atomically; provide a reachable UI for intended player hosting.

### COMP-08 [P2] Browser filters do not change results and later pages are unreachable

**Status 2026-10-28: Partly done, tracked in Equoria-esz55.** CompetitionFilters must show one flat discipline list and add Level and Prize filters. Done = all five bible filters narrow the list.

- **Source:** frontend/src/pages/CompetitionBrowserPage.tsx:39; frontend/src/pages/CompetitionBrowserPage.tsx:270; frontend/src/lib/api/competitionsApi.ts:52; frontend/src/components/competition/CompetitionFilters.tsx:106
- **Concrete failure:** Select Dressage, Free or This Week: state/buttons change but the list still receives the entire same first-page array and the query gets no filters. The client requests no page parameters and discards server pagination, so shows after the default first 20 cannot be browsed. Discipline selection uses grouped categories despite the supplied flat-list rule; level/prize filters are absent.
- **Evidence boundary:** Reached parent, query, transport and list traced; selected component tests use synthetic data and do not prove parent filtering.
- **Disposition:** Connect supported server filters and pagination to the mounted page, including unentered/selected-horse context; render the approved flat discipline control.

### COMP-09 [P2] Raw Show responses omit browser date and prize fields

**Status 2026-10-28: Done.** backend/modules/competition/services/showListView.mjs toShowListItem maps runDate->date, prize->prizePool and adds currentEntries/maxEntries (e6d9d0b48, Equoria-fyoca).

- **Source:** backend/modules/competition/services/competitionRouteQueries.mjs:27; frontend/src/lib/http/apiClient.ts:254; frontend/src/components/competition/CompetitionCard.tsx:81; frontend/src/pages/CompetitionBrowserPage.tsx:145
- **Concrete failure:** GET competition returns raw runDate/prize Show rows while cards/modal expect date/prizePool, without an adapter. A real scheduled funded show therefore renders Date unavailable and nonfinite prize placeholders; participant counters also use incompatible names. Conformation rows use the same undefined date. Entry fee itself survives because its field matches.
- **Evidence boundary:** Actual serializer/client/component shapes; source-inferred presentation outcome from formatDate and Currency guards. No browser screenshot or HTTP request.
- **Disposition:** Normalize the actual Show response once, retain pagination, and use verified run/prize/count names consistently.

### COMP-10 [P1] Results detail and performance use an unmounted API

**Status 2026-10-28: Done.** frontend/src/lib/api/competitionResults.ts now calls the mounted /api/v1/competition/show/:showId/results, served by competitionRoutes GET /show/:showId/results -> competitionResultRecord.getShowResultsView (Equoria-q4uem.10); no per-result breakdown is shown by owner ruling.

- **Source:** frontend/src/lib/api/competitionResults.ts:169; frontend/src/pages/CompetitionResultsPage.tsx:447; backend/app/routers.mjs:167
- **Concrete failure:** Select a real My Results row. The reached modal requests plural /competitions/:id/results, which is not mounted; the existing singular /competition/show/:showId/results has a different raw shape. Full field table/prize distribution/performance breakdown therefore fail even while the user summary loads. NAV-07 separately records missing frontend parameter deep links.
- **Evidence boundary:** Route registry, client and mounted parent traced; code comment also acknowledges the missing read contract. No deployed request.
- **Disposition:** Connect a real explicitly projected results read with persisted scoring components and current-user disclosure; register the associated detail navigation.

### COMP-11 [P1] A failed payout leaves a completed show outside recovery

**Status 2026-10-28: Done.** shows/showExecutionService.mjs recoverPartiallySettledShow + shows/showSettlementRecovery.mjs finish half-settled shows, each placing paid once (155e954c3, Equoria-cmw85.2; 963bfc3d5); quarantine after 3 failures (c49b04e1b, 5f1762528); test showSettlementRecovery.integration.test.mjs.

- **Source:** backend/modules/competition/shows/showController.mjs:551; backend/modules/competition/shows/showController.mjs:565; backend/services/jobs/impl/showExecutionReaper.mjs:121
- **Concrete failure:** After the ordinary executor marks completed, a result or payout transaction fails. That entrant gets no durable result, reward or progression; other entrant transactions can commit. Future normal scans require open and reaper scans executing, so neither retries the completed partial show. Saved ordering can remain but no automatic path consumes it.
- **Evidence boundary:** Actual extracted executor with injected result-create failure ends completed/results 0; a second execution does not retry. Source reaper predicate confirmed. Synthetic writes only; no database crash experiment.
- **Disposition:** Persist settlement progress and an idempotent retry boundary; reach completed only after required payouts/events and escrow disposition finish.

### COMP-12 [P1] Entry snapshot can omit a valid transaction at closing time

**Status 2026-10-28: Done.** 955630c66 'settle the final entry set, not the pre-claim snapshot' (Equoria-fzmiy); test showSettlementLateEntry.integration.test.mjs.

- **Source:** backend/modules/competition/shows/showController.mjs:443; backend/modules/competition/shows/showController.mjs:471; backend/modules/competition/shows/showController.mjs:516; backend/modules/competition/shows/showEscrowTx.mjs:117
- **Concrete failure:** An entrant updates the still-open Show just before close and holds its transaction while inserting/committing the entry. After close, the executor reads the previous committed entrant list, then its claim waits for the entrant Show lock. The valid entry commits; claim then succeeds on open but processes the earlier snapshot. The new entrant is omitted permanently. A zero-to-one field can be marked completed with no results.
- **Evidence boundary:** Exact transaction/read order plus synthetic executor seam inserting an accepted entry immediately before claim: completed, one accepted, zero results. This models the pre-close guarded transaction interleaving, not a real post-deadline HTTP acceptance or live PostgreSQL race.
- **Disposition:** Claim/close entry writes and obtain the final committed field in the same serialized transaction or approved immutable input snapshot.

### COMP-13 [P1] Completed ordinary shows can retain unpaid prize escrow

**Status 2026-10-28: Done.** showExecutionService.mjs refunds the full prizeEscrow for 0 entrants and refundUnpaidPrizeShareInTx refunds unpaid shares, remainder to 1st (Equoria-w7fnz); test showUnpaidPrizeRefund.integration.test.mjs covers 0/1/2/3 entrants and rounding.

- **Source:** backend/modules/competition/shows/showController.mjs:527; backend/modules/competition/shows/showController.mjs:537; backend/modules/competition/shows/showController.mjs:568; backend/modules/competition/shows/showEscrowTx.mjs:187
- **Concrete failure:** A host funds 1000 but nobody enters: the empty branch completes/clears ordering without settling/refunding prize escrow, leaving 1000 held. With one entrant only 500 is paid; two entrants leave 200; even three can leave rounding residuals. Fee settlement drains feeEscrow only. No terminal handling of unused prize was found.
- **Evidence boundary:** Actual synthetic empty-show execution retains prizeEscrow 1000 after completion. One/two-entry amounts derive from exact floor shares. No real escrow movement; disposition policy is not invented.
- **Disposition:** Define and transactionally record the approved unused-prize disposition for empty, small and rounded fields; keep terminal money accountable.

### COMP-14 [P1] Entry write does not repeat current horse ownership

**Status 2026-10-28: Done.** services/entryEligibility.mjs checkEntryEligibility re-reads horse {id, userId} under the entrant's User row lock inside the entry transaction for both ridden and conformation (prepareEntry -> checkConformationEntryInTx) paths (Equoria-mwjst); test showEntryInTransactionAuthority.integration.test.mjs.

- **Source:** backend/modules/competition/shows/showController.mjs:313; backend/modules/competition/shows/showEscrowTx.mjs:125; backend/modules/competition/services/competitionRouteQueries.mjs:125; backend/modules/competition/controllers/conformationShowController.mjs:83
- **Concrete failure:** A seller passes horse ownership then a buyer completes transfer before the seller entry transaction. Neither ordinary entry transaction nor conformation entry claims the Horse with current userId; it inserts the seller userId and horseId despite changed ownership. Later ordinary payout uses stored entry userId, while horse progression/history use the horse. Transfer reconciliation does not reconcile pending ShowEntry.
- **Evidence boundary:** Preflight/transaction predicates and transfer reconciliation traced; no live sale/entry race. Normal post-entry transfer policy also requires an explicit owner/award contract.
- **Disposition:** Re-prove actor ownership and applicable horse/staff eligibility at the authoritative write; separately define who owns already-accepted entries/rewards after transfer.

### COMP-15 [P2] Random stat rewards use a divergent pool and are not recorded

**Status 2026-10-28: Done.** utils/competitionRewards.mjs uses getDisciplineStats with no Racing fallback; competitionAwards.awardPlacementProgression applies an uncapped +1 and showExecutionService.settleEntry records it via recordProgressionOnResult (Equoria-q4uem.10); test resultProgressionRecord.integration.test.mjs.

- **Source:** backend/utils/competitionRewards.mjs:21; backend/utils/competitionRewards.mjs:37; backend/modules/competition/services/competitionAwards.mjs:131; backend/modules/competition/shows/showController.mjs:652
- **Concrete failure:** A winning Endurance horse can gain speed, stamina or focus from the Racing fallback although the source requires stamina, intelligence, speed. Reining and several named pools also differ. The ordinary result is created before this award and omits statGains; returned award/statGain is ignored. At stat 100 updateMany returns 0 but the helper still returns a nominal gain without recording no change.
- **Evidence boundary:** Actual exported catalog compared with source 23-row map; write/result order and cap predicate inspected. No stat roll applied to a live horse.
- **Disposition:** Use the approved discipline reward pool and persist actual bounded gain/outcome beside the result, keeping the random-chance versus Horse Points decision visibly OPEN.

### COMP-16 [P2] Prize payout does not update the earnings counter used by rankings

**Status 2026-10-28: Done.** showExecutionService.mjs settleEntry increments Horse.totalEarnings in the payout transaction (f6e385d03, Equoria-xal4m); test showSettlementHorseEarnings.integration.test.mjs.

- **Source:** backend/modules/competition/shows/showController.mjs:615; backend/modules/competition/services/competitionAwards.mjs:140; backend/modules/leaderboards/controllers/leaderboardController.mjs:252
- **Concrete failure:** A horse wins 500: wallet and CompetitionResult.prizeWon change, but Horse.totalEarnings remains 0. The prize-money/owner-earnings leaderboards, horse overview and snapshots read totalEarnings, so the horse can disappear from money rankings. Competition-specific earnings aggregation from results remains accurate and disagrees with those counters.
- **Evidence boundary:** Actual settlement writes and production totalEarnings consumer search; the award helper comments acknowledge the gap. No production result created.
- **Disposition:** Make earnings a consistent projection of authoritative results or update the counter atomically with payout; reconcile existing history under an explicit migration.

### COMP-17 [P2] Conformation gives titles without completed competition Points or prize payout

**Status 2026-10-28: Partly done, tracked in Equoria-k1p62.9.** Award Horse Points at conformation settlement per Equoria-k1p62.9; confirm a conformation show can never hold prize escrow.

- **Source:** backend/modules/competition/services/conformationShowService.mjs:443; backend/modules/competition/services/conformationShowService.mjs:444; backend/modules/competition/services/conformationShowService.mjs:467
- **Concrete failure:** A conformation entrant pays its fee and completes with ribbon/titlePoints/breedingBoost but receives no horse XP/Horse Points, player XP or configured monetary prize. The source says every completed competition earns Points. A pre-funded conformation prizeEscrow is not distributed or released by this settlement; fees are settled separately.
- **Evidence boundary:** Complete actual conformation transaction, award absence and result shape inspected. No claim that a standard creation API currently allows creating conformation shows.
- **Disposition:** Reconcile the event-type reward contract, including Points participation and escrow; keep title points distinct from Prestige and Horse Points.

### COMP-18 [P2] Conformation classes are accepted then discarded

**Status 2026-10-28: Superseded by owner ruling.** Ruling equoria-conformation-class-removed-legacy-groom-fallback (2026-10-20): className removed from entry requests/responses; no class enforcement until Stacey rules. Settlement comment in conformationShowService.mjs confirms class is score-irrelevant.

- **Source:** backend/modules/competition/controllers/conformationShowController.mjs:73; backend/modules/competition/services/competitionRouteQueries.mjs:195; backend/modules/competition/services/conformationShowService.mjs:32; packages/database/prisma/schema.prisma:1947
- **Concrete failure:** Enter a mare using a syntactically valid Stallions/Breed-Specific class. Server validates the label but not sex, breed or age-class membership, then persists no className/ageClass. All entrants in the show compete in one sorted field using the same score-neutral default class. The response label cannot be reconstructed from stored entry history.
- **Evidence boundary:** Actual validator, entry fields and settlement grouping. Classes/age eligibility partly OPEN in the reference; this documents current absence rather than imposing a new class design.
- **Disposition:** Persist approved class identity and enforce its eligibility/grouping when finalized; describe unclassified open-show behavior honestly until then.

### COMP-19 [P2] Conformation selector offers a class the server rejects

**Status 2026-10-28: Superseded by owner ruling.** Same ruling (equoria-conformation-class-removed-legacy-groom-fallback); frontend/src/components/competition/ConformationEntryModal.tsx now has no class picker ('There is no class to pick') and no Geldings option.

- **Source:** frontend/src/components/competition/ConformationEntryModal.tsx:58; backend/constants/schema.mjs:105; backend/modules/competition/services/conformationShowService.mjs:147
- **Concrete failure:** Choose Geldings from any conformation entry modal. The frontend includes that label, but the server catalog has Foals/Youngstock, Mares, Stallions, Veterans, Open All-Breed, Breed-Specific and no Geldings. Normal submission therefore returns invalid class. Most supported categories are not offered by the sex-derived selector.
- **Evidence boundary:** Reached option helper and server enum traced; exact class pure helper inspected. No real entry submitted.
- **Disposition:** Share approved class options and availability from the server, including a truthful handling of current horse sex/type.

### COMP-20 [P2] Conformation can use unpaid inactive or retired staff

**Status 2026-10-28: Done.** conformationShowService.mjs checkConformationEntryInTx locks the groom and refuses via utils/groomWorkRules.mjs checkGroomMayWork (retired, inactive, feeUnpaidSince); scoring with the entry's groom after entry is the owner rule (equoria-conformation-shows-settle-nightly-7-days, 10-12).

- **Source:** backend/modules/competition/services/conformationShowService.mjs:131; backend/modules/competition/controllers/conformationShowController.mjs:108; backend/modules/competition/services/conformationShowService.mjs:368
- **Concrete failure:** A groom in unpaid grace keeps an active horse assignment. Conformation validates assignment/age/horse health but never checks feeUnpaidSince, isActive or retired, so the groom can enter/handle the horse while other care commands reject unpaid work. At settlement an entry FK resolves that groom regardless of later availability; snapshot fallback also carries no work eligibility.
- **Evidence boundary:** Actual extracted validator with a synthetic old assignment and unpaid, inactive, retired groom returns valid true. Snapshot/FK resolution inspected. No live paid-work bypass.
- **Disposition:** Resolve the permitted conformation staff availability and post-entry retirement/release policy explicitly, then enforce the approved rules consistently. This audit does not infer an automatic ejection policy.

### COMP-21 [P2] Concurrent conformation wins can lose breeding boost increments

**Status 2026-10-28: Done.** conformationShowSettlement.mjs applyConformationRewards writes SET breedingValueBoost = LEAST(breedingValueBoost + delta, cap), a relative increment (Equoria-mwjst, 14c248161); test conformationShowConcurrentTitlePoints.test.mjs.

- **Source:** backend/modules/competition/services/conformationShowService.mjs:352; backend/modules/competition/services/conformationShowService.mjs:413; backend/modules/competition/services/conformationShowService.mjs:421
- **Concrete failure:** Two different due conformation shows settle the same horse concurrently. Each can read boost 0 before either locks Horse, then calculate/write 0.05 for a win. Title points use relative increments, but the final boost is only 0.05 rather than 0.10. The per-show claim prevents duplicate same-show settlement, not different-show stale horse snapshots.
- **Evidence boundary:** Source interleaving and exact absolute versus relative writes; no live concurrent shows. Boost has no found breeding consumer, so current affected state is the recorded/displayed value.
- **Disposition:** Apply the capped boost relative to current locked horse state, or derive it from durable reward records in the same settlement transaction.

### COMP-22 [P2] Leaderboard page expects a unified response the aliases do not emit

**Status 2026-10-28: Done.** 6cd0d662a gives every tab the entries shape and wires discipline (Equoria-pthuj); real win-percentage board 434c348f8 (Equoria-xxdqh); client now reads /api/v1/leaderboards/boards/:board (e857d9e14, Equoria-y3nia).

- **Source:** frontend/src/pages/LeaderboardsPage.tsx:241; frontend/src/lib/api/leaderboards.ts:168; backend/modules/leaderboards/routes/leaderboardRoutes.mjs:35; backend/modules/leaderboards/controllers/leaderboardController.mjs:300
- **Concrete failure:** Open Prize Money: the alias returns data.horses and pagination, but the page reads entries/currentPage/totalPages and defaults to an empty list. Level returns users; performance rankings; owner rankings; recent winners another envelope. The Discipline category requests /leaderboards/discipline, which is not registered. Win Rate aliases a MAX(score) ranking, not actual win percentage. Component mocks supply the expected unified shape and mask this integration mismatch.
- **Evidence boundary:** Actual route aliases, serializers, client and reached page compared. No live UI/HTTP assertion. Rich /leaderboards/competition aggregate API exists independently.
- **Disposition:** Provide an explicit adapter or coherent API for the reached categories/metrics/periods, and route discipline requests to the real filterable service.

### COMP-23 [P2] Personal competition history follows current ownership instead of entrant identity

**Status 2026-10-28: Partly done, tracked in Equoria-r9q06.** Once ruled, store the entering player on CompetitionResult and query player history by it.

- **Source:** backend/modules/competition/services/resultModelService.mjs:95; backend/modules/users/services/userStatsService.mjs:42; backend/modules/users/services/userPrizeHistoryService.mjs:24; backend/modules/competition/services/resultModelService.mjs:373
- **Concrete failure:** After a rewarded horse sells, the seller loses its past wins/prize history from My Results and statistics; the buyer gains that history as their personal success although they did not earn the old payout/XP. CompetitionResult has no immutable entrant owner/rider attribution. User summaries additionally report xpGained 0 while actual podium player XP was 20/15/10. Horse career history correctly remains with the horse; personal career attribution is the separate problem.
- **Evidence boundary:** Owner-based result selectors, schema and result summary field compared with real payout award table. No actual horse transfer.
- **Disposition:** Persist entrant/award-owner identities and actual award data; keep horse career history and personal financial/career history distinct.

### COMP-24 [P1] Public show results return full horse hidden state

**Status 2026-10-28: Done.** GET /show/:showId/results now returns competitionResultRecord.getShowResultsView with a narrow RESULT_SELECT (horse name/userId/username only); getResultsByShow deleted (baac72812, Equoria-0aej5); scoreInputs limited to Owner/Admin (Equoria-4q02c).

- **Source:** backend/modules/competition/routes/competitionRoutes.mjs:102; backend/modules/competition/services/resultModelService.mjs:182; backend/modules/competition/services/resultModelService.mjs:94; packages/database/prisma/schema.prisma:238
- **Concrete failure:** Any authenticated spectator can query raw results for a show. getResultsByShow includes each whole Horse plus breed and Show without owner/attendance disclosure or field projection. Horse.epigeneticModifiers.hidden, gait/genetic/care state and private progression fields are therefore serialized even for other owners. The purpose of public placements does not authorize exposing undiscovered traits. Owner-only horse history does not protect this second route.
- **Evidence boundary:** Actual result include/route/schema and global response optimizer inspected; no hidden-field exclusion found. Source-derived payload exposure, no production capture or other player data read.
- **Disposition:** Project public result identity/placement/score explicitly and authorize any sensitive scoring/history disclosure at its own boundary.

### COMP-25 [P2] A duplicate entry race maps to an internal error on one entry route

**Status 2026-10-28: Done.** competitionRoutes.mjs POST /enter now maps txError.code === 'P2002' to 409 ALREADY_ENTERED, matching showController.

- **Source:** backend/modules/competition/routes/competitionRoutes.mjs:446; backend/modules/competition/routes/competitionRoutes.mjs:129; backend/modules/competition/services/competitionRouteQueries.mjs:188
- **Concrete failure:** Two /competition/enter requests for the same horse/show can both pass the sequential duplicate read. Unique ShowEntry blocks the second transaction and rolls its fee back, but this route has no P2002-to 409 mapping and the outer catch returns 500. The /shows/:id/enter sibling correctly maps the same constraint to 409.
- **Evidence boundary:** Exact precheck, constraint, transaction and catch branches; no live duplicate requests. Integrity holds while retry/error feedback is incorrect.
- **Disposition:** Map the authoritative duplicate constraint consistently while preserving rollback and honest retry behavior.

### COMP-26 [P2] Legacy prize fallback permits an unbacked payout

**Status 2026-10-28: Open, tracked in Equoria-law5w.** settleEntry must pay only escrowed prize money unless the show is a marked Seasonal Event, and log any system-funded payout. Done = underfunded player show pays no unescrowed coins.

- **Source:** backend/modules/competition/shows/showController.mjs:601; backend/modules/competition/shows/showController.mjs:613; backend/seed/seedShows.mjs:46
- **Concrete failure:** A due legacy show with prize 1000 and prizeEscrow 0 can pay 500/300/200 by wallet increments while no system money is debited. The condition treats any underfunded snapshot as legacy, without a migration/legacy marker. This intentionally retained compatibility branch differs from current funded-show conservation and needs explicit accounting; the inspected seed writer also creates prize amounts without escrow.
- **Evidence boundary:** Actual settlement branch and historical seed writer traced. No claim that production has a due underfunded show, no money moved; not a new authorization claim against the safe current create command.
- **Disposition:** Identify approved legacy funding explicitly and record any system injection as an auditable paired source rather than silently bypassing escrow.

### COMP-27 [P2] Legacy achievement calculation misses stored competition placements

**Status 2026-10-28: Done.** CompetitionResult.placement is now Int (404019edb, Equoria-f46tb) and backend/modules/horses/services/legacyScoreCalculator.mjs calculateAchievementsScore compares placement === 1/2/3.

- **Source:** backend/modules/competition/shows/showController.mjs:575; backend/modules/competition/services/conformationShowService.mjs:439; backend/modules/horses/services/legacyScoreCalculator.mjs:188
- **Concrete failure:** Both real result writers store placement strings. The reachable legacy score reader includes those rows, then counts only numeric 1/2/3. A real win therefore contributes zero first-place/win-rate achievement reward instead of the helper intended amount. Participation counts still accrue; this is not the canonical Prestige ladder.
- **Evidence boundary:** Actual exported achievement helper with a stored string 1 returns score 0, wins 0; numeric seam returns score 9, wins 1. No database read. Wider Legacy design remains Volume 14 scope.
- **Disposition:** Normalize authoritative result placement consistently before deriving career achievements, and preserve a distinction between current legacy score and canonical future Prestige credentials.

### Verification and limitations

- Existing frontend: 46 files / 809 tests PASS, exit 0, 47.66 seconds. Mocks and reusable/unmounted components are included; not end-to-end production contract proof.
- Existing backend: 5 pure suites / 142 tests PASS, exit 0, 1.454 seconds. Temporary config removed shared database hooks/cleanup; dummy localhost port-one URLs. Force-exit/open-handle guidance emitted. No repository test modifications.
- Actual pure/extracted function probes with synthetic seams: discipline/preparation score invariance; additive luck; placement awards; universal versus advisory levels; bank threshold; eleven free host creations; age-40/riderless entry; unavailable staff validation; empty prize escrow; payout failure after completed status; accepted entry versus pre-claim field snapshot; string-placement legacy loss. No HTTP/SQL/live horse, wallet, staff, entry or result mutations. Synthetic retired horse property is not a persisted Horse field.
- TypeScript PASS; all 47 doctrine gates PASS. No full lint, beta E2E/browser playthrough, live race/sale/crash/reaper, production census, deployment/migration verification, load/device or comprehensive accessibility run.
- DOCX ZIP/XML/reopen and source hash/anchor checks PASS. Original SHA256 1c0e1ac347ad04e4434a7f7a777302574ec31ebc8297c51e7d4ca47503b7a867. Exact section/style/theme/numbering/package parts preserved; only document.xml and footer1.xml authored. Required tables have deliberate widths, repeated headers and expanding unsplit rows.
- Reference and final render attempts failed because the current bundled documents renderer cannot find LibreOffice soffice.exe. Visual layout, pagination and page count remain unverified.

AUDIT: CONCERNS

## 2026-10-20 — Staff/admin foundation adversarial re-review

Scope: Claude's rework range `a724734c5^..5d3c3bf7a`, reviewed at `5d3c3bf7a` against `docs/features/staff-foundation.md`, `docs/features/admin-time-back.md`, the 2026-10-13 findings above, and `C:\Users\heirr\AppData\Local\Temp\equoria-staff-rework-codex-rereview-handoff.md`. Correctness and security only. The implementation is materially better, but it is not ready for approval.

### Original finding ledger

| Original    | Re-review status                                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STAFF-CR-01 | **Partial** — the normal password/email/role races are serialized, but retirement is reversible under clock rollback and timestamp equality can reject a newly issued code (STAFF-RR-01). |
| STAFF-CR-02 | **Fixed** — player targets are locked and the actionable-target rule is applied.                                                                                                          |
| STAFF-CR-03 | **Fixed** — ticket list keyset pagination and UI traversal are present.                                                                                                                   |
| STAFF-CR-04 | **Fixed** — the sentinel runs through the documented root Jest command.                                                                                                                   |
| STAFF-CR-05 | **Partial** — the route grammar is substantially stronger, but it accepts the wrong guard on the three role-only routes (STAFF-RR-09).                                                    |
| STAFF-CR-06 | **Deferred by owner/project contract**, but the temporary no-mount proof remains incomplete (STAFF-RR-13).                                                                                |
| STAFF-CR-07 | **Partial** — entities are resolved, but non-player targets are not locked and malformed IDs do not receive the promised uniform answer (STAFF-RR-03/04).                                 |
| STAFF-CR-08 | **Fixed under the 2026-10-13 owner ruling** — same-status writes are refused and conditional updates select one winner. The concurrency harness still needs repair (STAFF-RR-12).         |
| STAFF-CR-09 | **Fixed** — replies are cursor-paged and incrementally reachable.                                                                                                                         |
| STAFF-CR-10 | **Partial** — a durable outbox exists, but crash accounting, erasure/delivery races, and run bounds are still wrong (STAFF-RR-02/05/06/07/08).                                            |
| STAFF-CR-11 | **Fixed in production logic** — current filer role is checked and demotion clears unread staff bells. The shared race harness caveat still applies.                                       |
| STAFF-CR-12 | **Fixed** — authorization data is private and callers receive copies.                                                                                                                     |
| STAFF-CR-13 | **Fixed** — a live filing mutation cannot be reset or resubmitted.                                                                                                                        |
| STAFF-CR-14 | **Fixed** — changing subject kind clears the old identifier.                                                                                                                              |
| STAFF-CR-15 | **Fixed** — reply success invalidates the thread and ledger.                                                                                                                              |
| STAFF-CR-16 | **Fixed** — the admin actor filter includes former/erased stewards.                                                                                                                       |
| STAFF-CR-17 | **Partial** — initial unknown-page identity is correct, but a later outage keeps cached office UI visible and action-level check-in failures do not return to check-in (STAFF-RR-10/11).  |
| STAFF-CR-18 | **Fixed for scheduled retention**, subject to STAFF-RR-01's irreversible-retirement defect.                                                                                               |

### STAFF-RR-01 [P1] Check-in retirement is not irreversible

**Status 2026-10-28: Open, tracked in Equoria-8pzlg.** Add a retirement mark (retiredAt or a per-account security generation) that newestLiveCodeTx checks independently of the clock, and compare issue order without a strict same-ms reject (e.g. generation or >=); needs an owner-approved migration for the column. Done = tests: retired code stays dead after clock rewind; code issued in the same ms as a password/email change behaves as specified.

**Evidence:** `backend/modules/staff/services/staffChallengeRetirement.mjs:28-32`; `backend/modules/staff/services/staffCheckinService.mjs:136-160`; `backend/modules/staff/services/staffCheckinService.mjs:191-210`.

**Failure scenario:** A code issued at T0 and expiring at T0+10m is retired by a role/password/email change at T0+1m by setting `expiresAt=T0+1m`. If the wall clock is corrected backwards to T0+30s after the account is again eligible, the unused code is live again and can create a trusted device. Separately, because a new code is accepted only when `createdAt` is strictly greater than the security timestamps, a code created in the same stored millisecond as an email/password change is immediately unusable even though it was issued afterward.

**Required fix:** Add an irreversible `retiredAt` and/or a monotonic staff-security generation captured by codes and devices. Verification must require an unretired code under the current generation in both transactions; stop using ambiguous wall-clock ordering as the authority. Prove clock rollback and equal-timestamp boundaries.

### STAFF-RR-02 [P1] Outbox crashes consume failures that never happened

**Status 2026-10-28: Open, tracked in Equoria-dqvg7.** Count confirmed provider failures separately from claims (or increment after the send result) so lease recovery never fails a row short of five real sends; done = test crashing between claim and send five times still leaves the row deliverable.

**Evidence:** `backend/modules/staff/services/ticketEmailOutbox.mjs:82-97`; `backend/modules/staff/services/ticketEmailOutbox.mjs:140-143`; `backend/modules/staff/services/ticketEmailOutbox.mjs:154-170`; misleading regression at `backend/modules/staff/__tests__/staffTicketEmailOutbox.integration.test.mjs:206-229`.

**Failure scenario:** Claims increment `attempts` before the provider is called. After four actual provider failures, a worker claims the fifth try and dies before line 155. Lease recovery increments the row to six, and lines 140-143 permanently fail it without making the fifth send. Repeating claim-before-send crashes can exhaust the budget with no send at all. That violates the contract that the fifth _failure_ is terminal; only a crash after provider acceptance was accepted as an ambiguous duplicate.

**Required fix:** Track confirmed provider failures separately from claim/lease generations. Claiming or reclaiming must not consume a failure. Increment the failure count only when the provider rejects/times out; terminalize on the fifth confirmed failure. Add crash-before-provider tests at every ordinal, especially the fifth.

### STAFF-RR-03 [P1] Horse/show/post targets can be deleted between validation and commit

**Status 2026-10-28: Open, tracked in Equoria-q4gt7.** Lock the target row (SELECT ... FOR KEY SHARE via $queryRaw on the TARGET_TABLES table) inside the filing tx before staffTicket.create; done = lock-barrier test where a concurrent delete either waits or the filing returns NO_TARGET.

**Evidence:** `backend/modules/staff/services/staffTicketService.mjs:121-143`; `backend/modules/staff/services/staffTicketService.mjs:161-178`; polymorphic string target at `packages/database/prisma/schema.prisma:2204-2205`.

**Failure scenario:** Filing reads horse 42, then a concurrent delete commits before the ticket insert. Because the ticket stores only a string and has no FK, the transaction commits a permanent ticket, log and notifications for a target that did not exist when filing committed, contrary to `staff-foundation.md:123-125`.

**Required fix:** Resolve each allow-listed target table with a row lock (`FOR KEY SHARE`/`FOR UPDATE`) held through ticket creation, or introduce an equivalent authoritative reference design. Prove both serial outcomes: delete-first returns the one not-found answer; filing-first commits against the still-existing locked row.

### STAFF-RR-04 [P2] Malformed non-player targets still enumerate validation classes

**Status 2026-10-28: Open, tracked in Equoria-0spfq.** For horse/show/post targets, route malformed/overlong/non-string IDs to the 404 NO_TARGET answer (keep 400 only for a truly absent required field if the contract says so); done = controller tests for each malformed form returning NO_TARGET.

**Evidence:** `backend/modules/staff/controllers/staffTicketController.mjs:68-97`; `backend/modules/staff/services/staffTicketService.mjs:133-143`; contract `docs/features/staff-foundation.md:123-125`.

**Failure scenario:** `targetId='999999'` reaches the service and returns 404 `NO_TARGET`, while `targetId=999999`, `''`, `null`, an overlong value, or an omitted value returns a distinguishable 400 from the controller. The contract requires malformed, unknown, deleted and wrong-kind IDs to receive one answer that does not say which.

**Required fix:** Route every unusable horse/show/post identifier through the same `NO_TARGET` response. Keep category/note and unsupported `targetType` validation separate. Add a response-identity matrix for type, blank, missing, overlong, signed/zero/leading-zero, unknown, deleted and wrong-kind values.

### STAFF-RR-05 [P1] Account erasure can miss a concurrently filed ticket email

**Status 2026-10-28: Superseded by owner ruling.** Ruling equoria-players-cannot-delete-accounts.md: accounts are never deleted, and both delete routes answer 403 via refuseAccountDeletion. eraseUserAccount is unreachable, and removing it is Equoria-81uop.

**Evidence:** `backend/modules/users/services/gdprAccountService.mjs:533-542`; `backend/modules/users/services/gdprAccountService.mjs:577-578`; `backend/modules/staff/services/staffTicketService.mjs:161-206`.

**Failure scenario:** Erasure scrubs all current ticket-email payloads, then a still-authorized filing inserts a new ticket/outbox row carrying the moderator's username before the final user delete. The FK permits the ticket to survive with a null filer, but the newly inserted payload was after the scrub and permanently retains the erased name.

**Required fix:** Serialize erasure and staff writes on the filing User row from the start of both transactions. If filing wins, erasure's later scrub must see it; if erasure wins, filing must re-read no user and create nothing. Add a deterministic scrub-versus-file race and inspect the committed outbox payload.

### STAFF-RR-06 [P1] Delivery sends stale recipient and filer data after state changes

**Status 2026-10-28: Open, tracked in Equoria-aexiz.** Take a shared row lock (or re-check under the same lock role/email changes use) immediately before sendStaffTicketEmail and send to the address read under it; add an explicit provider timeout shorter than the lease. Done = race test: demotion/email change between check and send yields no send to the old address.

**Evidence:** claimed payload snapshot at `backend/modules/staff/services/ticketEmailOutbox.mjs:82-97`; recipient check and send at `backend/modules/staff/services/ticketEmailOutbox.mjs:136-155`; erasure scrub at `backend/modules/staff/services/ticketEmailOutbox.mjs:240-247` and `backend/modules/users/services/gdprAccountService.mjs:539-542`.

**Failure scenario:** Worker A claims a row. Before A sends, the admin is demoted, un-verifies/changes their email, or is erased; A still sends to the address read before the change. In a second interleaving, erasure replaces the filing moderator's name in the durable row after the claim, but A sends the pre-scrub JavaScript payload and discloses the erased username. The send-time re-resolution and scrub tests are sequential, so both races remain invisible.

**Required fix:** Build one bounded, serialized final-delivery critical section shared with recipient role/email changes and filer erasure. Re-read the durable row and recipient after entering it; never send the claim snapshot. Use explicit provider timeouts so serialization is bounded. Add deterministic claim→state-change/scrub→send races and assert zero obsolete-address/name deliveries.

### STAFF-RR-07 [P2] Admin deletion can roll back an otherwise valid filing

**Status 2026-10-28: Superseded by owner ruling.** No account (admin included) can be deleted under ruling equoria-players-cannot-delete-accounts.md; erasure code is unreachable (Equoria-81uop), so the recipient FK cannot vanish mid-filing.

**Evidence:** unlocked recipient discovery at `backend/modules/staff/services/staffTicketService.mjs:179-196`; required outbox recipient FK at `packages/database/prisma/schema.prisma:2240-2242`.

**Failure scenario:** The admin is discovered, then their erasure commits before the notification/outbox inserts. One FK insert fails and rolls back the valid ticket, log and all remaining recipients instead of safely skipping the vanished recipient.

**Required fix:** Hold key-share locks on resolved recipients through the filing transaction, or re-resolve and safely omit recipients that disappeared without weakening delivery to surviving admins. Add an admin-erasure-versus-filing race.

### STAFF-RR-08 [P2] One outbox run can monopolize the cron lock far beyond its schedule

**Status 2026-10-28: Open, tracked in Equoria-bq0oi.** Give runEmailOutbox a wall-clock budget below the 5-minute period and an explicit SMTP connection/send timeout in emailService.mjs; done = test with a slow fake transport stopping before the budget and leaving the rest due.

**Evidence:** sequential batch at `backend/modules/staff/services/ticketEmailOutbox.mjs:189-199`; 50-row limit at `backend/modules/staff/services/ticketEmailOutbox.mjs:33-34`; global job lock/timeout at `backend/utils/cronLock.mjs:116-153`; five-minute schedule and 15-minute stale threshold at `backend/services/jobs/emailOutboxJob.mjs:18-23`; SMTP has no explicit timeout at `backend/utils/emailService.mjs:81-86`.

**Failure scenario:** Fifty slow SMTP sends can run serially for hours. The job holds a database transaction/advisory lock while performing external I/O, later five-minute runs skip, the heartbeat becomes stale after 15 minutes, and the 60-minute lock transaction can abort mid-batch. Even the bounded 15-second Gmail path can consume roughly 12.5 minutes for 50 ordinary sends, or longer with token refresh/retry.

**Required fix:** Give the run a wall-clock budget below its health/schedule envelope, configure bounded SMTP timeouts, use a smaller batch or bounded concurrency with per-row claims, and do not hold a long database transaction across provider I/O. Test a full slow batch against the run deadline, lock release and remaining due rows.

### STAFF-RR-09 [P1] Doctrine accepts capability guards on role-only check-in routes

**Status 2026-10-28: Open, tracked in Equoria-plbec.** For ROLE_ONLY_ALLOWED routes require guard.kind === 'role' (capability guard there fails); add planted negative cases to backend/**tests**/scripts/staffRoutesGuarded.sentinel.test.mjs.

**Evidence:** `scripts/doctrine-checks/check-staff-routes-guarded.mjs:232-245`; required production shape at `backend/modules/staff/routes/staffRoutes.mjs:36-38`; missing negative cases at `backend/__tests__/scripts/staffRoutesGuarded.sentinel.test.mjs:92-100`. A direct planted probe of `POST /checkin/request` guarded by `requireStaffCapability('ticket.file')` returned no failures.

**Failure scenario:** A future edit replaces `requireStaffRole` on `/checkin/request`, `/checkin/verify`, or `/me` with a capability guard. The doctrine gate stays green, but the first two routes now require an already trusted device, so a new browser cannot obtain the code needed to become trusted.

**Required fix:** On the three exact role-only route keys require `guard.kind === 'role'`; everywhere else require a capability guard. Add three planted capability-guard negatives plus the existing role-guard positives.

### STAFF-RR-10 [P2] A background `/staff/me` outage leaves the hidden office visible

**Status 2026-10-28: Open, tracked in Equoria-jqdho.** StewardGate should render NotFoundPage when me.isError (any status) even with stale data, per the hidden-office outage ruling in 1e00dc218; done = vitest: cached steward data + refetch 500 shows the not-found page.

**Evidence:** `frontend/src/components/staff/StewardGate.tsx:43-51`; explicit stale-data behavior at `frontend/src/pages/StewardsOfficePage.tsx:41-45`; contradictory regression at `frontend/src/pages/__tests__/StewardsOfficePage.test.tsx:454-476`; owner ruling at `docs/features/staff-foundation.md:76-86`.

**Failure scenario:** A steward loads the office, opens a dialog, and the next `/staff/me` refetch gets a network error or 500. TanStack retains the previous `me.data`; the gate hides only 404/no-data, so the office and its sensitive cached content remain rendered. The test deliberately locks in this behavior even though the owner ruled that an outage makes `/steward` blank like an unknown address.

**Required fix:** Treat any settled `/staff/me` error as not-found even when stale data exists. Replace the contradictory test with initial and background 5xx/network cases that assert identical blank DOM, URL and history and unmount cached office content.

### STAFF-RR-11 [P2] Action-level check-in expiry does not return the page to check-in

**Status 2026-10-28: Open, tracked in Equoria-pwucl.** Make the mutation-cache watcher (or StewardsOfficePage) switch to the check-in state when a staff mutation fails with 403 STAFF_CHECKIN_REQUIRED, including the new conduct actions; done = vitest: a filing/reply/status/role/conduct mutation 403 shows StaffCheckIn.

**Evidence:** the global mutation watcher handles only 404 at `frontend/src/hooks/api/useStaff.ts:54-86`; filing mutation is isolated at `frontend/src/components/staff/StaffTickets.tsx:65-113`; reply/status mutations are not observed at `frontend/src/components/staff/TicketThread.tsx:46-57` and `frontend/src/components/staff/TicketThread.tsx:87-116`; thread/list effects inspect only query errors at `frontend/src/components/staff/TicketThread.tsx:127-135` and `frontend/src/components/staff/StaffTickets.tsx:258-266`.

**Failure scenario:** The 30-day device trust expires after the page loaded. Filing, replying, changing status, or changing a role receives 403 `STAFF_CHECKIN_REQUIRED`, but only inline error copy appears; `checkinLapsed` is never set and the page keeps showing unusable tools until some later read/refocus happens to refresh `/me`.

**Required fix:** Centralize staff query and mutation access-error handling. Any staff mutation/query with `STAFF_CHECKIN_REQUIRED` must immediately enter the check-in state; 404 must still re-check `/me`. Cover filing, reply, status and role actions with a lapsed-device response.

### STAFF-RR-12 [P2] The shared race helper can declare unrelated locks as proof

**Status 2026-10-28: Done.** b36188fba (Equoria-8kbfl): raceUnderLock in staffFixtures.mjs counts only sessions blocked by the holder (pg_blocking_pids(pg_backend_pid())). The commit proved this with an unrelated waiter parked and a re-planted defect.

**Evidence:** `backend/modules/staff/__tests__/helpers/staffFixtures.mjs:250-293`; consumers include `staffCheckinMfaSecurityState.integration.test.mjs`, `staffTicketStatusAuthz.integration.test.mjs`, and `staffTicketRecipientsAuthz.integration.test.mjs`.

**Failure scenario:** `raceUnderLock` counts every session in the database whose `wait_event_type='Lock'`. An unrelated lock wait contributes to `n`, allowing the helper to start/release before one or more target requests have reached the intended row lock. A missing production lock can therefore leave the advertised race test green.

**Required fix:** Count only sessions blocked by the holder transaction (for example via its backend PID and `pg_blocking_pids`) and require the expected number of target requests. Prove the harness goes red when the production lock/re-check is locally neutered.

### STAFF-RR-13 [P2] The temporary fresh-proof release blocker skips files without a named guard

**Status 2026-10-28: Open, tracked in Equoria-8irhg.** Scan every backend route file for /time-back and /jobs/hold paths (and the capability names) regardless of StaffCapability, failing closed; add a planted admin-only time-back route to the sentinel. Superseded once puj1e.5 ships requireFreshStaffProof and the rule becomes 'must be preceded by it'.

**Evidence:** early skip at `scripts/doctrine-checks/check-staff-routes-guarded.mjs:428-433`; literal guard-call analysis at `scripts/doctrine-checks/check-staff-routes-guarded.mjs:445-505`; blocking contract `docs/features/admin-time-back.md:115-135`.

**Failure scenario:** Before `requireFreshStaffProof` exists, a developer adds an admin `/time-back` or `/jobs/hold` route protected by existing admin MFA/custom middleware but without spelling `requireStaffCapability`. Because the file lacks `StaffCapability`, the no-mount scan skips it and the release gate stays green even though the forbidden operation is reachable with only the old proof.

**Required fix:** Until the fresh-proof project lands, scan every production backend source and fail on forbidden route/capability literals outside the policy declaration, including custom/role-only middleware shapes. Add planted routes that contain no `StaffCapability` token. Keep the eventual relaxation tied to a proven `requireFreshStaffProof` predecessor.

### Verification

- Focused backend: 10 suites / 184 tests passed, exit 0.
- Focused frontend: 8 files / 66 tests passed, exit 0. The output includes the contradictory background-outage test described in STAFF-RR-10.
- TypeScript: `npm run typecheck` passed, exit 0.
- Doctrine: all 50 checks passed, exit 0. A direct planted probe still demonstrated STAFF-RR-09.
- Review-layer limitation: the blind layer and the final doctrine/frontend edge, verification and acceptance reruns hit the account usage ceiling. Earlier edge/verification/acceptance chunks completed; the primary reviewer directly completed the remaining code and contract checks. Failed layers were not counted as passed.
- Dismissed/accepted: the documented crash-after-provider-accept duplicate; the owner-approved ticket status transitions; `NOT_A_PLAYER` versus `NO_PLAYER`; production Gmail credential provisioning as an external release dependency. None excuses the findings above.
- No application or test source was modified by this review. The only repository write is this requested findings-ledger update; unrelated working-tree changes were preserved.

VERDICT: REVISE
