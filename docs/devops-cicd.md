# Equoria CI, Deployment, and Operations Map

**Status:** Active source-first runbook
**Owner:** Runtime and deployment configuration
**Last verified:** 2026-08-19
**Load only when:** changing or diagnosing CI, hooks, Docker, Railway, deployment gates, release operations, database-pool sizing, process/replica count, or cross-process runtime behavior
**Do not load for:** ordinary feature implementation or testing command discovery

Equoria uses GitHub Actions, repository doctrine checks, Husky hooks, a Docker build, and Railway deployment. This file routes operators to live configuration; it does not copy workflow status, job counts, issue state, or historical incident conclusions.

## Loading rule

Load this file only when changing or diagnosing CI workflows, hooks, Docker packaging, Railway configuration, deployment gates, or release operations. For ordinary implementation and testing, use the commands in `AGENTS.md` without loading this file.

## Live sources

| Concern                           | Authority                                                             |
| --------------------------------- | --------------------------------------------------------------------- |
| CI and scheduled automation       | `.github/workflows/*.yml`                                             |
| Workflow dependency actions       | `.github/dependabot.yml`                                              |
| Doctrine enforcement              | `scripts/doctrine-checks/run-all.sh` and its scripts                  |
| Local Git hooks                   | `.husky/`                                                             |
| Shared-checkout detection         | `scripts/session/session-guard.sh`, `scripts/session/claim.sh`        |
| Build image                       | `Dockerfile` and `.dockerignore`                                      |
| Railway build/start/health policy | `railway.toml`                                                        |
| Commands and runtime floor        | root and package `package.json` files                                 |
| Beta E2E orchestration            | `playwright.beta-readiness.config.ts`, `docs/testing/BETA_PROFILE.md` |
| Database-pool behavior            | `packages/database/dbPoolConfig.mjs` and focused tests                |
| Process and SSE behavior          | `backend/server.mjs`, cluster/SSE guards, ADR-011                     |
| Secrets/environment contract      | tracked `.env.example` files and workflow environment blocks          |

Enumerate `.github/workflows/` before making a claim about workflow ownership. Do not rely on a prose list or an old incident report; workflows are added, renamed, and consolidated over time.

## Required local gates

The repository-level baseline is:

```bash
npm run test:backend
npm run test:frontend
npm run typecheck
npm run lint
npm run test:e2e:beta-readiness
bash scripts/doctrine-checks/run-all.sh
```

Select additional focused checks from the touched workflow/configuration and current package scripts. Never introduce `continue-on-error`, skip flags, bypass headers, failure-swallowing shell syntax, or relaxed assertions to manufacture a passing gate.

## One session per checkout (Equoria-9ai5g)

Two Claude sessions in one working tree is a fourth shared mutable resource,
and the worst of them: one session's `reset`, `checkout --`, `stash` or branch
move destroys the other's unpushed work, and one session's in-progress commit
silently becomes an ancestor of the other's push. On 2026-09-11 that nearly
sent a half-finished revert to `master` inside an 80-commit push; nothing
detected it, an unrelated `git merge` refusal did.

The owner's ruling was to DETECT, not prevent. `scripts/session/session-guard.sh`
implements it:

| When          | Entry point                      | Behavior                                                                                                                                                                                                                        |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session start | `bash scripts/session/claim.sh`  | Claims the checkout. Reports a live foreign claim with its age and tells you to use a worktree. Always exits 0.                                                                                                                 |
| Commit        | `.husky/pre-commit` (first line) | Refuses when the claim belongs to another live session **and** this commit stages paths that session's snapshot did not contain. Staged paths that were all in its snapshot produce a warning instead.                          |
| Push          | `.husky/pre-push` (first check)  | Judges the refs on stdin, not `HEAD`. Refuses when the claim is foreign and live **and** the pushed commits touch paths that session never had dirty, or when the pushed commits carry more than one author/committer identity. |

**It catches one direction, not two.** The guard bites at the non-holder's
pre-commit and at the non-holder's push. A push by the session that _holds_ the
claim is checked only for differing author/committer identities — and every
session here commits as the same git user — so the holder pushing a branch that
already contains another session's commit is **not** caught at push. It is
caught earlier, when that other session tried to commit into the tree. The two
hooks are not two layers over the same direction.

The claim lives in `"$(git rev-parse --git-dir)"/equoria-session.json` — inside
the git directory, so it is never tracked and never appears in the working
tree. For a linked worktree that path is the worktree's own private gitdir, so
each worktree carries its own claim. That is the point: separate worktrees are
the fix, not the failure.

- Session identity comes from `EQUORIA_SESSION_ID`, else `CLAUDE_CODE_SESSION_ID`
  (Claude Code exports it into hook processes), else `CLAUDE_PID`. With none of
  them the token falls back to a parent pid, which git changes on every hook
  run — so that case is marked **weak** and the guard only warns, never
  refuses. A plain `git commit` by a human with no Claude environment is never
  blocked, and a claim written weakly is taken over silently.
- A claim is stale when the process that made it (`CLAUDE_PID`, recorded in the
  claim) is gone, so a restarted session takes the tree over automatically
  rather than being locked out. When liveness cannot be determined the claim
  expires after 2h; a claim whose process is provably alive expires after 8h.
  Takeover is always a warning, never a refusal.
- A corrupt, empty or truncated claim file is reported by name, rewritten, and
  the operation proceeds. It never refuses on behalf of a session it cannot
  name.
- Every refusal is overridable with `EQUORIA_SESSION_OVERRIDE=1` and prints what
  it found first. It is never silent.
- No-op under `CI=true` or `GITHUB_ACTIONS`. Cost measured on Windows Git Bash:
  ~0.5s pre-commit, ~0.2s pre-push.
- `sh scripts/session/session-guard.sh status` prints the current claim, whether
  it is yours, and whether it is stale.

To claim automatically, add this alongside the existing `SessionStart` hooks in
`.claude/settings.json`:

```json
{
  "hooks": [
    { "command": "bash \"$CLAUDE_PROJECT_DIR\"/scripts/session/claim.sh", "type": "command" }
  ]
}
```

What it cannot see: a push by the claim holder carrying another session's commit
(above); work committed before any claim existed; two sessions that share one
session token; any session with no identity in its environment; and destruction
rather than creation — `git reset --hard`, `git checkout --`, `git stash` and a
branch force still discard the other session's uncommitted work silently, and
no hook exists for them.

## Railway invariant

`railway.toml` owns the production start command. Prisma migration deployment must succeed before the backend starts; a non-zero migration exit must abort deployment. Preserve the direct/pooler URL behavior already encoded there and verify changes against the doctrine check that enforces fail-fast migration startup.

No document authorizes production deployment, rollback, secret changes, database mutation, branch-protection changes, or external service changes. Those actions require the authority implied by the user's request and must target the exact environment.

## Workflow-change checklist

1. Read every trigger, path filter, permission, environment, dependency, and downstream consumer in the live workflow.
2. Confirm which workflow owns the check; avoid duplicate owners and contradictory gates.
3. Preserve least-privilege permissions and pinned/approved action versions.
4. Use synthetic test secrets only; never print, persist, or upload real secrets.
5. Ensure failures propagate and required artifacts remain available for diagnosis.
6. Run YAML/static validation plus the affected local command and doctrine suite, then verify the change per "Verifying a workflow change before it reaches master" below — both layers, static and dispatch-on-a-branch.
7. Re-check branch-protection or platform configuration separately when it is part of the authorized scope; repository YAML cannot prove external settings.

## Verifying a workflow change before it reaches master (Equoria-axyem.6)

A workflow file is not compiled, not imported, and covered by no test. Its only
execution environment is GitHub Actions on a branch that has a matching trigger
— which, for the push/PR gates, means `master`. That is how the dead
`verify_migration.js` step (a `run:` referencing a file that had been deleted)
executed broken on `master` for 18 days without anyone noticing. Every workflow
edit carries the same exposure. Do both layers below.

### 1. Static — `check-workflows-lint`

`scripts/doctrine-checks/check-workflows-lint.sh` runs
[actionlint](https://github.com/rhysd/actionlint) over `.github/workflows/`. It
is auto-discovered by `run-all.sh`, so the pre-push hook and the Doctrine Gate
job already run it.

**actionlint must be installed. The check fails loudly when it is not** — a
doctrine check that passes because its tool is absent is the silent-skip class
this epic exists to remove. Pinned floor: **v1.7.12** (newer is accepted).

| Environment          | Install                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Windows (Git Bash)   | `winget install rhysd.actionlint` or `scoop install actionlint`                                               |
| macOS                | `brew install actionlint`                                                                                     |
| Any platform with Go | `go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.12`                                               |
| No package manager   | Release binary into the per-user cache below, from <https://github.com/rhysd/actionlint/releases/tag/v1.7.12> |
| CI                   | The `Install actionlint` step in `.github/workflows/doctrine-gate.yml` (tag-pinned **and** sha256-verified)   |

**Resolution order: `$ACTIONLINT` -> `actionlint` on `PATH` -> the per-user
cache.** The cache lives outside the repository, because the repository root is
a closed enumeration in `docs/REPOSITORY_MAP.md` and a doctrine check is not
entitled to add a root directory to it:

| Platform | Per-user cache path                                                       |
| -------- | ------------------------------------------------------------------------- |
| Windows  | `%LOCALAPPDATA%\equoria\actionlint\<version>\actionlint.exe`              |
| POSIX    | `${XDG_CACHE_HOME:-$HOME/.cache}/equoria/actionlint/<version>/actionlint` |

```bash
# Windows Git Bash example
DEST="$LOCALAPPDATA/equoria/actionlint/1.7.12"
mkdir -p "$DEST" && cd "$DEST"
curl -sSL -o al.zip \
  https://github.com/rhysd/actionlint/releases/download/v1.7.12/actionlint_1.7.12_windows_amd64.zip
unzip -oj al.zip actionlint.exe && rm al.zip
```

Several `<version>` directories may coexist; the check picks the highest that
contains an executable. The version string is parsed as the first `X.Y.Z` in
`actionlint --version`, and anything unparseable (`(devel)`, empty) is
**rejected**, never assumed current.

#### Known gap: shell inside `run:` blocks

The check disables actionlint's optional `shellcheck` and `pyflakes`
integrations (`-shellcheck= -pyflakes=`). Stated, not hidden:

- **Determinism.** `ubuntu-latest` ships shellcheck; Windows Git Bash does not.
  A gate whose verdict depends on the host's incidental tooling is not a gate.
- **`SC1083` is a structural false positive** against Actions syntax: every
  `${{ ... }}` inside a `run:` block reads to shellcheck as a literal brace.

Measured with shellcheck 0.11.0: **69 findings** — 50x SC2086, 7x SC2129, 6x
SC1083, 3x SC2034, and one each of SC2059, SC2046, SC2044. Do not read that as
"all cosmetic": SC2086, SC2046 and SC2044 are correctness-capable (unquoted
expansion, word-splitting over `find` output), and 52 of the 69 fall in those
codes. The honest statement is narrower — none is the class Equoria-axyem was
about, and **none has been triaged**. Enabling the integration means pinning
shellcheck as a second required tool everywhere, triaging all 69, and
suppressing the SC1083 class; that is its own bead. Until then, shell
correctness inside `run:` bodies is an **open, untriaged gap**.

actionlint's own workflow, expression, and action checks run at full strength,
with no allowlist, baseline, or `-ignore` regex. A missing or empty
`.github/workflows/` fails the check rather than passing it vacuously.

Static lint also cannot see a step that references a file which no longer
exists. That is precisely the `verify_migration.js` defect — which is why layer
2 is not optional.

### 2. Dynamic — run the changed workflow off `master` via `workflow_dispatch`

Workflows that declare `workflow_dispatch:` today: `test.yml`, `ci-cd.yml`,
`codeql.yml`, `security-scan.yml`, `evidence-verification.yml`,
`update-visual-baselines.yml`.

`gh workflow run --ref <branch>` executes **the workflow file as it exists on
that branch**, not the copy on `master`. So a feature branch is a real
execution environment for your edit, with no new tooling, no `act`, and nothing
merged.

```bash
# 1. Publish the branch carrying your workflow edit (never master).
git push origin <your-branch>

# 2. Trigger the edited workflow against that branch.
gh workflow run <workflow-file>.yml --ref <your-branch>

# 3. Watch it. The run appears within a few seconds.
gh run list --branch <your-branch> --limit 5
gh run watch <run-id>            # or poll `gh run list` on an interval

# 4. Read the result, per job.
gh run view <run-id>
gh run view <run-id> --log-failed   # only the failing steps' logs

# 5. Clean up when the evidence is recorded.
git push origin --delete <your-branch>
```

What you are proving is that **your edited workflow parsed, dispatched, and its
steps executed**. A red run is still valid evidence of that, as long as the
failures are pre-existing and you say which. What is _not_ evidence: a green run
of the `master` copy, or a lint pass alone.

If the workflow you changed has no `workflow_dispatch:` trigger, add one
minimally (no inputs, or one optional input) as part of the change. It costs
nothing on push/PR and makes the file verifiable forever after.

### Ordering

Static first (it is seconds and catches most of it), dynamic second, then the
rest of the workflow-change checklist below.

## Deployment-change checklist

1. Read `Dockerfile`, `railway.toml`, health/readiness routes, and affected environment templates.
2. Determine whether the change is backward compatible across old/new application instances and database schema.
3. Apply `docs/migration-deploy-checklist.md` for every dependency-major,
   schema, or data migration, including its additional authentication-sensitive
   checks when that trigger matches.
4. Define an explicit failure/rollback observation before deployment; do not invent unimplemented feature-flag or rollback services.
5. Verify the built artifact and startup path, not only a development server.

Historical CI recovery proposals, readiness reports, generated workflow inventories, and fleet handoffs are evidence only in the archive. They never override live configuration.

## Runtime scaling guardrails

Railway currently starts `node server.mjs` directly; the startup path does not
fork Node cluster workers. `CLUSTER_ENABLED` and `WEB_CONCURRENCY` are signals
consumed by guards, not a complete launcher. Confirm the live startup path
before claiming otherwise.

`packages/database/dbPoolConfig.mjs` currently owns Prisma pool defaults and
environment overrides. Every backend process has its own pool, so potential
connections grow with replicas, workers, overlapping deploys, tests,
migrations, administration, and other services. Never derive a safe pool or
replica count from a generic formula or an assumed PostgreSQL maximum.

The SSE event bus is process-local. Multiple serving processes can delay live
events until polling catches up. Cross-process fan-out must be implemented and
verified before multi-process deployment is treated as safe. Also review cron
uniqueness, schedulers, caches, rate limiting, graceful shutdown, and startup
preloads for multi-process semantics.

Before any production capacity change:

1. Measure concurrent demand, transaction duration, pool wait/P2024 errors,
   CPU, memory, and database activity.
2. Confirm the actual database/pooler mode, plan limits, reserved capacity,
   deploy overlap, and operational consumers.
3. Budget connections across every simultaneous process with recovery
   headroom.
4. Resolve or explicitly gate every process-local subsystem, especially SSE.
5. Load-test the proposed topology and verify shutdown, scheduler uniqueness,
   limiting, caches, and saturation behavior.
6. Change configuration, tests, deployment guidance, observability, and the
   rollback value together.

Increasing a timeout does not create capacity. Source, current platform limits,
and measured telemetry outrank every number in prose.
