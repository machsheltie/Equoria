# Database & Infrastructure - Data Management System

## Overview

The Equoria project uses PostgreSQL as the primary database with Prisma ORM for type-safe database operations. The infrastructure supports complex game mechanics including genetics, breeding, training, and competition systems.

## Database Schema Architecture

### Core Tables

#### 1. Users Table
```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT uuid(),
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  money INTEGER NOT NULL DEFAULT 1000,
  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- **UUID Primary Keys** for security and scalability
- **Unique email constraint** for account management
- **JSONB settings** for flexible user preferences
- **Progression tracking** with money, level, and XP

#### 2. Horses Table
```sql
CREATE TABLE horses (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  age INTEGER NOT NULL,
  gender VARCHAR NOT NULL,
  breed_id INTEGER REFERENCES breeds(id),
  owner_id INTEGER REFERENCES users(id),
  stable_id INTEGER REFERENCES stables(id),
  user_id VARCHAR REFERENCES users(id),
  discipline_scores JSONB DEFAULT '{}',
  epigenetic_modifiers JSONB DEFAULT '{}',
  training_cooldown TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- **Flexible relationship support** (both user and user systems)
- **JSONB discipline scores** for training progression
- **JSONB epigenetic modifiers** for complex trait storage
- **Training cooldown** system integration
- **Multi-table relationships** for breed, owner, stable data

#### 3. Foals Table
```sql
CREATE TABLE foals (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  sire_id INTEGER REFERENCES horses(id),
  dam_id INTEGER REFERENCES horses(id),
  genetics JSONB NOT NULL,
  traits JSONB DEFAULT '{}',
  bond_score INTEGER DEFAULT 50,
  stress_level INTEGER DEFAULT 30,
  development_stage VARCHAR DEFAULT 'newborn',
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- **Parent tracking** with sire and dam relationships
- **Complex genetics storage** in JSONB format
- **Trait development** system integration
- **Development metrics** for foal progression

#### 4. Competition Results Table
```sql
CREATE TABLE competition_results (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER REFERENCES horses(id),
  show_id INTEGER REFERENCES shows(id),
  score FLOAT NOT NULL,
  placement VARCHAR NULL,
  discipline VARCHAR NOT NULL,
  run_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- **Competition history** tracking
- **Performance scoring** system
- **Placement tracking** (1st, 2nd, 3rd)
- **Discipline-specific** results

#### 5. Training Logs Table
```sql
CREATE TABLE training_logs (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER REFERENCES horses(id),
  discipline VARCHAR NOT NULL,
  trained_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- **Training history** for cooldown calculations
- **Discipline-specific** tracking
- **Timestamp precision** for cooldown enforcement

### Specialized Tables

#### 6. Shows Table
```sql
CREATE TABLE shows (
  id SERIAL PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL,
  discipline VARCHAR NOT NULL,
  level_min INTEGER,
  level_max INTEGER,
  entry_fee INTEGER NOT NULL,
  prize INTEGER NOT NULL,
  run_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- **Competition management** with level restrictions
- **Financial system** integration (fees and prizes)
- **Scheduling** with run dates

#### 7. Foal Development Table
```sql
CREATE TABLE foal_development (
  id SERIAL PRIMARY KEY,
  foal_id INTEGER REFERENCES horses(id),
  current_day INTEGER DEFAULT 1,
  activities_completed JSONB DEFAULT '[]',
  milestones_reached JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- **Development tracking** with day-by-day progression
- **Activity history** for trait discovery
- **Milestone system** for achievement tracking

#### 8. Foal Training History Table
```sql
CREATE TABLE foal_training_history (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER REFERENCES horses(id),
  activity VARCHAR NOT NULL,
  bonding_impact INTEGER DEFAULT 0,
  stress_impact INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- **Enrichment activity** tracking
- **Impact measurement** on bonding and stress
- **Historical analysis** for trait discovery

## JSONB Field Structures

### 1. Discipline Scores (Horse)
```json
{
  "Racing": 25,
  "Show Jumping": 15,
  "Dressage": 30,
  "Cross Country": 10
}
```

**Features:**
- **Flexible discipline addition** without schema changes
- **Efficient querying** with PostgreSQL JSONB operators
- **Progressive scoring** through training

### 2. Epigenetic Modifiers (Horse/Foal)
```json
{
  "positive": ["resilient", "bold", "intelligent"],
  "negative": ["nervous", "stubborn"],
  "hidden": ["trainability_boost", "athletic", "calm"]
}
```

**Features:**
- **Trait categorization** for gameplay mechanics
- **Discovery system** integration
- **Flexible trait addition** for game expansion

### 3. Genetics (Foal)
```json
{
  "dominant_alleles": {
    "coat_color": "bay",
    "markings": "star",
    "size": "medium"
  },
  "recessive_alleles": {
    "coat_color": "chestnut",
    "markings": "none",
    "size": "large"
  },
  "inheritance_patterns": {
    "coat_color": "simple_dominant",
    "markings": "recessive",
    "size": "polygenic"
  }
}
```

**Features:**
- **Complex inheritance** modeling
- **Genetic diversity** preservation
- **Breeding prediction** capabilities

### 4. User Settings
```json
{
  "darkMode": true,
  "notifications": {
    "training": true,
    "competitions": true,
    "breeding": false
  },
  "privacy": {
    "profileVisible": true,
    "shareProgress": false
  }
}
```

**Features:**
- **User preferences** storage
- **Privacy controls** management
- **Notification settings** customization

## Database Migrations

### Migration System
The project uses Prisma migrations for schema evolution:

```bash
# Generate migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (development)
npx prisma migrate reset
```

### Key Migrations
1. **Initial Schema** - Basic tables and relationships
2. **User System** - UUID-based user accounts
3. **Training Cooldown** - Training restriction system
4. **Competition Results** - Competition tracking system
5. **Foal Development** - Breeding and development system
6. **Discipline Scores** - Training progression tracking

## Database Performance

### 1. Indexing Strategy

**Primary Indexes:**
- All primary keys (automatic)
- Foreign key relationships (automatic)
- Unique constraints (email, show names)

**Custom Indexes:**
```sql
-- Training efficiency
CREATE INDEX idx_horses_training_cooldown ON horses(training_cooldown);
CREATE INDEX idx_training_logs_horse_discipline ON training_logs(horse_id, discipline);

-- Competition queries
CREATE INDEX idx_competition_results_horse_id ON competition_results(horse_id);
CREATE INDEX idx_competition_results_show_id ON competition_results(show_id);

-- User queries
CREATE INDEX idx_horses_user_id ON horses(user_id);
CREATE INDEX idx_users_email ON users(email);
```

**JSONB Indexes:**
```sql
-- Discipline score queries
CREATE INDEX idx_horses_discipline_scores ON horses USING GIN (discipline_scores);

-- Trait queries
CREATE INDEX idx_horses_epigenetic_modifiers ON horses USING GIN (epigenetic_modifiers);
```

### 2. Query Optimization

**Efficient Relationship Loading:**
```javascript
// Optimized horse query with selected relationships
const horse = await prisma.horse.findUnique({
  where: { id: horseId },
  include: {
    breed: true,
    user: {
      select: { id: true, name: true, email: true }
    },
    competitionResults: {
      take: 10,
      orderBy: { createdAt: 'desc' }
    }
  }
});
```

**JSONB Query Patterns:**
```javascript
// Query horses with specific traits
const horsesWithTrait = await prisma.horse.findMany({
  where: {
    epigenetic_modifiers: {
      path: ['positive'],
      array_contains: ['resilient']
    }
  }
});

// Query horses by discipline score
const trainedHorses = await prisma.horse.findMany({
  where: {
    discipline_scores: {
      path: ['Racing'],
      gte: 20
    }
  }
});
```

### 3. Connection Management

**Prisma Configuration:**
```javascript
// Optimized connection pooling
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn'] : ['error'],
});

// Connection pool settings in DATABASE_URL
"postgresql://user:pass@host:port/db?connection_limit=20&pool_timeout=20"
```

## Data Seeding & Management

### 1. Seeding System

**Comprehensive Data Seeding:**
- **Horse data** with realistic breeds and characteristics
- **User accounts** with progression scenarios
- **Competition shows** with varied requirements
- **Relationship data** ensuring referential integrity

**Seeding Scripts:**
```bash
# Seed horses and basic data
npm run seed

# Seed shows and competitions
npm run seed:shows

# Development environment seeding
npm run seed:dev
```

### 2. Data Validation

**Model-Level Validation:**
- **Age restrictions** for training and breeding
- **Financial constraints** for purchases and entries
- **Relationship validation** for breeding pairs
- **Business rule enforcement** across all operations

**Database Constraints:**
- **Foreign key constraints** ensuring referential integrity
- **Check constraints** for valid data ranges
- **Unique constraints** preventing duplicates
- **Not null constraints** for required fields

### 3. Data Backup & Recovery

**Backup Strategy:**
```bash
# Automated daily backups
pg_dump equoria_production > backup_$(date +%Y%m%d).sql

# Point-in-time recovery setup
# WAL archiving for continuous backup
```

**Recovery Procedures:**
- **Automated backup verification**
- **Disaster recovery testing**
- **Data corruption detection**
- **Rollback procedures** for critical failures

## Environment Management

### 1. Environment Configuration

**Development Environment:**
```env
DATABASE_URL="postgresql://dev_user:dev_pass@localhost:5432/equoria_dev"
NODE_ENV="development"
LOG_LEVEL="debug"
```

**Test Environment:**
```env
DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/equoria_test"
NODE_ENV="test"
DISABLE_LOGGING="true"
```

**Production Environment:**
```env
DATABASE_URL="postgresql://prod_user:secure_pass@prod_host:5432/equoria_prod?sslmode=require"
NODE_ENV="production"
LOG_LEVEL="warn"
```

### 2. Security Configuration

**Database Security:**
- **SSL/TLS encryption** for all connections
- **Role-based access control** with minimal privileges
- **Connection string security** with environment variables
- **Regular security updates** and patches

**Application Security:**
- **SQL injection prevention** via Prisma ORM
- **Input validation** at multiple layers
- **Audit logging** for sensitive operations
- **Data anonymization** for development/testing

## Monitoring & Maintenance

### 1. Performance Monitoring

**Database Metrics:**
- **Query performance** analysis with slow query logs
- **Connection pool** utilization monitoring
- **Index usage** statistics and optimization
- **Storage growth** tracking and management

**Application Metrics:**
- **Response time** monitoring for database operations
- **Error rate** tracking for database failures
- **Resource utilization** monitoring (CPU, memory, I/O)
- **Business metrics** (active users, competition participation)

### 2. Maintenance Procedures

**Regular Maintenance:**
- **Statistics updates** for query optimization
- **Index maintenance** and reorganization
- **Vacuum operations** for space reclamation
- **Connection monitoring** and optimization

**Scheduled Tasks:**
- **Daily backups** with verification
- **Weekly performance analysis**
- **Monthly security audits**
- **Quarterly capacity planning**

The database infrastructure provides a robust, scalable foundation for the Equoria game with excellent performance, security, and maintainability characteristics that support complex game mechanics and user progression systems. 