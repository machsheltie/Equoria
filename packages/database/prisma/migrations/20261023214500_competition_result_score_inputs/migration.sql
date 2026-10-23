-- Equoria-4q02c - owner ruling q01 (2026-10-23): record each ridden show entry
-- score inputs (luck roll, temperament modifier and the other factors) on its
-- result, for the Owner and Admins to audit. Additive: one nullable JSONB
-- column, no backfill (earlier results stay NULL).

ALTER TABLE "competition_results" ADD COLUMN "scoreInputs" JSONB;
