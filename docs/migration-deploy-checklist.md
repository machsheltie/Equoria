# Migration and Deployment Safety

**Status:** Active runbook
**Owner:** Database and deployment configuration
**Last reviewed:** 2026-08-19
**Load only when:** planning or reviewing a dependency-major, Prisma/schema, data, or authentication/authorization migration
**Do not load for:** ordinary package use, patch/minor updates, routine Prisma queries, or unrelated implementation
**Live sources:** manifests/lockfiles, Prisma schema and migration history, `railway.toml`, affected readers/writers/tests, target platform configuration, and current official vendor guidance

## Trigger

Use the general migration rules for every dependency-major, schema, or data
change. Apply the authentication-sensitive section as well when a Prisma
migration purges, rehashes, changes identity/ownership semantics, or
restructures rows used to authenticate or authorize players—for example
`User`, refresh/verification tokens, sessions, MFA data, or a future
access-control table. If impact is uncertain, treat the sensitive section as
triggered until source and migration SQL prove otherwise.

This checklist does not authorize running a migration or changing production data.

## General migration rules

Plan one target at a time. A newer dependency version or generated migration
does not authorize its own adoption or execution.

For a dependency-major change:

- record the exact installed and proposed versions from current manifests and
  lockfiles;
- use the vendor's current official release notes and migration guide;
- establish a clean relevant baseline before changing dependencies;
- identify runtime, peer, type, plugin, config, and deployment compatibility;
- separate required migration work from unrelated refactoring;
- define focused checks, full regression gates, rollout, and rollback;
- retire any task-specific plan after completion.

Before creating or applying Prisma/SQL:

- confirm the change and target environment are explicitly authorized;
- inspect schema, migration history, deployment ordering, and every affected
  reader/writer;
- review generated SQL; generated output is never self-approving;
- define old/new compatibility, backfill/cutover/cleanup phases, locking and
  data-volume risk, and rollback or forward repair;
- replay migrations against a fresh disposable database and test the affected
  behavior;
- never use destructive reset or data-loss commands against shared or
  production data.

Production execution requires current backup/recovery, ordering, observation,
success, abort, and failure-handling criteria. A development migration file is
not a production runbook.

## Authentication-sensitive rationale

A historical refresh-token hashing migration invalidated stored token rows while older workers could still serve refresh requests. Missing tokens were temporarily liable to look like reuse. The runtime now distinguishes the zero-token upgrade cohort with `SESSION_UPGRADE_REQUIRED`; deployment sequencing must still prevent stale workers and new schema/data semantics from overlapping unsafely.

The shared auth limiter currently allows **200 failed** attempts per 15-minute window and skips successful requests. Do not change that control to compensate for a migration. Source, security doctrine, and the drift sentinel own the value.

## Preflight

- [ ] Resolve the exact database/environment and confirm it is the intended target.
- [ ] Read the migration SQL, affected Prisma models, every runtime reader/writer, and rollback/forward-repair constraints.
- [ ] Measure the expected affected-row cohort using a read-only query approved for the target environment.
- [ ] State expected player impact, including forced reauthentication, temporary unavailability, and any irreversible transformation.
- [ ] Confirm old application code can coexist with the new schema/data. If not, design an explicit drain/maintenance/compatibility phase supported by the actual platform; do not invent a feature flag or endpoint that does not exist.
- [ ] Confirm missing-row behavior fails safely and does not misclassify expected migration fallout as token theft/reuse.
- [ ] Add or identify current tests for the transformation and the old/new runtime boundary.
- [ ] Establish backup/restore or forward-repair capability appropriate to the migration before mutation begins.
- [ ] Define exact success, abort, and observation thresholds.

## Deployment

1. Stop incompatible old/new code overlap using the deployment mechanism actually available for the target platform.
2. Run `prisma migrate deploy` through the configured fail-fast path. Do not swallow, background, or continue after a migration failure.
3. Verify migration status and the expected row-count/data invariants before accepting application health.
4. Start or release compatible application instances only after the migration success criteria hold.
5. Keep the operation observable until authentication traffic and error rates stabilize.

Railway's current start sequence lives in `railway.toml`. Read it immediately before planning; this document does not duplicate its shell command or URL-selection details.

## Postflight

- [ ] Verify login, refresh, logout, verification, MFA, and affected authorization paths as applicable.
- [ ] Compare expected and actual transformed/purged row counts.
- [ ] Monitor Sentry and server/audit logs for `SESSION_UPGRADE_REQUIRED`, token-reuse signals, authentication failures, rate-limit saturation, and unexpected authorization failures.
- [ ] Confirm no stale application instances remain.
- [ ] Record actual impact and any forward repair in the migration/issue evidence, not as a permanent status claim in this runbook.

Pause further mutation and escalate if expected counts diverge, migration status is ambiguous, stale code is still serving, or security signals cannot be distinguished from planned cohort behavior.

## Out of scope

- General database engine/storage migrations
- JWT signing-secret rotation
- Permission to raise rate limits, disable controls, mutate production, or perform rollback

Use `.claude/rules/SECURITY.md`, current schema/migrations, official vendor
guidance, and platform configuration for those concerns.
