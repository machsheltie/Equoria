# Database Architecture

**Purpose**: Database schema design, infrastructure, and migration strategies for the Equoria platform.

**Stack**: PostgreSQL 15+, Prisma ORM 5.x

**Last Updated**: 2025-01-14

---

## Files in This Folder

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [databaseSchema.md](./databaseSchema.md) | Complete database schema definition | ~1,200 | Active |
| [databaseInfrastructure.md](./databaseInfrastructure.md) | Database setup, migrations, backups | ~350 | Active |

**Total**: 2 files, ~1,550 lines

---

## Quick Start

### New to Database Design?
1. Read [databaseSchema.md](./databaseSchema.md) for complete schema
2. Review [databaseInfrastructure.md](./databaseInfrastructure.md) for setup

### Need Specific Info?
- **Table definitions?** → [databaseSchema.md](./databaseSchema.md)
- **Relationships?** → [databaseSchema.md](./databaseSchema.md) (Relationships section)
- **Migrations?** → [databaseInfrastructure.md](./databaseInfrastructure.md)
- **Backups?** → [databaseInfrastructure.md](./databaseInfrastructure.md)

---

## Database Schema Overview

### Core Tables

```
Users
├── Horses (1:N)
│   ├── Breeding (N:M with Horses)
│   ├── Competitions (N:M)
│   └── Training (1:N)
├── Grooms (1:N)
│   └── HorseGroom (N:M with Horses)
├── Stables (1:N)
└── Transactions (1:N)
```

### Entity Relationship Diagram

```
┌─────────┐       ┌─────────┐       ┌─────────┐
│  Users  │───────│ Horses  │───────│ Grooms  │
└─────────┘  1:N  └─────────┘  N:M  └─────────┘
                       │
                       │ 1:N
                       │
                  ┌────────────┐
                  │   Traits   │
                  └────────────┘
```

---

## Tables

### Users Table

**Purpose**: User accounts and authentication

**Key Fields**:
- `id` (UUID, primary key)
- `email` (unique, indexed)
- `username` (unique, indexed)
- `passwordHash` (bcrypt)
- `createdAt`, `updatedAt`

### Horses Table

**Purpose**: Horse data and genetics

**Key Fields**:
- `id` (UUID, primary key)
- `name` (string)
- `breed` (enum)
- `birthDate` (date)
- `genetics` (JSONB - trait data)
- `ownerId` (foreign key → Users)
- `groomId` (foreign key → Grooms, nullable)

### Grooms Table

**Purpose**: Groom NPCs and progression

**Key Fields**:
- `id` (UUID, primary key)
- `name` (string)
- `level` (integer)
- `experience` (integer)
- `personality` (enum)
- `skills` (JSONB - skill data)
- `ownerId` (foreign key → Users)

### Traits Table

**Purpose**: Epigenetic traits and modifiers

**Key Fields**:
- `id` (UUID, primary key)
- `horseId` (foreign key → Horses)
- `traitType` (enum: genetic, epigenetic, acquired)
- `traitName` (string)
- `value` (float)
- `modifiers` (JSONB)

---

## Relationships

### One-to-Many (1:N)

**Users → Horses**:
```sql
ALTER TABLE horses
  ADD CONSTRAINT fk_horses_owner
  FOREIGN KEY (ownerId)
  REFERENCES users(id)
  ON DELETE CASCADE;
```

**Users → Grooms**:
```sql
ALTER TABLE grooms
  ADD CONSTRAINT fk_grooms_owner
  FOREIGN KEY (ownerId)
  REFERENCES users(id)
  ON DELETE CASCADE;
```

### Many-to-Many (N:M)

**Horses ↔ Grooms** (via HorseGroom join table):
```sql
CREATE TABLE horse_groom (
  horseId UUID REFERENCES horses(id) ON DELETE CASCADE,
  groomId UUID REFERENCES grooms(id) ON DELETE CASCADE,
  assignedAt TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (horseId, groomId)
);
```

**Horses ↔ Competitions** (via HorseCompetition join table):
```sql
CREATE TABLE horse_competition (
  horseId UUID REFERENCES horses(id) ON DELETE CASCADE,
  competitionId UUID REFERENCES competitions(id) ON DELETE CASCADE,
  placement INT,
  score FLOAT,
  PRIMARY KEY (horseId, competitionId)
);
```

---

## Indexing Strategy

### Primary Indexes
- All primary keys (UUID)
- Foreign keys (automatic in PostgreSQL)

### Secondary Indexes

**Users**:
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

**Horses**:
```sql
CREATE INDEX idx_horses_owner ON horses(ownerId);
CREATE INDEX idx_horses_breed ON horses(breed);
CREATE INDEX idx_horses_birth_date ON horses(birthDate);
```

**Grooms**:
```sql
CREATE INDEX idx_grooms_owner ON grooms(ownerId);
CREATE INDEX idx_grooms_level ON grooms(level);
```

**Traits**:
```sql
CREATE INDEX idx_traits_horse ON traits(horseId);
CREATE INDEX idx_traits_type ON traits(traitType);
```

---

## Prisma Schema

**Location**: `backend/prisma/schema.prisma`

**Example**:
```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  username      String    @unique
  passwordHash  String
  horses        Horse[]
  grooms        Groom[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("users")
}

model Horse {
  id          String    @id @default(uuid())
  name        String
  breed       String
  birthDate   DateTime
  genetics    Json
  owner       User      @relation(fields: [ownerId], references: [id])
  ownerId     String
  groom       Groom?    @relation(fields: [groomId], references: [id])
  groomId     String?
  traits      Trait[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([ownerId])
  @@index([breed])
  @@map("horses")
}
```

---

## Migrations

### Migration Strategy

**Development**:
1. Update Prisma schema
2. Run `npx prisma migrate dev --name description`
3. Test migration locally
4. Commit migration file

**Production**:
1. Review migration in staging
2. Backup database
3. Run `npx prisma migrate deploy`
4. Verify data integrity

### Migration Best Practices

1. **Always backup** before production migrations
2. **Test locally** first
3. **Use transactions** for multi-step migrations
4. **Rollback plan** for each migration
5. **Data migration** separate from schema migration

---

## Database Infrastructure

Full documentation in [databaseInfrastructure.md](./databaseInfrastructure.md).

### Environments

**Development**: Local PostgreSQL
**Staging**: Supabase (or similar)
**Production**: Managed PostgreSQL (AWS RDS, etc.)

### Backup Strategy

**Frequency**:
- Production: Daily automated backups
- Staging: Weekly backups
- Development: No automated backups

**Retention**:
- Production: 30 days
- Staging: 7 days

---

## Performance Optimization

### Query Optimization

1. **Use indexes** for frequently queried fields
2. **Avoid N+1 queries** with Prisma includes
3. **Pagination** for large result sets
4. **Connection pooling** (Prisma default)

### Example: Optimized Query

```typescript
// ❌ BAD: N+1 query
const horses = await prisma.horse.findMany();
for (const horse of horses) {
  const owner = await prisma.user.findUnique({ where: { id: horse.ownerId } });
}

// ✅ GOOD: Single query with include
const horses = await prisma.horse.findMany({
  include: { owner: true, groom: true, traits: true }
});
```

---

## Data Integrity

### Constraints

**Primary Keys**: All tables have UUID primary keys
**Foreign Keys**: Enforce referential integrity
**Unique Constraints**: Email, username
**Check Constraints**: Valid enum values

### Cascading Deletes

**ON DELETE CASCADE**:
- Horses → Traits (delete horse traits when horse deleted)
- Users → Horses (delete user horses when user deleted)
- Users → Grooms (delete user grooms when user deleted)

**ON DELETE SET NULL**:
- Grooms → Horses.groomId (set to null when groom deleted)

---

## Testing Strategy

### Database Tests

1. **Model tests**: CRUD operations
2. **Relationship tests**: Foreign keys, cascades
3. **Transaction tests**: Data consistency
4. **Migration tests**: Schema changes

### Test Database

**Setup**: Separate test database
**Reset**: Before each test suite
**Seed**: Test data fixtures

---

## Related Documentation

- **Backend Architecture**: [../backend/backendOverview.md](../backend/backendOverview.md)
- **API Specs**: [../backend/apiSpecs.md](../backend/apiSpecs.md)
- **Game Design**: [../../gameDesign/](../../gameDesign/) (trait system, mechanics)

---

**For complete architecture documentation, see [../README.md](../README.md)**
