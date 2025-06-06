-- =====================================================
-- Quick Migration Verification Script
-- Run this directly in psql to verify migration status
-- Usage: psql -d your_database -f packages/database/migrations/quick_verify.sql
-- =====================================================

\echo '🚀 Starting Quick Migration Verification'
\echo '========================================'

-- Test 1: Check if bond_score column exists
\echo ''
\echo '📋 Test 1: Checking bond_score column...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Horse' AND column_name = 'bond_score'
        ) 
        THEN '✅ bond_score column exists'
        ELSE '❌ bond_score column missing'
    END as result;

-- Test 2: Check if stress_level column exists
\echo ''
\echo '📋 Test 2: Checking stress_level column...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'Horse' AND column_name = 'stress_level'
        ) 
        THEN '✅ stress_level column exists'
        ELSE '❌ stress_level column missing'
    END as result;

-- Test 3: Check if foal_training_history table exists
\echo ''
\echo '📋 Test 3: Checking foal_training_history table...'
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'foal_training_history'
        ) 
        THEN '✅ foal_training_history table exists'
        ELSE '❌ foal_training_history table missing'
    END as result;

-- Test 4: Check table structure
\echo ''
\echo '📋 Test 4: Checking foal_training_history table structure...'
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'foal_training_history'
ORDER BY ordinal_position;

-- Test 5: Check indexes
\echo ''
\echo '📋 Test 5: Checking indexes on foal_training_history...'
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'foal_training_history'
ORDER BY indexname;

-- Test 6: Check foreign key constraints
\echo ''
\echo '📋 Test 6: Checking foreign key constraints...'
SELECT 
    constraint_name,
    table_name,
    column_name,
    foreign_table_name,
    foreign_column_name
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc 
    ON kcu.constraint_name = rc.constraint_name
JOIN information_schema.key_column_usage fkcu 
    ON rc.unique_constraint_name = fkcu.constraint_name
WHERE kcu.table_name = 'foal_training_history';

-- Test 7: Check migration history
\echo ''
\echo '📋 Test 7: Checking Prisma migration history...'
SELECT 
    migration_name,
    finished_at,
    CASE 
        WHEN finished_at IS NOT NULL THEN '✅ Applied'
        ELSE '❌ Failed'
    END as status
FROM "_prisma_migrations" 
WHERE migration_name LIKE '%horse_bonding%' OR migration_name LIKE '%foal_training%'
ORDER BY finished_at DESC;

-- Test 8: Sample data check
\echo ''
\echo '📋 Test 8: Checking sample data...'
SELECT 
    'Horse count' as table_name,
    COUNT(*) as record_count
FROM "Horse"
UNION ALL
SELECT 
    'foal_training_history count' as table_name,
    COUNT(*) as record_count
FROM "foal_training_history";

-- Test 9: Test basic queries
\echo ''
\echo '📋 Test 9: Testing basic queries...'
SELECT 
    id,
    name,
    bond_score,
    stress_level
FROM "Horse"
WHERE bond_score IS NOT NULL OR stress_level IS NOT NULL
LIMIT 3;

-- Final summary
\echo ''
\echo '========================================'
\echo '🎯 Verification Complete!'
\echo ''
\echo 'If you see any ❌ results above, the migration may not have been applied correctly.'
\echo 'If all tests show ✅, the migration was successful!'
\echo ''
\echo '💡 Troubleshooting:'
\echo '   - If columns are missing: Run the Prisma migration or manual SQL script'
\echo '   - If table is missing: Check if migration was applied'
\echo '   - If no migration history: Run "npx prisma migrate dev"'
\echo '========================================' 