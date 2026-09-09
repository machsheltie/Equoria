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

## The header of `migration.sql` is stale in three places, and cannot be corrected

Read the last comment block of `migration.sql` — "MIGRATION STATUS AT THE TIME THIS FILE WAS
WRITTEN" — as history, not as instruction. Three of its sentences are false now, and because those
bytes are inside the applied checksum they can never be fixed in place. That is the whole reason
this file exists; corrections live here.

1. **"Prepared, NOT applied to any environment."** It *is* applied — to the local development
   database, on 2026-09-08, after that header was written. The Environment status table at the
   bottom of this file is the live answer.
2. **"Whoever applies it should read `.superpowers/sdd/FINDINGS/task-14-report.md` first."** Do not
   go looking. That path is git-ignored working scratch for one task and is deleted when this branch
   merges; it will not exist for the operator who needs it.

   The surviving successor for the DROP-hazard detail the header was pointing at is the schema
   itself: the `///` comment blocks on **`Horse`**, **`UserTransaction`** and **`SystemAccount`** in
   `packages/database/prisma/schema.prisma`. Read those. As of Equoria-69gip they say the opposite of
   what the header says — see item 3.
3. **"`prisma migrate dev` … proposes DROPping the 17 raw-SQL runtime indexes from `qh6jk` plus
   `ALTER COLUMN "system_accounts"."updatedAt" DROP DEFAULT`, and those DROP statements must be
   deleted from any generated migration before it is applied."** (`migration.sql` lines 53–58, inside
   that same final comment block. Those line numbers are permanently stable — the bytes are inside
   the applied checksum and can never change.) **Both halves are now false, and this one is the
   dangerous one.**

   Equoria-69gip (2026-09-09) declared those indexes in
   `packages/database/prisma/schema.prisma`, each with `map:` pinning the name the `qh6jk` migration
   already created, and declared `SystemAccount.updatedAt @default(now())` to describe the default
   the `si69u` migration already created. Measured read-only with
   `prisma migrate diff --from-schema-datasource <schema> --to-schema-datamodel <schema> --script`
   against the local `equoria` database: the proposal went from 17 `DROP INDEX` + 1 `ALTER COLUMN`
   to `-- This is an empty migration.` **So there is no longer any such proposal, and there is
   nothing to delete from a generated migration.**

   **Do not follow the instruction in those bytes.** Hand-editing generated SQL was never the right
   remedy, and it is the specific practice that caused the checksum breakage described above in
   "Do not edit `migration.sql`". If a `migrate dev` proposal ever again contains a `DROP INDEX` for
   one of those names, that is now an ALARM — it means a declaration was deleted from
   `schema.prisma` — and the fix is to restore the declaration, never to edit the generated SQL.

Nothing else in the header has gone stale: the reasoning about the separate table, the CHECK
constraint, and the additive-only safety analysis all still describe the migration accurately.

## Apply this with `migrate deploy`, never `migrate dev`

```
node packages/database/node_modules/prisma/build/index.js migrate deploy \
  --schema packages/database/prisma/schema.prisma
node packages/database/node_modules/prisma/build/index.js generate \
  --schema packages/database/prisma/schema.prisma
```

Still use `migrate deploy`: this migration is hand-written, and `migrate dev` would generate its own
migration rather than apply this one.

**Corrected 2026-09-09 (Equoria-69gip).** This paragraph used to say that `migrate dev` proposes
DROPping the 17 raw-SQL runtime indexes from `qh6jk` (16 × `idx_horses_*`, plus
`user_transactions_user_created_idx`) plus
`ALTER COLUMN "system_accounts"."updatedAt" DROP DEFAULT`, and that those DROP statements had to be
deleted from any generated migration before applying it. **That is no longer true, and the deletion
instruction was the wrong remedy in the first place.** Those indexes are now DECLARED in
`packages/database/prisma/schema.prisma` with `map:` pinning each existing name, and
`SystemAccount.updatedAt` declares `@default(now())`. Measured against the local `equoria` database:
the proposal is `-- This is an empty migration.` Nothing is generated, so nothing needs deleting.

If a generated proposal ever again contains `DROP INDEX` for one of those names, treat it as an
ALARM rather than as routine noise to edit out: it means a declaration was removed from
`schema.prisma`, and the fix is to restore the declaration. The authoritative, maintained record is
the `///` comment blocks on `Horse`, `UserTransaction` and `SystemAccount` in
`packages/database/prisma/schema.prisma` — check them, not this paragraph.

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
