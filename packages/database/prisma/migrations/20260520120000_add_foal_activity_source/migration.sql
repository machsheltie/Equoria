-- Equoria-8yhe3: add a stream-source discriminator to foal_activities so the
-- taskLog-count derivation (foalActivityStore.deriveTaskCountsFromActivities)
-- can ENFORCE the disjointness of its two writers in code rather than relying
-- on an unenforced activityType naming convention.
--
-- Two writers land rows in this table:
--   * groomController.recordInteraction  -> taskLog-driving GROOM stream
--   * foalModel.completeActivity          -> legacy foal ENRICHMENT-day stream
-- The derivation must only count the groom stream; an enrichment row must NOT
-- be able to inflate a taskLog key via a namespace collision.

-- AddColumn (nullable; legacy rows backfilled below, future rows set by writers)
ALTER TABLE "foal_activities" ADD COLUMN "source" TEXT;

-- Backfill existing rows idempotently. The two streams use DISJOINT activityType
-- namespaces (enrichment types are the closed set produced by
-- foalModel.getAvailableActivities; the groom path writes raw interactionType
-- strings). Classify by the enrichment allow-list: any existing row whose
-- activityType is a known enrichment type came from completeActivity; everything
-- else came from the groom co-writer (recordInteraction, the only other writer
-- of canonical rows). Idempotent: re-running only sets rows still NULL.
UPDATE "foal_activities"
SET "source" = 'enrichment_activity'
WHERE "source" IS NULL
  AND "activityType" IN (
    'gentle_touch', 'quiet_presence', 'soft_voice', 'feeding_assistance',
    'grooming_intro', 'play_interaction', 'walking_practice',
    'environment_exploration', 'social_introduction', 'halter_introduction',
    'leading_practice', 'handling_exercises', 'trailer_exposure',
    'obstacle_introduction', 'grooming_advanced', 'training_games',
    'confidence_building', 'new_experiences', 'independence_practice',
    'final_assessment', 'graduation_ceremony', 'future_planning'
  );

UPDATE "foal_activities"
SET "source" = 'groom_interaction'
WHERE "source" IS NULL;

-- CreateIndex (supports the source-filtered groupBy in the derivation)
CREATE INDEX "foal_activities_foalId_source_idx" ON "foal_activities"("foalId", "source");
