# Equoria security remediation handoff for Claude Code

## Assignment

Implement correct, durable fixes for the three validated vulnerabilities in the completed Codex Security scan of Equoria. Work in the existing checkout at:

`C:\Users\heirr\Desktop\Equoria`

Do not create another setup workspace. Do not edit the sealed scan artifacts. Do not broaden this into an enterprise-security redesign: Equoria is a small, pre-revenue horse simulation game, but its gameplay state and economy still need server-authoritative, atomic behavior.

Treat this document as implementation guidance. The sealed report and current repository source are the evidence. If a line number has drifted, follow the named symbol and prove the current behavior before changing it.

## Authoritative inputs

Read these before planning or editing:

1. Repository implementer instructions:
   - `C:\Users\heirr\Desktop\Equoria\CLAUDE.md`
   - `C:\Users\heirr\Desktop\Equoria\AGENTS.md`
   - `C:\Users\heirr\Desktop\Equoria\.claude\rules\CONTRIBUTING.md`
   - `C:\Users\heirr\Desktop\Equoria\docs\SECURITY_TESTING.md`
2. Sealed security report:
   - `C:\Users\heirr\.codex\state\plugins\codex-security\scans\Equoria\175b8c1a1384b5300e4c56d709b75d27d8310ad5_20261002T155210Z_zpnegxf0\report.md`
3. Canonical machine-readable scan artifacts in the same directory:
   - `findings.json`
   - `coverage.json`
   - `scan-manifest.json`
   - `exports\results.sarif`

The report was sealed against revision `175b8c1a1384b5300e4c56d709b75d27d8310ad5`. The current checkout was later observed at `1e0d75cf26247c932e83b7e568f12510910dd427`. Reconfirm the current HEAD and inspect the live implementations before editing. The affected runtime files were unchanged when last compared, but do not assume that remains true.

## Preserve the user's work

At handoff time the checkout had these unrelated user-owned changes:

```text
 D .claude/agents/shadcn-ui-adapter.md
 M PRODUCT.md
 M skills-lock.json
```

Do not restore, overwrite, stage, reformat, or otherwise alter those changes. Re-run `git status --short` before work and again before reporting completion. If a required fix genuinely conflicts with an existing user edit, stop and explain the exact conflict instead of erasing it.

Do not edit `CLAUDE.md`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, or `.claude/rules/**` without explicit owner permission.

## What “correct” means

The goal is not to make existing tests green by the shortest route. The final implementation must make each reported attacker sequence fail at the real HTTP/service/database boundary while preserving legitimate gameplay.

For every finding:

- Start with a regression test that demonstrates the original attack or violated invariant through real Equoria code and the disposable test database.
- Exercise the real routing, middleware, validation, service, Prisma, and transaction path. Do not mock Prisma or an internal service to manufacture a pass.
- Fix the production behavior, not the test expectation. Existing tests may be changed only where they encode the vulnerable old contract; explicitly document the old contract and the corrected contract.
- Test both rejection and legitimate success. A secure endpoint that breaks normal feeding, competition entry, due settlement, or foal development is not complete.
- Keep every player-state mutation introduced or touched by this work inside a Prisma transaction. Coupled economic or gameplay writes must commit or roll back together.
- Prove race-sensitive behavior where duplicate entry or duplicate settlement is possible. A single sequential happy-path test is insufficient.
- Do not add a hosted service, dependency, telemetry system, queue, or speculative platform abstraction.
- Do not weaken assertions, skip tests, increase timeouts/workers/memory, swallow errors, add bypass headers, or hide vulnerable routes only in the frontend.

## Required work order

1. Read the authoritative inputs above.
2. Inspect current `git status`, current HEAD, package scripts, Prisma schema, affected routes/controllers/services, all callers, and nearby tests.
3. Write a short implementation plan before editing. For each finding, state:
   - the precise server-owned invariant;
   - the current trusted and untrusted inputs;
   - the transaction boundary;
   - the negative exploit test;
   - the positive legitimate-flow test.
4. Work finding by finding in severity order: feed reset, conformation competition, foal development.
5. Run only the narrow affected tests during iteration. Run broader gates sequentially after the candidate is complete, in proportion to the change and laptop budget.
6. Review the final diff for unintended files and produce an evidence block for every finding.

Do not combine several speculative fixes into one experiment. If two attempts fail to distinguish the cause, stop and reassess from evidence.

---

## Finding 1 — High: production feed-cooldown reset enables repeat stat farming

### Vulnerable behavior

An ordinary authenticated player who owns a horse can feed it, call the production reset endpoint, and feed it again on the same day. Repeating this while inventory remains allows repeated permanent stat rolls. For pregnant mares, repeated feeding also manipulates pregnancy-related counters/bonuses.

Inspect these current symbols and their callers:

- `backend/modules/horses/routes/horseFeedRoutes.mjs` — production registration of `POST /:id/reset-last-fed` (approximately lines 101–107 in the scanned revision).
- `backend/modules/horses/controllers/horseFoalingController.mjs` — reset handler accepting a client-controlled number of days and directly updating the horse (approximately lines 441–459).
- `backend/modules/horses/services/horseFeedService.mjs` — daily-feed guard (approximately lines 174–177) and permanent stat/pregnancy effects (approximately lines 217–227).
- `backend/utils/pregnancyBonus.mjs` — pregnancy effect (approximately lines 56–77).
- `backend/modules/horses/__tests__/resetLastFed.integration.test.mjs` — existing test coverage for the reset route.

### Correct fix

Remove this debug/test mutation from the production HTTP surface. There is no legitimate player-facing business need for a route that rewinds a horse's feed timestamp.

- Delete the route from the production router rather than merely removing its UI, renaming it, adding ownership checks, adding rate limiting, or changing it to an ordinary admin route.
- Remove the controller/export if it has no legitimate production caller.
- Replace test fixture dependence on the HTTP endpoint with a narrowly owned test helper or direct test-database fixture setup. Fixture code must not be mounted in the production application.
- If an HTTP test seam is absolutely unavoidable, it must exist only in an explicit test harness that is structurally absent from production registration and proven fail-closed outside that harness. A `NODE_ENV` check buried in a normal production handler is not the preferred solution and requires unusually strong proof.
- Preserve the legitimate feed endpoint's ownership, inventory, daily cooldown, stat behavior, and pregnancy behavior.
- Ensure all remaining player-state writes in the feed operation are transactionally coupled.
- Add a route/doctrine/sentinel protection against future production mounting of debug/test state-rewind endpoints. The sentinel must prove its detector fails on a planted violation, not just pass against current source.

### Required proof

- Under production-like app wiring, `POST /:id/reset-last-fed` is not a usable mutation surface (normally 404; use 410 only if the repository deliberately retains a tombstone contract).
- An owner who submits two feeds in one UTC day consumes inventory and receives permanent stat/pregnancy effects exactly once.
- The legitimate first daily feed still works.
- A fixture can establish historical `lastFedDate` without calling a production route.
- The route/sentinel check detects a deliberately planted forbidden registration.

### Do not accept

- Frontend removal only.
- Ownership or rate limiting as the primary fix.
- A renamed or obscured reset route.
- “Admin only” without a real production business requirement.
- A normal production route whose only protection is an environment conditional.

---

## Finding 2 — Medium: conformation entries are free and player hosts can settle future shows

### Vulnerable behavior

The conformation entry path creates an entry with `feePaid: 0` and does not atomically debit the entrant or credit show escrow. It also lacks the canonical entry-window and level-bracket enforcement found in the regular show path. Separately, an ordinary player host can execute a conformation show before its scheduled due time and cause title points, titles, and breeding-value rewards to be awarded early.

Inspect:

- `backend/modules/competition/controllers/conformationShowController.mjs`
  - entry flow, approximately lines 111–149;
  - host execution flow, approximately lines 298–311.
- `backend/modules/competition/services/conformationShowService.mjs`
  - settlement claim, approximately lines 330–343;
  - reward writes, approximately lines 346–407.
- Canonical regular-show behavior in `backend/modules/competition/shows/showController.mjs`, approximately lines 304–350.
- The existing atomic entry helper, likely `backend/modules/competition/shows/showEscrowTx.mjs`, and its callers/tests.
- `backend/modules/competition/__tests__/conformationShowRoutesHttp.integration.test.mjs`, which in the scanned revision proves the vulnerable behavior by allowing a player-hosted show scheduled seven days ahead to execute immediately.

Trace the live schema and domain vocabulary before coding. Determine whether `closeDate`, `runDate`, or another field is the repository's authoritative settlement boundary. Do not invent a second time model.

### Correct entry fix

Reuse or refactor the canonical show-entry transaction/domain service instead of writing a second ad hoc fee implementation. The final path must enforce, in one Prisma transaction:

- show exists and is open;
- entry window is currently valid;
- horse is eligible for the show type and correct level bracket;
- entrant owns the horse and any groom/handler rule is satisfied;
- duplicate entry is rejected safely, including under concurrency;
- sufficient funds are checked with a guarded debit that cannot overspend under a race;
- exactly the configured entry fee is debited from the player;
- the same amount is credited to the show's escrow/counterparty state;
- the `ShowEntry` records the actual amount as `feePaid`;
- any canonical ledger entry or economic audit record is written consistently;
- any failure rolls the whole operation back with no entry, wallet drift, escrow drift, or partial ledger state.

Use the existing module public API boundary. Cross-module production imports must go through the target module's `index.mjs`; do not bypass the linted boundary.

### Correct settlement fix

Prefer removing the player-triggered conformation execute route and using the existing due-show scheduler/cron if that is the canonical product design. If current product behavior genuinely requires a host action, authorization alone is not sufficient: enforce the due-time predicate server-side in the atomic claim that transitions the show from open to processing/complete.

The claim must prevent two concurrent requests from both awarding results. The time/status predicate and state transition belong in the same atomic mechanism; checking the date before a later unguarded update leaves a race.

Existing or legacy rows must be safe even if current public show creation no longer exposes the exact host/conformation combination. Do not dismiss a live service vulnerability merely because one current UI path cannot create a new example.

### Required proof

Entry tests using the real disposable database must show:

- correct fee debited exactly once;
- matching escrow credit exactly once;
- `feePaid` equals the configured fee;
- insufficient funds produce no entry and no money/escrow/ledger drift;
- closed, too-early, or out-of-bracket entry attempts fail without side effects;
- duplicate and concurrent entry attempts create/charge at most once;
- existing regular-show entry behavior remains correct.

Settlement tests must show:

- an ordinary host cannot execute before the authoritative due time;
- early rejection creates no result, title points, title, or breeding-value change;
- a due show can still be settled through the intended legitimate mechanism;
- two concurrent settlement attempts award exactly once and end in one coherent terminal state;
- money/escrow and reward invariants reconcile after success and after rejection.

The existing test that celebrates immediate execution of a show seven days in the future encodes the vulnerable contract. Replace that expectation with an early-rejection test, and add a separate legitimate due-settlement test. Explain this contract correction in the evidence block; do not quietly rewrite it just to obtain green.

### Do not accept

- Setting a nonzero `feePaid` without moving money.
- Debiting and creating the entry in separate transactions.
- A read-then-write date check that permits a settlement race.
- “Only the host can execute” as proof of correct timing.
- A UI-only restriction.
- A new fee/escrow abstraction that duplicates the canonical regular-show implementation.

---

## Finding 3 — Low: foal development accepts player-authored day, bond, and stress state

### Vulnerable behavior

The owner can send target values for `currentDay`, `bondingLevel`, and `stressLevel` to the foal development endpoint. Range validation does not make player-authored state authoritative. A client can jump directly to day 6 and choose bond/stress values, affecting the legacy development UI, activity availability, and graduation output.

The scan did not establish that this path changes the canonical horse bond/stress, money, inventory, breeding, or marketplace state, so keep the severity and solution proportionate. It is still an integrity flaw in a horse-development game mechanic.

Inspect:

- `backend/modules/breeding/routes/foalRoutes.mjs`, approximately lines 166–176.
- `backend/modules/breeding/controllers/foalController.mjs`, approximately lines 538–586.
- `backend/modules/horses/models/foalModel.mjs`
  - legacy activity consumption of development state, approximately lines 364–369;
  - newer age-derived enrichment, approximately lines 240–269;
  - development/activity writes around lines 396–421, which were separate non-transactional writes in the scanned revision.
- `frontend/src/components/breeding/FoalDevelopmentTracker.tsx`, around lines 248–263, which intentionally sends `currentDay + 1`.
- `frontend/src/lib/api/breeding.ts` and all other callers.

Because the frontend deliberately exposes “Advance Day,” this is a contract and UI correction, not just backend validation.

### First decision: retain or retire the legacy flow

Use current source, callers, tests, and product documentation to decide which of these is true:

1. **Superseded flow:** the endpoint and legacy `FoalDevelopment` state are no longer the canonical mechanic. Remove/deprecate the mutation path and update the frontend to use the canonical age-derived enrichment. Prove no legitimate caller or graduation behavior is lost.
2. **Retained mechanic:** redesign the endpoint as a command/action, never a generic “set target state” update.

Do not choose removal merely because it is shorter. Do not retain mutable duplicate state merely because deleting it requires tracing callers. Record the evidence for the decision.

### Correct retained-flow design

If the mechanic remains:

- The server derives the current development day from date of birth and current server time, or permits exactly one transition according to the repository's actual elapsed-time/business rule.
- The client does not submit `bondingLevel` or `stressLevel` target values.
- Bond/stress changes are computed from server-owned activity definitions and outcomes.
- Validate the active development window and prior state.
- Place the development update and associated activity record in one Prisma transaction. If either write fails, neither remains.
- Make replay/duplicate behavior explicit and safe.
- Update the frontend to submit the action/choice, not authoritative resulting state.

Do not stop at checking `currentDay` is 0–6 and bond/stress are 0–100; that leaves the vulnerability intact.

### Required proof

- A request attempting to jump directly to day 6 cannot alter authoritative day/state.
- A request containing chosen bond/stress values cannot overwrite server-owned values.
- Day and available activities come from server-owned time/state.
- The legitimate player interaction still works through the redesigned contract, or the retired UI cleanly uses the canonical replacement.
- Development and activity writes roll back together on a forced second-write failure if the retained path performs both.
- Graduation and display behavior remain coherent.
- Frontend tests assert the new command-shaped request rather than the old target-state payload.

---

## Transaction-invariant scope

The repository states that every player-state mutation belongs inside a Prisma transaction. The scan found that this invariant is not universally true. Do not turn this three-finding task into an unbounded repository-wide transaction refactor without owner approval.

For this patch, the invariant is mandatory for every touched flow:

- the production feed reset mutation should disappear or be isolated to non-production test infrastructure;
- conformation fee, escrow, entry, and relevant ledger writes must be one atomic transaction;
- conformation settlement/reward claim must be exactly once;
- retained foal development/activity writes must be one transaction.

One representative adjacent issue is `backend/modules/horses/models/foalModel.mjs` around scanned lines 396–421, where `FoalDevelopment` was updated and `FoalActivity` was then created separately. If the foal redesign retains and touches this path, correct both writes as one transaction and add rollback evidence. Do not sweep unrelated direct writes across messages, listings, or other modules into this patch unless the owner explicitly expands scope.

## Test and verification discipline

Use live package scripts as authority. During iteration, run only the smallest affected test file with:

```text
npm run test:backend:targeted -- <current-test-path>
```

Security controls require real middleware and a disposable test database. Name new module-resident control tests so they are selected by the current security gate (for example, use an applicable `Security`, `Ownership`, or `ServerAuthoritative` token), or update the gate's explicit inventory and its independent sentinel together if naming cannot express the test. Verify the current config before choosing.

After all three fixes are complete, run the applicable checks sequentially, never concurrently:

1. Each targeted regression/integration test.
2. Relevant competition, horse feeding, breeding, and frontend suites.
3. `npm --prefix backend run test:security`.
4. `npm run typecheck`.
5. `npm run lint`.
6. `bash scripts/doctrine-checks/run-all.sh`.
7. The final broader backend/frontend/E2E gate only if the completed candidate and live repository instructions call for it. Do not run expensive gates repeatedly during edits.

Before a heavy run, check whether another Equoria test/build is already active. Respect the two-worker ceiling. Never raise workers, heap, timeouts, or retries to force a pass. If interrupted, clean up only processes owned by this task and use the repository's current reaper/check procedure.

For attack-path verification, tests must assert side effects, not only status codes. Capture before/after database values for horse stats, inventory, pregnancy state, wallet, escrow, entries, results, titles, breeding-value boosts, foal development, and activity records as applicable.

## Prohibited shortcuts

Do not:

- make tests pass by weakening, deleting, skipping, renaming out of the security gate, or changing assertions to bless vulnerable behavior;
- mock Prisma, internal Equoria services, repositories, app state, or primary API routes in place of real integration evidence;
- rely on frontend hiding, client validation, obscurity, ownership alone, rate limiting alone, or a magic environment header;
- introduce a test-only branch into normal production mutation code and cite it as security proof;
- catch and ignore transaction, ledger, or reward errors;
- duplicate canonical show-entry or escrow logic;
- add broad abstractions, dependencies, hosted services, telemetry, or infrastructure;
- reformat unrelated files or include the owner's pre-existing changes in this patch;
- claim a repository-wide transaction invariant has been fixed unless it has actually been audited and proven repository-wide.

## Evidence required in Claude's final report

Provide one evidence block per finding with:

1. Finding title and severity.
2. The original attacker sequence, in one or two sentences.
3. The corrected server-owned invariant.
4. Exact production and test files changed, with relevant symbols/lines.
5. The negative regression test that proves the exploit now fails.
6. The positive test that proves legitimate gameplay still works.
7. Transaction/race evidence, including rollback and exactly-once behavior where applicable.
8. Commands run and exact pass/fail summaries.
9. Any residual risk or intentionally deferred adjacent issue.

Also include:

- final `git status --short`;
- confirmation that the three pre-existing user changes were preserved;
- confirmation that no dependency/service was added;
- any test or gate not run, with the honest reason—not a claim of completion.

## Definition of done

This task is complete only when all of the following are true:

- The feed timestamp reset is absent from production HTTP wiring, and same-day repeat feeding cannot duplicate permanent effects.
- Conformation entry charges the configured fee atomically, funds escrow consistently, enforces canonical eligibility/window rules, and resists duplicate/concurrent charging.
- A conformation show cannot settle before its authoritative due time, and concurrent settlement awards rewards exactly once.
- Foal development no longer trusts client-authored day/bond/stress state; the chosen retained-or-retired design is proven against real callers and UI behavior.
- Every player-state mutation touched by the patch is within an appropriate Prisma transaction.
- Negative exploit tests and positive gameplay tests pass through real code and the disposable database.
- Applicable security, type, lint, doctrine, module, and frontend checks pass, or a concrete external blocker is reported without papering it over.
- The final diff contains no unrelated changes and preserves the owner's existing dirty files.

“All tests green” is not sufficient by itself. Completion requires source evidence that the vulnerable trust boundaries, transaction boundaries, and race conditions are actually corrected.

## Suggested skills

Call these with the Skill tool if they are installed in the Claude Code environment; otherwise follow the equivalent workflow manually:

- `superpowers:writing-plans` — turn the three findings into a small, reviewable implementation plan before editing.
- `superpowers:test-driven-development` — capture each exploit as a failing real-path regression before the production change.
- `codex-security:fix-finding` — apply the security-finding remediation/evidence workflow, if available.
- `superpowers:systematic-debugging` — use only when a regression or existing test fails unexpectedly; form and test one falsifiable hypothesis at a time.
- `superpowers:verification-before-completion` — verify the final candidate and diff before making completion claims.

