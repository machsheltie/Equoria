# Documentation Constitution

**Status:** Active governance
**Owner:** Project owner
**Last reviewed:** 2026-08-19

This file governs every tracked document in `docs/` and every Markdown file an
agent proposes to add elsewhere in the repository. Read it before creating,
moving, splitting, merging, reviving, or retiring documentation. It is a
routing and lifecycle contract, not general implementation context.

## Authority order

When sources disagree, use this order:

1. the owner's current instruction or ruling;
2. root `PRODUCT.md` for product identity and player experience;
3. root `DESIGN.md` for player-facing visual and interaction direction;
4. `CLAUDE.md`, `AGENTS.md`, and applicable `.claude/rules/` for agent conduct;
5. a narrowly applicable active decision, contract, or runbook listed in
   `docs/README.md`;
6. live source, schema, configuration, tests, and executable gates for current
   implementation behavior;
7. the current issue/task system for work status and sequencing.

Archived material, generated reports, completed plans, retrospectives, and
old issue narratives are evidence only. They never outrank an active source
and never grant permission to implement anything.

## The creation gate

Do not create a document merely because writing one is easy. Before adding a
tracked Markdown file, answer all of these questions:

1. What exact future task becomes safer or faster because this file exists?
2. Which durable fact cannot be recovered safely from source, tests, config,
   Git history, the current issue, `PRODUCT.md`, or `DESIGN.md`?
3. What is the file's single owner and single home in the map below?
4. What exact task trigger tells Claude to load it?
5. Which live sources must be checked before trusting it?
6. What event makes it obsolete, and who retires it?

If any answer is missing, do not create the file. Put temporary reasoning,
status, acceptance evidence, and next steps in the current issue/task or the
user-facing handoff instead.

### Documents prohibited by default

Claude must not create any of these unless the owner explicitly requests a
durable repository artifact and names its purpose:

- implementation summaries, completion reports, handoffs, session notes, or
  “what I changed” files;
- readiness/status snapshots, generated inventories, test-count reports, or
  source-tree scans;
- a second PRD, roadmap, backlog, sprint tracker, or issue mirror;
- one-off plans, audit reports, retrospectives, or traceability matrices;
- copied endpoint, schema, component, route, package, or configuration lists;
- framework tutorials, generic best-practice guides, or library recipes;
- documents whose real purpose is to make an agent remember to read another
  document.

The normal output of a completed task is changed code plus verification in the
task response—not a new Markdown souvenir.

## Approved homes

| Home                          | What belongs there                                                                                                           | What does not                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `PRODUCT.md`                  | Durable product identity, player promise, feature boundaries, rejected product structures                                    | implementation status, package permission, component recipes                |
| `DESIGN.md`                   | Durable art direction and player-facing visual/interaction rules                                                             | route inventories, migration plans, generic component-library conventions   |
| `docs/design-system/`         | Accepted cross-route design decisions, tokens, motion, active exception register, narrowly routed implementation inventories | premade-library doctrine, page templates, feature requirements              |
| `docs/features/`              | A small number of durable feature contracts with expensive gameplay, economy, privacy, state-machine, or concurrency rules   | completed implementation plans, code sketches, UI layouts, issue sequencing |
| `docs/architecture/`          | Accepted cross-cutting ADRs with meaningful alternatives and consequences                                                    | source-tree tours, audits, feature plans, product or visual decisions       |
| `docs/api-contracts-backend/` | Narrow security/behavior contracts protected by a named source and drift check                                               | hand-copied endpoint catalogs or aspirational APIs                          |
| `docs/audits/`                | The exact current findings path required by `AGENTS.md`, only while an audit is active                                       | permanent status reports or parallel backlogs                               |
| `docs/testing/`               | Narrow, cross-config operational test-profile references                                                                     | testing tutorials, coverage snapshots, copied commands                      |
| `docs/legal/`                 | Owner-approved legal text                                                                                                    | engineering policy or speculative compliance claims                         |
| `docs/product/`               | Compatibility stubs required by executable tests                                                                             | active product direction or a second PRD set                                |
| `docs/*.md`                   | Cross-cutting operational references and test-required compatibility paths listed in `docs/README.md`                        | feature-local detail or uncategorized leftovers                             |
| `docs/.archive/`              | Retired originals awaiting external legacy extraction                                                                        | active context, fallback specifications, or templates                       |

Do not create a new top-level documentation folder without updating this map,
`docs/README.md`, and the conditional loading rules in `CLAUDE.md` in the same
change. A folder name is not a new document class.

## Repository structure and file placement

`REPOSITORY_MAP.md` owns the directory map, lookup order, file destinations,
compatibility-only roots, generated-output lifecycle, and new-directory gate.
Load it only when locating an unfamiliar subsystem or creating, moving,
renaming, consolidating, or retiring a repository path. Do not preload it for
ordinary work after the owning path is known.

The documentation-specific homes above remain governed by this file. A new
top-level documentation folder requires updates to this file, `docs/README.md`,
`REPOSITORY_MAP.md`, and the matching `CLAUDE.md` trigger in the same change.

## Required document contract

Every new active document must begin with enough metadata to prevent accidental
authority expansion:

```markdown
**Status:** Active contract | Active decision | Active runbook
**Owner:** person or subsystem
**Last verified:** YYYY-MM-DD
**Load only when:** exact task trigger
**Do not load for:** adjacent but out-of-scope work
**Live sources:** paths/configuration/tests that must be checked
**Retire when:** objective trigger
```

Use `Planned` only for an owner-approved feature that is not implemented, and
say so in the first screenful. Never label a document `canonical`, `complete`,
`verified`, or `source of truth` unless an executable mechanism keeps that
claim true.

## Task-to-document routing

Start with the smallest row whose trigger matches. Never load a directory
wholesale.

| Work                                                        | Read                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Player-facing product or UI                                 | `PRODUCT.md` and `DESIGN.md`, then only the design-system files triggered by `CLAUDE.md`               |
| A named feed or stud-service rule                           | The exact file in `docs/features/`, plus live source/tests                                             |
| A named cross-cutting architecture decision                 | The exact ADR in `docs/architecture/`                                                                  |
| Rate-limit behavior                                         | `docs/api-contracts-backend/rate-limiting.md` and live middleware/tests                                |
| Ordinary implementation or debugging                        | Source, tests, config, current issue; no broad docs preload                                            |
| Test commands                                               | `AGENTS.md`, package scripts, and live test config                                                     |
| Playwright beta profiles                                    | `docs/testing/BETA_PROFILE.md`                                                                         |
| CI, Railway, Docker, release, or scaling                    | `docs/devops-cicd.md` and live configuration                                                           |
| Schema, data, dependency-major, or auth-sensitive migration | `docs/migration-deploy-checklist.md`, live schema/history/config, and current official vendor guidance |
| Security testing                                            | `docs/SECURITY_TESTING.md` and live tests/doctrine                                                     |
| Sentry/telemetry                                            | `docs/SENTRY_SETUP.md` and live configuration                                                          |
| Local onboarding                                            | `docs/development-guide.md` and package/config sources                                                 |
| Documentation work                                          | This file and `docs/README.md`                                                                         |

An old citation in a test comment does not trigger a retired document. The
assertion and live implementation own the behavior unless the owner explicitly
requests historical review.

## Review protocol

Before relying on an active document:

1. Confirm its status and exact load trigger match the task.
2. Read its named live sources; prose never proves current implementation.
3. Check for conflicts with the authority order above.
4. Separate durable decisions from dated examples, paths, counts, and status.
5. If it drifted, fix or retire it in the same authorized change. Do not work
   around the conflict by creating another document.

For player-facing work, a technical document cannot approve a dependency,
page shell, chart, toast, modal, card grid, tab structure, or other presentation
pattern. Those decisions remain governed by `PRODUCT.md`, `DESIGN.md`, and the
triggered design-system files.

## Update, merge, and retirement rules

- Update a durable contract in the same change that intentionally changes its
  governed behavior.
- Merge documents when they share the same audience, authority, load trigger,
  live sources, and retirement event. Link them when only one of those differs.
- Split a file only when its sections have genuinely different load triggers.
  File size alone is not a reason to create a shard forest.
- Delete generated output that can be reproduced and has no historical value.
- Move every other retired original to
  `docs/.archive/retired-YYYY-MM-DD/<former-relative-path>`.
- After a move, repair active links, `CLAUDE.md`, scripts, and indexes. Do not
  leave redirect stubs unless an executable consumer requires the old path.
- Archived files are frozen. Never edit one into current truth or copy its
  instructions back into active context. Restore only by owner decision and a
  fresh source review.

Retire a document when its task completes, its decision is superseded, its
status can no longer be proven, its content duplicates live sources, or it no
longer passes the creation gate. `docs/.archive/` is a handoff shelf, not a
second documentation library; the owner removes it to protected legacy storage.

## Claude hard stops

- Do not create a Markdown file without applying the creation gate.
- Do not create a new docs folder because an existing category feels crowded.
- Do not turn a task plan or audit into standing implementation authority.
- Do not preserve contradictory advice with warning labels; retire it.
- Do not make a document “current” by changing only its date.
- Do not infer completeness from a polished document, table, diagram, or code
  sample.
- Do not use archived material to fill gaps in active requirements.
- If the right home or authority is unclear, ask the owner before creating the
  artifact.
