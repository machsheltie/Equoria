# Fable Round 3 — Fleet Hand-off Prompts (Day 3 outputs: master-gate restoration + XP award, 2026-07-06)

Companion to `FABLE_SPRINT_PLAN.md`, `FABLE_ROUND1_FLEET_PROMPTS.md`, `FABLE_ROUND2_AUDIT_FLEET_PROMPTS.md`,
and governed by `FABLE_MASTER_SEQUENCE.md`. Covers the concrete fleet work that came out of Fable's Day 3
session (CI/master-gate diagnosis + XP-award architecture).

## What's in this round

| #   | Issue           | What                                                                                                        | Model       | Status                                                                                                           |
| --- | --------------- | ----------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Equoria-3ewqy   | Stale retryableTransactionWrapping sentinel pin (count 1→2)                                                 | Sonnet high | Ready — parallel-safe; unblocks P0-2. **THE ONLY remaining fleet blocker for the gate.**                         |
| 2   | Equoria-ip8kk   | Security Jest config `.js`-strip → env self-import TDZ                                                      | —           | ✅ LANDED 2026-07-06 (commit 73ca57f0b) and CLOSED. Do NOT dispatch.                                             |
| 3   | Equoria-oey96.4 | Overnight-show XP/stat award (full spec on issue)                                                           | Opus xhigh  | ⚠ Lane A — prereqs jvi3u/geo1a/wsj2i ALL LANDED (bd deps green); runnable after the showController money cluster |
| 4   | Equoria-xal4m   | Cron never updates Horse.totalEarnings (Hall of Fame)                                                       | Opus xhigh  | ⚠ Lane A — right after .4 (bd dep wired)                                                                         |
| 5   | Equoria-4maxb   | P1 FIX: `\|\| 50`/`\|\| 100` zero-corruption on Horse stat columns + its behavioral sentinel (parked draft) | Opus xhigh  | Ready — but it is a FIX issue, not cleanup; see rewritten #5 below                                               |

**P0-2 (yours, not a fleet prompt):** `ip8kk` has landed; once `3ewqy` lands and the Quality + Security
gates go green, the master-gate diagnosis steps 4–7 (two consecutive green CI runs, three green local
authoritative runs on a frozen HEAD, the fefh2.20 WS5 checklist, a timed pre-push hook execution) must
complete BEFORE **you** execute the exception-removal (steps 8–9 of
`docs/debugging-reports/2026-07-06-master-gate-diagnosis.md`, Principle 6). Steps 4–7 are lead-agent work —
schedule them; the first green gate alone does NOT satisfy the removal condition. Treat the first
green-gate run as a **triage run** — Coverage/E2E/Docker/Beta/Deploy were starved ~3 weeks, so expect
backlog failures surfacing, not necessarily new regressions. To attribute a red downstream gate: first
reproduce the failure at the pre-fleet baseline HEAD (e3373193b or the current pre-restoration tip) before
blaming any fleet commit. During steps 4–5 (the consecutive-green window) HOLD all other fleet pushes —
an interleaved `--no-verify` landing resets the count.

## Tooling available (reviewed 2026-07-06)

- **Skills to lace in:** `senior-backend`, `systematic-debugging`, `bmad-tea` (ATDD tests), and
  `/test-architecture` are the relevant ones for this round. (`hunt-mocks`, `senior-frontend`,
  `senior-security`, `playwright-e2e-tester` aren't needed here.)
- **Agents:** `qa-code-auditor` if you want an independent read on the XP-award diff before closure.
- **Hooks (automatic — the agent should heed them):** `post-edit-lint.sh` + `post-edit-test.sh` run after
  every edit, `preCommit` runs `npm run lint` + `type-check`, and the pre-push doctrine suite
  (`scripts/doctrine-checks/*`) must pass. Do not weaken any of them to get green.
- **Plugins:** none installed at project level.

## GLOBAL INJECT TEMPLATE (applies to every issue below)

```
Read the issue with bd show <id> first (and for oey96.4, also docs/architecture/show-xp-award-architecture.md
and AUDIT_EXECUTION_PROTOCOL.md — its AC requires the protocol). You inherit CLAUDE.md, so: checkout master,
pull --rebase, bd update <id> --status=in_progress; SENTINEL/ATDD TEST FIRST — write it, run it, confirm it
FAILS against current code, paste the failure — THEN fix; real DB, no mocks, scoped cleanup; RE-RUN the
suite after and paste passing output; §9 self-critique; do NOT self-close — post evidence and STOP for my
approval. The post-edit lint/test hooks fire automatically — heed their output, don't fight them. Push only
after `bash scripts/doctrine-checks/run-all.sh` exits 0, via `git push origin master --no-verify`.
```

---

## 1 — Equoria-3ewqy — stale sentinel pin — Sonnet high — parallel-safe — DO FIRST

```
/safe-ralph Equoria-3ewqy correct the retryableTransactionWrapping sentinel's pinned count for the 2nd groomMarketplaceController $transaction; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, id=Equoria-3ewqy]
Lace in: /test-architecture. Fable already root-caused it: commit 28d01bfbc added a correctly-wrapped 2nd
$transaction to groomMarketplaceController.mjs but never bumped the sentinel's pinned count. Fix: update the
pin {wrapped: 1, totalTx: 1} → {wrapped: 2, totalTx: 2}.
DO NOT WEAKEN the sentinel (EDGE_CASE §2): it must be the exact new count, not a removed/loosened check.
Verify it still FIRES on a planted unwrapped transaction and passes on the current (correct) code. It fails
locally in ~0.4s today — confirm that, then confirm green after the bump.
Parallel: safe (own sentinel file).
```

---

## 2 — Equoria-ip8kk — ✅ LANDED 2026-07-06 — do NOT dispatch

```
RESOLVED: the one-line js-first fix landed as commit 73ca57f0b and the issue is CLOSED. No fleet work
remains here. If the Security Gate is still red after 3ewqy lands, that is a NEW failure — file a new
issue with the master-gate diagnosis evidence discipline; do not reopen this one.
```

---

## 3 — Equoria-oey96.4 — overnight-show XP/stat award — Opus xhigh — ⚠ Lane A, AFTER jvi3u + geo1a

```
⚠ PREREQ STATE (verified 2026-07-06): jvi3u/geo1a/wsj2i are ALL LANDED and CLOSED. jvi3u shipped
addXpToUserCore(db,...) (userModelService.mjs:253, exported via the users barrel). addXpToHorseCore does
NOT exist yet — geo1a landed as an inline $transaction. Extracting that callback into
addXpToHorseCore(db,...) is THIS ISSUE'S first implementation step per the architecture doc §4.2 (public
fn becomes a thin wrapper, contract unchanged) — do NOT file a follow-up for it and do NOT nest a
transaction (self-deadlock on the row lock the prize payout holds). Run in Lane A after the showController
money cluster.
```

```
/safe-ralph Equoria-oey96.4 award horse+user XP and stat gains in the overnight-show executor tx, exactly-once, per the architecture spec; ATDD tests fail-first then pass; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, id=Equoria-oey96.4]
Read docs/architecture/show-xp-award-architecture.md and the decision set posted on the issue — implement
to that spec, no new decisions. Lace in: senior-backend + bmad-tea (ATDD, red-first) + systematic-debugging.
Key spec points (already resolved):
- Call the TX-AWARE CORES (addXpToHorseCore(db,...) / addXpToUserCore(db,...)) INSIDE the executor's
  per-entry $transaction — never the public wrappers (they open their own tx → deadlock).
- Idempotency/exactly-once: keep competitionResult.create as the FIRST write so the [showId, horseId]
  unique constraint is the idempotency token (duplicate processing P2002-aborts before any XP statement);
  the atomic show claim is the multi-replica mutex.
- Constants (PRD-03 §2.1, agree with legacy): horse XP 30/27/25, user XP 20/15/10, stat gain 10/5/3%,
  plus 20 participation XP for 4th+ (PRD adds this; follow the PRD).
- Tests: awards-happen (fails on master with deltas=0), exactly-once (two concurrent executor calls),
  atomicity (planted P2002), deterministic stat-gain via calculateStatGains' existing _rngFn seam.
⚠ SERIAL LANE A (showController). Runs after the Round 1 showController money cluster and the XP writers;
before .11. Never concurrent with another showController issue.
VERIFIED (2026-07-06, tree check): geo1a landed WITHOUT the core — addXpToHorseCore does not exist on the
tree. Per the architecture doc §4.2 the extraction IS this issue's work: extract geo1a's inline
$transaction callback into addXpToHorseCore(db,...), keep the public addXpToHorse as a thin wrapper, then
call the core inside the executor tx. Never nest a transaction. Also extract the award logic into
competitionAwards.mjs HERE — 709qm retires enterAndRunShow and must land AFTER this (bd dep wired).
```

---

## 4 — Equoria-xal4m — cron totalEarnings for Hall of Fame — Opus xhigh — ⚠ Lane A, right after .4

```
/safe-ralph Equoria-xal4m update Horse.totalEarnings in the overnight-show executor tx so Hall-of-Fame earnings accrue; sentinel fails-first then passes; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, id=Equoria-xal4m]
Lace in: senior-backend. The cron executor never updates Horse.totalEarnings, so Hall-of-Fame earnings
starve for every post-410 result. Add the totalEarnings increment INSIDE the same executor $transaction as
the prize payout (same idempotency guarantees as .4 — increment must ride the same claim/unique backstop so
a re-drive can't double-count).
⚠ SERIAL LANE A — same cron/file as .4; land immediately after .4, same agent.
Sentinel that must fail first: run the executor over a seeded winning result → the horse's totalEarnings
rises by the prize exactly once; a second executor run does not double it.
```

---

## 5 — Equoria-4maxb — P1 FIX: zero-corrupting bare defaults + behavioral sentinel — Opus xhigh

```
/safe-ralph Equoria-4maxb strip the Class-1 || 50/|| 100 bare-default guards on NOT NULL Horse stat columns and land the bareDefaultGuardZeroCorruption behavioral sentinel red-then-green; evidence on the issue; awaiting my closure
```

```
[GLOBAL INJECT TEMPLATE, id=Equoria-4maxb]
Lace in: senior-backend + /test-architecture. SCOPE CORRECTION (2026-07-06 review): this is a P1 FIX
issue, not a cleanup. The issue body carries the full Class-1 vs Class-2 site taxonomy — read it; Class-2
sites (deliberate bareDefaultGuard-campaign guards, || 0 counters, horse.age) must NOT be touched.
The ~95%-complete draft of backend/__tests__/bareDefaultGuardZeroCorruption.sentinel.test.mjs
(docs/audits/4maxb-parked-draft.mjs.txt + verbatim in the bd notes; 3 stripped literals at lines 20/38/39:
name:/email:/username:) is a BEHAVIORAL red test — it drives discoverTraitsForHorse with a stressLevel=0
horse and CANNOT pass until the Class-1 sites are fixed. Sequence per the issue's own test plan:
  1. Restore the draft, re-home into backend/__tests__/, run it, paste the RED output (fails today —
     stress 0 reads as 100, bond 0 reads as 50).
  2. Fix the Class-1 sites (one commit per module cluster per Constitution §5; file child issues if it
     balloons past ~2 commits).
  3. Re-run — paste GREEN. Then extend the grep-based bareDefaultGuard sentinel pattern to the Class-1
     files (sentinel-positive: prove it FIRES on a planted || 50 violation).
Do NOT weaken the behavioral test to make it pass on unfixed code (EDGE_CASE §2). Confirm the doctrine
suite passes (bash scripts/doctrine-checks/run-all.sh exit 0 — the check count drifts; exit code is the
gate, not a number) with the sentinel in place.
Parallel: safe until step 2 (the fixes touch traits/grooms/horses/breeding modules — check for lane
overlap before starting step 2 if other agents are live in those modules).
```

---

## Where this slots in the master sequence

- `3ewqy` → Wave 0 (master-gate restoration). Run first, parallel-safe. `ip8kk` already landed. Then the
  diagnosis steps 4–7 (lead), then YOU retire the exception (steps 8–9).
- `oey96.4` → Serial Lane A, after the showController money cluster (XP-writer prereqs all landed);
  before `.11`.
- `xal4m` → Serial Lane A, right after `.4` (bd dep wired).
- `4maxb` → its sentinel restore is parallel-safe; its Class-1 fixes touch traits/grooms/horses/breeding —
  coordinate with any live lane in those modules.

See `HANDOFF.md` for the canonical cross-epic order and the no-parallel-push rule.
