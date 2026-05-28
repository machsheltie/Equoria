-- Equoria-qh6jk (2026-05-28): Align migration history with the canonical DB
-- by recording the 17 runtime-created indexes that already exist on the live
-- DB but are NOT declared in schema.prisma and were NOT created by any prior
-- migration file. This unblocks `prisma migrate dev` (shadow-DB drift detector)
-- without touching the canonical DB.
--
-- ROOT CAUSE (read-only investigation, 2026-05-28):
--   These indexes are created at RUNTIME by the application services:
--     - backend/services/databaseOptimizationService.mjs (16 horses indexes,
--       lines 287-289 [GIN on JSONB fields] and 333-336 [composite btree])
--     - backend/services/financialLedgerService.mjs (the user_transactions
--       index, line 20)
--   Each emits `CREATE INDEX IF NOT EXISTS ...` against the live DB during an
--   optimization pass / app startup. Three prior cleanup migrations
--   (20260430000000, 20260501130000, 20260515120000) DROP-IF-EXISTS the same
--   names; on this canonical DB the cleanup migrations applied 2026-05-26
--   but the services subsequently recreated the indexes. The migration
--   history says "these do not exist"; the live DB says "they do" → drift.
--
-- POSTURE CHOICE (per task instructions, see "Note" below):
--   This migration brings the HISTORY into line with the LIVE DB. It does
--   NOT change the live DB (everything is `IF NOT EXISTS`, so on the
--   canonical DB this is a no-op). On a fresh DB built from migrations,
--   this migration creates the same indexes the runtime services would
--   eventually create anyway.
--
-- IDEMPOTENCY:
--   Every statement uses `IF NOT EXISTS`. Re-applying this migration on the
--   canonical DB is a no-op. On a green-field DB it creates 17 indexes.
--   No DROPs, no destructive ops.
--
-- Note (LEAD decision point):
--   The prior cleanup migrations explicitly DROP these names as "orphans"
--   that shouldn't exist (the schema declares only canonical Prisma-named
--   indexes via @@index([...]) decorators). Recording the orphans here
--   contradicts that prior posture and codifies the runtime services'
--   side-effect into migration history. The alternative — STOP the services
--   from creating these indexes (delete the runtime CREATE INDEX calls in
--   databaseOptimizationService.mjs + financialLedgerService.mjs) and then
--   add the desired indexes via @@index in schema.prisma + a normal
--   forward migration — is structurally cleaner but out of scope for this
--   read-only task. The LEAD should choose between:
--     (A) Apply THIS migration (records the status quo, unblocks migrate dev).
--     (B) Delete the runtime CREATE INDEX calls + DROP these orphans on the
--         live DB via a separate migration (structurally cleaner; aligns with
--         the prior 3 cleanup migrations' intent).
--   Option (A) is what this file implements. See bd Equoria-qh6jk for full
--   context.

-- ============================================================================
-- horses table: 16 runtime-created indexes
-- ============================================================================

-- GIN indexes on JSONB / array columns (databaseOptimizationService:287-289)
CREATE INDEX IF NOT EXISTS "idx_horses_discipline_scores_filter" ON "horses" USING GIN ("disciplineScores");
CREATE INDEX IF NOT EXISTS "idx_horses_discipline_scores_gin"    ON "horses" USING GIN ("disciplineScores");
CREATE INDEX IF NOT EXISTS "idx_horses_disciplinescores_gin"     ON "horses" USING GIN ("disciplineScores");
CREATE INDEX IF NOT EXISTS "idx_horses_epigenetic_flags_gin"     ON "horses" USING GIN ("epigeneticFlags");
CREATE INDEX IF NOT EXISTS "idx_horses_epigenetic_flags_search"  ON "horses" USING GIN ("epigeneticFlags");
CREATE INDEX IF NOT EXISTS "idx_horses_epigeneticflags_gin"      ON "horses" USING GIN ("epigeneticFlags");
CREATE INDEX IF NOT EXISTS "idx_horses_epigeneticmodifiers_gin"  ON "horses" USING GIN ("epigeneticModifiers");
CREATE INDEX IF NOT EXISTS "idx_horses_stats_gin"                ON "horses" USING GIN ("conformationScores");
CREATE INDEX IF NOT EXISTS "idx_horses_ultrararetraits_gin"      ON "horses" USING GIN ("ultraRareTraits");

-- Composite btree indexes (databaseOptimizationService:333-336 + curated patterns)
CREATE INDEX IF NOT EXISTS "idx_horses_age_and_training_status"     ON "horses" (age, "trainingCooldown");
CREATE INDEX IF NOT EXISTS "idx_horses_breedid_age"                 ON "horses" ("breedId", age);
CREATE INDEX IF NOT EXISTS "idx_horses_ownerid_stableid"            ON "horses" ("userId", "stableId");
CREATE INDEX IF NOT EXISTS "idx_horses_userid_age"                  ON "horses" ("userId", age);
CREATE INDEX IF NOT EXISTS "idx_horses_userid_age_trainingcooldown" ON "horses" ("userId", age, "trainingCooldown");
CREATE INDEX IF NOT EXISTS "idx_horses_userid_breedid"              ON "horses" ("userId", "breedId");
CREATE INDEX IF NOT EXISTS "idx_horses_userid_createdat"            ON "horses" ("userId", "createdAt");

-- ============================================================================
-- user_transactions table: 1 runtime-created index
-- ============================================================================

-- financialLedgerService:20 (snake_case + DESC ordering, distinct from the
-- canonical schema-declared user_transactions_userId_createdAt_idx).
CREATE INDEX IF NOT EXISTS "user_transactions_user_created_idx"
  ON "user_transactions" ("userId", "createdAt" DESC);
