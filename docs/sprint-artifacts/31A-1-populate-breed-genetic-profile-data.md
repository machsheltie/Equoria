# Story 31A-1: Populate Breed Genetic Profile Data

**Epic:** 31A — Breed Genetic Profile Population
**Story:** 31A-1
**Status:** ready-for-dev
**Created:** 2026-04-01
**Story File:** docs/sprint-artifacts/31A-1-populate-breed-genetic-profile-data.md

---

## User Story

As a developer,
I want all breed records populated with complete genetic profiles in the `breed_genetic_profile` JSONB field,
So that all downstream systems (conformation, gaits, temperament, color genetics) have the data they need to generate horse attributes.

---

## Context & Scope

The project currently has **12 canonical breeds** in the database, each with a `breedGeneticProfile` JSONB field (migration `20260325143510_add_breed_genetic_profile` already ran). An existing seed script at `backend/seed/populateBreedGeneticProfiles.mjs` handles the original 12 breeds via Prisma upsert.

The **expanded scope** of this story is to load **310 breed records** from `docs/BreedData/*.txt`. Each `.txt` file is a raw SQL INSERT statement containing a complete `breed_genetic_profile` JSONB blob with:

- `allowed_alleles`, `allele_weights`, `disallowed_combinations` — coat color genetics (needed by Epic 31E)
- `marking_bias`, `shade_bias`, `boolean_modifiers_prevalence`, `advanced_markings_bias` — marking system (needed by Epic 31E)
- `rating_profiles` — conformation + gait means/std_devs (needed by Epics 31B, 31C)
- `temperament_weights` — breed temperament distributions (needed by Epic 31D)
- `starter_stats` — initial stat distributions for new horses
- `is_gaited_breed`, `gaited_gait_registry` — gaited breed configuration (needed by Epic 31C)

**Running this story pre-loads the data for all Physical Systems epics (31B–31E) in one step.**

---

## Acceptance Criteria

**Given** a Prisma migration adds `defaultTrait String?` to the Breed model
**When** the migration runs
**Then** the `breeds` table has a `default_trait` column without breaking existing data

**Given** the Breed model has a unique index on `name`
**When** the seed script runs
**Then** `ON CONFLICT (name) DO UPDATE` in the SQL files resolves correctly

**Given** the seed script reads all `.txt` files from `docs/BreedData/`
**When** it executes each file against the database
**Then** 310 breed records exist in the `breeds` table with non-null `breed_genetic_profile` JSONB

**And** each breed's `breed_genetic_profile` contains all required top-level keys:

- `allowed_alleles` — object with 17+ locus keys
- `allele_weights` — probability distributions per locus
- `disallowed_combinations` — lethal combination exclusions
- `marking_bias` — face/leg marking probabilities
- `shade_bias` — color shade variants
- `boolean_modifiers_prevalence` — sooty/flaxen/pangare/rabicano rates
- `rating_profiles.conformation` — 8 region means + std_devs
- `rating_profiles.gaits` — walk/trot/canter/gallop/gaiting means + std_devs
- `rating_profiles.is_gaited_breed` — boolean
- `temperament_weights` — 11 temperament types summing to 100
- `starter_stats` — 12 stat means + std_devs

**And** the script is idempotent (can run multiple times without error or data corruption)

**And** the script logs a summary: total breeds processed, created vs updated, any errors

**And** existing 12 canonical breed records (IDs 1–12) are updated, not duplicated

**And** a test verifies the count (≥ 300 breeds), required JSONB keys presence, and idempotency

---

## Technical Implementation Plan

### Task 1: Prisma Schema Migration

**File:** `packages/database/prisma/schema.prisma`

Add two fields to the `Breed` model:

```prisma
model Breed {
  id                  Int      @id @default(autoincrement())
  name                String   @unique                        // ADD @unique if not present
  description         String?
  defaultTrait        String?                                 // ADD THIS
  breedGeneticProfile Json?
  horses              Horse[]
  @@map("breeds")
}
```

**Critical:** The `name` field MUST have `@unique` for `ON CONFLICT (name)` to work. Check current schema — add `@unique` if missing.

Run migration:

```bash
cd packages/database
npx prisma migrate dev --name add_breed_default_trait
```

This generates a migration SQL:

```sql
ALTER TABLE "breeds" ADD COLUMN "defaultTrait" TEXT;
ALTER TABLE "breeds" ADD CONSTRAINT "breeds_name_key" UNIQUE ("name");  -- if not already present
```

**Do NOT add `updatedAt`** — the SQL files reference `updated_at` (snake_case) but Prisma maps camelCase. Strip it from the seed script execution or use raw SQL that handles missing columns gracefully.

---

### Task 2: Create Breed Seed Script

**File:** `backend/seed/populateBreedsFromSql.mjs`

```javascript
/**
 * populateBreedsFromSql.mjs
 *
 * Reads all breed SQL files from docs/BreedData/*.txt and executes them
 * against the database to populate breed records with complete genetic profiles.
 *
 * Idempotent — safe to run multiple times.
 * Covers 310 breeds including all coat color genetics data for Epic 31E.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import prisma from '../../packages/database/prismaClient.js';
import logger from '../logger/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BREED_DATA_DIR = join(__dirname, '../../docs/BreedData');

/**
 * Strip the updated_at reference from SQL since it's not in Prisma schema.
 * The ON CONFLICT clause updates breed_genetic_profile and default_trait only.
 */
function sanitizeSql(sql) {
  // Remove updated_at = NOW() from ON CONFLICT SET clause
  return sql.replace(/,?\s*updated_at\s*=\s*NOW\(\)/gi, '');
}

export async function populateBreedsFromSql() {
  const results = { processed: 0, errors: [], errorFiles: [] };

  let files;
  try {
    files = await readdir(BREED_DATA_DIR);
  } catch (err) {
    throw new Error(`Cannot read breed data directory: ${BREED_DATA_DIR} — ${err.message}`);
  }

  // Only process .txt files (breed SQL files), skip .sql files (handled separately)
  const breedFiles = files.filter((f) => f.endsWith('.txt')).sort();

  logger.info(`[populateBreedsFromSql] Processing ${breedFiles.length} breed files...`);

  for (const file of breedFiles) {
    const filePath = join(BREED_DATA_DIR, file);
    try {
      const rawSql = await readFile(filePath, 'utf8');
      const sql = sanitizeSql(rawSql);
      await prisma.$executeRawUnsafe(sql);
      results.processed++;
    } catch (err) {
      const msg = `Failed: ${file} — ${err.message}`;
      results.errors.push(msg);
      results.errorFiles.push(file);
      logger.error(`[populateBreedsFromSql] ${msg}`);
    }
  }

  const breedCount = await prisma.breed.count();
  logger.info(
    `[populateBreedsFromSql] Complete. Processed: ${results.processed}, Errors: ${results.errors.length}, Total breeds in DB: ${breedCount}`
  );

  if (results.errors.length > 0) {
    logger.warn('[populateBreedsFromSql] Failed files:', results.errorFiles);
  }

  return { ...results, totalBreeds: breedCount, success: results.errors.length === 0 };
}

// Allow direct execution: node backend/seed/populateBreedsFromSql.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  populateBreedsFromSql()
    .then((result) => {
      console.log('Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal error:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
```

**Prisma client import path:** Check existing seed scripts for the correct import. It may be:

- `'../../packages/database/prismaClient.js'`
- `'../db/index.mjs'`
- Match the import path used in `backend/seed/populateBreedGeneticProfiles.mjs`

---

### Task 3: Add npm Script

**File:** `backend/package.json`

Add to `scripts`:

```json
"seed:breeds": "node seed/populateBreedsFromSql.mjs"
```

Also add a combined script:

```json
"seed:all-breeds": "node seed/populateBreedsFromSql.mjs"
```

---

### Task 4: Write Tests

**File:** `backend/tests/seed/populateBreedsFromSql.test.mjs`

Test strategy: Balanced mocking — mock the filesystem reads and `prisma.$executeRawUnsafe`, test real business logic (file filtering, SQL sanitization, error handling, result aggregation).

```javascript
/**
 * Tests for populateBreedsFromSql seed script.
 * Mocks: fs/promises (readdir/readFile), prisma.$executeRawUnsafe, prisma.breed.count
 * Tests: file filtering, SQL sanitization, error handling, result structure
 */

import { jest } from '@jest/globals';

// Mock fs/promises
jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

// Mock prisma
jest.mock('../../../packages/database/prismaClient.js', () => ({
  default: {
    $executeRawUnsafe: jest.fn(),
    breed: { count: jest.fn() },
    $disconnect: jest.fn(),
  },
}));

import { readdir, readFile } from 'fs/promises';
import prisma from '../../../packages/database/prismaClient.js';
import { populateBreedsFromSql } from '../../seed/populateBreedsFromSql.mjs';

describe('populateBreedsFromSql', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.breed.count.mockResolvedValue(310);
    prisma.$executeRawUnsafe.mockResolvedValue(1);
  });

  it('processes only .txt files, ignores .sql files', async () => {
    readdir.mockResolvedValue(['Arabian.txt', 'seed.sql', 'Appaloosa.txt', 'README.md']);
    readFile.mockResolvedValue("INSERT INTO breeds (name) VALUES ('test')");

    await populateBreedsFromSql();

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2); // Arabian.txt + Appaloosa.txt only
  });

  it('strips updated_at from SQL before execution', async () => {
    readdir.mockResolvedValue(['Arabian.txt']);
    readFile.mockResolvedValue(
      "INSERT INTO breeds VALUES ('Arabian') ON CONFLICT (name) DO UPDATE SET breed_genetic_profile = EXCLUDED.breed_genetic_profile, updated_at = NOW()"
    );

    await populateBreedsFromSql();

    const executedSql = prisma.$executeRawUnsafe.mock.calls[0][0];
    expect(executedSql).not.toContain('updated_at');
  });

  it('returns processed count and totalBreeds on success', async () => {
    readdir.mockResolvedValue(['Arabian.txt', 'Appaloosa.txt']);
    readFile.mockResolvedValue("INSERT INTO breeds VALUES ('test')");

    const result = await populateBreedsFromSql();

    expect(result.processed).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(result.totalBreeds).toBe(310);
    expect(result.success).toBe(true);
  });

  it('captures errors per file and continues processing others', async () => {
    readdir.mockResolvedValue(['Arabian.txt', 'BadBreed.txt']);
    readFile.mockResolvedValue("INSERT INTO breeds VALUES ('test')");
    prisma.$executeRawUnsafe
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('syntax error'));

    const result = await populateBreedsFromSql();

    expect(result.processed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errorFiles).toContain('BadBreed.txt');
    expect(result.success).toBe(false);
  });

  it('throws if breed data directory cannot be read', async () => {
    readdir.mockRejectedValue(new Error('ENOENT'));

    await expect(populateBreedsFromSql()).rejects.toThrow('Cannot read breed data directory');
  });
});
```

---

### Task 5: Verify Existing 12-Breed Seed Compatibility

The existing `backend/seed/populateBreedGeneticProfiles.mjs` handles 12 breeds via Prisma upsert with a different JSONB structure. After this story runs:

- The 310-breed SQL data **supersedes** the existing 12-breed data
- The JSONB from `.txt` files is a superset (includes all existing keys plus coat color genetics)
- Do NOT delete `populateBreedGeneticProfiles.mjs` — it may still be referenced elsewhere
- Do NOT call `populateBreedGeneticProfiles.mjs` after running `populateBreedsFromSql.mjs` on the same breeds — the SQL files are the new source of truth

---

## File Locations

| Action                         | File                                                                    |
| ------------------------------ | ----------------------------------------------------------------------- |
| Prisma schema update           | `packages/database/prisma/schema.prisma`                                |
| New migration (auto-generated) | `packages/database/prisma/migrations/YYYYMMDD_add_breed_default_trait/` |
| New seed script                | `backend/seed/populateBreedsFromSql.mjs`                                |
| Seed tests                     | `backend/tests/seed/populateBreedsFromSql.test.mjs`                     |
| package.json scripts           | `backend/package.json`                                                  |
| Breed data source (READ ONLY)  | `docs/BreedData/*.txt` (310 files)                                      |

---

## Critical Constraints

- **ES Modules only** — `.mjs` extension, `import`/`export`, no `require()`
- **Import paths require `.js` extension** — e.g., `import prisma from '../../packages/database/prismaClient.js'`
- **Do NOT modify `.txt` files** — they are the source of truth, sanitize in code
- **Do NOT alter existing breedController.mjs or breedRoutes.mjs** — this is a seed-only story
- **Do NOT add new API endpoints** — out of scope for this story
- **Prisma migration only** — do not edit the DB schema directly
- **Balanced mocking** — mock only `fs/promises` and `prisma` in tests; test real sanitization logic

---

## Architecture Guardrails

- New seed script goes in `backend/seed/` — matches existing `populateBreedGeneticProfiles.mjs` location
- Logger import: check existing seed scripts for exact import path (e.g., `../logger/index.mjs`)
- Prisma client: match the import used in `backend/seed/populateBreedGeneticProfiles.mjs` exactly
- Test files go in `backend/tests/seed/` folder (create if it doesn't exist)
- Follow existing test pattern: `describe`/`it`/`beforeEach`, `jest.mock()` at top

---

## Definition of Done

- [ ] Prisma schema has `defaultTrait String?` and `@unique` on `name`
- [ ] Migration runs cleanly (`prisma migrate dev`)
- [ ] `backend/seed/populateBreedsFromSql.mjs` created and executable
- [ ] `npm run seed:breeds` runs without error
- [ ] Database contains ≥ 300 breed records after running
- [ ] Each breed has non-null `breed_genetic_profile` with all required keys
- [ ] Script is idempotent (run twice = same result, no errors)
- [ ] Tests pass: `npx jest populateBreedsFromSql`
- [ ] No lint errors: `npm run lint`
- [ ] Existing breed API tests still pass (no regressions)

---

## Dev Notes

- The `generichorse.txt` file appears to contain a generic/fallback profile — process it last or skip it (it inserts as 'Lusitano' based on file content, which conflicts with the canonical Lusitano breed). Investigate before running.
- `seed.sql` uses a PL/pgSQL `DO $$...$$` block with a variable — this may not execute cleanly via `$executeRawUnsafe`. If it fails, skip it; the individual .txt files are the actual breed data.
- `populate_breed_ratings.sql` and `populate_breed_temperaments.sql` use the JSONB merge operator (`||`) for the original 12 breeds. These are superseded by the .txt files but can be run first as a fallback.
- File execution order: sort alphabetically to ensure consistent, reproducible runs.
