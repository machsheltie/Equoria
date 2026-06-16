# 10. CI/CD Integration

> **Rewritten 2026-06-10:** the former inline YAML (Node 18, `equoria_test`, codecov) and sub-minute timing targets described a pipeline that no longer exists. The canonical pipeline is documented in `docs/devops-cicd.md`; this section keeps only the testing-strategy view of it.

### 10.1 GitHub Actions

The canonical pipeline is **Equoria Quality Gate** (`.github/workflows/test.yml`, Node 22.x): lint → db-preflight (ephemeral Postgres service + full `prisma migrate deploy` replay) → backend Jest in a 3-shard matrix → merged coverage gate (70% line/branch) → frontend Vitest → Playwright E2E → performance → security gate → docker build → beta-readiness gate → deployment gate. Supporting workflows: Doctrine Gate, Evidence Verification, PR Body Evidence, OWASP ZAP, CodeQL (advanced workflow — sole owner since 2026-06-10), HttpOnly Cookie Auth. Full inventory: `docs/devops-cicd.md`.

Key CI facts for test strategy:

- CI's Postgres is created **empty** on every run — the full migration chain must replay from zero (see §3.4; `Equoria-fefh2.14`). This is the shared bootstrap for Quality Gate, cookie-auth, and ZAP; when the replay broke in 2026-06, all three went red before a single test ran.
- Backend CI shards remain coverage-equivalent to the authoritative local run. `Equoria-fefh2.15` added named package profiles plus doctrine checks that keep backend/root scripts, pre-push, CI, and the worker/pool budget synchronized.
- On failure, backend CI retains Jest JSON, a concise generated summary, and the captured Jest log in a per-shard artifact.

### 10.2 Test Execution Performance

Honest current state (2026-06-10) — the former sub-minute targets were aspirational fiction at today's scale:

| Run                                                                | Reality                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authoritative local backend run (sequential sharded `--runInBand`) | ~10 minutes — the accepted cost of safety (CLAUDE.md §3)                                                                                                                                                       |
| Full parallel backend run (`maxWorkers: 6`)                        | Connection lifecycle repaired under `Equoria-fefh2.15`: measured peak fell from 101 to 8 and connection-exhaustion errors fell to zero; independent deterministic suite failures still block a green full gate |
| Frontend Vitest                                                    | minutes, not gated on a hard target                                                                                                                                                                            |
| E2E (Playwright)                                                   | bounded by CI job timeout                                                                                                                                                                                      |

No blanket timeout increases are permitted without a before/after latency distribution. Re-baseline performance only after the separately tracked deterministic failures permit green burn-in.

---
