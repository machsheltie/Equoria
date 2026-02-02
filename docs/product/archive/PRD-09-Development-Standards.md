# PRD-09: Development Standards

**Version:** 1.0.0
**Last Updated:** 2025-12-01
**Status:** Reference Documentation
**Source Integration:** Consolidated from docs/history/claude-guides/best-practices.md, TECH_STACK_DOCUMENTATION.md

---

## Overview

This document establishes the development standards, coding conventions, and best practices for the Equoria project. All contributors must adhere to these standards to maintain code quality and consistency.

---

## 1. Technology Stack

### 1.1 Backend Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Runtime** | Node.js | 18+ |
| **Framework** | Express.js | 4.18+ |
| **Database** | PostgreSQL | 14+ |
| **ORM** | Prisma | 6.8+ |
| **Authentication** | JWT | - |
| **Logging** | Winston | 3.x |
| **Testing** | Jest + Supertest | - |

### 1.2 Frontend Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | React | 19 |
| **Build Tool** | Vite | 5.2+ |
| **Styling** | TailwindCSS | 3.4+ |
| **State Management** | React Query | 5.x |
| **Routing** | React Router | 6.x |
| **Type System** | TypeScript | 5.x |
| **Testing** | Jest + RTL | - |

### 1.3 Database Design

| Feature | Technology |
|---------|------------|
| **Schema Management** | Prisma Migrations |
| **Flexible Data** | JSONB fields |
| **Indexing** | Strategic indexes |
| **Connection Pool** | Prisma built-in |

---

## 2. Code Style Standards

### 2.1 JavaScript/Node.js (Backend)

#### ES Modules (Required)
```javascript
// ALWAYS use ES Modules (.mjs files)
import express from 'express';
import { createHorse } from './horseService.mjs';

// NEVER use CommonJS
// const express = require('express'); // Don't do this
```

#### Async/Await (Required)
```javascript
// GOOD - Use async/await
async function createHorseWithValidation(data) {
  await validateHorseData(data);
  const horse = await createHorse(data);
  await sendNotification(horse);
  return horse;
}

// BAD - Promise chains
function createHorseWithValidation(data) {
  return validateHorseData(data)
    .then(() => createHorse(data))
    .then(horse => sendNotification(horse).then(() => horse));
}
```

#### Error Handling (Required)
```javascript
// GOOD - Custom error classes
class HorseValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'HorseValidationError';
    this.field = field;
  }
}

// BAD - Generic errors
throw new Error('Invalid data'); // Not helpful
```

### 2.2 TypeScript/React (Frontend)

#### Strict Mode (Non-Negotiable)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### Component Patterns
```typescript
// GOOD - Typed functional component
interface HorseCardProps {
  horse: Horse;
  onSelect?: (horse: Horse) => void;
}

export function HorseCard({ horse, onSelect }: HorseCardProps) {
  const handleClick = () => {
    onSelect?.(horse);
  };

  return (
    <div onClick={handleClick}>
      <h3>{horse.name}</h3>
      <p>Age: {horse.age}</p>
    </div>
  );
}

// BAD - No types
export function HorseCard(props) {
  return <div>{props.horse.name}</div>;
}
```

#### State Management
```typescript
// React Query for server state
import { useQuery } from '@tanstack/react-query';

function HorseList() {
  const { data: horses, isLoading } = useQuery({
    queryKey: ['horses'],
    queryFn: fetchHorses,
  });

  if (isLoading) return <Loading />;
  return horses.map(horse => <HorseCard key={horse.id} horse={horse} />);
}

// useState for local component state
function HorseFilter() {
  const [searchTerm, setSearchTerm] = useState('');
  // ... filter logic
}
```

---

## 3. Database Best Practices

### 3.1 Prisma Schema Design

```prisma
// GOOD - Clear relationships, proper types
model Horse {
  id        String   @id @default(uuid())
  name      String
  age       Int
  genetics  Json     // JSONB for flexible game data
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
  @@index([createdAt])
}
```

### 3.2 Query Optimization

```typescript
// GOOD - Include relations, select only needed fields
const horses = await prisma.horse.findMany({
  where: { ownerId: userId },
  select: {
    id: true,
    name: true,
    age: true,
    owner: {
      select: { id: true, username: true },
    },
  },
  take: 20,
  orderBy: { createdAt: 'desc' },
});

// BAD - N+1 query problem
const horses = await prisma.horse.findMany();
for (const horse of horses) {
  const owner = await prisma.user.findUnique({
    where: { id: horse.ownerId }
  }); // N+1 queries!
}
```

### 3.3 JSONB Best Practices

```typescript
// GOOD - Structured JSONB with TypeScript
interface HorseGenetics {
  coat: {
    base: string;
    dilution?: string;
    modifiers: string[];
  };
  height: number;
  temperament: string[];
}

await prisma.horse.create({
  data: {
    name: 'Thunderbolt',
    genetics: {
      coat: { base: 'bay', modifiers: ['flaxen'] },
      height: 16.2,
      temperament: ['spirited', 'brave']
    } as HorseGenetics,
  },
});
```

---

## 4. Performance Standards

### 4.1 Backend Performance

#### Parallel Execution
```javascript
// GOOD - Run independent queries in parallel
const [horses, users, competitions] = await Promise.all([
  prisma.horse.findMany(),
  prisma.user.findMany(),
  prisma.competition.findMany(),
]);

// BAD - Sequential execution
const horses = await prisma.horse.findMany();
const users = await prisma.user.findMany();
const competitions = await prisma.competition.findMany();
```

#### Caching Strategy
```javascript
import Redis from 'ioredis';

const redis = new Redis();

async function getHorse(id) {
  // Check cache first
  const cached = await redis.get(`horse:${id}`);
  if (cached) return JSON.parse(cached);

  // Fetch from database
  const horse = await prisma.horse.findUnique({ where: { id } });

  // Cache for 5 minutes
  await redis.setex(`horse:${id}`, 300, JSON.stringify(horse));

  return horse;
}
```

### 4.2 Frontend Performance

#### Code Splitting
```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Training = lazy(() => import('./pages/Training'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/training" element={<Training />} />
      </Routes>
    </Suspense>
  );
}
```

#### Memoization
```typescript
import { useMemo, memo } from 'react';

function HorseStatistics({ horses }) {
  const statistics = useMemo(() => {
    return calculateComplexStats(horses);
  }, [horses]);

  return <StatsDisplay stats={statistics} />;
}

const HorseCard = memo(({ horse }) => {
  return <div>{horse.name}</div>;
});
```

### 4.3 Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API GET requests** | <100ms | 95th percentile |
| **API POST requests** | <200ms | 95th percentile |
| **Complex queries** | <500ms | 95th percentile |
| **First Contentful Paint** | <2s | Lighthouse |
| **Time to Interactive** | <3s | Lighthouse |
| **Lighthouse Score** | >90 | Overall |
| **Backend Tests** | <30s | Full suite |
| **Frontend Tests** | <20s | Full suite |

---

## 5. Git Workflow

### 5.1 Commit Messages

**Format:** Conventional Commits
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting |
| `refactor` | Code restructuring |
| `test` | Adding tests |
| `chore` | Maintenance |

**Examples:**
```
feat(breeding): Add genetic trait inheritance system

Implemented multi-allele genetic system with dominant/recessive
traits for coat color, height, and temperament.

Closes #123
```

### 5.2 Branch Naming

```
type/description

Examples:
- feat/authentication-system
- fix/horse-age-validation
- refactor/database-queries
- test/competition-scoring
```

### 5.3 Pull Request Guidelines

**Title:** Same as commit message format

**Description Template:**
```markdown
## Summary
Brief description of changes

## Changes Made
- Bullet point list of key changes

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests passing
- [ ] Manual testing completed

## Screenshots
(If UI changes)
```

---

## 6. Documentation Standards

### 6.1 Code Documentation

**JSDoc for Functions:**
```typescript
/**
 * Creates a new horse with genetic trait inheritance
 * @param sireId - ID of the sire (father) horse
 * @param damId - ID of the dam (mother) horse
 * @param name - Name for the new foal
 * @returns Promise resolving to the created horse
 * @throws {ValidationError} If parent horses are incompatible
 */
async function breedHorses(
  sireId: string,
  damId: string,
  name: string
): Promise<Horse> {
  // Implementation
}
```

**Inline Comments:**
```typescript
function calculateGeneticTrait(sireGene: Gene, damGene: Gene): Gene {
  // Dominant genes take precedence in heterozygous pairs
  if (sireGene.dominance > damGene.dominance) {
    return sireGene;
  }

  // Equal dominance results in random selection (Mendelian inheritance)
  return Math.random() < 0.5 ? sireGene : damGene;
}
```

### 6.2 Document Standards

- **Maximum 500 lines** per document
- **Clear title and version**
- **Last updated date**
- **Status indicators**
- **Cross-references**

---

## 7. Anti-Patterns to Avoid

### 7.1 Magic Numbers
```typescript
// BAD
if (horse.age > 25) { /* ... */ }

// GOOD
const MAX_BREEDING_AGE = 25;
if (horse.age > MAX_BREEDING_AGE) { /* ... */ }
```

### 7.2 Callback Hell
```javascript
// BAD
function processHorse(id, callback) {
  getHorse(id, (horse) => {
    validateHorse(horse, (valid) => {
      if (valid) {
        saveHorse(horse, (result) => {
          callback(result);
        });
      }
    });
  });
}

// GOOD
async function processHorse(id) {
  const horse = await getHorse(id);
  const valid = await validateHorse(horse);
  if (valid) {
    return await saveHorse(horse);
  }
}
```

### 7.3 Using `any` Type
```typescript
// BAD
function processHorse(data: any) {
  return data.name;
}

// GOOD
interface Horse {
  id: string;
  name: string;
  age: number;
}

function processHorse(horse: Horse): string {
  return horse.name;
}
```

### 7.4 Premature Optimization
```typescript
// BAD - Over-optimizing before measuring
const memoizedEverything = useMemo(() => horse.name, [horse]);

// GOOD - Optimize when needed
const expensiveCalculation = useMemo(
  () => calculateGeneticProbabilities(horse),
  [horse]
);
```

---

## 8. Testing Standards

### 8.1 Testing Philosophy

**Balanced Mocking Approach:**
- Mock ONLY external dependencies (database, HTTP, logger)
- Test real business logic with actual implementations
- Use integration tests for cross-system validation
- Pure functions tested without mocks achieve 100% success

### 8.2 Coverage Requirements

| Category | Minimum |
|----------|---------|
| **Branches** | 80% |
| **Functions** | 90% |
| **Lines** | 85% |
| **Statements** | 85% |

### 8.3 Test File Organization

```
src/
  services/
    horseService.mjs
    __tests__/
      horseService.test.mjs
  controllers/
    horseController.mjs
    __tests__/
      horseController.test.mjs
```

---

## 9. Project Milestones & Achievements

### 9.1 Backend Milestones

| Date | Achievement |
|------|-------------|
| 2025-10-29 | Windows compatibility fix for npm test |
| 2025-10-29 | 100% frontend test success (268/268) |
| 2025-10-28 | Frontend groom system Phase 2 complete |
| 2025-10-22 | Backend ESLint 0 errors (9,014 fixed) |
| 2025-10-21 | Frontend tests 100% NO MOCKING |

### 9.2 Current Metrics

| Metric | Value |
|--------|-------|
| **Backend Tests** | 468+ (90.1% success) |
| **Frontend Tests** | 268 (100% success) |
| **Database Tables** | 30+ |
| **API Endpoints** | 130+ |
| **ESLint Errors** | 0 |

---

## 10. Quality Gates

### 10.1 Pre-Commit

- [ ] ESLint passing
- [ ] TypeScript type-check passing
- [ ] Affected tests passing

### 10.2 Pre-Push

- [ ] Full test suite passing
- [ ] Build successful
- [ ] No console.log statements

### 10.3 Pre-Merge

- [ ] Code review approved
- [ ] All CI checks passing
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

---

## Cross-References

- **Testing Strategy:** See [PRD-06-Testing-Strategy.md](./PRD-06-Testing-Strategy.md)
- **Deployment Guide:** See [PRD-05-Deployment-Guide.md](./PRD-05-Deployment-Guide.md)
- **Security Architecture:** See [PRD-08-Security-Architecture.md](./PRD-08-Security-Architecture.md)
- **Historical Source:** `docs/history/claude-guides/best-practices.md`

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-01 | Initial creation from best-practices.md and TECH_STACK_DOCUMENTATION.md |
