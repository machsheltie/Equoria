-- 31D-4 (Equoria-gi9o): persist temperament-groom synergy modifier on each interaction
-- for analytics. Nullable + default 0 keeps existing rows valid.
ALTER TABLE "groom_interactions" ADD COLUMN "synergyModifier" DOUBLE PRECISION DEFAULT 0;
