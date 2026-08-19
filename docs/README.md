# Equoria Documentation Map

**Status:** Active index
**Last reviewed:** 2026-08-19

`docs/` is deliberately small and routed. Read
[`DOCUMENTATION.md`](DOCUMENTATION.md) before creating, moving, merging, or
retiring any documentation. Never preload the directory.

Root `PRODUCT.md` and `DESIGN.md` are the product and visual authorities.
`CLAUDE.md` supplies exact conditional loading rules. Live source, schema,
configuration, tests, and executable gates own current implementation behavior.

For repository layout and file placement, read
[`REPOSITORY_MAP.md`](REPOSITORY_MAP.md) only when locating an unfamiliar
subsystem or deciding where a path belongs. It is not ordinary implementation
context.

## Active map

| Area                                               | Purpose                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [`design-system/`](design-system/)                 | Accepted visual decisions, tokens, motion, exceptions, and narrowly routed implementation inventories |
| [`features/`](features/)                           | Durable contracts for feed/pregnancy care and the planned cross-owner stud-service economy            |
| [`architecture/`](architecture/)                   | Small active ADR collection                                                                           |
| [`api-contracts-backend/`](api-contracts-backend/) | Narrow, drift-protected backend contracts; currently rate limiting only                               |
| [`testing/`](testing/)                             | Cross-config Playwright beta-profile reference                                                        |
| [`audits/`](audits/)                               | Reserved current findings location required by `AGENTS.md`; not ordinary context                      |
| [`legal/`](legal/)                                 | Legal text                                                                                            |
| [`product/`](product/)                             | Test-required compatibility stubs; never product authority                                            |
| [`.archive/`](.archive/)                           | Retired originals awaiting owner extraction; never active context                                     |

## Cross-cutting operational references

| File                                                             | Load only when                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`REPOSITORY_MAP.md`](REPOSITORY_MAP.md)                         | Locating an unfamiliar subsystem or creating, moving, consolidating, or retiring a path  |
| [`development-guide.md`](development-guide.md)                   | Local onboarding, environment setup, or command discovery                                |
| [`devops-cicd.md`](devops-cicd.md)                               | CI, hooks, Docker, Railway, release operations, database-pool or process/replica scaling |
| [`migration-deploy-checklist.md`](migration-deploy-checklist.md) | Dependency-major, Prisma/schema/data, or authentication-sensitive migration work         |
| [`SECURITY_TESTING.md`](SECURITY_TESTING.md)                     | Security-control tests, security CI, or security-coverage claims                         |
| [`SENTRY_SETUP.md`](SENTRY_SETUP.md)                             | Sentry, telemetry, alert thresholds, or monitoring privacy                               |
| [`beta-route-truth-table.md`](beta-route-truth-table.md)         | Beta route classification and its machine-read drift test                                |

`beta-signoff.yaml` is an executable-process record maintained by the beta
readiness workflow. It is not a product roadmap or a standing claim that beta
is ready.

## Compatibility-only paths

These files remain because executable doc-drift tests read their exact paths:

- `architecture.md`
- `project_context.md`
- `SECURITY_ASSESSMENT_REPORT.md`
- `product/PRD-02-Core-Features.md`
- `product/PRD-08-Security-Architecture.md`

They are intentionally tiny and non-authoritative. Do not load them for
ordinary work, expand them into replacement documents, or infer that their old
titles represent active document categories.

## What no longer lives here

Generated sprint stories, retrospectives, roadmaps, status files, historical
Claude imports, stale breed data, one-off plans, diagrams, audits, technical
specs, test matrices, and governance-only folder READMEs were retired to the
dated archive. Runtime breed source data lives at `backend/data/breeds/`.
Current work status lives in the issue/task system, not Markdown.

If the needed information is not in this map, inspect the live implementation
or ask the owner. Do not search the archive for a convenient answer.
