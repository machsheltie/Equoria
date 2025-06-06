# Database Schema - Equoria Game Database

## Database Overview
- **Database Engine**: PostgreSQL 14+
- **ORM**: Prisma with JavaScript ES6+ modules
- **Schema Management**: Prisma migrations
- **Key Features**: JSONB for flexible game data, comprehensive relationships, optimized indexing

## Core Tables

### 1. users
Primary user account management with UUID-based identifiers
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
- UUID primary keys for security and scalability
- Unique email constraint for account management
- JSONB settings for flexible user preferences
- Progression tracking with money, level, and XP

**Sample Settings JSONB:**
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

### 2. horses
Main horse entities with comprehensive attributes and relationships
```sql
CREATE TABLE horses (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  age INTEGER NOT NULL,
  gender VARCHAR NOT NULL CHECK (gender IN ('Mare', 'Stallion', 'Gelding')),
  breed_id INTEGER REFERENCES breeds(id),
  owner_id INTEGER REFERENCES users(id),
  stable_id INTEGER REFERENCES stables(id),
  user_id VARCHAR REFERENCES users(id),
  discipline_scores JSONB DEFAULT '{}',
  epigenetic_modifiers JSONB DEFAULT '{}',
  training_cooldown TIMESTAMP NULL,
  final_display_color VARCHAR,
  shade VARCHAR,
  trait VARCHAR,
  temperament VARCHAR,
  precision INTEGER DEFAULT 0,
  strength INTEGER DEFAULT 0,
  speed INTEGER DEFAULT 0,
  agility INTEGER DEFAULT 0,
  endurance INTEGER DEFAULT 0,
  intelligence INTEGER DEFAULT 0,
  personality INTEGER DEFAULT 0,
  total_earnings INTEGER DEFAULT 0,
  health_status VARCHAR DEFAULT 'Healthy',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- Flexible relationship support (both legacy user and new user systems)
- JSONB discipline scores for training progression
- JSONB epigenetic modifiers for complex trait storage
- Training cooldown system integration
- Comprehensive stat tracking for competition mechanics

**Sample Discipline Scores JSONB:**
```json
{
  "Racing": 25,
  "Show Jumping": 15,
  "Dressage": 30,
  "Cross Country": 10,
  "Barrel Racing": 5
}
```

**Sample Epigenetic Modifiers JSONB:**
```json
{
  "positive": ["resilient", "bold", "intelligent"],
  "negative": ["nervous", "stubborn"],
  "hidden": ["trainability_boost", "athletic", "calm"]
}
```

### 3. foals
Specialized table for foal development and breeding mechanics
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
  user_id VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- Parent tracking with sire and dam relationships
- Complex genetics storage in JSONB format
- Trait development system integration
- Development metrics for foal progression

**Sample Genetics JSONB:**
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

### 4. shows
Competition and show management
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
- Competition management with level restrictions
- Financial system integration (fees and prizes)
- Scheduling with run dates
- Unique constraint on show names

### 5. competition_results
Competition history and result tracking
```sql
CREATE TABLE competition_results (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER REFERENCES horses(id) ON DELETE CASCADE,
  show_id INTEGER REFERENCES shows(id) ON DELETE CASCADE,
  score FLOAT NOT NULL,
  placement VARCHAR NULL CHECK (placement IN ('1st', '2nd', '3rd')),
  discipline VARCHAR NOT NULL,
  run_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- Competition history tracking with relationships
- Performance scoring system with float precision
- Placement tracking for top 3 finishers
- Discipline-specific results with timestamps

### 6. training_logs
Training session history and cooldown tracking
```sql
CREATE TABLE training_logs (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER REFERENCES horses(id) ON DELETE CASCADE,
  discipline VARCHAR NOT NULL,
  trained_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- Training history for cooldown calculations
- Discipline-specific tracking
- Timestamp precision for cooldown enforcement

## Supporting Tables

### 7. breeds
Horse breed definitions and characteristics
```sql
CREATE TABLE breeds (
  id SERIAL PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL,
  characteristics JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 8. users (Legacy Support)
Legacy user system maintained for backward compatibility
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR UNIQUE,
  password_hash VARCHAR,
  role VARCHAR DEFAULT 'User',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 9. stables
Stable management and horse location tracking
```sql
CREATE TABLE stables (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  owner_id INTEGER REFERENCES users(id),
  capacity INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 10. foal_development
Detailed foal development tracking
```sql
CREATE TABLE foal_development (
  id SERIAL PRIMARY KEY,
  foal_id INTEGER REFERENCES horses(id) ON DELETE CASCADE,
  current_day INTEGER DEFAULT 1,
  activities_completed JSONB DEFAULT '[]',
  milestones_reached JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- Development tracking with day-by-day progression
- Activity history for trait discovery
- Milestone system for achievement tracking

### 11. foal_training_history
Enrichment activity tracking for foal development
```sql
CREATE TABLE foal_training_history (
  id SERIAL PRIMARY KEY,
  horse_id INTEGER REFERENCES horses(id) ON DELETE CASCADE,
  activity VARCHAR NOT NULL,
  bonding_impact INTEGER DEFAULT 0,
  stress_impact INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Features:**
- Enrichment activity tracking
- Impact measurement on bonding and stress
- Historical analysis for trait discovery

## Database Relationships

### Primary Relationships
```
users (1) ←→ (N) horses
horses (N) ←→ (1) breeds
horses (1) ←→ (N) competition_results
horses (1) ←→ (N) training_logs
shows (1) ←→ (N) competition_results
horses (sire_id, dam_id) ←→ (N) foals
foals (1) ←→ (1) foal_development
horses (1) ←→ (N) foal_training_history
```

### Foreign Key Constraints
- **Cascading Deletes**: competition_results, training_logs, foal_development, foal_training_history
- **Referential Integrity**: All foreign keys enforced with proper constraints
- **Nullable References**: Some relationships allow null for flexibility

## Indexes and Performance

### Primary Indexes (Automatic)
- All primary keys have automatic indexes
- Unique constraints create automatic indexes (email, show names)

### Custom Indexes
```sql
-- Training system optimization
CREATE INDEX idx_horses_training_cooldown ON horses(training_cooldown);
CREATE INDEX idx_training_logs_horse_discipline ON training_logs(horse_id, discipline);
CREATE INDEX idx_training_logs_trained_at ON training_logs(trained_at);

-- Competition system optimization
CREATE INDEX idx_competition_results_horse_id ON competition_results(horse_id);
CREATE INDEX idx_competition_results_show_id ON competition_results(show_id);
CREATE INDEX idx_competition_results_run_date ON competition_results(run_date);

-- User and relationship optimization
CREATE INDEX idx_horses_user_id ON horses(user_id);
CREATE INDEX idx_horses_owner_id ON horses(owner_id);
CREATE INDEX idx_horses_breed_id ON horses(breed_id);
CREATE INDEX idx_users_email ON users(email);

-- Foal and breeding optimization
CREATE INDEX idx_foals_sire_id ON foals(sire_id);
CREATE INDEX idx_foals_dam_id ON foals(dam_id);
CREATE INDEX idx_foals_user_id ON foals(user_id);
```

### JSONB Indexes
```sql
-- Discipline score queries
CREATE INDEX idx_horses_discipline_scores ON horses USING GIN (discipline_scores);

-- Trait and genetics queries
CREATE INDEX idx_horses_epigenetic_modifiers ON horses USING GIN (epigenetic_modifiers);
CREATE INDEX idx_foals_genetics ON foals USING GIN (genetics);
CREATE INDEX idx_foals_traits ON foals USING GIN (traits);

-- User settings queries
CREATE INDEX idx_users_settings ON users USING GIN (settings);
```

## Data Validation and Constraints

### Check Constraints
```sql
-- Horse gender validation
ALTER TABLE horses ADD CONSTRAINT check_gender 
CHECK (gender IN ('Mare', 'Stallion', 'Gelding'));

-- Competition placement validation
ALTER TABLE competition_results ADD CONSTRAINT check_placement 
CHECK (placement IN ('1st', '2nd', '3rd') OR placement IS NULL);

-- Score range validation
ALTER TABLE competition_results ADD CONSTRAINT check_score_range 
CHECK (score >= 0 AND score <= 1000);

-- Age validation
ALTER TABLE horses ADD CONSTRAINT check_age 
CHECK (age >= 0 AND age <= 30);

-- User progression validation
ALTER TABLE users ADD CONSTRAINT check_money CHECK (money >= 0);
ALTER TABLE users ADD CONSTRAINT check_level CHECK (level >= 1);
ALTER TABLE users ADD CONSTRAINT check_xp CHECK (xp >= 0);
```

### Business Rule Constraints
- **Training Age Limit**: Enforced at application layer (3+ years)
- **Training Cooldown**: 7-day global cooldown per horse
- **Competition Eligibility**: Age 3-20, level restrictions, no duplicates
- **Breeding Restrictions**: Age and gender requirements at application layer

## Migration History

### Key Migrations
1. **20241201000000_initial**: Basic tables and relationships
2. **20241215000000_add_users**: UUID-based user accounts
3. **20241220000000_training_cooldown**: Training restriction system
4. **20241225000000_competition_results**: Competition tracking system
5. **20241228000000_foal_development**: Breeding and development system
6. **20241230000000_discipline_scores**: Training progression tracking
7. **20250101000000_show_management**: Competition management system

### Migration Commands
```bash
# Generate new migration
npx prisma migrate dev --name migration_name

# Apply migrations to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Generate Prisma client
npx prisma generate
```

## Sample Queries

### Common Game Queries
```sql
-- Get user with all horses
SELECT p.*, h.name as horse_name, h.age, b.name as breed_name
FROM users p
LEFT JOIN horses h ON p.id = h.user_id
LEFT JOIN breeds b ON h.breed_id = b.id
WHERE p.id = $1;

-- Get trainable horses (age 3+, no recent training)
SELECT h.*, p.name as user_name
FROM horses h
JOIN users p ON h.user_id = p.id
WHERE h.age >= 3 
AND (h.training_cooldown IS NULL OR h.training_cooldown <= NOW());

-- Get competition results for horse
SELECT cr.*, s.name as show_name, s.discipline
FROM competition_results cr
JOIN shows s ON cr.show_id = s.id
WHERE cr.horse_id = $1
ORDER BY cr.run_date DESC;

-- Get horses with specific traits
SELECT h.*, h.epigenetic_modifiers->'positive' as positive_traits
FROM horses h
WHERE h.epigenetic_modifiers->'positive' ? 'resilient';
```

### Performance Queries
```sql
-- Efficient discipline score lookup
SELECT h.name, h.discipline_scores->>'Racing' as racing_score
FROM horses h
WHERE (h.discipline_scores->>'Racing')::int > 20;

-- Complex breeding query
SELECT f.*, 
       s.name as sire_name, 
       d.name as dam_name,
       f.genetics->'dominant_alleles' as dominant_traits
FROM foals f
JOIN horses s ON f.sire_id = s.id
JOIN horses d ON f.dam_id = d.id
WHERE f.user_id = $1;
```

## Backup and Recovery

### Backup Strategy
```bash
# Daily automated backups
pg_dump equoria_production > backup_$(date +%Y%m%d).sql

# JSONB-optimized backup
pg_dump --compress=9 --format=custom equoria_production > backup.dump
```

### Recovery Procedures
```bash
# Restore from backup
pg_restore --clean --if-exists backup.dump

# Point-in-time recovery (with WAL archiving)
pg_basebackup -D recovery_directory -Ft -z -P
```

## Environment Configuration

### Connection Strings
```bash
# Development
DATABASE_URL="postgresql://dev_user:dev_pass@localhost:5432/equoria_dev"

# Testing
DATABASE_URL="postgresql://test_user:test_pass@localhost:5432/equoria_test"

# Production
DATABASE_URL="postgresql://user:pass@host:5432/equoria_prod?sslmode=require&connection_limit=20"
```

## References
- **Architecture Overview**: `@docs/architecture.markdown`
- **API Specifications**: `@docs/api_specs.markdown`
- **Backend Implementation**: `@docs/backend-overview.md`
- **Models Layer**: `@docs/models-layer.md`
- **Database Infrastructure**: `@docs/database-infrastructure.md`