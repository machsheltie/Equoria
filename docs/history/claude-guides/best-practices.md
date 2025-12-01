# Development Best Practices

**Last Updated:** 2025-01-18
**Purpose:** Code quality standards and development guidelines for Equoria

---

## TypeScript Standards

### Strict Mode (Non-Negotiable)

**Configuration:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Rules:**
- ✅ Zero `any` types tolerated
- ✅ Explicit types for all function signatures
- ✅ Use optional chaining (`?.`) and nullish coalescing (`??`)
- ✅ Proper null/undefined handling

**Examples:**

```typescript
// ❌ BAD - Using 'any'
function processHorse(data: any) {
  return data.name;
}

// ✅ GOOD - Explicit types
interface Horse {
  id: string;
  name: string;
  age: number;
}

function processHorse(horse: Horse): string {
  return horse.name;
}

// ✅ GOOD - Null safety
function getHorseName(horse: Horse | null): string {
  return horse?.name ?? 'Unknown';
}
```

---

## Code Style and Patterns

### JavaScript/Node.js Backend

**Module System:**
```javascript
// ✅ ALWAYS use ES Modules (.mjs files)
import express from 'express';
import { createHorse } from './horseService.mjs';

// ❌ NEVER use CommonJS
const express = require('express'); // Don't do this
```

**Async/Await:**
```javascript
// ✅ GOOD - Use async/await
async function createHorseWithValidation(data) {
  await validateHorseData(data);
  const horse = await createHorse(data);
  await sendNotification(horse);
  return horse;
}

// ❌ BAD - Promise chains
function createHorseWithValidation(data) {
  return validateHorseData(data)
    .then(() => createHorse(data))
    .then(horse => sendNotification(horse).then(() => horse));
}
```

**Error Handling:**
```javascript
// ✅ GOOD - Custom error classes
class HorseValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'HorseValidationError';
    this.field = field;
  }
}

async function createHorse(data) {
  if (!data.name) {
    throw new HorseValidationError('Name is required', 'name');
  }
  // ... create horse
}

// ❌ BAD - Generic errors
throw new Error('Invalid data'); // Not helpful
```

### React/Frontend

**Component Patterns:**
```typescript
// ✅ GOOD - Functional component with TypeScript
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

// ❌ BAD - No types, unclear props
export function HorseCard(props) {
  return <div>{props.horse.name}</div>;
}
```

**State Management:**
```typescript
// ✅ GOOD - React Query for server state
import { useQuery } from '@tanstack/react-query';

function HorseList() {
  const { data: horses, isLoading } = useQuery({
    queryKey: ['horses'],
    queryFn: fetchHorses,
  });

  if (isLoading) return <Loading />;

  return horses.map(horse => <HorseCard key={horse.id} horse={horse} />);
}

// ✅ GOOD - useState for local component state
function HorseFilter() {
  const [searchTerm, setSearchTerm] = useState('');
  // ... filter logic
}
```

---

## Database Best Practices

### Prisma ORM

**Schema Design:**
```prisma
// ✅ GOOD - Clear relationships, proper types
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

**Query Optimization:**
```typescript
// ✅ GOOD - Include relations, select only needed fields
const horses = await prisma.horse.findMany({
  where: { ownerId: userId },
  select: {
    id: true,
    name: true,
    age: true,
    owner: {
      select: {
        id: true,
        username: true,
      },
    },
  },
  take: 20,
  orderBy: { createdAt: 'desc' },
});

// ❌ BAD - N+1 query problem
const horses = await prisma.horse.findMany();
for (const horse of horses) {
  const owner = await prisma.user.findUnique({
    where: { id: horse.ownerId }
  });
}
```

**JSONB Best Practices:**
```typescript
// ✅ GOOD - Structured JSONB with TypeScript
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
      coat: {
        base: 'bay',
        modifiers: ['flaxen', 'dapple']
      },
      height: 16.2,
      temperament: ['spirited', 'brave']
    } as HorseGenetics,
  },
});
```

---

## Performance Optimization

### Backend Performance

**Parallel Execution:**
```javascript
// ✅ GOOD - Run independent queries in parallel
const [horses, users, competitions] = await Promise.all([
  prisma.horse.findMany(),
  prisma.user.findMany(),
  prisma.competition.findMany(),
]);

// ❌ BAD - Sequential execution
const horses = await prisma.horse.findMany();
const users = await prisma.user.findMany();
const competitions = await prisma.competition.findMany();
```

**Caching:**
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

### Frontend Performance

**Code Splitting:**
```typescript
// ✅ GOOD - Lazy load routes
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

**Memoization:**
```typescript
// ✅ GOOD - Memoize expensive calculations
import { useMemo } from 'react';

function HorseStatistics({ horses }) {
  const statistics = useMemo(() => {
    return calculateComplexStats(horses); // Expensive operation
  }, [horses]);

  return <StatsDisplay stats={statistics} />;
}

// ✅ GOOD - Prevent unnecessary re-renders
const HorseCard = React.memo(({ horse }) => {
  return <div>{horse.name}</div>;
});
```

---

## Security Best Practices

### Authentication

**JWT Best Practices:**
```javascript
// ✅ GOOD - Short-lived access tokens, refresh tokens
const accessToken = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '15m' }
);

const refreshToken = jwt.sign(
  { userId: user.id },
  process.env.JWT_REFRESH_SECRET,
  { expiresIn: '7d' }
);
```

**Password Hashing:**
```javascript
import bcrypt from 'bcrypt';

// ✅ GOOD - Use bcrypt with high cost factor
const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}
```

### Input Validation

```typescript
// ✅ GOOD - Validate and sanitize input
import { z } from 'zod';

const CreateHorseSchema = z.object({
  name: z.string().min(1).max(50),
  age: z.number().int().min(0).max(30),
  breed: z.string().min(1).max(50),
});

function createHorse(data: unknown) {
  const validated = CreateHorseSchema.parse(data);
  return prisma.horse.create({ data: validated });
}

// ❌ BAD - No validation
function createHorse(data) {
  return prisma.horse.create({ data });
}
```

---

## Git Workflow

### Commit Messages

**Format:** Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**
```
feat(breeding): Add genetic trait inheritance system

Implemented multi-allele genetic system with dominant/recessive
traits for coat color, height, and temperament.

Closes #123

fix(api): Prevent duplicate horse registration

Added unique constraint on horse name + owner combination.

Refs #456
```

### Branch Naming

```
type/description

Examples:
- feat/authentication-system
- fix/horse-age-validation
- refactor/database-queries
- test/competition-scoring
```

### Pull Request Guidelines

**Title:** Same as commit message format
**Description:**
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

## Documentation Standards

### Code Documentation

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
// Use comments for non-obvious logic
function calculateGeneticTrait(sireGene: Gene, damGene: Gene): Gene {
  // Dominant genes take precedence in heterozygous pairs
  if (sireGene.dominance > damGene.dominance) {
    return sireGene;
  }

  // Equal dominance results in random selection (Mendelian inheritance)
  return Math.random() < 0.5 ? sireGene : damGene;
}
```

### API Documentation

**OpenAPI/Swagger:**
```yaml
paths:
  /api/horses:
    post:
      summary: Create a new horse
      tags:
        - Horses
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateHorseRequest'
      responses:
        '201':
          description: Horse created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Horse'
```

---

## Common Anti-Patterns to Avoid

### ❌ Magic Numbers
```typescript
// BAD
if (horse.age > 25) { /* ... */ }

// GOOD
const MAX_BREEDING_AGE = 25;
if (horse.age > MAX_BREEDING_AGE) { /* ... */ }
```

### ❌ Callback Hell
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

### ❌ Premature Optimization
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

## Performance Benchmarks

### Test Execution
- **Backend Tests:** <30s (parallel: 56% faster)
- **Frontend Tests:** <20s
- **E2E Tests:** <5 minutes

### API Response Times
- **GET /api/horses:** <100ms (95th percentile)
- **POST /api/horses:** <200ms (95th percentile)
- **Complex queries:** <500ms (95th percentile)

### Frontend Performance
- **First Contentful Paint:** <2s
- **Time to Interactive:** <3s
- **Lighthouse Score:** >90

---

**Related Documentation:**
- [Testing Standards](./testing-standards.md)
- [Workflow Automation](./workflow-automation.md)
- [Hooks Configuration](../config/hooks-config.md)
