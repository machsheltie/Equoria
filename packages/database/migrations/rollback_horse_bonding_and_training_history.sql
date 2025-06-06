-- =====================================================
-- ROLLBACK SCRIPT: Horse Bonding and Foal Training History
-- Description: Rollback script for add_horse_bonding_and_training_history.sql
-- Date: 2025-05-25
-- Version: 1.0
-- =====================================================

-- WARNING: This script will permanently delete data!
-- Make sure to backup your database before running this rollback.

-- =====================================================
-- ROLLBACK OPERATIONS
-- =====================================================

-- Drop foal_training_history table and related objects
DO $$
BEGIN
    -- Drop trigger if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_foal_training_history_updated_at'
    ) THEN
        DROP TRIGGER update_foal_training_history_updated_at ON "foal_training_history";
        RAISE NOTICE 'Dropped trigger: update_foal_training_history_updated_at';
    END IF;
    
    -- Drop function if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'update_updated_at_column'
    ) THEN
        DROP FUNCTION update_updated_at_column();
        RAISE NOTICE 'Dropped function: update_updated_at_column';
    END IF;
    
    -- Drop table if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'foal_training_history'
    ) THEN
        DROP TABLE "foal_training_history";
        RAISE NOTICE 'Dropped table: foal_training_history';
    END IF;
END $$;

-- Remove columns from Horse table
DO $$
BEGIN
    -- Remove bond_score column and its constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Horse' AND column_name = 'bond_score'
    ) THEN
        -- Drop constraint first
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'Horse_bond_score_check'
        ) THEN
            ALTER TABLE "Horse" DROP CONSTRAINT "Horse_bond_score_check";
            RAISE NOTICE 'Dropped constraint: Horse_bond_score_check';
        END IF;
        
        -- Drop column
        ALTER TABLE "Horse" DROP COLUMN "bond_score";
        RAISE NOTICE 'Dropped column: Horse.bond_score';
    END IF;
    
    -- Remove stress_level column and its constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Horse' AND column_name = 'stress_level'
    ) THEN
        -- Drop constraint first
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'Horse_stress_level_check'
        ) THEN
            ALTER TABLE "Horse" DROP CONSTRAINT "Horse_stress_level_check";
            RAISE NOTICE 'Dropped constraint: Horse_stress_level_check';
        END IF;
        
        -- Drop column
        ALTER TABLE "Horse" DROP COLUMN "stress_level";
        RAISE NOTICE 'Dropped column: Horse.stress_level';
    END IF;
END $$;

-- =====================================================
-- VERIFICATION OF ROLLBACK
-- =====================================================

-- Verify rollback was successful
DO $$
DECLARE
    bond_score_exists BOOLEAN;
    stress_level_exists BOOLEAN;
    table_exists BOOLEAN;
    trigger_exists BOOLEAN;
    function_exists BOOLEAN;
    constraint1_exists BOOLEAN;
    constraint2_exists BOOLEAN;
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
    
    -- Check if trigger exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_foal_training_history_updated_at'
    ) INTO trigger_exists;
    
    -- Check if function exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'update_updated_at_column'
    ) INTO function_exists;
    
    -- Check if constraints exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Horse_bond_score_check'
    ) INTO constraint1_exists;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'Horse_stress_level_check'
    ) INTO constraint2_exists;
    
    -- Report results
    RAISE NOTICE '=== ROLLBACK VERIFICATION RESULTS ===';
    RAISE NOTICE 'bond_score column exists: %', bond_score_exists;
    RAISE NOTICE 'stress_level column exists: %', stress_level_exists;
    RAISE NOTICE 'foal_training_history table exists: %', table_exists;
    RAISE NOTICE 'trigger exists: %', trigger_exists;
    RAISE NOTICE 'function exists: %', function_exists;
    RAISE NOTICE 'bond_score constraint exists: %', constraint1_exists;
    RAISE NOTICE 'stress_level constraint exists: %', constraint2_exists;
    
    -- Final verification
    IF NOT bond_score_exists AND NOT stress_level_exists AND NOT table_exists 
       AND NOT trigger_exists AND NOT function_exists 
       AND NOT constraint1_exists AND NOT constraint2_exists THEN
        RAISE NOTICE '✅ ROLLBACK COMPLETED SUCCESSFULLY!';
        RAISE NOTICE 'All migration changes have been reverted.';
    ELSE
        RAISE WARNING '⚠️  ROLLBACK INCOMPLETE!';
        RAISE WARNING 'Some objects may still exist. Please check manually.';
    END IF;
END $$;

-- =====================================================
-- CLEANUP VERIFICATION QUERIES
-- =====================================================

-- Optional: Run these queries manually to double-check

-- Check for any remaining objects
SELECT 
    'Column' as object_type,
    column_name as object_name,
    'Horse' as table_name
FROM information_schema.columns 
WHERE table_name = 'Horse' 
AND column_name IN ('bond_score', 'stress_level')

UNION ALL

SELECT 
    'Table' as object_type,
    table_name as object_name,
    table_schema as table_name
FROM information_schema.tables 
WHERE table_name = 'foal_training_history'

UNION ALL

SELECT 
    'Trigger' as object_type,
    trigger_name as object_name,
    event_object_table as table_name
FROM information_schema.triggers 
WHERE trigger_name = 'update_foal_training_history_updated_at'

UNION ALL

SELECT 
    'Function' as object_type,
    routine_name as object_name,
    routine_schema as table_name
FROM information_schema.routines 
WHERE routine_name = 'update_updated_at_column'

UNION ALL

SELECT 
    'Constraint' as object_type,
    constraint_name as object_name,
    table_name as table_name
FROM information_schema.table_constraints 
WHERE constraint_name IN ('Horse_bond_score_check', 'Horse_stress_level_check');

-- If the above query returns no rows, the rollback was successful! 