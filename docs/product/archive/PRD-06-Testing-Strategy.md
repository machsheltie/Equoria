# PRD-06: Testing Strategy & Quality Assurance

**Version:** 1.0.0
**Last Updated:** 2025-12-01
**Status:** Backend ✅ Complete | Frontend ⚠️ In Progress
**Source Integration:** Consolidated from docs/history/claude-guides/ and docs/history/claude-docs/

---

## Overview

This document defines the comprehensive testing strategy for the Equoria platform. The approach is based on **Test-Driven Development (TDD)** principles with a **balanced mocking philosophy** that has been mathematically validated to achieve 90%+ success rates.

### Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Backend Tests | 468+ | Maintain |
| Backend Success Rate | 90.1% | >90% |
| Backend Coverage | 80-90% | 90%+ |
| Frontend Tests | 115+ | 200+ |
| Frontend Coverage | ~60% | 80%+ |

---

## 1. Testing Philosophy

### 1.1 Balanced Mocking Approach

**CRITICAL:** This project uses a balanced mocking philosophy that has been mathematically validated.

| Approach | Success Rate | Status |
|----------|--------------|--------|
| Balanced Mocking | 90.1% | ✅ Proven |
| Over-Mocking | 1% | ❌ Proven Failure |

**Strategy:**
- ✅ Mock ONLY external dependencies (database, HTTP, logger)
- ✅ Test real business logic with actual implementations
- ✅ Use integration tests for cross-system validation
- ✅ Pure functions tested without mocks achieve 100% success

**Evidence:**
This approach provides:
- Real bug detection (not false confidence)
- Actual implementation validation
- Reduced test brittleness
- Production-ready code assurance

### 1.2 TDD Workflow (Red-Green-Refactor)

**Mandatory Approach:**
1. **RED** - Write failing test first
2. **GREEN** - Implement minimum code to pass
3. **REFACTOR** - Improve code quality
4. **REPEAT** - For each feature

```javascript
// Step 1: RED - Write failing test
describe('HorseBreeding', () => {
  it('should create offspring with correct genetics', () => {
    const offspring = breedHorses(sireId, damId);
    expect(offspring.genetics).toMatchGeneticsRules(sire, dam);
  });
});

// Step 2: GREEN - Implement validation
function breedHorses(sireId, damId) {
  // Minimal implementation to pass test
}

// Step 3: REFACTOR - Improve (if needed)
// Step 4: REPEAT - Next test
```

---

## 2. Test Categories

### 2.1 Unit Tests (75% of tests)

**Purpose:** Individual component testing in isolation

**Coverage:** 350+ tests
- Models: CRUD operations, validation
- Controllers: Business logic
- Utils: Game mechanics, calculations
- Services: Background jobs

**Key Test Files:**
| File | Tests | Coverage |
|------|-------|----------|
| horseModel.test.js | 32 | CRUD, validation |
| userModel.test.js | 27 | Account management |
| trainingController.test.js | 38 | Training business logic |
| resultModel.test.js | 23 | Competition results |
| foalModel.test.js | 15+ | Breeding, foal management |

**Testing Pattern:**
```javascript
// ✅ GOOD - Mock only external dependencies
import { prismaMock } from '../__mocks__/prisma';

test('createHorse creates a horse with correct genetics', async () => {
  prismaMock.horse.create.mockResolvedValue(mockHorse);

  const result = await createHorse(horseData);

  // Test REAL business logic (genetics calculation)
  expect(result.genetics).toEqual(expectedGenetics);
});

// ❌ BAD - Over-mocking hides real bugs
jest.mock('../geneticsCalculator'); // Don't do this!
```

### 2.2 Integration Tests (20% of tests)

**Purpose:** Multi-component interactions and end-to-end workflows

**Coverage:** 100+ tests
- API endpoint testing with real database
- Multi-step process validation
- Data consistency verification
- Performance testing for critical operations

**Key Test Files:**
| File | Purpose |
|------|---------|
| training.test.js | Complete training workflows |
| cronJobsIntegration.test.js | Background job processing |
| traitDiscoveryIntegration.test.js | Trait revelation system |
| foalEnrichmentIntegration.test.js | Foal development workflows |
| competitionController.test.js | Competition system |

**Integration Pattern:**
```javascript
describe('Horse Breeding Integration', () => {
  it('should create offspring with correct genetics', async () => {
    // Use REAL database (test environment)
    const sire = await createTestHorse({ name: 'Sire' });
    const dam = await createTestHorse({ name: 'Dam' });

    const offspring = await breedHorses(sire.id, dam.id);

    // Verify REAL genetics calculation
    expect(offspring.genetics).toMatchGeneticsRules(sire, dam);
  });
});
```

### 2.3 End-to-End Tests (5% of tests)

**Purpose:** Critical user journeys

**Coverage:** 18+ tests
- Authentication flows
- Complete game workflows
- Cross-system interactions

**E2E Pattern (Playwright):**
```typescript
test('complete horse purchase flow', async ({ page }) => {
  // Login
  await page.fill('[data-testid="email"]', 'user@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="login-button"]');

  // Navigate to marketplace
  await page.click('text=Marketplace');

  // Select horse
  await page.click('[data-testid="horse-card"]:first-child');

  // Purchase
  await page.click('text=Buy Horse');
  await page.click('text=Confirm Purchase');

  // Verify success
  await expect(page.locator('text=Purchase successful')).toBeVisible();
});
```

---

## 3. Test Infrastructure

### 3.1 Backend Test Stack

| Tool | Purpose |
|------|---------|
| Jest | Test framework |
| Supertest | API endpoint testing |
| Prisma Mock | Database mocking for unit tests |
| Test Database | Real PostgreSQL for integration |

### 3.2 Frontend Test Stack

| Tool | Purpose |
|------|---------|
| Vitest | Test framework |
| React Testing Library | Component testing |
| Playwright | E2E browser automation |
| Storybook | Component development |
| axe-core | Accessibility testing |
| Lighthouse CI | Performance testing |

### 3.3 Test Environment Setup

**Backend Configuration:**
```javascript
// jest.config.mjs
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 10000,
  maxWorkers: '50%'
};
```

**Test Database:**
```bash
# .env.test
DATABASE_URL="postgresql://user:pass@localhost:5432/equoria_test"
NODE_ENV="test"
JWT_SECRET="test_secret_key"
```

**Setup/Teardown:**
```javascript
beforeEach(async () => {
  await clearTestData();
  await seedTestData();
});

afterEach(async () => {
  await cleanupTestData();
});
```

---

## 4. Specialized Test Suites

### 4.1 Game Mechanics Testing

**Trait System:**
| Test File | Purpose |
|-----------|---------|
| traitDiscovery.test.js | Trait revelation conditions |
| traitEvaluation.test.js | Trait impact calculations |
| epigeneticTraits.test.js | Advanced genetics system |

**Competition System:**
| Test File | Purpose |
|-----------|---------|
| simulateCompetition.test.js | Competition scoring |
| competitionRewards.test.js | Prize distribution |
| isHorseEligible.test.js | Competition eligibility |

**Training System:**
| Test File | Purpose |
|-----------|---------|
| trainingCooldown.test.js | Cooldown mechanism |
| training-complete.test.js | Complete workflow |
| training-updated.test.js | Enhanced training |

### 4.2 Security & Authentication Testing

**Features Tested:**
- JWT token generation and validation
- Password hashing and verification
- Role-based access control
- Session management
- Security middleware functionality
- Rate limiting

**Test Files:**
| File | Purpose |
|------|---------|
| auth.test.js | JWT authentication |
| auth-working.test.js | Authentication workflows |
| auth-simple.test.js | Basic authentication |

### 4.3 Database & Seeding Tests

**Features Tested:**
- Database connection stability
- Seeding data integrity
- Migration compatibility
- Data relationship validation

**Test Files:**
| File | Purpose |
|------|---------|
| database.test.js | Database connectivity |
| horseSeed.test.js | Data seeding |
| data-check.test.js | Data integrity |

---

## 5. Coverage Requirements

### 5.1 Coverage by Module

| Module | Current | Target |
|--------|---------|--------|
| Models Layer | 100% | 100% |
| Controllers Layer | 100% | 100% |
| Utils Layer | 100% | 100% |
| Routes Layer | 100% | 100% |
| Frontend Components | ~60% | 80%+ |

### 5.2 Coverage Metrics

| Metric | Backend | Frontend |
|--------|---------|----------|
| Line Coverage | 95%+ | 80%+ |
| Branch Coverage | 90%+ | 70%+ |
| Function Coverage | 100% | 80%+ |
| Integration Coverage | 100% | 80%+ |

### 5.3 Coverage Configuration

```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 90,
      "lines": 85,
      "statements": 85
    }
  }
}
```

---

## 6. Quality Gates

### 6.1 Pre-Commit

```bash
npm run lint
npm run type-check  # Frontend only
npm run test:affected
```

**Must Pass:**
- ESLint (errors only, warnings allowed)
- TypeScript type-check (frontend)
- Tests for changed files

### 6.2 Pre-Push

```bash
npm run test
npm run test:integration
npm run build
```

**Must Pass:**
- Full test suite (468+ backend, 115+ frontend)
- Integration tests
- Build succeeds

### 6.3 Pre-Deploy

```bash
npm run test:e2e
npm run test:performance
npm run security:audit
```

**Must Pass:**
- E2E tests (critical user journeys)
- Performance tests (Lighthouse scores >90)
- Security audit (npm audit)
- Zero critical vulnerabilities

---

## 7. Frontend Testing Strategy

### 7.1 Component Testing Best Practices

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ✅ GOOD - Wrap with necessary providers
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

test('HorseList displays horses from API', async () => {
  renderWithProviders(<HorseList />);

  await waitFor(() => {
    expect(screen.getByText('Thunderbolt')).toBeInTheDocument();
  });
});
```

### 7.2 Accessibility Testing

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('HorseCard has no accessibility violations', async () => {
  const { container } = render(<HorseCard horse={mockHorse} />);
  const results = await axe(container);

  expect(results).toHaveNoViolations();
});
```

**Required Standards:**
- WCAG 2.1 AA Compliance
- Keyboard Navigation
- Screen Reader Support
- Color Contrast (4.5:1 minimum)

### 7.3 Performance Testing

**Lighthouse CI Configuration:**
```json
{
  "ci": {
    "collect": {
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 2000 }]
      }
    }
  }
}
```

---

## 8. Backend Load Testing

### 8.1 Artillery Configuration

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 50
    - duration: 60
      arrivalRate: 100
scenarios:
  - flow:
      - post:
          url: '/api/auth/login'
          json:
            email: 'test@example.com'
            password: 'password123'
          capture:
            - json: '$.data.accessToken'
              as: 'token'
      - get:
          url: '/api/horses'
          headers:
            Authorization: 'Bearer {{ token }}'
      - post:
          url: '/api/training/train'
          headers:
            Authorization: 'Bearer {{ token }}'
          json:
            horseId: 1
            discipline: 'dressage'
```

### 8.2 Performance Targets

| Metric | Target |
|--------|--------|
| Response time (p95) | <200ms |
| Response time (p99) | <500ms |
| Throughput | 100+ req/s |
| Error rate | <0.1% |
| Concurrent users | 500+ |

---

## 9. Test Organization

### 9.1 Backend Structure

```
backend/tests/
├── unit/                    # Individual component testing
│   ├── models/             # Model function testing
│   ├── controllers/        # Controller logic testing
│   ├── utils/              # Utility function testing
│   └── helpers/            # Test helper utilities
├── integration/            # Multi-component testing
│   ├── user.test.js       # User system integration
│   └── horseRoutes.test.js # API endpoint integration
├── setup.js               # Test environment setup
└── data-check.test.js     # Database connectivity validation
```

### 9.2 Frontend Structure

```
frontend/src/
├── components/
│   ├── HorseCard.tsx
│   └── __tests__/
│       └── HorseCard.test.tsx
├── pages/
│   ├── Dashboard.tsx
│   └── __tests__/
│       └── Dashboard.test.tsx
└── utils/
    ├── genetics.ts
    └── __tests__/
        └── genetics.test.ts
```

### 9.3 Naming Conventions

- **File:** `ComponentName.test.tsx` or `functionName.test.ts`
- **Describe:** Component/function name
- **Test:** "should [expected behavior]"

```typescript
describe('HorseCard', () => {
  it('should display horse name', () => {
    // test implementation
  });

  it('should show genetic traits when expanded', () => {
    // test implementation
  });
});
```

---

## 10. CI/CD Integration

### 10.1 GitHub Actions

```yaml
name: Run Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: equoria_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run test:coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### 10.2 Test Execution Performance

| Metric | Target |
|--------|--------|
| Backend Unit Tests | <30 seconds |
| Backend Integration | <60 seconds |
| Frontend Tests | <20 seconds |
| E2E Tests | <5 minutes |
| Total Pipeline | <10 minutes |

---

## 11. Error Testing Patterns

### 11.1 Comprehensive Error Coverage

**Error Types to Test:**
- Database connection failures
- Invalid input validation
- Authentication failures
- Authorization denials
- Resource not found scenarios
- Timeout conditions

### 11.2 Error Testing Pattern

```javascript
test('should handle database connection failure', async () => {
  // Mock database failure
  jest.spyOn(prisma, 'horse').mockRejectedValue(
    new Error('Connection failed')
  );

  // Verify proper error handling
  await expect(getHorseById(1)).rejects.toThrow('Connection failed');
});

test('should return 404 for non-existent horse', async () => {
  const response = await request(app)
    .get('/api/horses/99999')
    .set('Authorization', `Bearer ${validToken}`);

  expect(response.status).toBe(404);
  expect(response.body.success).toBe(false);
});
```

---

## 12. Mock Strategy

### 12.1 What to Mock

| Mock | When |
|------|------|
| Database (Prisma) | Unit tests only |
| External HTTP APIs | Always |
| Logger | When testing logging behavior |
| Time functions | For time-dependent tests |
| Random generators | For predictable outcomes |

### 12.2 What NOT to Mock

| Don't Mock | Why |
|------------|-----|
| Business logic | Defeats purpose of testing |
| Validation functions | Need real validation |
| Calculation functions | Need real calculations |
| Internal services | Test real integration |

### 12.3 Mock Examples

```javascript
// ✅ GOOD - Mock external dependency
jest.mock('../utils/externalService.js', () => ({
  callExternalAPI: jest.fn().mockResolvedValue(mockResponse)
}));

// ❌ BAD - Over-mocking internal logic
jest.mock('../services/geneticsCalculator'); // Don't do this!
```

---

## Cross-References

- **Previous:** [PRD-05-Deployment-Guide.md](./PRD-05-Deployment-Guide.md)
- **API Contracts:** [api-contracts-backend.md](../api-contracts-backend.md)
- **Development Guide:** [development-guide.md](../development-guide.md)
- **Architecture:** [architecture-backend.md](../architecture-backend.md)
- **Historical Source:** `docs/history/claude-guides/testing-standards.md`, `docs/history/claude-docs/archive/testing-architecture.md`

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-01 | Initial creation from historical docs consolidation |
