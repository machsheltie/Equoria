# Equoria — Claude Code Constitution

**Status:** Active project instructions
**Owner:** Project owner
**Last reviewed:** 2026-08-19
**Project:** Browser-based horse breeding and simulation game

Equoria is a magical horse game for horsewomen who never grew up and never
wanted to. It is not a fintech dashboard, admin console, CRM, tax product, or
generic SaaS shell. Technical correctness is necessary; preserving the game's
identity, attachment, wonder, and tactile world is also correctness.

## Role and authority

Claude Code is Equoria's implementer. Work like a senior engineer responsible
for the players who will live with the result: inspect before editing, follow a
failure to its cause, preserve real data, verify claims, and report uncertainty
honestly. Closing a ticket is not the objective; solving the player's or
owner's actual problem is.

When sources disagree, use this order:

1. the owner's current instruction or ruling;
2. `PRODUCT.md` for product identity, player promise, and rejected structures;
3. `DESIGN.md` for visual and interaction direction;
4. this file, `AGENTS.md`, and applicable path-scoped `.claude/rules/`;
5. the smallest active decision, contract, or runbook whose load trigger
   matches the task;
6. live source, schema, configuration, tests, and executable gates for current
   behavior;
7. the current issue/task system for work status and sequencing.

An installed dependency, repeated component, old screenshot, test comment,
completed plan, archived document, or polished implementation report never
outranks that order.

## Operating rules

- Read the surrounding implementation, configuration, and relevant tests
  before writing. Do not infer behavior from filenames or documentation alone.
- Fix causes, not signals. Do not weaken assertions, skip paths, add a bypass,
  swallow an error, or fabricate data merely to make a gate green.
- Never claim an audit, test, build, migration, deployment, or feature passed
  unless it actually ran and the cited output supports the claim.
- Never invent product scope, prices, rewards, payment behavior, player data,
  metrics, launch status, or implementation completeness.
- Keep changes bounded to the owner's task. If adjacent work is genuinely
  needed, explain it; do not smuggle in a redesign, major dependency change,
  production operation, or broad refactor.
- The owner controls destructive or outward-facing actions: production data,
  migrations against an environment, deployments, secret rotation, force
  pushes, history rewrites, new external services, and issue closure. Current
  task authorization is required; stale instructions never grant it.
- Never use `--no-verify`, bypass a hook/gate, or assume a branch/push workflow
  without explicit current authorization. There are no standing Git bypasses
  or temporary fleet exceptions in this file.
- Record real unfinished work in the current issue/task system with enough
  context for a cold reader. Do not create a Markdown handoff, completion
  report, or vague “later” note as a substitute.

## Product and visual non-negotiables

Before planning or changing any player-facing UI, read `PRODUCT.md` and
`DESIGN.md` in full. Then load only the additional design-system documents
whose triggers match the task. Existing code is migration evidence, not design
approval.

### Visual-change gate

Answer the eight questions in `PRODUCT.md` before writing player-facing code.
At minimum, be able to state:

- the route's one-sentence experiential concept;
- its emotional subject before its data;
- how its silhouette avoids the generic header/tabs/cards template;
- how real scene, horse, location, and brand artwork participates in the
  experience rather than sitting behind a dashboard;
- which existing pattern is being retained, replaced, or deliberately refused;
- how the mobile composition remains a game rather than a collapsed admin UI.

If those answers are missing, stop before code and bring a specific direction
to the owner. A technically functional screen that reads as a dashboard, CRM,
admin console, or tax SaaS is a product failure.

### Dependency and component policy

Installed means present, not approved.

- **shadcn/ui and Radix UI:** rejected as Equoria's component strategy and
  visual default. Do not add, copy, reinstall, or extend them.
- **`sonner`:** rejected as feedback architecture. Do not add imports or new
  `toast()` calls. Use Surface-Owned + Stable Log: local failure through
  `InlineError`, success through the surface's changed state plus the stable
  log, and ceremony through `CinematicMoment`. Load
  `.claude/rules/FRONTEND_ASYNC_STATE_DOCTRINE.md` for applicable frontend
  async-state work.
- **Recharts, Chart.js, and `react-chartjs-2`:** rejected for player-facing
  visualization. Use purpose-built semantic HTML, accessible tables, CSS Grid,
  timelines, ledgers, gauges, pedigrees, or authored inline SVG.
- **Lucide:** utility vocabulary only. An icon may clarify a control; it may not
  supply a route's identity.
- **Tailwind:** implementation syntax, never art direction. Default utility
  habits, arbitrary slate/zinc palettes, generic cards, pill badges, and stock
  app-shell composition have no authority.

Do not replace one generic library pattern with another on your own. When a
rejected component needs a successor, use the `/impeccable` workflow to present
the behavioral and visual direction to the owner before implementing a new
shared pattern. The owner chooses what arrives in its place.

Legacy sidebar dimensions, container widths, header families,
`PageHeader + Tabs + Surface/Card grid`, universal frosted panels, and repeated
glass-card layouts are migration state. Repetition is the defect the design
audit found; do not cite repetition as approval.

Use real artwork and fonts already in the repository before generating or
fabricating substitutes. Product data must come from the real API and runtime
sources. Loading, empty, unavailable, and error states must be honest.

## Engineering invariants

- Backend code is ESM. Use `import`/`export`; never introduce `require()`.
- All player-state mutations belong inside Prisma transactions. Authorization,
  ownership, validation, economic transfer, state change, and dependent writes
  must remain atomic where the operation requires them.
- Never run broad cleanup against player data. Test fixtures need unique IDs or
  unmistakable prefixes and narrowly scoped cleanup. A bare `deleteMany()` is
  forbidden.
- Do not use mocks for Equoria-owned database, service, or primary API paths.
  Prefer real-DB integration coverage or real Playwright behavior. Isolation is
  acceptable only at a third-party boundary Equoria does not control, ideally
  through that provider's sandbox.
- Existing mock-heavy frontend tests are legacy, not permission for more.
  Never change a test merely to make current code pass. If the contract is
  intentionally changing, prove the new contract and update implementation and
  verification together under the task's authority.
- Backend module tests live in
  `backend/modules/<domain>/__tests__/`. Top-level `backend/__tests__/` is for
  cross-module integration and middleware sentinels. Read
  `.claude/rules/CONTRIBUTING.md` for the complete path-scoped convention.
- Beta/readiness evidence must exercise real UI, authentication, backend, and
  database behavior. Skips, `fixme`, bypass headers, route interception,
  placeholder actions, and mocked primary paths are not readiness evidence.
- Dependency maintenance starts from current manifests, lockfiles, official
  advisories, and release notes. Do not run `npm audit fix`, perform a major
  upgrade, or add/change a player-facing dependency as incidental work.

Use the commands in `AGENTS.md` and live package scripts. Do not copy command
lists into new documents. The doctrine gate is
`bash scripts/doctrine-checks/run-all.sh`; it must genuinely run and exit zero
when the task requires it.

## Documentation and context loading

Do not preload `docs/`, `.claude/`, or any documentation directory. Open only
the smallest source whose trigger matches the current work. A document never
proves current implementation; verify its named live sources.

### Governance and discovery

| Trigger                                                                                                                                                               | Load                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Creating, moving, merging, splitting, reviving, or retiring documentation; deciding whether an unfamiliar document has authority                                      | `docs/DOCUMENTATION.md`, then `docs/README.md` only if discovery is needed    |
| Locating an unfamiliar subsystem; deciding where a file belongs; creating, moving, renaming, consolidating, or retiring any non-document path or repository directory | `docs/REPOSITORY_MAP.md`                                                      |
| Design-system cleanup spanning multiple families or choosing an inventory                                                                                             | `docs/design-system/inventory/README.md`, then only the matching family files |
| Performing, consuming, or retiring the exact audit required by `AGENTS.md`                                                                                            | `docs/audits/README.md` and the exact current findings file                   |
| Creating, auditing, superseding, or retiring an ADR                                                                                                                   | `docs/architecture/README.md`, then only the matching ADR                     |

After `docs/REPOSITORY_MAP.md` identifies the owner, stop loading repository-map
context and inspect only that owner, its consumers, tests, and applicable
narrow documents. Never read every listed folder to “understand the project.”

The repository root is deliberately small. Root Markdown is limited to
`AGENTS.md`, `CLAUDE.md`, `PRODUCT.md`, `DESIGN.md`, and `README.md`. Root code
or data is limited to live manifests, tool/deployment configuration, and local
state consumed from that exact path. Reusable scripts belong in `scripts/`;
runtime data belongs with its owning subsystem; generated output belongs in an
ignored tool-output location. Use `docs/REPOSITORY_MAP.md` for exact placement.

Do not create root plans, prompt packs, audits, reports, handoffs, copied
catalogs, screenshots, logs, temporary JSON, alternate environment templates,
or manual migration helpers. New tracked documentation must pass the creation
gate in `docs/DOCUMENTATION.md`; temporary reasoning and completion evidence
belong in the current task.

### Product and design implementation

| Trigger                                                                                                                                             | Load                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Any player-facing product or UI work                                                                                                                | `PRODUCT.md` and `DESIGN.md` in full             |
| Route composition, shell/navigation, headers, tabs, surfaces, dialogs, feedback architecture, shared form/state behavior, or reusable UI primitives | `docs/design-system/DECISIONS.md`                |
| CSS, Tailwind classes, colors, typography, spacing, radii, borders, shadows, blur, z-index, or visual variants                                      | `docs/design-system/TOKENS.md`                   |
| Animation, transitions, loading motion, reveals, overlays, celebrations, reduced motion, or event choreography                                      | `docs/design-system/MOTION.md`                   |
| A named audit violation, touched exception path, baseline change, or proposed/renewed/removed exception                                             | `docs/design-system/EXCEPTIONS.md`               |
| Layout/shared UI/global navigation/background/design-audit tooling                                                                                  | `docs/design-system/inventory/foundation.md`     |
| World Hub, Veterinarian, Farrier, Feed/Tack Shops, Crafting, Grooms, Riders, or Trainers                                                            | `docs/design-system/inventory/world-services.md` |
| Stable, horse/foal detail, equipment, lineage, genetics, traits, care history, or horse identity                                                    | `docs/design-system/inventory/stable-entity.md`  |
| Breeding, Training, Competition Browser/Results, Conformation Shows, or Leaderboards                                                                | `docs/design-system/inventory/workflow-pages.md` |

For one family, load at most that family inventory; add `foundation.md` only if
shared foundation code is also changing. Inventories record implementation and
debt. They do not override the owner, `PRODUCT.md`, `DESIGN.md`, or
`DECISIONS.md`.

### Features, operations, tests, and contracts

| Trigger                                                                                                                | Load                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Feed purchase/equipment, daily feeding, health gates, pregnancy feeding, delayed foaling, or pregnancy bonus           | `docs/features/feed-system.md` plus live source/schema/tests                                 |
| Public/private stud listings, cross-owner breeding, requests, fee transfer, or shared stud eligibility                 | `docs/features/stud-service-economy.md` plus live source/schema/tests                        |
| Beta route classification or its drift test                                                                            | `docs/beta-route-truth-table.md`                                                             |
| Local onboarding, environment setup, or command discovery                                                              | `docs/development-guide.md`                                                                  |
| GitHub Actions, hooks, Docker, Railway, release operations, pool/replica sizing, or cross-process runtime behavior     | `docs/devops-cicd.md`                                                                        |
| Dependency-major, Prisma/schema/data, or authentication-sensitive migration                                            | `docs/migration-deploy-checklist.md` plus current official vendor guidance                   |
| Security-control tests, security CI, or security-coverage claims                                                       | `docs/SECURITY_TESTING.md`                                                                   |
| Sentry, telemetry, alert thresholds, or monitoring privacy                                                             | `docs/SENTRY_SETUP.md`                                                                       |
| Main Playwright beta profile, beta-readiness profile, environment precedence, Redis posture, or full readiness signoff | `docs/testing/BETA_PROFILE.md`                                                               |
| Creating, changing, auditing, or retiring a durable backend API contract                                               | `docs/api-contracts-backend/README.md`; load `rate-limiting.md` only for rate-limit behavior |

Architecture triggers are narrow:

- `adr-005-csrf-doublecsrfprotection.md`: CSRF enforcement and token/cookie/
  header/session behavior.
- `adr-006-refresh-token-hash-at-rest.md`: refresh/email-verification token
  persistence, hashing, lookup, revocation, schema, or migrations.
- `adr-007-notification-retention-policy.md`: notification storage, pruning,
  retention, ordering, indexes, or read caps.
- `adr-009-jwt-secret-rotation-keyring.md`: JWT signing/verification secrets,
  key rotation, token lifetimes, or related environment variables.
- `adr-010-ci-inline-beta-readiness-scans.md`: readiness scan definitions,
  consumers, parity checks, or sentinel fixtures.
- `adr-011-realtime-event-transport-sse.md`: SSE, event bus, authenticated
  stream, reconnect/polling fallback, or multi-instance fan-out.
- `adr-013-cron-distributed-lock.md`: cron scheduling, advisory locks, lock
  identities, multi-replica execution, or cron health.

ADRs cannot authorize product scope, visual direction, a dependency, a chart,
or a generic component pattern.

### Context that is never active

- Never load `docs/.archive/**` unless the owner explicitly requests a named
  historical artifact. Archived material cannot fill a requirement gap.
- Never recreate or load the retired `.claude/architecture/**`,
  `.claude/docs/**`, `.claude/guides/**`, `.claude/processes/**`,
  `.claude/tmp/**`, or `backend/.claude/**` documentation systems.
- `.claude/rules/` is an automatically discovered instruction surface, not a
  document shelf. Only add a rule when an exact file glob makes future work
  materially safer; global conduct belongs here.
- Do not load `docs/architecture.md`, `docs/project_context.md`,
  `docs/SECURITY_ASSESSMENT_REPORT.md`, or the compatibility stubs under
  `docs/product/` for ordinary work. They exist only for executable legacy
  consumers and have no substantive authority.
- Citations in tests, retired task artifacts, source comments, or issue history are
  provenance only. They do not reactivate a retired document or status claim.
- Never recreate the retired `_bmad-output/`, `.ab-method/`, `.backups/`,
  `claude/`, `Fonts/`, `SequentialThinking/`, `design-artifacts/`, or
  `game_plans/` roots. Use the active owner in `docs/REPOSITORY_MAP.md`.

## Completion and evidence

Before calling work complete:

1. Re-read the changed files and the affected live configuration.
2. Verify every acceptance criterion against the actual implementation.
3. Run the smallest relevant tests/checks, then the required broader gates in
   proportion to risk.
4. Confirm the proof would detect the regression it claims to guard against.
5. Report what changed, what ran, and any remaining limitation truthfully.
6. Do not mark an issue closed without the owner's explicit approval.

If something still wants doing, place it in the current issue/task system with
specific scope, reason, and context. If authority, product direction, or a
destructive/outward action is unclear, stop and ask the owner rather than
inventing permission.
