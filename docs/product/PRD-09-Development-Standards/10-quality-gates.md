# 10. Quality Gates

> **Rewritten 2026-06-10** to match the actual gate implementation. Authoritative detail: PRD-06 §6 and `docs/devops-cicd.md` §1/§8.

### 10.1 Pre-Commit

- [ ] ESLint passing (errors are blocking; warning burn-down tracked under `Equoria-fefh2.23`)
- [ ] TypeScript type-check passing (frontend)

### 10.2 Pre-Push

The pre-push hook (`.husky/pre-push`) is the authoritative local gate. It runs:

- [ ] **Doctrine checks** — `bash scripts/doctrine-checks/run-all.sh` (bypass-header gate, no-skip gate, no-db-mocks gate, etc.)
- [ ] **DB preflight** — reachability probe + structural health (pending migrations, orphan FK rows)
- [ ] **Full backend suite** — `npm --prefix backend run test:backend:full`; 8 sequential fresh-process shards (memory bounding, not parallelism)

**Active exception (time-boxed):** CLAUDE.md's "Active exceptions" section authorizes `git push origin master --no-verify` while the hook's infrastructure issue is under investigation — with a mandatory manual `scripts/doctrine-checks/run-all.sh` run before every push. The exception is removed by the **user** (never by an agent) only after the complete gate is restored under `Equoria-fefh2.20`, following the ordered gate sequence in the 2026-06-10 sprint change proposal (Workstream 5): doctrine suite → lint/format → fresh-DB migration replay → full authoritative backend suite → frontend Vitest → Playwright readiness/E2E → Evidence Verification → CodeQL + ZAP → full master CI.

**Targeted test runs are never closure evidence.** `npm test -- <pattern>` is developer feedback only; story/issue closure requires authoritative full-gate evidence.

### 10.3 Pre-Merge / Master CI

- [ ] All CI checks passing — required jobs **executed**, not skipped (a green check from skipped jobs is not evidence)
- [ ] Code review approved (where a PR exists; master-direct is the norm, see §5.2)
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

---
