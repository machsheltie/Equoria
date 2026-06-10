# 6. Quality Gates

> **Rewritten 2026-06-10** to match the actual gate implementation (`.husky/pre-push`, `.github/workflows/test.yml`) per the CI/test-infrastructure recovery proposal. The former text described npm scripts (`test:affected`, `test:integration`) and suite sizes that do not exist in the current repo.

### 6.1 Pre-Commit

```bash
npm run lint
npm run type-check  # Frontend only
```

**Must Pass:**

- ESLint (errors only, warnings allowed — warning burn-down tracked under `Equoria-fefh2.23`)
- TypeScript type-check (frontend)

### 6.2 Pre-Push — the authoritative local gate

The pre-push hook (`.husky/pre-push`) runs, in order:

1. **Doctrine checks** — `bash scripts/doctrine-checks/run-all.sh` (all `check-*.{sh,mjs}` scripts; fast, fails first).
2. **DB preflight** — `scripts/preflight/db-probe.mjs` (reachability) and `db-health.mjs` (pending migrations, orphan FK rows).
3. **The full backend suite, sequentially sharded** — from `backend/`, 8 shards run one at a time:

   ```bash
   node --max-old-space-size=4096 --experimental-vm-modules \
     node_modules/jest/bin/jest.js --runInBand --shard=i/8 --retryTimes=1
   ```

   Sharding bounds memory (fresh heap per shard); execution is strictly serial. This is the **current authoritative backend command**. Named profiles (`test:backend:full/ci/targeted/diagnostic`) are planned under `Equoria-fefh2.15`, not landed.

**Active exception:** CLAUDE.md ("Active exceptions") authorizes `git push origin master --no-verify` while the hook's infrastructure issue is investigated, with a **mandatory manual doctrine-suite run before every push**. The exception is time-boxed and retired by the user only after the complete gate is restored (`Equoria-fefh2.20`).

**Rule:** targeted runs (`npm test -- <pattern>`) are developer feedback only. They are **never** closure evidence for a story, an issue, or the campaign — only the authoritative full run (and full CI) is.

### 6.3 CI / Pre-Deploy

The canonical CI pipeline is the **Equoria Quality Gate** (`.github/workflows/test.yml`): lint → db-preflight → sharded backend Jest → coverage gate → frontend Vitest → Playwright E2E → security gate → docker build → beta-readiness gate → deployment gate (see `docs/devops-cicd.md` §1).

**Must additionally hold:**

- **Fresh-database migration replay** — the complete migration chain applies from an empty database (shared prerequisite of every DB-dependent workflow; guarded by `freshDbMigrationReplay.sentinel.test.mjs`, see §3.4).
- **Executable-evidence freshness** — the Evidence Verification workflow re-runs every `_bmad-output/test-artifacts/evidence/*.md` command on every PR. When the implementation an evidence file points at legitimately moves (the `Equoria-veql` lesson: the scan regex moved from inline workflow text into `scripts/lib/beta-readiness-scans.sh`, ADR-010), the evidence must be **re-established against the new canonical implementation with sentinel-positive proof** — never edited to match whatever output the stale command now produces.
- **Infrastructure vs product classification** — every red CI signal is classified (application defect / test defect / migration defect / workflow-config defect / unresolved infrastructure contention) before remediation. A pipeline that stops before backend tests, auth tests, or ZAP cannot support a release claim, but it also says nothing about product health.
- Zero critical vulnerabilities (`npm audit` against the allowlist), Lighthouse thresholds per `.lighthouserc.yml`.

---
