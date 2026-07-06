# HANDOFF.md — Fleet Execution Plan (effective 2026-07-08)

**Written:** 2026-07-06 (Fable Day 5, after the adversarial self-review pass)
**Audience:** the Opus/Sonnet fleet lead + agents, and the user (your action queue is §3).
**Authority order when documents disagree:** live `bd show <id>` (incl. dated notes) → this file →
`FABLE_ROUND1..5_*.md` (prompt libraries) → `FABLE_MASTER_SEQUENCE.md` (rationale only, superseded).
The Day-5 review found the coordination docs had drifted from bd/git reality; all were reconciled
2026-07-06 evening, but only **this file** and `bd` will be maintained going forward.

**bd tip:** plain `bd list` truncates at 50 issues. Use `bd list --limit 200`, `bd ready`, or
per-epic listing (`bd list --parent Equoria-oey96`). `bd ready` respects the `blocks` deps wired
2026-07-06 — but the user-gate and decision-gate markers live in issue text, so **read the full
issue before claiming it**.

---

## 1. The fleet contract (non-negotiable, every session)

1. **Session shape:** `git checkout master && git pull --rebase origin master` → `bd show <id>` →
   `bd update <id> --status=in_progress` (or `--claim`). One issue → 1–2 commits → one push →
   STOP for user closure. Never two `git push` in parallel; the lead serializes all landings.
2. **Sentinel first:** failing test before fix, raw red output pasted on the issue, then green
   pasted. Doc-only issues: the before/after grep is the evidence (protocol carve-out, 2026-07-06).
3. **Pin maintenance:** any commit that adds/moves a `prisma.$transaction` site updates
   `retryableTransactionWrapping.sentinel` pins in the same commit and runs that sentinel locally
   before push. This exact omission (28d01bfbc) kept master red for 3 days.
4. **Line-drift carve-out:** cited lines moved but the defect is intact → append corrected
   citations and continue. Defect gone or mechanism changed → STOP, report, do not improvise.
5. **Migrations:** "approved" = the _design_. The executing agent posts the concrete SQL +
   backfill on the issue and STOPS for the user's review **before the first run against the
   canonical DB** — the local dev DB IS real player data (c3kb6). All migrations go through the
   single Migration Lane (§4.5); never two migration-generating agents at once.
6. **Push:** `bash scripts/doctrine-checks/run-all.sh` → exit 0 → `git push origin master
--no-verify` (active exception). Exception removal is the user's, at the end of §2.
7. **No self-close, no gate weakening, no skips/bypasses/mocks** — CLAUDE.md constitution +
   `docs/audits/AUDIT_EXECUTION_PROTOCOL.md` govern every issue.
8. **Quiescence window:** while the lead is collecting the two-consecutive-green CI runs and the
   3× local authoritative runs (§2 steps 4–5), **no other fleet pushes land.**

**Already in progress (do NOT cold-claim):** `gumnp` (claimed 2026-07-06 by another session),
`av27e` (sweep complete — resume to append findings + request closure), `fefh2.15`, `fefh2.43`
(both mid-flight, dep-wired), `oey96.1` + `oey96.5` (work landed, awaiting user closure).

---

## 2. Wave 0 — master-gate restoration (run FIRST, everything benefits)

Reference runbook: `docs/debugging-reports/2026-07-06-master-gate-diagnosis.md`.

| Step | Owner               | Action                                                                                                                                                                                                                                                                                              |
| ---- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | fleet (Sonnet high) | **`Equoria-3ewqy`** — one-line sentinel pin bump (Round 3 #1). The ONLY remaining fleet blocker; `ip8kk` already landed (73ca57f0b).                                                                                                                                                                |
| 2    | lead                | Observe the next Quality Gate run. Expect Shards 1–3 + Security Gate green; Coverage/E2E/Docker/Beta/Deploy execute for the first time in ~3 weeks. **Triage run:** anything red there = new bd issue; attribute by first reproducing at the pre-fleet baseline HEAD before blaming a fleet commit. |
| 3    | lead                | Two consecutive green Quality Gate runs on master (fefh2.43 AC). Post raw run links on `fefh2.43` + `fefh2.15`. **Fleet pushes HELD during this window.**                                                                                                                                           |
| 4    | lead                | Three consecutive green `npm run test:backend:full` runs on the frozen post-fix HEAD (fefh2.15 exit criterion).                                                                                                                                                                                     |
| 5    | lead                | Execute the `fefh2.20` WS5 checklist in order (doctrine suite; lint+format; fresh-DB replay; full backend suite; frontend Vitest; Playwright readiness; Evidence Verification; CodeQL+ZAP; full CI green with Deployment-Gate jobs EXECUTED).                                                       |
| 6    | lead                | Verify + time `.husky/pre-push` end-to-end locally.                                                                                                                                                                                                                                                 |
| 7    | **USER**            | Close `fefh2.15`/`fefh2.43` on the evidence; remove the `--no-verify` active-exception block from CLAUDE.md (steps 8–9 of the runbook). Agents may not do this.                                                                                                                                     |
| 8    | **USER**            | P0-4: re-run beta readiness + re-sign-off (`oey96.1` closure) — only after step 7.                                                                                                                                                                                                                  |

> **P0-1 is a phantom — do not act on older docs.** The v58ta prod migration was repaired
> 2026-06-16 (fefh2.14). Running `migrate resolve --rolled-back` + `deploy` against prod now would
> be destructive. Remaining: a READ-ONLY `railway run … prisma migrate status` confirmation
> (user), and the doc corrections (`Equoria-45222`, fleet-runnable any time).

---

## 3. USER action queue (nothing here is agent-executable)

**Verify-and-close (evidence already on the issues):**

- `oey96.5` (landed d90f50c24) and its sibling `wt42i` (same defect; validation note offers close
  paths — the follow-up E2E is `dyoyi`, onRetry wire-up noted)
- `ys186` (keep-vs-close; premise superseded by the oey96.5 endpoint — note on issue)
- `49dzc`, `pey97`, `xbir9` (SECURITY.md content already documented — stale no-ops)
- `oey96.54` **or** `r4cyk` (duplicates — recommend keeping r4cyk; close .54)
- `a2xce` (subset of 8sag0's tack leg — close when 8sag0's tack child lands)
- `rgjdd` (empty shell — Vite portion landed; close or re-scope)
- `oey96.1` (invalidation landed 511f4e10f — close after §2 step 8)

**Decisions to make (each has options prepared on the issue):**

- `oey96.7` — trainer-modifier FORMULA sign-off (implement decision already made)
- `oey96.8` — roster-cap SCALING CURVE sign-off (scaled-by-stable-level decided; curve + source open)
- `oey96.9` — ratify the exotic-trigger condition mapping (NO schema change — mapping is on the issue)
- `oey96.11` vs `ek242` — pick the canonical scorer engine; close/re-scope the loser
- `oey96.37` — labs exposure per cluster (`20o40`'s delete-path premise is FALSE; .37 is canonical)
- `oey96.23` (task panel), `oey96.34` (conflict resolution), `oey96.49` (rider-discovery stub)
- `g8qg0` — one-line pin of the level→bracket mapping
- `cpu7v` — stud crossbreed allow-list + stallion max-age (blocks `3sfys`; beta ships fail-closed regardless)
- `dzit3` / `mwi6k` / `xb9oc` / `njfwa` — security-posture calls (fail-open/closed, MFA lockout store,
  prod CORS list, public-API deprecation)
- `2nacc` (max-age policy 20 vs 21 + enforce-vs-fix-PRDs), `smqn7` (XP curve 100 vs 200)
- `f46tb` — pinned to Option B for the fleet; re-open Option A only if you want the Int migration
- `oey96.40` / `oey96.56` / `oey96.62` / `oey96.60` — micro-decisions flagged on-issue

**SQL reviews (agent posts SQL on the issue, you approve before first canonical-DB run):**
`e7tgc.1` → `icqqm` → `c7mx0` → `6lobd` (order matches lane need; `lffdv`/`zmb8k` queue behind).

---

## 4. Fleet lanes (dependency-ordered; deps are wired in bd)

### 4.1 Lane A — money/show (`showController.mjs` + friends) — ONE agent, Opus xhigh

```
8sag0 (fix one controller; FILE per-controller children for the rest)
→ 8pb6w → c7mx0(SQL gate) → 3k96w → g8qg0(after formula pin)
→ oey96.45 → oey96.4 (extracts competitionAwards.mjs + addXpToHorseCore — its OWN first step)
→ xal4m → 709qm → oey96.14 → wmwbr (settlement-skip; Test C caveat in arch-doc §9)
→ oey96.11 (after user picks engine)
icqqm (own file — slot anywhere in this agent's run, after its SQL gate)
```

Prompts: `FABLE_ROUND1_FLEET_PROMPTS.md` (statuses refreshed 2026-07-06) + Round 2/3 blocks.

### 4.2 Lane B — roster/staff — one agent (may be the Lane A agent afterwards)

```
oey96.8 (after curve sign-off) → oey96.24 (retired-staff) → oey96.25 (same controllers) → oey96.68 (needs .8 + .26; .26 decision now recorded)
```

### 4.3 Lane C — SECURITY.md (one agent, serial)

```
oey96.15 (code fix, unblocks .30's A04 rewrite — dep wired)
→ 3giol → wvf0z → nzhu8 (re-locate drifted citation) → 7rc1q → mi64z → oey96.61
→ oey96.30 (REMOVE gameIntegrity + absorbed d0qur scope incl. 30d→7d cooldown text + sentinel)
→ hjnrc (REMOVE dead detector/Sentry pipeline)
→ av27e (resume-and-finish)
```

### 4.4 auditLog mini-lane (one agent, serial — same files)

```
xbabf → 2ghng → hjnrc(if not already done in Lane C — coordinate!) → oierg
```

`hjnrc` sits in BOTH lanes because it deletes from `auditLog.mjs` (mini-lane) and edits SECURITY.md
(Lane C). Simplest: the Lane C agent executes it, and the mini-lane runs `xbabf → 2ghng → oierg`
AFTER hjnrc lands.

### 4.5 Migration Lane (one agent at a time, strictly serial, SQL gate each)

```
e7tgc.1 → icqqm → c7mx0 → 6lobd → (later: lffdv, zmb8k, oey96.14's enum, oey96.28's viewedAt if approved)
```

### 4.6 Stud Service lane — epic `Equoria-e7tgc` (one agent; Round 5 doc, corrected 2026-07-06)

```
S1(.1, migration lane) → S3(.3) + S4(.4) + S2(.2) in parallel → S5(.5) → S6(.6) → S7(.7) → S8(.8)
→ S9(.9) + S10(.10) parallel → S11(.11)
```

Public-stud fast path (no S1): S2/S3/S4/S5/S9. Note the 2026-07-06 spec corrections on the issues:
foalBreedId existence guard (S4/S5/S6), GDPR-anonymize cascade (S6), C3 proof carve-out (no
index-dropping), C6 clarified scenario.

### 4.7 Parallel fan-out pool (agent team, own worktrees, lead lands serially)

- `oey96.2` (backend /progress extension per the issue's design decision), `oey96.3`,
  `oey96.6 → .20 → .21 → .22` (groom chain — serialized internally), `oey96.12 → .13`,
  `oey96.27`, `oey96.28`, `oey96.29`, `oey96.10` (a11y), `4maxb` (Round 3 #5 rewrite — sentinel
  restore is parallel-safe; Class-1 fixes coordinate with live lanes), `49bc2`, `4hra5`, `m54lr`,
  `r4cyk` (after the .54 dup close), `oey96.32 → .33` (shared file), `oey96.41`, `oey96.47 → .48`,
  `oey96.50`, `oey96.51`, `oey96.52`, `oey96.53` (after .29), `oey96.55`–`.58`, the P3
  doc-reconciliation batch (`45222`, `oey96.38/.39/.59/.63/.65/.66/.67`, `u6ipz`, `caqrq`),
  `wj4rt` P3 singles (`2je95`, `4yocc`, `8hweb`, `b9yi1`, `ckfi5` (ADR-011 check first!), `ht7qz`,
  `hikk1`, `ib96u`, `k3854`, `l22ki`, `llhf6`, `m1sf8`, `oiye4`, `ot1mo`, `pqor7`, `z3yv3`,
  `buznf` (after r4cyk)), `oey96.64`, `dyoyi`, `krjou`, `vb48u`, `3khb1`, `qyyj7` (per its AC
  correction), `8doyo` (coordinate with e7tgc fees), `t8v8t` (after S3).
- Leaderboard cluster — serialized: `6lobd` (migration lane) → `2y91o` → `4qpqb`/`9svu0`/`f46tb`.

### 4.8 Gated chains (open as upstream lands)

```
USER ratifies .9 mapping → oey96.9 → oey96.31 (Phoenix-Born)
oey96.16 (decision recorded — runnable now) → .17 → .19 ; and .18 / .46
oey96.36 (PRD-12) after 8sag0's contract settles
cgx4h (Burn-In) after §2 completes
```

---

## 5. Closure evidence standard (before you ask the user to close ANYTHING)

On the issue, per `COMPLETION_VERIFICATION_POLICY` + `OPTIMAL_FIX_DISCIPLINE` §8/§9/§10:

1. Every AC command run literally, **raw output pasted** (not summarized).
2. Failing-first evidence (red) AND post-fix (green) for every sentinel; doc-only = before/after grep.
3. Post-change area-suite re-run AFTER the final edit, raw totals pasted.
4. §9 self-critique findings (or an explicit "ran §9, zero findings").
5. What-was-NOT-done list — every deferred item as a **filed bd ID**, not a sentence.
6. Files changed with line ranges; pin-table updates noted if any tx sites moved.
   Then STOP: "Ready for closure? [Y/N]" — the user closes. `bd close` by an agent is a violation.

---

## 6. What NOT to touch without the user (hard list)

1. **Prod (Railway/Supabase) — anything.** Especially NO `prisma migrate resolve`/`deploy`
   against prod: v58ta is already repaired; re-running would be destructive.
2. **The canonical local DB, destructively.** No unscoped `deleteMany`, no index drops (even "to
   prove a sentinel red" — see the C3 carve-out), no migration runs before the SQL review.
3. **CLAUDE.md's active-exception block** (removal is §2 step 7 — user only) and anything in
   `.claude/rules/`.
4. **Closing/marking-done any bd issue** (incl. "close the redundant/duplicate" — flag for the
   user instead).
5. **Gates and sentinels:** no `test.skip`/`continue-on-error`/regex-widening/threshold-lowering/
   assertion deletion. If a fix seems to need one — STOP.
6. **Schema** (`schema.prisma`) outside the Migration Lane's gated flow.
7. **Git history:** no force-push, no rebase -i, no amend of pushed commits, no branches.
8. **`ggzdu` / `w16yk`** (art/lore content — not code-fleet work) and **`gumnp`/`av27e`/
   `fefh2.15`/`fefh2.43`** (in-flight — coordinate, don't cold-claim).
9. **Security posture flips** (CORS origins, fail-open/closed, MFA lockout store) — propose, wait.
10. **The pre-push hook and doctrine scripts** — fix what they catch, never what they are.

---

## 7. New/changed since the round docs were written (Day-5 review outputs)

- Filed: `Equoria-wmwbr` (P2 settlement-skip, Lane A), `Equoria-cgx4h` (Burn-In, post-gate),
  `Equoria-cpu7v` (stud product decisions), `Equoria-vb48u` (ip8kk regression sentinel).
- ~15 `blocks` deps wired (Lane A order, Lane C's .15→.30, e7tgc S2/S4→S6→S7, dup gates
  .11→ek242 and .37→20o40, cluster chains). `bd ready` is now materially trustworthy.
- ~35 dated correction notes appended to issues (decision recordings, evidence refreshes,
  AC corrections, user-gate markers, the wj4rt crNN legend).
- Round docs 1–5 + master sequence + stud spec + audit protocol + XP arch doc corrected in place.
