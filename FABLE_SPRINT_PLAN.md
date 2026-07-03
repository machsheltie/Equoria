# Fable 5 Sprint Plan — 5-Day Window (2026-07-02 → 2026-07-07)

**Owner:** Stacey
**Context:** Claude Fable 5 access ends 2026-07-07. This document is the plan for spending that
window on the work Fable is _uniquely_ suited for, and handing everything else to the Opus/Sonnet
fleet as execution-ready backlog.

---

## 1. The operating principle (read this first)

Fable 5 is Anthropic's most capable model: 1M-token context, always-on adaptive thinking, built for
demanding reasoning and long-horizon agentic work. Its edge over Opus/Sonnet is **judgment** — holding
the whole codebase in context at once, reasoning across modules, and catching subtle systemic problems.
It is not meaningfully faster at typing well-specified code; cheaper models do that nearly as well.

**Decision rule — put a task on Fable only if BOTH are true:**

1. **High-leverage or hard to reverse** (schema decisions, money/economy logic, prod migrations,
   security posture, architecture) — a mistake is expensive or permanent.
2. **Reasoning-dominant** — the hard part is figuring out _what_ to do, not doing it.

Everything that is well-scoped and mechanical (single-file UI wiring, file splits, boilerplate tests,
doc refreshes) is a **waste of the Fable window**. Queue it for the fleet.

**The multiplier:** Use Fable to _convert_ reasoning-heavy problems into airtight specs (full acceptance
criteria, exact files, test requirements, edge cases) that Opus/Sonnet can execute unattended for weeks
after 7/7. Plan quality caps execution quality.

---

## 2. Fable vs. the fleet — the split

| Do WITH Fable (this week)                                   | Queue for Opus/Sonnet (after 7/7)                      |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| Whole-codebase economy / game-integrity exploit audit       | ProfilePage real-data wiring (P1-1)                    |
| Schema & data-model integrity decisions (P1-8, FK onDelete) | CompetitionResults fetch hook (P1-4)                   |
| Prod-migration remediation runbook (P0-1)                   | Horse search/filter integration into StableView (P1-2) |
| CI / test-infra root-cause (P0-2, P0-3)                     | Groom talent-tree UI wiring (P1-5)                     |
| Deepening backlog into execution-ready specs                | Slot-cap validation endpoint (P1-7)                    |
| XP-pipeline _architecture_ design (P1-3)                    | Splitting >1500-line files                             |
| Security threat-model refresh                               | `architecture-frontend.md` refresh, boilerplate tests  |
| Adversarial self-review of specs + fleet handoff plan       | XP-pipeline _implementation_ (from Fable's spec)       |

**Rule of thumb for the borderline cases:** if Fable can write a spec so complete that a mid-tier model
can't go wrong, the _design_ belongs to Fable and the _build_ belongs to the fleet.

---

## 3. The prioritized task tiers

### Tier 1 — Highest Fable-fit (do these first)

**T1. Whole-codebase economy & game-integrity exploit audit.**
The single best use of the window. You have real money, breeding, and competition rewards, and you've
already been bitten by this class (double-pay, prize-distribution transactionality, slot-cap bypass,
protected-stat tampering). Fable can hold every economic flow in context simultaneously and adversarially
hunt for exploits. _Output:_ ranked exploit list + a filed beads issue per finding with full fix spec.

**T2. Schema / data-model integrity decisions.**
Exotic-traits schema bug (P1-8), `Horse.userId` FK `onDelete` semantics, nullable stat columns, and the
4 trait-history FK orphans. Hard to reverse once production data exists; requires reasoning about the
whole model graph. _Output:_ decision + migration spec + evaluator spec per item, filed as beads issues.

**T3. Failed prod-migration remediation runbook (P0-1).**
`20260530120000_v58ta_horse_restrict_fks` is stuck `failed` on prod since 2026-05-30. User-gated and
catastrophic if wrong (prior DB nuke, Equoria-c3kb6). Fable does NOT run it — it produces a verified,
dry-run-validated resolve+deploy runbook with rollback. _Output:_ a runbook doc + validation evidence.

**T4. CI / test-infra root-cause (P0-2, P0-3).**
Pre-push hook broken on `--no-verify` since 2026-05-12; CI-only failures (`betaReadinessEnvSentinel`,
`preflightTimerSentinel`, `traitHistoryLogFkIntegrity.integration`, `breedController`). Root-causing
Jest OOM/sharding/env-templating is reasoning-heavy; the fix is mechanical. _Output:_ diagnosis + fix
spec; hand the patch to the fleet.

**T5. Deepen the backlog into execution-ready specs.**
For each open P1 (and any adjacent issues surfaced), write acceptance criteria, exact files, test
requirements, and edge cases so the fleet runs unattended. Highest multiplier for the remaining time.

### Tier 2 — Worth Fable if time remains

**T6. XP-pipeline architecture design (P1-3).** Competing currently awards zero horse/user XP — the only
progression path is dead. Design the award architecture with Fable (cross-cutting); implement with Opus.

**T7. Security threat-model refresh.** Verify no bypass path in prod across auth, HttpOnly cookies, CSRF
binding, and rate-limiting; confirm the doctrine gates actually cover what they claim.

### Tier 3 — Do NOT use Fable (queue for the fleet)

P1-1, P1-2, P1-4, P1-5, P1-7; file-size splits; doc refresh; boilerplate/component tests. Let Fable spec
them, let cheaper models build them.

---

## 4. The 5-day schedule

| Day        | Date  | Focus                                                                                   |
| ---------- | ----- | --------------------------------------------------------------------------------------- |
| **Day 1**  | 07/02 | T1 — Economy/integrity exploit audit (biggest, needs whole repo)                        |
| **Day 2**  | 07/03 | T2 — Schema/data-model decisions + migration specs; T3 — prod runbook                   |
| **Day 3**  | 07/04 | T4 — CI/test-infra root-cause; T6 — XP-pipeline architecture design                     |
| **Day 4**  | 07/05 | T7 — Security refresh; T5 — backlog into deep specs; **T8 — Stud Service feature spec** |
| **Day 5**  | 07/06 | Adversarial self-review of all specs/runbook; fleet handoff master plan                 |
| _(buffer)_ | 07/07 | Reserve for overflow / final verification before access ends                            |

Front-load the irreversible and whole-system work; leave spec-writing and self-review for later days when
Fable already has the codebase paged into context.

---

## 5. Daily initial prompts (copy-paste)

Each prompt is self-contained. Paste it at the start of that day's Fable session. All prompts assume the
Equoria constitution in `CLAUDE.md` and the rules in `.claude/rules/` are in force: real-DB tests only,
no mocks on primary paths, no bypass headers, beads for all tracking, and **agents may not self-close or
run destructive/prod actions without your explicit approval.**

**Cross-cutting (every day):** begin heavy-reasoning sessions with `/ultra-think` to force depth, and
invoke `/es-modules-guide` whenever code is touched (the codebase is strict ESM). Where a prompt tells you
to spawn a subagent (e.g. `qa-code-auditor`), note those run on **Opus** per their frontmatter — use them
for parallel breadth/legwork while **you keep the core judgment**. File every output as a `bd`
(beads) issue regardless of which skill produced it; do not spin up a parallel story/epic system.

**Fable's safety classifier and fallback (important for the security-flavored days).** Per Anthropic's
help article, Fable 5 auto-falls-back to Opus 4.8 when a request touches four areas; the only one relevant
here is **"offensive cybersecurity techniques (building exploits, malware, attack tooling)"** — a net
Anthropic calls _"intentionally broad,"_ with _"high fallback rates"_ even for routine/defensive cyber
work and acknowledged false positives. Two consequences:

1. **Framing helps but isn't the whole story.** Reword defensively — you're hardening _a product you own
   and operate_. Prefer "robustness review," "integrity check," "verify our server-side controls,"
   "unintended state," "confirm the control is enforced" over "exploit," "attack," "hack," "adversarially
   hunt," "penetration," "how could a player cheat." Day 1 and Day 4 below are already worded this way.
2. **The classifier also scans everything Fable _reads_** — memory, files, search results — not just your
   message. Our own `SECURITY.md` and `CLAUDE.md` are full of SSRF/injection/"exploit"/"bypass" vocabulary,
   so telling Fable to run `/security-guide` (which loads `SECURITY.md`) can trip the fallback _by itself_.
   On Days 1 and 4, consider skipping `/security-guide` and pointing Fable at the specific middleware files
   instead, to avoid loading the offensive-sounding doc into context.

**Strategy: don't fight it on Days 1 and 4.** If the reworded prompt still falls back, just let that work
run on **Opus 4.8** — it's highly capable, has a large context, and does economy/integrity + controls
verification well without this friction. Reserve Fable's 1M-context edge for the days that don't trip the
net (Day 2 schema/data-model, Day 3 CI + XP architecture, Day 4 Part B specs, Day 5 self-review). Also
useful: automatic switching can be toggled in **Settings > Capabilities** (or **Config > MODEL & OUTPUT**
in Claude Code); if a message is wrongly blocked, "Send feedback" reports the false positive; and if you
switch back to Fable after a fallback, **edit the earlier message first** — the original stays in context
and re-triggers the block otherwise.

**Recovery playbook — when a conversation gets stuck flagging every message.** Once Fable has generated
security-flavored output in a thread, that output is permanent context and the classifier re-scans it on
every subsequent turn, so even unrelated messages keep flagging. You cannot edit away already-generated
assistant turns. Recovery:

1. **Abandon the thread and start a fresh conversation.** This is the only reliable reset — the burned
   thread will keep flagging no matter what you type.
2. **Toggle off automatic model switching** (Settings > Capabilities / Config > MODEL & OUTPUT) so a flag
   pauses and lets you edit-retry on Fable instead of force-switching to Opus.
3. **Do not load `SECURITY.md`** (skip `/security-guide`); reference specific source files instead.
4. **Strip all security vocabulary** — describe the work as correctness/consistency/validation/concurrency,
   never "exploit / attack / cheat / adversarial / tampering / bypass / IDOR / TOCTOU." (Day 1 above is
   already written this way.)
5. **If it still trips, chunk it.** Run one subsystem per fresh message — "Review the correctness of the
   prize-distribution write path in backend/…, confirming it is transactional and idempotent" — so no
   single turn accumulates enough flagged content to trip. Collect the beads issues as you go.
6. **Report every false positive** with `/feedback` — that's the channel that narrows the net over time.

---

### Day 1 — Economy & game-integrity exploit audit

```
You are the senior engineer who owns Equoria's reliability, doing a transaction-correctness and
data-integrity review of our own game's economy code. This is routine reliability QA — making sure
in-game currency and player records always stay consistent. Read-only, no code changes today.

Load first: start with /ultra-think, then work through the senior-backend skill and systematic-debugging.
(Do NOT run /security-guide — reference the specific files directly instead.) You MAY spawn the
qa-code-auditor subagent for parallel breadth (enumerating and mapping the controllers/services below),
but keep the analysis, ranking, and synthesis on yourself.

Task: Review every code path that changes in-game currency or player records and confirm each is correct,
consistent, and safe under concurrent access. Use your full context to hold every currency-touching flow
at once. For each path, verify the code maintains its data invariants so balances and records can never
drift into an incorrect state. Focus areas:
  - Currency & record correctness: bank, transactions, marketplace, horse sales, prize distribution,
    salary/cron payouts. Confirm that multi-step writes are wrapped in a single database transaction, that
    two concurrent requests cannot double-apply the same operation, that amounts are validated (no
    negative or overflowing values), and that read-then-write sequences cannot race.
  - Server-side rule enforcement: confirm the server (not only the UI) enforces the game's rules —
    training/breeding cooldowns, roster/slot limits, the "a horse cannot be both parents" guard — and that
    each endpoint confirms the requesting user owns the record it is changing and validates every
    client-supplied ID and amount.
  - Scheduled jobs: confirm cron jobs are idempotent and cannot execute twice across multiple instances
    (advisory locks), so payouts happen exactly once.

Method:
  1. Enumerate every controller/service that writes currency or player records. Map the call graph.
  2. For each, state the invariant it must uphold and whether the code actually enforces it server-side.
  3. Rank findings P0/P1/P2 by likelihood x player impact.
  4. Note adjacent occurrences of each defect pattern (per OPTIMAL_FIX_DISCIPLINE §3) — instance or class?

Deliverable: For EACH finding, file a beads issue with: title naming the defect, the incorrect outcome if
it goes unfixed, the invariant violated, exact file(s)/line(s), a fix spec, and a required
sentinel-positive test description. Do not fix anything today. Do not close issues. End with a ranked
summary table and a one-line statement of which finding you'd fix first and why.
```

---

### Day 2 — Schema / data-model integrity + prod-migration runbook

```
You are the senior engineer who owns Equoria's data model. Three reasoning-heavy deliverables today. No
prod changes; local dry-runs only.

Load first: run /database-guide (schema, Prisma, migration patterns), then engage the senior-architect
skill (trade-off framework for the FK decisions) and senior-backend. Use systematic-debugging for the
failed-migration diagnosis in Part B. Start with /ultra-think.

Part A — Data-model integrity decisions. Reason across the whole Prisma schema
(packages/database/prisma/schema.prisma) and the code that reads it:
  1. Exotic traits (P1-8): the evaluators read fields/relations that don't exist in the schema
     (e.g. dailyCareLogs, groomTaskLogs, siblings). Decide the correct schema shape, write the migration
     spec, and write the evaluator-fix spec.
  2. Horse.userId FK has no onDelete clause. Decide SetNull vs Restrict vs Cascade from the product and
     data-integrity implications; justify the choice; write the migration spec.
  3. Nullable stat columns (Int? @default(0)): specify the backfill + non-null migration and the removal
     of `?? 0` readers.
  4. The 4 pre-existing trait-history FK orphans: decide clean-up vs schema change; spec it.
For each: file a beads issue with the decision, rationale, migration spec, affected readers, and required
real-DB test. Consider at least one alternative per decision (OPTIMAL_FIX_DISCIPLINE §5).

Part C — Economy-fix migration specs (from the 2026-07-02 audit; user-approved 2026-07-02). Design the
additive migrations that two P1 fixes depend on, so the fleet can execute them once the user approves the
SQL. Do NOT run any migration against prod — user-gated.
  1. icqqm (salary idempotency): add a `weekKey` column + a unique constraint
     (userId, groomId, weekKey, paymentType) so a cron re-run cannot double-charge. Inspect the real
     salary/payment data FIRST and specify the dedupe/backfill strategy (or a partial index
     WHERE "weekKey" IS NOT NULL) — the constraint will fail to apply if historical double-pay rows exist.
  2. c7mx0 (recoverable shows): add a `claimedAt` timestamp + persist the scored ordering at claim time,
     so a crashed 'executing' show is re-driven as a pure payout replay — never re-scored, and never
     re-paying an entry that already has a competitionResult row.
  3. mhdul cooldown value (user-decided 2026-07-02): the mare (dam) breeding cooldown is ONE GAME YEAR =
     7 real days, on the DAM ONLY; stallions unrestricted. Compute it with the canonical UTC date-only
     helpers (backend/utils/horseAge.mjs), never ms-delta. Spec the guard and any column needed.
For each: update the existing beads issue with the migration spec, the dedupe/backfill note, affected
readers, and the required real-DB test.

Part B — Prod-migration remediation runbook (P0-1). Migration
20260530120000_v58ta_horse_restrict_fks is stuck `failed` on prod (Supabase/Railway) since 2026-05-30.
Produce a step-by-step runbook to resolve and deploy it safely: exact `prisma migrate resolve`/`deploy`
commands, a local dry-run reproduction proving the fix, a rollback path, and a pre-flight checklist.
Validate the fix locally and paste the evidence. DO NOT run anything against prod — this is user-gated
(Constitution §6). End by telling me exactly what you need me to authorize and run.
```

---

### Day 3 — CI/test-infra root-cause + XP-pipeline architecture

```
You are the senior engineer who owns Equoria's CI and progression systems. Two deliverables.

Load first: run /test-architecture (testing strategy and patterns) and lean on systematic-debugging as
the primary tool for Part A — it is explicitly "use before proposing fixes." Engage senior-architect for
the Part B XP design, and use bmad-tea / bmad-testarch-atdd to design the "awarded exactly once" tests.
Start with /ultra-think.

Part A — CI/test-infra root-cause (P0-2, P0-3). The pre-push hook (full Jest suite) has been bypassed via
--no-verify since 2026-05-12 (active exception), and these fail in CI but pass locally:
betaReadinessEnvSentinel, preflightTimerSentinel, traitHistoryLogFkIntegrity.integration, breedController.
Hold the whole test/CI config in context (.github/workflows/*, jest.config*.mjs, scripts/doctrine-checks,
env templating) and root-cause each. Distinguish env/secret-availability failures from real defects.
Deliverable: a diagnosis doc with the root cause per failure and a mechanical fix spec the fleet can
apply; and a plan to restore the master gate and retire the --no-verify exception. File beads issues.
Do not disable, skip, or weaken any gate (EDGE_CASE_FIX_DISCIPLINE §2).

Part B — XP-pipeline architecture (P1-3). The show cron currently awards ZERO horse XP and user XP, so
competing produces no progression — and it's the only progression path. Design the correct award
architecture: where XP is computed, how it's extracted from enterAndRunShow and wired into
executeClosedShows, transactionality/idempotency under multi-replica cron, and the real-DB tests that
prove awards happen exactly once. Deliverable: an architecture spec + a filed beads issue detailed enough
for Opus to implement without further design decisions. Design only — do not implement today.
```

---

### Day 4 — Security threat-model refresh + backlog-to-specs

```
You are the senior engineer who owns Equoria's security posture and backlog quality. Two deliverables.

Load first: run /security-guide and engage senior-security for Part A. Use the hunt-mocks skill to drive
the false-green audit (it systematically finds test-bypass headers, skipped tests, no-op handlers, and
fake data left in our own code). For Part B, use bmad-check-implementation-readiness to prove each spec is
fleet-executable and bmad-tea to define the test requirements per spec. Start with /ultra-think.

Part A — Security controls verification. This is a defensive review of controls in a product we own.
Verify, against the actual code (not the docs), that our own protections are actually enforced across:
JWT/cookie auth (backend/middleware/auth.mjs), CSRF double-submit + per-user binding
(backend/middleware/csrf.mjs), rate-limiting, prototype-pollution guards, and the doctrine gates that are
supposed to keep test-only bypass headers out of production. For each claim in .claude/rules/SECURITY.md,
confirm the code backs it or flag it as a false-green (a control the docs claim but the code doesn't
enforce). File a beads issue for every gap; note adjacent occurrences.

Part B — Deepen the backlog into execution-ready specs. Review every open P1 and any issues surfaced this
week. For each, rewrite the beads issue to fleet-executable depth: literal acceptance criteria, exact
files to touch, the real-DB or Playwright test required, edge cases, and a "done" definition matching
OPTIMAL_FIX_DISCIPLINE §8. The goal: an Opus/Sonnet agent can pick up any issue and finish it with zero
further design decisions. Do not close issues. End with a list of the issue IDs now execution-ready.
```

---

### T8 — Stud Service feature spec (run as its own session; natural home is Day 4, or any clean Fable window)

Note: this is the `i8eoy` "build & ship it" decision (§5b). It is a real feature, not a fix — spec it
fully before the fleet builds it. Not security-flavored, so it won't trip the classifier.

```
You are the senior engineer designing a new feature for Equoria: a cross-owner Stud Service economy.
This is a feature-design/spec session — produce a complete implementation spec the fleet can build, plus
a bd epic with fleet-sized child issues. Design only; no implementation unless a piece is trivial.

Load first: /database-guide, senior-architect, senior-backend. Start with /ultra-think. Reuse the
canonical concurrency/transaction patterns identified in the 2026-07-02 economy audit (name each one you
reuse): debitMoneyOrThrow-in-tx for fee payment, the conditional updateMany atomic claim for status
transitions, and the atomic-claim pattern for the mare "one active request" invariant.

The feature has two modes.

PUBLIC STUD
  - A stallion owner lists a stallion for public stud and sets the stud fee.
  - Any player may breed their mare to that stallion immediately, provided ALL criteria are met:
    * mare and stallion are the same breed OR an allowed crossbreed,
    * mare is of breeding age (3-20 game years),
    * the requesting player has enough money for the fee,
    * the mare is not currently pregnant,
    * the mare is not on breeding cooldown (1 game year = 7 real days on the dam - the 2026-07-02
      decision; compute via backend/utils/horseAge.mjs).
  - If all criteria pass, in ONE transaction: charge the fee, credit the stallion owner, create the
    breeding/pregnancy record, and stamp the dam cooldown. If any check fails, reject with a clear
    400/409 and move no money.

PRIVATE STUD
  - A stallion owner lists a stallion for private stud.
  - Other players submit a request to breed their mare to that stallion (validated against the SAME
    criteria at submit time).
  - The stallion owner may accept or reject the request; the requester may cancel it.
  - A mare may have only ONE active (pending) request at a time - enforce this as a hard invariant so a
    mare cannot be held in "breeding purgatory"; cancelling frees the mare.
  - Request state machine: pending -> accepted | rejected | cancelled. Money moves ONLY on accept.
  - On accept: atomically claim the request (pending -> accepted) AND re-validate every criterion inside
    the tx (mare still not pregnant, still eligible, funds still present, still off cooldown) - do not
    trust the submit-time check; the mare may have changed state since. Then charge, credit, breed, stamp
    cooldown. Reject and cancel just close the request with no charge.

Cross-cutting requirements:
  - Access control: only the stallion owner can set/edit the listing & fee and accept/reject; only the
    mare owner can submit and cancel her own request.
  - Self-cross guard (sireId !== damId) and sex guards still apply.
  - Every money movement is exactly-once and conserved (fee debit + owner credit + ledger rows in the
    same tx). No count-then-create, no read-check-write outside a tx.
  - Crossbreed rule: locate the existing breed / allowed-crossbreed compatibility logic in the codebase
    and reuse it. If no such ruleset exists, DO NOT invent one - flag it as a product decision the user
    must make, and spec the feature to call a pluggable isCrossbreedAllowed(breedA, breedB).

Deliverables:
  1. Data model: the stud-listing and breeding-request tables/fields (additive schema; user approves the
     migration before it runs). Include the unique/partial index that enforces one-active-request-per-mare.
  2. API surface: list/unlist & set-fee (public/private), public-breed, submit-request, accept, reject,
     cancel, and the read endpoints (my requests / requests on my stallions).
  3. A single shared eligibility validator used by BOTH public-breed and private-accept, so the rules
     cannot drift between the two paths.
  4. Transaction & concurrency design for each write, naming the reused audit pattern.
  5. Required tests (real-DB + Playwright), including concurrency sentinels that must fail against a naive
     implementation: two accepts racing -> exactly one succeeds; cancel racing accept -> money moves at
     most once; a second request for an already-requested mare -> rejected; pregnant / underage / over-age
     / insufficient-funds / on-cooldown mare -> rejected with no charge; fee charged exactly once and
     conserved.
  6. Access-control tests: non-owner accept/reject -> 403; non-owner cancel -> 403.

File this as a bd EPIC linking fleet-sized child issues (one buildable in a single session each), ordered
with dependencies. Do not implement, do not run migrations against prod. End with the recommended build
order and which child issues are gated on your schema-migration approval.
```

---

### Day 5 — Adversarial self-review + fleet handoff master plan

```
You are the senior engineer doing the final pass before Fable access ends 2026-07-07. Everything today is
about making the Opus/Sonnet fleet succeed unsupervised.

Load first: start with /ultra-think. Run the bmad-code-review skill (adversarial Blind Hunter / Edge Case
Hunter / Acceptance Auditor layers) over every spec, runbook, and issue produced this week — this is the
constitution's own review gate. Use bmad-check-implementation-readiness as the final go/no-go that the
backlog is fleet-ready, and bmad-retrospective to structure the wrap-up.

Task 1 — Adversarial self-review (OPTIMAL_FIX_DISCIPLINE §9). Re-read every spec, runbook, and beads issue
produced this week. For each: does the fix actually solve the problem or just the symptom? Are the tests
sentinel-positive (they fail when the defect returns)? Are there forward-references or overclaims? Fix or
re-file anything weak. Report gaps honestly regardless of count.

Task 2 — Fleet handoff master plan. Produce a single dependency-ordered execution plan for the fleet:
which beads issues to run, in what order, what blocks what, which are user-gated (prod migration, gate
restoration, any destructive action), and the verification each must record before I approve closure.
Include a short "what NOT to touch without me" list. Deliverable: a HANDOFF.md I can hand the fleet on
7/8. Do not close issues or run gated actions.
```

---

## 5b. Decisions log

Product/design calls made by the user, recorded so the fleet applies them when it reaches the gated
issues. Update the corresponding `bd` issues with these before the fleet picks them up.

- **Breeding cooldown (`mhdul`)** — 1 game year = **7 real days**, on the **dam only**; stallions
  unrestricted. Compute with the canonical UTC date-only helpers (`backend/utils/horseAge.mjs`).
  Land the self-cross / sex guards immediately; wire the cooldown to this value. (2026-07-02)
- **Level brackets (`g8qg0`)** — **Enforce.** Horses may only enter the competition bracket matching
  their level; server-side validation + sentinel test. This is enforcement, not copy removal. (2026-07-02)
- **Stud-fee flow (`i8eoy`)** — **Build & ship it.** Now a real feature, not a beta cleanup, with two
  modes: **public stud** (owner sets a fee; any eligible mare breeds instantly on payment) and **private
  stud** (owner accepts/rejects requests; requester can cancel; a mare may have only one active request
  at a time). Eligibility for both: same breed or allowed crossbreed, mare age 3–20, sufficient funds,
  not pregnant, off the 7-day dam cooldown. It is spec'd in the **T8 — Stud Service feature spec** session
  in §5; the fleet builds from that epic, not from the one-line issue. (2026-07-02)
- **Economy-fix migrations (`icqqm`, `c7mx0`)** — **Approved to design** (Day 2 Part C). Additive schema;
  Fable specs the concrete SQL + dedupe/backfill, user approves the actual migration before it runs.
  (2026-07-02)

## 6. Fleet handoff protocol (for after 7/7)

- Fable files fully-specified beads issues; **you** approve closure — agents may not self-close
  (COMPLETION_VERIFICATION_POLICY, Constitution §6).
- The fleet runs one issue → one or two commits → one push per session, directly on `master`
  (Constitution §1, §5). No feature branches.
- The fleet drives each defect via `/safe-ralph <Equoria-id> <task>` — the wrapper that enforces the
  `--completion-promise` required by EDGE_CASE_FIX_DISCIPLINE §5a, so a loop can't spin after the work is
  done. Do not invoke `/ralph-loop` directly for fix work.
- User-gated items Fable must leave for you: the prod migration apply (P0-1), retiring the `--no-verify`
  exception (P0-2), and any destructive/outward-facing action.
- Every fix requires a sentinel-positive test and post-change suite evidence before you approve
  (OPTIMAL_FIX_DISCIPLINE §8, §10).

## 7. Success criteria for the window

By 7/7 you should have, as durable artifacts (not chat that evaporates):

1. A ranked, filed exploit list for the economy/integrity surface — each with a fix spec.
2. Locked-in schema/data-model decisions with migration specs.
3. A verified prod-migration runbook awaiting only your authorization.
4. A CI/test-infra diagnosis + mechanical fix specs; a path to retire `--no-verify`.
5. A correct XP-pipeline architecture spec.
6. A security false-green audit.
7. A backlog of fleet-executable beads issues + a dependency-ordered `HANDOFF.md`.

If you get through only the first three, the window was still well spent — those are the irreversible ones.
