# Repository Map and File-Routing Contract

- **Status:** Active contract
- **Owner:** Project owner
- **Last verified:** 2026-08-19
- **Load only when:** locating an unfamiliar subsystem; deciding where a file or
  directory belongs; or creating, moving, renaming, consolidating, or retiring
  a repository path
- **Do not load for:** ordinary implementation after the owning subsystem and
  target path are already known
- **Live sources:** current imports, package manifests, test configuration,
  workflow files, `docs/README.md`, and the actual directory tree
- **Retire when:** replaced by an owner-approved repository map with equivalent
  Claude loading rules

This is Equoria's file-placement and lookup map. It does not grant product,
visual, dependency, or implementation permission. `PRODUCT.md`, `DESIGN.md`,
live code, and the authority order in `DOCUMENTATION.md` still govern those
questions.

## Routing rule

Use the narrowest existing owner:

1. Put feature behavior beside the subsystem that runs it.
2. Put verification beside the behavior unless a configured cross-package test
   root is required.
3. Put durable documentation in the one approved document class that owns it.
4. Put repository-wide automation in `scripts/` and package-local automation in
   that package.
5. Do not create a new root, parallel implementation tree, generic bucket, or
   empty future scaffold when an owner already exists.

When a path looks misplaced, trace its imports, scripts, tests, and workflow
consumers before moving it. A cleaner-looking path is not enough reason to
break a live exact-path contract.

## Repository root

The root is an integration boundary, not a workspace for miscellaneous files.

| Root content                                                     | Purpose and placement rule                                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PRODUCT.md`                                                     | Product identity, player promise, scope, and product rejection criteria.                                                                                                              |
| `DESIGN.md`                                                      | Player-facing art direction, interaction character, and anti-SaaS visual rules.                                                                                                       |
| `CLAUDE.md`                                                      | Claude's concise operating constitution and conditional context-loading table.                                                                                                        |
| `AGENTS.md`                                                      | Cross-agent roles, commands, and repository invariants.                                                                                                                               |
| `README.md`                                                      | Human entry point, setup summary, and compact repository overview.                                                                                                                    |
| `package.json`, lockfile, Jest/Playwright/ESLint/Prettier config | Monorepo commands and root tool configuration. Keep a file here only when the tool consumes it from this exact location.                                                              |
| `Dockerfile`, `railway.toml`, `.github/`, `.husky/`              | Deployment, CI, ownership, dependency automation, and Git hooks.                                                                                                                      |
| `storageState.json`                                              | Ignored Playwright authentication state consumed from this exact path. It is generated local state, may contain credentials, and must never be committed or treated as documentation. |
| `.mcp.json`, `skills-lock.json`, editor/agent config             | Tool-owned integration configuration. It has no product or design authority.                                                                                                          |

Do not add root reports, plans, screenshots, logs, exports, temporary data,
manual migrations, source modules, or additional Markdown authorities.

## Product code and verification

| Home                 | Look here for                                                                                              | Put here                                                                                | Never put here                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `backend/`           | Express runtime, API behavior, domain logic, backend configuration, runtime data, and backend verification | Server-owned behavior and package-local support files                                   | Frontend code, root automation, parallel database migrations, or project planning            |
| `frontend/`          | React application, routes, authored game UI, client state, shipped assets, and frontend verification       | Browser-client behavior, bespoke Equoria components, and package-local frontend tooling | Backend rules, generated reports, generic UI-kit experiments, or unshipped reference art     |
| `packages/database/` | Prisma schema/client, database lifecycle, and canonical migrations                                         | Shared database runtime and migrations created through the Prisma-owned path            | A second migration hierarchy, feature UI, or copied schema documentation                     |
| `tests/`             | Configured cross-package integration tests, root sentinels, helpers, and Playwright E2E                    | Verification that genuinely spans owners or is selected by root test configuration      | Product code, generated screenshots/reports, or a duplicate package-local test suite         |
| `scripts/`           | Repository-wide doctrine, preflight, audit, session, and evidence automation                               | Reusable automation serving more than one package or a root workflow                    | One-off repair scripts, product runtime code, test-result dumps, or documentation souvenirs  |
| `docs/`              | Approved durable contracts, decisions, runbooks, legal text, and compatibility stubs                       | Only document classes admitted by `DOCUMENTATION.md` and indexed by `docs/README.md`    | Status mirrors, generated inventories, speculative plans, source copies, or active code/data |

### Backend routing

| Path                                                                       | Responsibility                                                                                                                                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/app.mjs`, `backend/server.mjs`                                    | Application construction and process entry points.                                                                                                                                                    |
| `backend/app/`                                                             | Application-level composition such as the router registry; not a second domain layer.                                                                                                                 |
| `backend/modules/<domain>/`                                                | Preferred home for domain routes, controllers, services, validation, and domain-local tests. New gameplay behavior normally begins here.                                                              |
| `backend/middleware/`                                                      | Truly cross-domain HTTP, authentication, authorization, rate-limit, validation, and request-lifecycle middleware.                                                                                     |
| `backend/config/`                                                          | Backend runtime configuration and integration setup. Do not place gameplay constants here merely because they are configurable.                                                                       |
| `backend/schemas/`                                                         | Runtime request/response validation schemas shared across the backend. Domain-only schemas should stay with their module when practical.                                                              |
| `backend/constants/`, `backend/data/`                                      | Authored backend constants and runtime/seed source data. Generated output does not belong here.                                                                                                       |
| `backend/services/`, `backend/logic/`, `backend/utils/`, `backend/errors/` | Existing cross-domain runtime support. Prefer a domain module for new domain-specific behavior; do not expand these into catch-all buckets.                                                           |
| `backend/seed/`, `backend/scripts/`                                        | Backend/database seed entry points and backend-only operational utilities. Reusable repository automation belongs in root `scripts/`.                                                                 |
| `backend/docs/`                                                            | Files deliberately served by the running backend, including Swagger and the player feature guide. These are runtime content, not project-planning authority.                                          |
| `backend/modules/<domain>/__tests__/`                                      | Domain-local backend tests.                                                                                                                                                                           |
| `backend/__tests__/`                                                       | Existing cross-module, middleware, security, and doctrine sentinels selected by backend Jest configuration.                                                                                           |
| `backend/tests/`                                                           | Existing configured backend test support and suites that are not domain-local. Do not invent another backend test convention; follow the live Jest configuration and `.claude/rules/CONTRIBUTING.md`. |

### Frontend routing

| Path                                               | Responsibility                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/pages/`                              | Route-level screen composition and page-specific orchestration.                                                                                                               |
| `frontend/src/components/`                         | Reusable or feature-owned UI. `components/ui/` contains Equoria's implemented primitives; its existence does not authorize shadcn, Radix styling, or generic SaaS components. |
| `frontend/src/hooks/`                              | Reusable client behavior, server-state access, and UI workflows. Keep feature-only behavior near its feature when reuse is not real.                                          |
| `frontend/src/contexts/`                           | Cross-tree client state that genuinely requires a React context boundary.                                                                                                     |
| `frontend/src/lib/`                                | Client infrastructure, API helpers, and broadly reusable pure utilities—not an uncategorized feature bucket.                                                                  |
| `frontend/src/config/`, `constants/`, `types/`     | Client configuration, stable constants, and shared TypeScript contracts. Prefer feature locality over premature global types.                                                 |
| `frontend/src/styles/`, `frontend/src/index.css`   | Implemented global atmosphere, design tokens, and cross-route styling governed by `DESIGN.md` and the triggered design-system documents.                                      |
| `frontend/src/test/`, colocated `__tests__/`       | Shared frontend test support and verification near the behavior it covers.                                                                                                    |
| `frontend/public/`                                 | Authored assets and fonts shipped unchanged to players. Placeholder art, mood-board references, and design-source dumps do not belong here.                                   |
| `frontend/scripts/`, `.storybook/`, `.impeccable/` | Frontend-only asset verification, Storybook integration, and local design-tool configuration.                                                                                 |

### Database routing

- `packages/database/prisma/schema.prisma` is the schema definition.
- `packages/database/prisma/migrations/` is the only migration history.
- `packages/database/prismaClient.mjs` and database lifecycle/configuration files
  own shared database runtime behavior.
- `packages/database/scripts/` is for database-package operations only.
- Never recreate `backend/migrations/`, `packages/database/migrations/`, a
  nested `packages/database/packages/`, or loose manual migration SQL.

## Compatibility-only roots

These locations are structurally unusual but still have exact-path consumers.
They are migration debt, not destinations for new work.

| Home              | Why it remains                                                                              | Rule                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `config/`         | Legacy epigenetic flag configuration consumed by root compatibility services                | Do not add configuration. New backend configuration belongs in `backend/config/`.                                                                                     |
| `services/`       | Legacy epigenetic evaluation services retained for exact-path tests                         | Do not add services or treat this as the mounted backend service layer. New behavior belongs in `backend/modules/<domain>/` or an existing backend shared owner.      |
| `utils/`          | Repository agent utilities with exact-path sentinel tests                                   | Do not add application utilities. Repository-wide automation belongs in `scripts/`; runtime utilities belong with backend or frontend.                                |
| `samples/Breeds/` | Breed import fixtures and executable breed-data auditors consumed by seed scripts and tests | Keep only required fixtures/auditors. Runtime breed data belongs in `backend/data/breeds/`; generated images and general reference dumps do not belong in `samples/`. |

Move one of these paths only in an explicitly scoped migration that updates all
imports, scripts, tests, comments, and configuration in the same change.

## Tool, workflow, and local-state roots

| Home                                                   | Purpose                                                                                                        | Claude rule                                                                                                                           |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.git/`                                                | Git's private repository database                                                                              | Never edit it directly. Use Git commands.                                                                                             |
| `.claude/`                                             | Claude Code rules, hooks, commands, agents, personalities, config, and installed skills                        | Open only the exact rule/skill triggered by the task. Do not use it as a document shelf.                                              |
| `.agents/`, `.agent/`, `.bmad/`, `.codex/`, `.gemini/` | Installed multi-agent and workflow integrations                                                                | Tool-owned. Load only when explicitly invoking or maintaining that integration; never treat generated templates as Equoria direction. |
| `.github/`                                             | GitHub Actions, repository ownership, dependency automation, PR templates, and workflow-consumed prompts/tools | Put GitHub-specific automation here; put reusable implementation scripts in `scripts/`.                                               |
| `.husky/`                                              | Git hook entry points                                                                                          | Keep hooks thin and delegate reusable logic to `scripts/`.                                                                            |
| `.beads/`                                              | Current issue-system database, exports, hooks, and tool backups                                                | Use `bd`; do not hand-edit the database or turn issue storage into documentation.                                                     |
| `.impeccable/`                                         | Root design-tool configuration                                                                                 | Configuration is not design approval. `DESIGN.md` remains authoritative.                                                              |
| `.hyperresearch/`, `research/`, `.venv/`               | Local research database, working corpus, and Python runtime                                                    | Research is evidence only. Keep it ignored/local and promote only owner-approved conclusions into an existing authority.              |
| `.remember/`                                           | Local session-memory state                                                                                     | Never cite it as project authority or copy its logs into docs.                                                                        |
| `.vscode/`                                             | Shared editor settings                                                                                         | Editor configuration only.                                                                                                            |
| `node_modules/` and package-local `node_modules/`      | Installed dependencies                                                                                         | Reproducible output. Never inspect it for product direction or commit it.                                                             |
| `docs/.archive/`                                       | Frozen retired originals awaiting owner extraction                                                             | Never search or load it unless the owner names a historical artifact. Never restore from it merely because active guidance is absent. |

## Where to look and where to write

| Task or artifact                                              | Look first                                                                      | Write to                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Product scope, player promise, rejected product pattern       | `PRODUCT.md`                                                                    | `PRODUCT.md`, only with owner-approved durable direction                                 |
| Visual character, interaction feel, anti-SaaS rule            | `DESIGN.md`, then only the matching design-system trigger in `CLAUDE.md`        | Existing `DESIGN.md` or matching `docs/design-system/` owner                             |
| Backend gameplay/API behavior                                 | Mounted route and `backend/modules/<domain>/`, then schema/tests                | Existing domain module; cross-domain middleware only when genuinely cross-domain         |
| Frontend route or game screen                                 | `frontend/src/pages/`, route config, owned components/hooks                     | Existing page/feature family under `frontend/src/`                                       |
| Shared UI primitive                                           | Existing `frontend/src/components/ui/`, `DESIGN.md`, triggered decisions/tokens | The narrowest existing component family; no new component kit or parallel primitive tree |
| Prisma model or database migration                            | `packages/database/prisma/schema.prisma` and canonical migration history        | `packages/database/prisma/` through the approved Prisma workflow                         |
| Seed/import source data                                       | Owning backend data/seed consumer                                               | `backend/data/`, `backend/seed/`, or an explicitly retained fixture path                 |
| Player-facing static asset/font                               | Current component/CSS consumer and required-asset check                         | `frontend/public/` in the owning asset family                                            |
| Package-local test                                            | Nearest behavior and that package's live test config                            | Colocated/package-defined test location                                                  |
| Cross-package or browser test                                 | Root Jest/Playwright configuration and `tests/` conventions                     | Existing matching directory under `tests/`                                               |
| Repository-wide check or codemod worth retaining              | Package scripts, workflow consumers, existing root scripts                      | Named family under `scripts/`; delete one-off scripts after use                          |
| GitHub workflow or Git hook                                   | `.github/workflows/`, `.husky/`, delegated scripts                              | GitHub/Husky entry point plus reusable root script where needed                          |
| Durable feature contract                                      | `docs/README.md` and live implementation                                        | Existing `docs/features/` only if it passes the documentation creation gate              |
| Cross-cutting architecture decision                           | Live implementation and `docs/architecture/README.md`                           | A numbered ADR only when alternatives and consequences are durable                       |
| Operational runbook                                           | `docs/README.md` and live config/workflows                                      | Existing cross-cutting operational document; do not create a second guide                |
| Audit finding                                                 | Current source and `AGENTS.md`                                                  | Exact active findings path required by `AGENTS.md`, then retire after triage             |
| Work status, next steps, acceptance evidence                  | Current issue/task system                                                       | Beads/current task, not Markdown                                                         |
| Temporary analysis, logs, coverage, screenshots, build output | Producing tool/config                                                           | Ignored tool-output path; delete when no longer useful                                   |
| External research                                             | `research/` only when the active research task requires it                      | Ignored research corpus; promote only an approved conclusion, not the corpus             |

## Creating or retiring a directory

Before creating any directory:

1. Confirm no existing owner in this map fits.
2. Name the live consumer and why locality is impossible.
3. Define what may and may not enter the directory.
4. Define whether it is tracked source, ignored output, or local tool state.
5. Define its retirement condition.
6. For a new top-level root, obtain owner approval and update this file,
   `README.md`, `docs/README.md` when documentation is involved, ignore rules,
   and `CLAUDE.md` loading triggers in the same change.

Retire generated output by deleting it. Retire durable historical documents to
`docs/.archive/` for owner extraction. Retire a live code or compatibility path
only after migrating every consumer. Never preserve active alternatives in
`.backups`, a second source tree, or a newly invented archive.
