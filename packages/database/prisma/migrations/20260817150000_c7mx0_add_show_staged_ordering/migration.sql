-- Equoria-c7mx0: scored-ordering staging (2026-07-06 approved decision).
-- Written in the SAME atomic UPDATE as the 'open' -> 'executing' claim, so a
-- persisted 'executing' status always carries the ordering scored at claim
-- time. The payout phase (and any crash-recovery re-drive by the
-- show-execution reaper) is a pure replay of this array — placements and
-- scores are never re-rolled after the claim. Cleared alongside claimedAt on
-- every terminal ('completed') write.
ALTER TABLE "shows" ADD COLUMN "stagedOrdering" JSONB;
