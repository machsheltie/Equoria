# Testing Standards

**Last Updated:** 2025-01-18
**Purpose:** Comprehensive testing guidelines for Equoria project

---

## Testing Philosophy

### Balanced Mocking Approach ✨

**CRITICAL:** This project uses a balanced mocking philosophy that has been mathematically validated:

**Current Success Rate:** 90.1% (851/942 tests passing)
**Over-Mocking Success Rate:** 1% (proven failure)

**Strategy:**

- ✅ Mock ONLY external dependencies (database, HTTP, logger)
- ✅ Test real business logic with actual implementations
- ✅ Use integration tests for cross-system validation
- ✅ Pure functions tested without mocks achieve 100% success

**Evidence:** This approach provides:

- Real bug detection (not false confidence)
- Actual implementation validation
- Reduced test brittleness
- Production-ready code assurance

---

## Backend Testing

### Test Coverage Targets

- **Unit Tests:** 90%+ coverage for business logic
- **Integration Tests:** All cross-system interactions
- **API Tests:** Every endpoint with multiple scenarios
- **Performance Tests:** Load testing for critical paths

### Current Status

- **Tests:** 468+ tests
- **Success Rate:** 90.1%
- **Coverage:** 80-90% across modules

### Testing Stack

- **Framework:** Jest
- **Mocking:** Minimal (only external dependencies)
- **Database:** Mock Prisma client for unit tests, real DB for integration
- **HTTP:** Supertest for API endpoint testing

### Example: Balanced Mocking

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

---

## Frontend Testing (React 19 + TypeScript)

### Test Coverage Targets

- **Component Tests:** 80%+ coverage
- **Integration Tests:** User flow testing
- **E2E Tests:** Critical user journeys
- **Accessibility:** WCAG 2.1 AA compliance

### Current Status

- **Tests:** 115+ tests
- **Completion:** ~60% (frontend is 60% complete)
- **Coverage:** Aligned with implementation progress

### Testing Stack

- **Unit/Component:** Vitest + React Testing Library
- **E2E:** Playwright (browser automation)
- **Visual:** Storybook (component development)
- **Accessibility:** axe-core + eslint-plugin-jsx-a11y
- **Performance:** Lighthouse CI

### Test-Driven Development (TDD) Workflow

**Mandatory Approach:**

1. **RED** - Write failing test first
2. **GREEN** - Implement minimum code to pass
3. **REFACTOR** - Improve code quality
4. **REPEAT** - For each feature

**Example TDD Workflow:**

```typescript
// Step 1: RED - Write failing test
describe('LoginPage', () => {
  it('should validate email format', () => {
    const { getByLabelText, getByText } = render(<LoginPage />);
    const emailInput = getByLabelText('Email');

    fireEvent.change(emailInput, { target: { value: 'invalid' } });
    fireEvent.blur(emailInput);

    expect(getByText('Invalid email format')).toBeInTheDocument();
  });
});

// Step 2: GREEN - Implement validation
function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? null : 'Invalid email format';
}

// Step 3: REFACTOR - Improve (if needed)
// Step 4: REPEAT - Next test
```

### Component Testing Best Practices

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

---

## Integration Testing

### Backend Integration Tests

**Purpose:** Test cross-system interactions

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

### Frontend Integration Tests

**Purpose:** Test user flows across multiple components

```typescript
import { renderWithRouter } from '../test-utils';

describe('Authentication Flow', () => {
  it('should allow user to register and login', async () => {
    const { getByLabelText, getByRole } = renderWithRouter(<App />);

    // Navigate to register
    fireEvent.click(getByRole('link', { name: /register/i }));

    // Fill form
    fireEvent.change(getByLabelText('Email'), {
      target: { value: 'test@example.com' }
    });

    // Submit and verify redirect
    fireEvent.click(getByRole('button', { name: /sign up/i }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard');
    });
  });
});
```

---

## E2E Testing (Playwright)

### Critical User Journeys

**Setup:**

```typescript
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173');
});
```

**Test Example:**

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

## Accessibility Testing

### Required Standards

- **WCAG 2.1 AA Compliance**
- **Keyboard Navigation**
- **Screen Reader Support**
- **Color Contrast**

### Automated Testing

```typescript
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('HorseCard has no accessibility violations', async () => {
  const { container } = render(<HorseCard horse={mockHorse} />);
  const results = await axe(container);

  expect(results).toHaveNoViolations();
});
```

---

## Performance Testing

### Frontend Performance

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

### Backend Performance

**Load Testing with Artillery:**

```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - flow:
      - get:
          url: '/api/horses'
      - post:
          url: '/api/horses'
          json:
            name: 'Test Horse'
```

---

## Quality Gates

### Pre-Commit

- ESLint passing (errors only)
- TypeScript type-check passing
- Tests for changed files passing

### Pre-Push

- **Full test suite passing** (468+ backend, 115+ frontend)
- **Integration tests passing**
- **Build succeeds**

### Pre-Deploy

- **E2E tests passing** (critical user journeys)
- **Performance tests passing** (Lighthouse scores >90)
- **Security audit passing** (npm audit)
- **Zero critical vulnerabilities**

---

## Test Organization

### File Structure

```
src/
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

### Test Naming Convention

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

## Success Metrics

### Coverage Targets

| Module      | Current            | Target |
| ----------- | ------------------ | ------ |
| Backend     | 80-90%             | 90%+   |
| Frontend    | ~60% (in progress) | 80%+   |
| Integration | ~70%               | 80%+   |

### Test Execution Time

- **Backend:** <30 seconds (parallel execution)
- **Frontend:** <20 seconds (parallel execution)
- **E2E:** <5 minutes (critical paths only)

### Quality Indicators

- **Test Success Rate:** >90% (backend: 90.1%)
- **Flaky Test Rate:** <1%
- **Coverage Trend:** Increasing with each sprint

---

**Related Documentation:**

- [Best Practices](./best-practices.md)
- [Agent Configuration](../config/agents-config.md)
- [Hooks Configuration](../config/hooks-config.md)
