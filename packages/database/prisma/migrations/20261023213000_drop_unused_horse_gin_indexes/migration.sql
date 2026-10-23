-- Equoria-34dad - owner decision 32 (Stacey, 2026-10-19; q37, 2026-10-23): drop the
-- three never-used GIN indexes on "horses". Unused, each only costs write time
-- and disk. Definitions as read from the live database:
--   idx_horses_epigeneticmodifiers_gin  USING gin ("epigeneticModifiers")
--   idx_horses_stats_gin                USING gin ("conformationScores")
--   idx_horses_ultrararetraits_gin      USING gin ("ultraRareTraits")
-- The matching @@index declarations leave schema.prisma in the same commit.
-- IF EXISTS keeps the migration safe on a database that never had them.

DROP INDEX IF EXISTS "idx_horses_epigeneticmodifiers_gin";
DROP INDEX IF EXISTS "idx_horses_stats_gin";
DROP INDEX IF EXISTS "idx_horses_ultrararetraits_gin";
