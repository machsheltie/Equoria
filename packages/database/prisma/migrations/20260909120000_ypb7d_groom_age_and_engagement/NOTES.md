# Operator notes — `20260909120000_ypb7d_groom_age_and_engagement`

**This file exists because `migration.sql` cannot say any of it.** Prisma hashes that file's raw
bytes and stores the hash in `_prisma_migrations` when the migration is applied, so **editing
`migration.sql` after it has been applied anywhere — comments included — breaks
`prisma migrate dev` for every database that applied the old bytes.**

Prisma reads only `migration.sql` from this directory, and
`backend/__tests__/scripts/appliedMigrationChecksumIntegrity.sentinel.test.mjs` hashes only that
file, so notes here are safe to edit forever.

## Do not edit `migration.sql`

It was applied to the local development database on 2026-09-09. Its bytes are now load-bearing.
Anything you want to add about this migration belongs in this file instead. The sibling
`20260908180000_m9lz1_groom_retirement_schedule/NOTES.md` records how this rule was broken twice in
this repository and what it cost; read it before reaching for an "improvement" to the header.

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

## The header of `migration.sql` asserts something now false, and cannot be corrected

`migration.sql` lines 81–85, inside its `MIGRATION STATUS` comment block (lines 78–89), repeat the
claim corrected just above: that `migrate dev` proposes DROPping the 17 `qh6jk` runtime indexes plus
the `system_accounts.updatedAt` default, and that **"those DROP statements must be deleted from any
generated migration before it is applied."**

That block's *other* instructions are still correct and should be followed: apply with
`migrate deploy` and never `migrate dev`, and never edit the file again now that it is applied. Only
the DROP-deletion sentence has gone false. Its pointer to
`.superpowers/sdd/FINDINGS/task-14-report.md` is also a dead end — that path is git-ignored task
scratch and does not survive the branch merge.

**Both halves are false as of Equoria-69gip (2026-09-09), and those bytes can never be fixed.** They
are inside the hash stored in `_prisma_migrations`, so editing them — comments included — would break
`prisma migrate dev` for every database that applied the old bytes and would trip
`backend/__tests__/scripts/appliedMigrationChecksumIntegrity.sentinel.test.mjs`. The line numbers
above are therefore permanently stable, and this note is the only available correction. Read that
block as history, not as instruction.

**Do not follow it.** Hand-editing generated SQL is the specific practice that caused the checksum
breakage this repository has already paid for twice (see the sibling
`20260908180000_m9lz1_groom_retirement_schedule/NOTES.md`). The indexes are declared; there is no
proposal to edit.

## Two objects in here are invisible to Prisma

Both live only in the raw SQL, and a generated migration that proposes dropping either must have
that DROP edited out:

| Object | What it enforces |
| --- | --- |
| `grooms_start_age_range` (CHECK) | `startAge IS NULL OR startAge BETWEEN 18 AND 24` — the band `drawStartAge()` in `backend/modules/grooms/services/groomAgeService.mjs` draws from. Widening one without the other produces a write error rather than a silently wider distribution, which is the point. NULL is admitted because the column lands on existing rows with no backfill. |
| `groom_engagements_active_groomId_key` (partial UNIQUE, `WHERE "endedAt" IS NULL`) | A groom works for at most one player at a time. Partial for the same reason `kccmt`'s staff-assignment indexes are: the rule applies to the OPEN row, and history must be free to hold many closed rows for the same groom. |

`packages/database/prisma/schema.prisma` carries `///` comments on `Groom.startAge` and
`GroomEngagement` pointing here.

## What the two new `grooms` columns mean

- **`startAge`** — the groom's age when they entered the game, drawn once from 18..24. The groom's
  CURRENT age is `startAge + careerWeeks`, because `careerWeeks` already advances once per weekly
  career pass and one weekly pass is one game-year on Equoria's clock
  (`backend/utils/horseAge.mjs`). There is no second age counter and no second clock. A groom with
  `startAge` NULL has no known age and is not retired by the age rule until the weekly pass draws
  one.
- **`feeUnpaidSince`** — the pay-week start (Monday 00:00 UTC, `getPayWeekStart`) of the first
  weekly fee the engaging player could not pay. NULL means paid up. Non-NULL means the groom is
  inside the owner's one-week grace period: still on that player's staff, but barred from grooming.
  When a strictly later pay week arrives with it still set, a full week has gone unpaid and the
  weekly fee pass releases the groom to the grooms-for-hire pool.

## Environment status

| Environment | Applied |
| --- | --- |
| local development (`equoria`) | yes, 2026-09-09 |
| every other environment | **no** — needs the `migrate deploy` + `generate` above |

Additive only: two nullable columns, one CHECK, one `CREATE TABLE`, two FKs, one partial unique
index and two plain indexes. No DELETE, UPDATE or TRUNCATE, no column dropped or retyped, and no
backfill — existing grooms get a `startAge` from the weekly career pass's idempotent
`ensureStartAge`, and an engagement row from the weekly fee pass's idempotent
`ensureEngagementTx`.

## Two identifiers in `migration.sql` are wrong, and cannot be corrected there

Fix round 1, finding F10. The header of the applied `migration.sql` names
`ensureEngagement`; the function is **`ensureEngagementTx`**. That file's bytes are inside the
applied checksum, so the name cannot be corrected in place — this note is the correction, which is
the whole reason this file exists. `ensureStartAge` in the same block is correct as written.

Since Equoria-ypb7d fix round 1, a legacy protégé
(`groomLegacyService.generateLegacyProtege`) also draws its own `startAge` and opens its own
engagement inside its creation transaction, so it no longer depends on either backstop. The
backstops remain for the rows that predate the migration.
