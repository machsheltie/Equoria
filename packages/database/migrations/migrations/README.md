# Database Schema Migration: Horse Bonding and Foal Training History

This document describes the database schema migration that adds bonding and stress tracking capabilities to the Equoria horse simulation game.

## Migration Overview

**Migration Name:** `add_horse_bonding_and_foal_training_history`  
**Date:** 2025-05-25  
**Version:** 1.0  
**Type:** Schema Enhancement

### Changes Made

1. **Horse Table Enhancements**

   - Added `bond_score` column (INTEGER, default 50, range 0-100)
   - Added `stress_level` column (INTEGER, default 0, range 0-100)

2. **New Table: foal_training_history**
   - UUID primary key for unique identification
   - Detailed tracking of foal training activities
   - Foreign key relationship to Horse table with CASCADE delete
   - Comprehensive indexing for performance

## Files Included

### 1. Prisma Migration

- **Location:** `packages/database/prisma/migrations/20250525184836_add_horse_bonding_and_foal_training_history/migration.sql`
- **Type:** Auto-generated Prisma migration
- **Usage:** Applied automatically via `npx prisma migrate dev`

### 2. Manual SQL Migration

- **Location:** `packages/database/migrations/add_horse_bonding_and_training_history.sql`
- **Type:** Comprehensive SQL script with validation
- **Features:** Idempotent, includes constraints, comments, and verification

### 3. Rollback Script

- **Location:** `packages/database/migrations/rollback_horse_bonding_and_training_history.sql`
- **Type:** Complete rollback with verification
- **Features:** Safe cleanup, comprehensive verification, detailed logging

## Schema Details

### Horse Table Changes

```sql
-- New columns added to Horse table
ALTER TABLE "Horse" ADD COLUMN "bond_score" INTEGER DEFAULT 50;
ALTER TABLE "Horse" ADD COLUMN "stress_level" INTEGER DEFAULT 0;

-- Constraints (in manual migration only)
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_bond_score_check"
CHECK ("bond_score" >= 0 AND "bond_score" <= 100);

ALTER TABLE "Horse" ADD CONSTRAINT "Horse_stress_level_check"
CHECK ("stress_level" >= 0 AND "stress_level" <= 100);
```

### FoalTrainingHistory Table

```sql
CREATE TABLE "foal_training_history" (
    "id" TEXT NOT NULL,                    -- UUID primary key
    "day" INTEGER NOT NULL,                -- Development day (0-6)
    "activity" TEXT NOT NULL,              -- Activity type
    "outcome" TEXT NOT NULL,               -- Activity outcome
    "bond_change" INTEGER NOT NULL DEFAULT 0,    -- Bonding change (-50 to +50)
    "stress_change" INTEGER NOT NULL DEFAULT 0,  -- Stress change (-50 to +50)
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "horse_id" INTEGER NOT NULL,           -- Foreign key to Horse

    CONSTRAINT "foal_training_history_pkey" PRIMARY KEY ("id")
);
```

### Indexes Created

```sql
-- Performance indexes
CREATE INDEX "foal_training_history_horse_id_idx" ON "foal_training_history"("horse_id");
CREATE INDEX "foal_training_history_day_idx" ON "foal_training_history"("day");
CREATE INDEX "foal_training_history_timestamp_idx" ON "foal_training_history"("timestamp");
CREATE INDEX "foal_training_history_horse_id_day_idx" ON "foal_training_history"("horse_id", "day");
```

## Usage Instructions

### Applying the Migration

#### Option 1: Prisma Migration (Recommended)

```bash
cd packages/database
npx prisma migrate dev --name add_horse_bonding_and_foal_training_history
```

#### Option 2: Manual SQL Migration

```bash
# Connect to your PostgreSQL database
psql -h localhost -U your_username -d equoria

# Run the migration script
\i packages/database/migrations/add_horse_bonding_and_training_history.sql
```

### Verifying the Migration

```sql
-- Check if columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Horse'
AND column_name IN ('bond_score', 'stress_level');

-- Check if table was created
SELECT table_name
FROM information_schema.tables
WHERE table_name = 'foal_training_history';

-- Check indexes
SELECT indexname
FROM pg_indexes
WHERE tablename = 'foal_training_history';
```

### Rolling Back the Migration

#### Option 1: Prisma Rollback

```bash
cd packages/database
npx prisma migrate reset  # WARNING: This resets the entire database
```

#### Option 2: Manual Rollback

```bash
# Connect to your PostgreSQL database
psql -h localhost -U your_username -d equoria

# Run the rollback script
\i packages/database/migrations/rollback_horse_bonding_and_training_history.sql
```

## Integration with Application Code

### Backend Model Updates

Update your horse model to include the new fields:

```javascript
// backend/models/horseModel.js
export async function updateHorseBonding(horseId, bondScore, stressLevel) {
  return await prisma.horse.update({
    where: { id: horseId },
    data: {
      bond_score: bondScore,
      stress_level: stressLevel,
    },
  });
}

export async function createFoalTrainingRecord(data) {
  return await prisma.foalTrainingHistory.create({
    data: {
      horse_id: data.horseId,
      day: data.day,
      activity: data.activity,
      outcome: data.outcome,
      bond_change: data.bondChange,
      stress_change: data.stressChange,
    },
  });
}
```

### Frontend Integration

Update your horse interfaces and components:

```typescript
// types/Horse.ts
interface Horse {
  id: number;
  name: string;
  age: number;
  bond_score?: number; // New field
  stress_level?: number; // New field
  // ... other fields
}

interface FoalTrainingRecord {
  id: string;
  horse_id: number;
  day: number;
  activity: string;
  outcome: string;
  bond_change: number;
  stress_change: number;
  timestamp: Date;
}
```

### API Endpoints

Create new endpoints for bonding and training history:

```javascript
// backend/routes/horseRoutes.js
router.put('/horses/:id/bonding', async (req, res) => {
  const { bondScore, stressLevel } = req.body;
  const horse = await updateHorseBonding(req.params.id, bondScore, stressLevel);
  res.json(horse);
});

router.get('/horses/:id/training-history', async (req, res) => {
  const history = await prisma.foalTrainingHistory.findMany({
    where: { horse_id: parseInt(req.params.id) },
    orderBy: { timestamp: 'desc' },
  });
  res.json(history);
});
```

## Data Migration Notes

### Existing Data Handling

- All existing horses will receive default values:
  - `bond_score`: 50 (neutral bonding)
  - `stress_level`: 0 (no stress)

### Data Preservation

The migration includes logic to preserve existing `foal_activities` data by copying it to the new `foal_training_history` table with proper field mapping.

## Performance Considerations

### Indexes

The migration creates several indexes to optimize common queries:

1. **horse_id index**: Fast lookups by horse
2. **day index**: Efficient filtering by development day
3. **timestamp index**: Chronological sorting
4. **composite index (horse_id, day)**: Optimized for horse-specific day queries

### Query Optimization

```sql
-- Efficient queries enabled by indexes
SELECT * FROM foal_training_history
WHERE horse_id = 123
ORDER BY timestamp DESC;

SELECT * FROM foal_training_history
WHERE horse_id = 123 AND day = 3;
```

## Security Considerations

### Data Validation

The manual migration includes check constraints:

```sql
-- Ensures valid ranges
CHECK ("bond_score" >= 0 AND "bond_score" <= 100)
CHECK ("stress_level" >= 0 AND "stress_level" <= 100)
CHECK ("day" >= 0 AND "day" <= 6)
CHECK ("bond_change" >= -50 AND "bond_change" <= 50)
CHECK ("stress_change" >= -50 AND "stress_change" <= 50)
```

### Foreign Key Constraints

- `CASCADE DELETE`: When a horse is deleted, all training history is automatically removed
- `CASCADE UPDATE`: Horse ID changes propagate to training history

## Testing

### Test Data Creation

```sql
-- Create test horse with bonding data
INSERT INTO "Horse" (name, age, "breedId", bond_score, stress_level)
VALUES ('Test Horse', 2, 1, 75, 15);

-- Create test training history
INSERT INTO foal_training_history (horse_id, day, activity, outcome, bond_change, stress_change)
VALUES (1, 0, 'Gentle Touch', 'excellent', 5, -2);
```

### Validation Queries

```sql
-- Verify constraints work
INSERT INTO "Horse" (name, age, "breedId", bond_score)
VALUES ('Invalid Horse', 2, 1, 150); -- Should fail

-- Verify foreign key constraint
INSERT INTO foal_training_history (horse_id, day, activity, outcome)
VALUES (99999, 0, 'Test', 'Test'); -- Should fail
```

## Troubleshooting

### Common Issues

1. **Migration fails due to existing data**

   - Solution: Ensure all existing horses have valid data before migration

2. **Constraint violations**

   - Solution: Check data ranges before inserting new records

3. **Performance issues**
   - Solution: Verify indexes were created properly

### Verification Commands

```sql
-- Check migration status
SELECT * FROM information_schema.columns
WHERE table_name = 'Horse'
AND column_name IN ('bond_score', 'stress_level');

-- Check constraints
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%Horse%';

-- Check foreign keys
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE constraint_name LIKE '%foal_training_history%';
```

## Conclusion

This migration successfully adds comprehensive bonding and stress tracking capabilities to the Equoria horse simulation game. The implementation includes:

- ✅ **Idempotent migration scripts**
- ✅ **Complete rollback functionality**
- ✅ **Data validation constraints**
- ✅ **Performance optimization**
- ✅ **Comprehensive documentation**
- ✅ **Integration guidelines**

The migration is production-ready and provides a solid foundation for the epigenetic traits system and foal development mechanics.
