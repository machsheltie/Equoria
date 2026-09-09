# Operator notes — `20260908180000_m9lz1_groom_retirement_schedule`

**This file exists because `migration.sql` cannot say any of it.** Prisma hashes that file's raw
bytes and stores the hash in `_prisma_migrations` when the migration is applied, so **editing
`migration.sql` after it has been applied anywhere — comments included — breaks
`prisma migrate dev` for every database that applied the old bytes.**

Prisma reads only `migration.sql` from this directory, and
`backend/__tests__/scripts/appliedMigrationChecksumIntegrity.sentinel.test.mjs` hashes only that
file, so notes here are safe to edit forever.

## Do not edit `migration.sql`

It was applied to the local development database on 2026-09-08. Its bytes are now load-bearing.
Anything you want to add about this migration belongs in this file instead.

This is not hypothetical: Equoria-mxftz spent two rounds repairing exactly this defect in
`20260430055822_feed_phase_a`, where `fee265d07` reworded a comment block in an already-applied
migration and left `prisma migrate dev` refusing to run for three weeks. During Equoria-m9lz1 fix
round 1 I then reintroduced the same defect in *this* migration by rewriting its header after
applying it — caught by the checksum sentinel that Equoria-mxftz built for the purpose, and repaired
by restoring the exact bytes from commit `e024e964f`. The lesson survives here rather than in the
file it is about.

**On this file's location.** Equoria-mxftz stated the same rule in the docs tree
(`docs/features/feed-system.md`), and its own migration directory holds only `migration.sql`. Putting
the note *here* instead is a deliberate deviation, not that precedent: the warning belongs where
someone about to edit the migration is already looking, which is exactly where my round-1 edit went
wrong — I had read the rule in the docs file and broke it here anyway. If a future maintainer prefers
the docs tree for consistency, move this file and update the pointer in
`packages/database/prisma/schema.prisma`; nothing depends on it living here.

## Apply this with `migrate deploy`, never `migrate dev`

```
node packages/database/node_modules/prisma/build/index.js migrate deploy \
  --schema packages/database/prisma/schema.prisma
node packages/database/node_modules/prisma/build/index.js generate \
  --schema packages/database/prisma/schema.prisma
```

`migrate dev` on this repository proposes DROPping the 17 raw-SQL runtime indexes from `qh6jk`
(`idx_horses_*`, `user_transactions_user_created_idx`) plus
`ALTER COLUMN "system_accounts"."updatedAt" DROP DEFAULT`. Those DROP statements must be deleted
from any generated migration before it is applied. This migration is hand-written precisely so that
proposal never has to be accepted.

## The CHECK constraint is invisible to Prisma

`groom_retirement_schedules_age_range` (`retirementAge BETWEEN 50 AND 65`) exists only in the raw
SQL — Prisma cannot express a CHECK constraint, the same way it cannot express the `qh6jk` runtime
indexes or the `kccmt` partial unique indexes. If a future generated migration proposes dropping it,
edit that DROP out. It is a second enforcement of the band that
`backend/modules/grooms/services/groomRetirementScheduleService.mjs` draws from, so widening one
without the other produces a write error rather than a silently wider distribution — which is the
point.

## Environment status

| Environment | Applied |
| --- | --- |
| local development (`equoria`) | yes, 2026-09-08 |
| every other environment | **no** — needs the `migrate deploy` + `generate` above |

Additive only: `CREATE TABLE`, one FK, one CHECK. No DELETE, UPDATE or TRUNCATE, no column dropped
or retyped, and no backfill — existing grooms get a schedule from the weekly pass's idempotent
`ensureRetirementSchedule` backstop.
