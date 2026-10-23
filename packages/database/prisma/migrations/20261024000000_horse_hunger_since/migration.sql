-- Equoria-qwz60 - owner ruling q12/q13 (2026-10-23): hunger is a five-level fill
-- bar. A feeding below Excellent raises it one level, so the hunger clock needs
-- its own instant ("hungerSince"); lastFedDate stays the real time of the last
-- feeding (the once-a-day rule at Excellent). Additive: one nullable column, no
-- backfill (NULL means "count from lastFedDate", which is what every horse did).

ALTER TABLE "horses" ADD COLUMN "hungerSince" TIMESTAMP(3);
