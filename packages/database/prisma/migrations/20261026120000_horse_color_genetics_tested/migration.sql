-- Equoria-7dmzp (owner ruling 2026-10-26, q78): the Veterinarian sells a paid
-- Genetic Testing panel (500 coins). Whether a horse has been tested is stored
-- on the horse. Equoria-8tz7p reads it to reveal colour genetics on the
-- Genetics tab; until then the flag only records the purchase.
-- Existing horses are untested.
ALTER TABLE "horses" ADD COLUMN "colorGeneticsTested" BOOLEAN NOT NULL DEFAULT false;
