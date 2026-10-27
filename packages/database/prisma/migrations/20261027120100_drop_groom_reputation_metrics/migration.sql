-- Owner ruling 2026-10-27 (q128, Equoria-q4dko): the groom reputation / performance system is
-- retired. Nothing has fed it since POST /groom-performance/record was closed
-- (Equoria-bvddn.6), so every groom's scores sat at their defaults and every record row was
-- either a test fixture or a player-authored value. Staff never gain XP (owner, 2026-10-21).
--
-- DESTRUCTIVE and intended: both tables are dropped with their indexes and foreign keys.
-- Nothing else references them.

DROP TABLE IF EXISTS "groom_performance_records";
DROP TABLE IF EXISTS "groom_metrics";
