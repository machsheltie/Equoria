# Fable Round 5 — Stud Service Economy Fleet Hand-off (Epic Equoria-e7tgc, 2026-07-06)

Companion to the sprint plan and Rounds 1–4; governed by `FABLE_MASTER_SEQUENCE.md`. Packages the new
Stud Service Economy feature — a self-contained public + private stud-fee system Fable spec'd and filed as
epic `Equoria-e7tgc` (11 children `.1`–`.11`, mapping 1:1 to S1–S11, + follow-ups `3sfys`, `t8v8t`).

Full spec: `docs/features/stud-service-economy.md` (data model, API surface, shared validator, per-write tx
design, test matrix, frontend scope, build order).

## Decisions baked in (2026-07-06)

- **Crossbreeding → FAIL-CLOSED (same-breed only)** for beta. `isCrossbreedAllowed(breedA, breedB)` stays a
  stub (same breed only; `breedId: null` rejected). A crossbreed ruleset is a deferred follow-up.
- **S1 migration APPROVED** (BreedingRequest table + partial unique index). You review the final SQL before
  any prod apply. Unblocks the private-stud half (S6/S7/S8/S10/S11).
- **Non-owner cancel → keep the 404-shape** (CWE-639: don't leak resource existence). accept/reject stay 403.

## Tooling for this round (reviewed 2026-07-06)

- **Skills:** `senior-backend` (money/tx/concurrency — the core of this feature), `bmad-tea` (the ATDD
  proven-to-fail concurrency sentinels), `/database-guide` (S1 migration + the repo's first partial unique
  index), `/test-architecture`, `senior-frontend` (the read/UI children).
- **Agent:** `qa-code-auditor` for an independent read on the money-path diffs (S3, S4, public-breed).
- **Hooks (auto-fire):** post-edit lint/test, preCommit lint + type-check, doctrine suite pre-push. Heed them.
- **Plugins:** none.

## GLOBAL INJECT TEMPLATE (every S-child)

```
Read the child issue with bd show Equoria-e7tgc.<N> AND docs/features/stud-service-economy.md (the full
spec, data model, and per-write transaction design) first. You inherit CLAUDE.md: checkout master, pull
--rebase, bd update --status=in_progress. This feature is concurrency-critical: EVERY concurrency
sentinel's AC requires a recorded proven-to-FAIL run against a naive variant BEFORE the real
implementation lands — do that and paste it. EXCEPTION for DB-constraint-enforced invariants (C3
one-pending-per-mare): the arbiter is the S1 partial unique index, so a code-level naive variant cannot
go red without dropping the index on the canonical DB (forbidden, destructive). For C3 the required proof
is: (a) the P2002 assertion fires on the second concurrent pending insert (positive proof the index
arbitrates), and (b) freshDbMigrationReplay.sentinel covers the index's creation. Do NOT drop indexes to
manufacture a red run. Real DB, no mocks; re-run the area suite after and PASTE the raw totals (OPTIMAL_FIX
§10 — not a summary); §9 self-critique; do NOT self-close — post evidence and STOP for my approval. If you
add or move a prisma.$transaction site, update the retryableTransactionWrapping sentinel pins in the SAME
commit and run that sentinel locally before pushing (sub-second; this class broke master on 28d01bfbc).
Reuse the three named audit patterns per the spec (transferUserMoneyOrThrow user→user conditional
debit+credit+ledger in one tx; conditional updateMany atomic claim for status transitions; DB-level partial
unique index for the one-pending-request invariant).
Push only after `bash scripts/doctrine-checks/run-all.sh` exits 0, via `git push origin master --no-verify`.
```

## Build order (from Fable) — with model / tool per step

Order: **S1 → (S3, S4, S2 parallel) → S5 → S6 → S7 → S8 → (S9, S10 parallel) → S11.** `bd ready` currently
surfaces S1–S4.

| Step | Child            | What (confirm exact scope in the spec / issue)                                                                           | Model           | Tool                             | Flags                                                                                                                                                                                                                                                    |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `e7tgc.1` (S1)   | BreedingRequest table + partial unique index `WHERE status='pending'`                                                    | Opus xhigh      | /database-guide + senior-backend | ✅ APPROVED — user reviews the concrete SQL BEFORE the first run against the canonical DB (local dev DB IS real data — c3kb6 discipline), and again before prod. Repo's FIRST partial unique index (confirm PG supports it). **Gates S6/S7/S8/S10/S11.** |
| 2a   | `e7tgc.3` (S3)   | `transferUserMoneyOrThrow` — user→user fee: conditional debit + credit + both ledger rows in ONE tx                      | Opus xhigh      | senior-backend + bmad-tea        | Money path; conservation by construction. Parallel with S2/S4.                                                                                                                                                                                           |
| 2b   | `e7tgc.2` (S2)   | Public-stud listing mode (public/private) + canonical constants + browse endpoint                                        | Opus xhigh      | senior-backend                   | Parallel with S3/S4.                                                                                                                                                                                                                                     |
| 2c   | `e7tgc.4` (S4)   | Shared eligibility validator + fail-closed `isCrossbreedAllowed` hook (used by public-breed AND private-accept; spec §5) | Opus xhigh      | senior-backend                   | Crossbreed = fail-closed same-breed-only (DECIDED). Single source of truth for the rules. Includes the foalBreedId existence guard (spec §5, 2026-07-06 correction). Parallel with S2/S3.                                                                |
| 3    | `e7tgc.5` (S5)   | Public stud breed endpoint — one-tx charge/credit/pregnancy/cooldown + race sentinels (tx §6.2)                          | Opus xhigh      | senior-backend + bmad-tea        | Money + eligibility. Depends on S2+S3+S4 — do NOT start before the validator (S4) lands.                                                                                                                                                                 |
| 4    | `e7tgc.6` (S6)   | Private requests: submit/cancel/outgoing/incoming + one-pending-per-mare (P2002 mapping) + GDPR export/erasure           | Opus xhigh      | senior-backend + bmad-tea        | **Non-requester cancel = 404-shape** (DECIDED). Needs S1. Accept/reject is S7, NOT here.                                                                                                                                                                 |
| 5    | `e7tgc.7` (S7)   | Private accept/reject + permanent-vs-transient revalidation (D4) + unlist cascade (D3) + race sentinels C1/C2/C5         | Opus xhigh      | senior-backend + bmad-tea        | Concurrency: accept-vs-accept, cancel-vs-accept. Non-owner accept/reject = 403. Needs S1, S3, S4, S5.                                                                                                                                                    |
| 6    | `e7tgc.8` (S8)   | Cross-flow hardening: C4 public-vs-accept same mare, full-lifecycle conservation audit, deadlock-order review            | Opus xhigh      | senior-backend                   | Needs S5, S6, S7.                                                                                                                                                                                                                                        |
| 7a   | `e7tgc.9` (S9)   | Per spec (read endpoints / listing)                                                                                      | model per issue | senior-frontend / senior-backend | Parallel with S10.                                                                                                                                                                                                                                       |
| 7b   | `e7tgc.10` (S10) | Per spec (UI / read)                                                                                                     | model per issue | senior-frontend                  | Parallel with S9. Needs S1.                                                                                                                                                                                                                              |
| 8    | `e7tgc.11` (S11) | Per spec (final integration)                                                                                             | model per issue | —                                | Last. Needs S1.                                                                                                                                                                                                                                          |

(Where "per spec / per issue" appears, the child's own AC in `bd show` + the spec doc names the exact scope,
files, test, and done-definition — assign Opus for money/concurrency, Sonnet for mechanical/UI.)

## Follow-ups (after the epic, or as their notes say)

- `Equoria-3sfys` — `createFoal` unification. Coordinate if other breeding/foaling work is in flight.
- `Equoria-t8v8t` — `buyHorse` → helper migration.

## Public-stud-only fast path

If you want value while everything else runs: **S2 / S3 / S4 / S5 / S9 are NOT gated by S1** — the
public-stud half ships on its own. The private-stud chain (S6/S7/S8/S10/S11) needs S1.

## Where this slots in the master sequence

New **Stud Service Lane (Epic e7tgc)** — largely independent of the economy/audit lanes; one agent follows
the build order above. It reuses `mhdul`'s breeding guards (closed) and the dam-cooldown at
`horseFoalingController.mjs:26`; the `3sfys` follow-up unifies `createFoal`, so coordinate if breeding/foaling
code is being touched by another lane. See `FABLE_MASTER_SEQUENCE.md`.
