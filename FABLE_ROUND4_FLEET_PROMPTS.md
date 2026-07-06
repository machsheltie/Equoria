# Fable Round 4 — Fleet Hand-off Prompts (Day 4 execution-ready set, 2026-07-06)

Companion to the sprint plan and Rounds 1–3; governed by `FABLE_MASTER_SEQUENCE.md`. Packages the NEW
execution-ready issues from Fable's Day 4 session (Part A middleware documentation-drift audit + Part B
backlog validation).

**Already covered elsewhere — do NOT re-run here:** `3ewqy`, `4maxb` (Round 3); `oey96.4`, `.35`, `.3`,
`.6`, `.10` (Round 2). Run those from their own docs.

**Stud Service Economy** — the other Day 4 output (the T8 spec session, now epic `Equoria-e7tgc`) has its
own doc: **`FABLE_ROUND5_STUD_FLEET_PROMPTS.md`**. It is not duplicated here.

## Tooling for this round (reviewed 2026-07-06)

- **Skills:** `hunt-mocks` (the primary tool — false-green / dead-code / stale-doc detection), `senior-backend`,
  `/test-architecture`. Not needed: senior-frontend, playwright, bmad-\* here.
- **Agent:** `qa-code-auditor` for an independent read on any removal diff before closure.
- **Hooks (auto-fire):** `post-edit-lint.sh` + `post-edit-test.sh` after edits, `preCommit` lint + type-check,
  doctrine suite pre-push. Heed them; don't weaken to get green.
- **Plugins:** none at project level.

## GLOBAL INJECT TEMPLATE (every issue below)

```
Read the issue with bd show <id> first — it carries a dated FLEET-READINESS VALIDATION note (tree-verified
citations, corrected line numbers, the exact test required, a §8 done-definition). For oey96 children also
read AUDIT_EXECUTION_PROTOCOL.md. You inherit CLAUDE.md: checkout master, pull --rebase,
bd update --status=in_progress; TEST/SENTINEL FIRST — write it, run it, confirm it FAILS, paste it — THEN
fix. DOC-ONLY issues: the "failing test" is the AC grep showing the stale text present before and absent
after — do not fabricate a vacuous test. Real DB, no mocks; re-run the suite after and paste it; §9
self-critique; do NOT self-close — post evidence and STOP for my approval. Heed the auto post-edit
lint/test hooks. Push only after `bash scripts/doctrine-checks/run-all.sh` exits 0, via
`git push origin master --no-verify`.
```

---

## Table 1 — Documentation-drift & dead-code cleanup (Part A)

| Issue      | What                                                                                                                                                                                  | Model       | Tool                             | Notes / flags                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oierg`    | Shallow `sanitizeLogData` — nested secrets persist into `audit_logs` (hi41p's deeper spec merged in)                                                                                  | Opus xhigh  | senior-backend                   | Real-DB test required; secret-handling correctness. `hi41p` closed as its dup. ⚠ NOT parallel-safe vs `hjnrc`/`xbabf`/`2ghng` — all four touch `auditLog.mjs` and/or `jest.setup.mjs`; run these four as ONE mini-lane (suggested order: `xbabf` → `2ghng` → `hjnrc` → `oierg`). |
| `3khb1`    | Bypass-header doctrine gate scans only tests/e2e + frontend api-client — backend prod tree unguarded                                                                                  | Sonnet high | /test-architecture + hunt-mocks  | Widen the gate to the backend tree; sentinel-positive (planted header FIRES). Do NOT weaken.                                                                                                                                                                                     |
| `2ghng`    | `auth.mjs` `suspiciousActivityCache` never populated; cleanup interval runs for nothing                                                                                               | Sonnet high | senior-backend                   | Remove the dead cache + interval (aligns with the `hjnrc` remove decision). Parallel-safe.                                                                                                                                                                                       |
| `xbabf`    | Orphan `jest.setup.mjs` carrying a ~300-line drifted `auditLog` copy                                                                                                                  | Sonnet high | /test-architecture               | Delete after confirming nothing imports it (adjacent-locations check). Parallel-safe.                                                                                                                                                                                            |
| `caqrq`    | Stale code-comment refs in `authRateLimiter.mjs` / `security.mjs`                                                                                                                     | Sonnet high | —                                | Comment-only. Parallel-safe.                                                                                                                                                                                                                                                     |
| `3giol`    | "Token Fingerprinting" claim has no implementation                                                                                                                                    | Sonnet high | — (doc fix)                      | Remove/soften the claim. ⚠ SECURITY.md lane (see below).                                                                                                                                                                                                                         |
| `wvf0z`    | 5 stale SECURITY.md statements (password min 8→12–128, `BCRYPT_ROUNDS`→`BCRYPT_SALT_ROUNDS`, "iterative" vs depth-capped recursion, bare-constructor overclaim, stale retention path) | Sonnet high | — (doc fix)                      | ⚠ SECURITY.md lane.                                                                                                                                                                                                                                                              |
| `av27e`    | Residual SECURITY.md sweep (XSS-sanitizer graph, CORS, refresh rotation, §6 integrity bullets)                                                                                        | Opus xhigh  | senior-backend + hunt-mocks      | ◐ IN_PROGRESS — the sweep itself is COMPLETE per its notes; what remains is appending the findings appendix + user closure. Resume-and-finish, not a cold dispatch. ⚠ SECURITY.md lane.                                                                                          |
| `oey96.30` | **REMOVE** unmounted `gameIntegrity.mjs` + correct its SECURITY.md sections (DECIDED 2026-07-06; absorbed `d0qur`, now P1)                                                            | Opus xhigh  | senior-backend + qa-code-auditor | ⚠ SECURITY.md lane. Land `oey96.15` BEFORE the A04 rewrite (reconciliation #11). Add d0qur's `noDeadIntegrityMiddleware` sentinel.                                                                                                                                               |
| `hjnrc`    | **REMOVE** unmounted suspicious-activity + Sentry threshold-alerting pipeline + correct docs (DECIDED 2026-07-06)                                                                     | Opus xhigh  | senior-backend + qa-code-auditor | Sibling of `.30`. Delete the `auditLog` factory middlewares (mounted on zero routes) + `trackSecurityEventWithThreshold`; fix the doc claims. ⚠ SECURITY.md lane.                                                                                                                |

## Table 2 — Other validated P1s (self-contained validation notes)

I don't have these four issues' specifics — each carries its own dated FLEET-READINESS VALIDATION note that
names the domain, files, test, and done-definition. Run them with the GLOBAL INJECT TEMPLATE and pick the
model per the note (Opus for correctness-heavy, Sonnet for mechanical).

| Issue   | Model                                          | How to run                                                                                                                              |
| ------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `49bc2` | Opus xhigh (GDPR tx-correctness)               | Template + `bd show`.                                                                                                                   |
| `4hra5` | Sonnet high (FE error-state fix + offline E2E) | Same.                                                                                                                                   |
| `m54lr` | Sonnet high (FE honest-state fix)              | Same.                                                                                                                                   |
| `r4cyk` | Sonnet high (FE honest-state fix)              | Same. ⚠ `oey96.54` is the SAME defect/file (CommunityPage.tsx) — user closes one as dup before dispatch; `buznf` touches the same page. |

## ⚠ SECURITY.md serial lane

`3giol`, `wvf0z`, `av27e` (resume-and-finish), `oey96.30`, `hjnrc`, **plus `oey96.61`, `7rc1q`, `mi64z`,
`nzhu8`** (added 2026-07-06 — all edit `.claude/rules/SECURITY.md` too) — **serialize them** (one agent, or
careful ordering) so they don't conflict on the same file — and land **`oey96.15` before `oey96.30`'s A04
section rewrite** (it proves `canTrain` is a partial false-green, so the doc must reflect that; bd dep
wired). Note: `nzhu8`'s quoted target line has drifted — re-locate before editing. The stale no-op trio
`49dzc`/`pey97`/`xbir9` (content already documented) awaits the user's verify-and-close — do NOT dispatch.
Everything else in Table 1 is parallel-safe disjoint files EXCEPT the auditLog mini-lane flagged on
`oierg`.

## Where this slots in the master sequence

- Table 1 non-SECURITY.md items (`oierg`, `3khb1`, `2ghng`, `xbabf`, `caqrq`) + Table 2 → parallel fan-out
  pool.
- SECURITY.md editors → their own serial lane (above).
- `av27e` may file follow-ups — treat it as a sweep, not a single fix.

See `FABLE_MASTER_SEQUENCE.md`.
