-- =====================================================
-- Migration: Add Horse Bonding and Foal Training History
-- Description: Adds bond_score and stress_level columns to horses table
--              and creates foal_training_history table for detailed tracking
-- Date: 2025-05-25
-- Version: 1.0
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- FORWARD MIGRATION
-- =====================================================

-- Add bond_score column to horses table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Horse' AND column_name = 'bond_score'
    ) THEN
        ALTER TABLE "Horse" ADD COLUMN "bond_score" INTEGER DEFAULT 50;
        
        -- Add constraint to ensure bond_score is between 0 and 100
        ALTER TABLE "Horse" ADD CONSTRAINT "Horse_bond_score_check" 
        CHECK ("bond_score" >= 0 AND "bond_score" <= 100);
        
        -- Add comment for documentation
        COMMENT ON COLUMN "Horse"."bond_score" IS 'Bonding score between horse and handler (0-100)';
    END IF;
END $$;

-- Add stress_level column to horses table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Horse' AND column_name = 'stress_level'
    ) THEN
        ALTER TABLE "Horse" ADD COLUMN "stress_level" INTEGER DEFAULT 0;
        
        -- Add constraint to ensure stress_level is between 0 and 100
        ALTER TABLE "Horse" ADD CONSTRAINT "Horse_stress_level_check" 
        CHECK ("stress_level" >= 0 AND "stress_level" <= 100);
        
        -- Add comment for documentation
        COMMENT ON COLUMN "Horse"."stress_level" IS 'Current stress level of the horse (0-100)';
    END IF;
END $$;

-- Create foal_training_history table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'foal_training_history'
    ) THEN
        CREATE TABLE "foal_training_history" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "horse_id" INTEGER NOT NULL,
            "day" INTEGER NOT NULL,
            "activity" TEXT NOT NULL,
            "outcome" TEXT NOT NULL,
            "bond_change" INTEGER NOT NULL DEFAULT 0,
            "stress_change" INTEGER NOT NULL DEFAULT 0,
            "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Add foreign key constraint to horses table
        ALTER TABLE "foal_training_history" 
        ADD CONSTRAINT "foal_training_history_horse_id_fkey" 
        FOREIGN KEY ("horse_id") REFERENCES "Horse"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
        
        -- Add constraints for data validation
        ALTER TABLE "foal_training_history" 
        ADD CONSTRAINT "foal_training_history_day_check" 
        CHECK ("day" >= 0 AND "day" <= 6);
        
        ALTER TABLE "foal_training_history" 
        ADD CONSTRAINT "foal_training_history_bond_change_check" 
        CHECK ("bond_change" >= -50 AND "bond_change" <= 50);
        
        ALTER TABLE "foal_training_history" 
        ADD CONSTRAINT "foal_training_history_stress_change_check" 
        CHECK ("stress_change" >= -50 AND "stress_change" <= 50);
        
        -- Create indexes for performance
        CREATE INDEX "foal_training_history_horse_id_idx" ON "foal_training_history"("horse_id");
        CREATE INDEX "foal_training_history_day_idx" ON "foal_training_history"("day");
        CREATE INDEX "foal_training_history_timestamp_idx" ON "foal_training_history"("timestamp");
        CREATE INDEX "foal_training_history_horse_day_idx" ON "foal_training_history"("horse_id", "day");
        
        -- Add comments for documentation
        COMMENT ON TABLE "foal_training_history" IS 'Detailed history of foal training activities and outcomes';
        COMMENT ON COLUMN "foal_training_history"."id" IS 'Unique identifier for training history record';
        COMMENT ON COLUMN "foal_training_history"."horse_id" IS 'Foreign key reference to Horse table';
        COMMENT ON COLUMN "foal_training_history"."day" IS 'Development day (0-6) when activity occurred';
        COMMENT ON COLUMN "foal_training_history"."activity" IS 'Type of training activity performed';
        COMMENT ON COLUMN "foal_training_history"."outcome" IS 'Result/outcome of the training activity';
        COMMENT ON COLUMN "foal_training_history"."bond_change" IS 'Change in bonding score (-50 to +50)';
        COMMENT ON COLUMN "foal_training_history"."stress_change" IS 'Change in stress level (-50 to +50)';
        COMMENT ON COLUMN "foal_training_history"."timestamp" IS 'When the activity was performed';
    END IF;
END $$;

-- Create trigger for updating updated_at timestamp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_foal_training_history_updated_at'
    ) THEN
        -- Create function for updating timestamp
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $trigger$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $trigger$ LANGUAGE plpgsql;
        
        -- Create trigger
        CREATE TRIGGER update_foal_training_history_updated_at
            BEFORE UPDATE ON "foal_training_history"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =====================================================
-- DATA MIGRATION (Optional)
-- =====================================================

-- Update existing horses with default bond_score and stress_level if they are NULL
UPDATE "Horse" 
SET "bond_score" = 50 
WHERE "bond_score" IS NULL;

UPDATE "Horse" 
SET "stress_level" = 0 
WHERE "stress_level" IS NULL;

-- Migrate existing foal_activities data to foal_training_history (if needed)
-- This preserves existing data while providing the new UUID-based structure
INSERT INTO "foal_training_history" (
    "horse_id", 
    "day", 
    "activity", 
    "outcome", 
    "bond_change", 
    "stress_change", 
    "timestamp"
)
SELECT 
    "foalId" as "horse_id",
    "day",
    "activityType" as "activity",
    "outcome",
    "bondingChange" as "bond_change",
    "stressChange" as "stress_change",
    "createdAt" as "timestamp"
FROM "foal_activities"
WHERE NOT EXISTS (
    SELECT 1 FROM "foal_training_history" 
    WHERE "horse_id" = "foal_activities"."foalId" 
    AND "day" = "foal_activities"."day"
    AND "activity" = "foal_activities"."activityType"
    AND "timestamp" = "foal_activities"."createdAt"
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify columns were added successfully
DO $$
DECLARE
    bond_score_exists BOOLEAN;
    stress_level_exists BOOLEAN;
    table_exists BOOLEAN;
BEGIN
    -- Check if bond_score column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Horse' AND column_name = 'bond_score'
    ) INTO bond_score_exists;
    
    -- Check if stress_level column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Horse' AND column_name = 'stress_level'
    ) INTO stress_level_exists;
    
    -- Check if foal_training_history table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'foal_training_history'
    ) INTO table_exists;
    
    -- Report results
    IF bond_score_exists AND stress_level_exists AND table_exists THEN
        RAISE NOTICE 'Migration completed successfully!';
        RAISE NOTICE 'Added bond_score column: %', bond_score_exists;
        RAISE NOTICE 'Added stress_level column: %', stress_level_exists;
        RAISE NOTICE 'Created foal_training_history table: %', table_exists;
    ELSE
        RAISE EXCEPTION 'Migration failed! bond_score: %, stress_level: %, table: %', 
            bond_score_exists, stress_level_exists, table_exists;
    END IF;
END $$;

-- =====================================================
-- ROLLBACK SCRIPT (Run separately if needed)
-- =====================================================

/*
-- ROLLBACK INSTRUCTIONS:
-- To rollback this migration, run the following commands:

-- Drop foal_training_history table and related objects
DROP TRIGGER IF EXISTS update_foal_training_history_updated_at ON "foal_training_history";
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS "foal_training_history";

-- Remove columns from Horse table
ALTER TABLE "Horse" DROP CONSTRAINT IF EXISTS "Horse_bond_score_check";
ALTER TABLE "Horse" DROP CONSTRAINT IF EXISTS "Horse_stress_level_check";
ALTER TABLE "Horse" DROP COLUMN IF EXISTS "bond_score";
ALTER TABLE "Horse" DROP COLUMN IF EXISTS "stress_level";

-- Verification of rollback
DO $$
DECLARE
    bond_score_exists BOOLEAN;
    stress_level_exists BOOLEAN;
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Horse' AND column_name = 'bond_score'
    ) INTO bond_score_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Horse' AND column_name = 'stress_level'
    ) INTO stress_level_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'foal_training_history'
    ) INTO table_exists;
    
    IF NOT bond_score_exists AND NOT stress_level_exists AND NOT table_exists THEN
        RAISE NOTICE 'Rollback completed successfully!';
    ELSE
        RAISE EXCEPTION 'Rollback failed! bond_score: %, stress_level: %, table: %', 
            bond_score_exists, stress_level_exists, table_exists;
    END IF;
END $$;
*/ 