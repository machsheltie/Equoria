# Equoria — Claude Code Instructions

@AGENTS.md

Equoria is a browser-based horse breeding and simulation game built by one
person. It is pre-revenue, has no public traffic, and runs on a limited personal
budget and a single Windows development laptop. Choose solutions proportionate
to that reality.

## Product identity

- Equoria is a game world for adult horse enthusiasts. It is not SaaS, fintech,
  tax software, a CRM, an admin console, or an enterprise platform.
- Player-facing work must feel like an authored horse game: horses, places,
  lineage, care, competition, discovery, and atmosphere lead. Dashboards, KPI
  strips, bento grids, generic card walls, and business-software language fail
  the product even when technically functional.
- Do not invent enterprise requirements, multi-tenant architecture, billing,
  subscriptions, analytics programs, compliance programs, growth tooling, or
  operational complexity without an explicit current request.

For player-facing product or UI work, read `PRODUCT.md` and `DESIGN.md` before
planning. They are deliberately not imported into every session.

## Scale, infrastructure, and cost

- Existing approved external services are Netlify, Railway, and Supabase.
- Do not add, recommend, configure, or require Docker, virtual machines,
  Kubernetes, Sentry, Datadog, New Relic, external telemetry, or another hosted
  service unless the owner explicitly asks for that named product in the
  current conversation.
- “Free tier” is not approval. Before proposing any new dependency or service,
  state the problem it solves, the local or already-owned alternative, present
  and plausible future cost, data sent off-machine, lock-in, and removal path.
  Wait for explicit approval before installation, signup, configuration, or
  code integration.
- Prefer the smallest native Node/npm solution that fits the current load. Do
  not design for hypothetical scale, teams, visitors, or revenue.
- Do not create agent teams or spawn parallel subagents for routine work. Use a
  separate reviewer only when the task is complex or high-risk enough to repay
  its context, time, and cost.

## Authority and scope

Use this order when instructions disagree:

1. The owner's current message and current-session rulings.
2. `PRODUCT.md` for product identity and scope.
3. `DESIGN.md` for player-facing visual and interaction direction.
4. This file, `AGENTS.md`, and a matching path-scoped `.claude/rules/` file.
5. Narrow active contracts or runbooks whose documented trigger matches.
6. Live source, schema, configuration, tests, and executable checks.
7. The current issue/task record for status.

Historical reports, archived documents, generated plans, old issue text,
installed packages, and existing repetition are evidence, not authority.

Keep changes inside the requested outcome. Do not attach a platform redesign,
large refactor, dependency migration, new service, or speculative hardening to
an ordinary bug or feature.

Do not edit `CLAUDE.md`, `AGENTS.md`, `PRODUCT.md`, `DESIGN.md`, or files under
`.claude/rules/` unless the owner explicitly authorizes instruction or product
documentation changes in the current conversation.

## Work method

1. Inspect the relevant source, configuration, and existing tests.
2. For a bug, capture the actual failure and form one falsifiable hypothesis.
   Separate observation, hypothesis, intervention, and conclusion.
3. Make the smallest complete production fix.
4. Verify the affected real behavior with the narrowest meaningful command.
5. Review the diff for unrelated changes and report exact evidence.

Do not promote a plausible cause to “root cause” without evidence that names
the failing owner or mechanism. Do not stack several interventions into one
experiment. If two attempts fail to distinguish the cause, stop, preserve the
evidence, and reassess instead of repeating increasingly broad commands.

Use plan mode for uncertain, multi-file, destructive, schema, deployment, or
product-direction work. Skip ceremonial plans for a small obvious change.

## Test integrity

- Fix production code, data flow, configuration, or schema. Never change an
  existing test merely to make it green; never weaken an assertion, widen a
  tolerance, add a skip, swallow an error, reduce coverage, or update a snapshot
  to conceal a regression.
- Change an existing test only when the owner has explicitly changed the
  behavior it specifies. State the old contract and new ruling before editing.
- Test Equoria-owned behavior through real code. Backend integration tests use
  the real test database and narrowly owned fixtures. Do not mock Prisma,
  internal services, repositories, application state, or the primary API to
  bypass behavior.
- Mock only a genuine third-party network boundary when no safe sandbox is
  available. Keep the real Equoria request, validation, persistence, and error
  path on both sides of that boundary.
- A passing mock is not integration, readiness, or proof that the game works.
  Prefer a regression test that fails for the original defect and passes after
  the production fix.

## Laptop and process budget

- During development run only the affected test file or smallest relevant
  suite. For backend work use
  `npm run test:backend:targeted -- <path-to-test>`.
- Never start backend, frontend, Playwright, doctrine, build, or dependency
  installation jobs concurrently. Before a resource-heavy run, check for an
  existing Equoria test/build process in another window.
- Do not run `npm run test:backend:full`, the beta E2E gate, or push merely to
  check an incremental edit. One final full gate is appropriate only when the
  completed candidate requires it or the owner authorizes a push.
- Do not leave background monitors, servers, test runners, or shell tasks
  running casually. Record every background task's purpose and identity when
  started, stop it when its observation is complete, and verify exit.
- Never raise worker counts, heap limits, timeouts, retry counts, or memory
  budgets to get a pass. Never use `--no-verify` or disable a gate.
- On interruption or timeout, stop only processes owned by the current task,
  wait for them to exit, run the repository's current orphan check/reaper when
  applicable, and verify cleanup. Never kill by a stale PID or broad process
  name.
- Do not install dependencies while another worktree or process is using a
  shared or junctioned `node_modules` tree.

## Files, worktrees, and completion

- Preserve unrelated user changes. Never reset, restore, clean, move, or delete
  them to simplify the task.
- Put code, tests, scripts, and durable documentation in the existing owning
  subsystem. Before creating or moving a path, consult
  `docs/REPOSITORY_MAP.md`. Before creating, moving, or retiring Markdown, read
  `docs/DOCUMENTATION.md`.
- Do not create root-level plans, reports, handoffs, logs, screenshots, scratch
  scripts, or alternate implementations. Temporary artifacts belong in an OS
  temporary directory and must be removed when the task ends.
- Create a worktree only when isolation is necessary. Record its purpose and
  branch, do not share mutable dependency output unsafely, and remove the
  worktree after its changes are integrated or abandoned.
- Keep one current implementation plan and one issue/status owner. Update the
  existing record instead of creating parallel plans. When acceptance criteria
  and required verification are complete, mark the work complete; do not leave
  finished tasks described as pending. Do not claim completion while cleanup,
  verification, or an owned process remains.
- For a long or degraded session, write a compact structured handoff into the
  existing issue or an ignored temporary artifact and recommend a fresh
  session. Repeated compaction is not a reason to keep accumulating guesses.

## Conditional context

Read only when the trigger applies:

| Trigger                                           | Read                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Player-facing feature or UI                       | `PRODUCT.md`, `DESIGN.md`, then the matching file under `docs/design-system/` |
| Backend, scripts, packages, or test configuration | `.claude/rules/CONTRIBUTING.md`                                               |
| Security control or security test                 | `docs/SECURITY_TESTING.md` and live implementation                            |
| Documentation lifecycle                           | `docs/DOCUMENTATION.md`                                                       |
| Creating, moving, or locating files/directories   | `docs/REPOSITORY_MAP.md`                                                      |
| CI, hooks, Railway, Netlify, or release work      | `docs/devops-cicd.md` and live configuration                                  |
| Migration or dependency-major work                | `docs/migration-deploy-checklist.md`                                          |

Do not preload `docs/`, `.claude/`, archives, audit history, or generated
planning output. Retrieve the smallest relevant source when needed.

## Commands

- Targeted backend: `npm run test:backend:targeted -- <path-to-test>`
- Frontend: `npm run test:frontend`
- Types: `npm run typecheck`
- Lint: `npm run lint`
- Doctrine: `bash scripts/doctrine-checks/run-all.sh`
- Orphan cleanup/check: `npm run test:reap`

Use live package scripts as authority. Run checks sequentially and only in
proportion to the change.
