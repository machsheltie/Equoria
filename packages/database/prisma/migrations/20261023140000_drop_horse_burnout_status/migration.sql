-- Equoria-0gl9o — owner ruling 2026-10-23 (Stacey), following Equoria-0d4wa
-- (2026-10-22: there is no burnout; bad health is the only consequence).
-- Drop Horse.burnoutStatus, the grooming 'burnout immunity' label. Nothing
-- read it (no gate, no effect, no frontend consumer); local data 2026-10-22
-- held 'none' on every horse. The consecutive-day care streak
-- (daysGroomedInARow) is a separate column and stays.
--
-- No index, constraint or view references the column.

-- AlterTable
ALTER TABLE "horses" DROP COLUMN "burnoutStatus";
