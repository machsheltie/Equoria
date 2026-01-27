# Database Guide

**Skill:** `/database-guide`
**Purpose:** Load database schema, query patterns, and Prisma documentation

---

## When to Use This Skill

Invoke this skill when:

- Designing database schema changes
- Optimizing queries
- Creating migrations
- Understanding table relationships
- Working with JSONB fields
- Debugging database performance

---

## Quick Database Overview

### Tech Stack

- **PostgreSQL 14+** - Relational database with JSONB support
- **Prisma ORM** - Type-safe database client
- **30+ Tables** - Complex game data relationships
- **JSONB Fields** - Flexible storage for traits, settings, genetics

### Key Tables

```
- User (accounts, progression)
- Horse (horse data, stats, traits)
- Breed (breed definitions)
- Groom (caretaker data)
- Training (training sessions, cooldowns)
- Breeding (breeding records, offspring)
- Competition (shows, results)
- Trait (trait definitions, discoveries)
```

---

## Documentation Locations

### Database Documentation

```bash
# Database infrastructure
cat .claude/docs/archive/database-infrastructure.md

# Prisma schema
cat packages/database/prisma/schema.prisma
```

---

## Key Concepts

### Prisma Schema Structure

```prisma
model Horse {
  id                String   @id @default(uuid())
  name              String
  age               Int
  sex               String
  stats             Json     // JSONB field
  traits            Json     // JSONB field
  genetics          Json     // JSONB field

  userId            String
  user              User     @relation(fields: [userId], references: [id])

  trainingRecords   Training[]
  breedingRecords   Breeding[]
  competitionResults CompetitionResult[]

  @@index([userId])
  @@index([age])
}
```

### JSONB Usage Patterns

```javascript
// Store flexible data in JSONB
{
  "stats": {
    "speed": 75,
    "stamina": 82,
    "agility": 68
  },
  "traits": {
    "discovered": ["speed_demon", "endurance_boost"],
    "hidden": ["legendary_bloodline"]
  },
  "genetics": {
    "sireId": "uuid-123",
    "damId": "uuid-456",
    "generation": 3
  }
}
```

### Query Optimization

```javascript
// Use Prisma's efficient querying
const horses = await prisma.horse.findMany({
  where: {
    userId: userId,
    age: { gte: 3 },
  },
  include: {
    user: true,
    trainingRecords: {
      take: 10,
      orderBy: { createdAt: 'desc' },
    },
  },
  take: 20,
});
```

### Strategic Indexing

```prisma
// Add indexes for frequently queried fields
@@index([userId])           // User's horses
@@index([age])              // Age-based queries
@@index([createdAt])        // Time-based queries
@@index([userId, age])      // Composite index
```

---

## Common Tasks

### Creating Migration

```bash
# 1. Modify schema
# Edit packages/database/prisma/schema.prisma

# 2. Generate migration
cd packages/database
npx prisma migrate dev --name add_new_field

# 3. Generate Prisma client
npx prisma generate

# 4. Test migration
npm test -- migration
```

### Schema Changes

1. Load `/database-guide` skill
2. Review existing schema
3. Plan changes (fields, relationships, indexes)
4. Create migration
5. Test with rollback capability

### Query Optimization

1. Identify slow query
2. Analyze query execution plan
3. Add appropriate indexes
4. Use Prisma's include/select efficiently
5. Test performance improvement

### JSONB Optimization

```javascript
// Use GIN indexes for JSONB queries
CREATE INDEX idx_horse_traits ON "Horse" USING GIN (traits);

// Query JSONB efficiently
const horses = await prisma.$queryRaw`
  SELECT * FROM "Horse"
  WHERE traits @> '{"discovered": ["speed_demon"]}'::jsonb
`;
```

---

## Database Schema Highlights

### User Progression

```prisma
model User {
  id            String   @id @default(uuid())
  username      String   @unique
  email         String   @unique
  passwordHash  String

  money         Int      @default(10000)
  level         Int      @default(1)
  xp            Int      @default(0)

  horses        Horse[]
  grooms        Groom[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### Training System

```prisma
model Training {
  id           String   @id @default(uuid())
  horseId      String
  horse        Horse    @relation(fields: [horseId], references: [id])

  discipline   String
  statGains    Json     // JSONB: which stats improved

  startedAt    DateTime @default(now())
  completedAt  DateTime?

  @@index([horseId])
  @@index([startedAt])
}
```

### Groom System

```prisma
model Groom {
  id               String   @id @default(uuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id])

  name             String
  skillLevel       Int
  personalityType  String

  assignments      GroomAssignment[]

  hiredAt          DateTime @default(now())
  retiredAt        DateTime?

  @@index([userId])
}
```

---

## Migration Best Practices

### Safe Migration Process

1. **Backup:** Always backup production database before migration
2. **Test:** Test migration on development database first
3. **Rollback Plan:** Have rollback script ready
4. **Downtime:** Schedule during low-traffic periods
5. **Verification:** Verify data integrity after migration

### Common Migration Tasks

```bash
# Create new migration
npx prisma migrate dev --name migration_name

# Apply migrations to production
npx prisma migrate deploy

# Reset database (DESTRUCTIVE - dev only)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

---

## Performance Monitoring

### Query Performance Analysis

```javascript
// Enable query logging (development)
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Analyze slow queries
// Look for:
// - Missing indexes
// - N+1 query problems
// - Inefficient includes
// - Large result sets without pagination
```

### Common Performance Issues

1. **N+1 Queries:** Use `include` or `select` instead of multiple queries
2. **Missing Indexes:** Add indexes on frequently queried fields
3. **Large JSONB:** Optimize JSONB structure and use GIN indexes
4. **No Pagination:** Always paginate large result sets

---

**Load full documentation:**

```bash
# Database infrastructure
cat .claude/docs/archive/database-infrastructure.md

# Prisma schema
cat packages/database/prisma/schema.prisma
```
