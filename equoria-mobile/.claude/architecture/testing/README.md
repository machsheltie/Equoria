# Testing Architecture

**Purpose**: Testing strategy, test plans, and quality assurance for the Equoria platform.

**Stack**: Jest 29.x, React Testing Library, Supertest, Prisma Test Environment

**Last Updated**: 2025-01-14

---

## Files in This Folder

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| [testingArchitecture.md](./testingArchitecture.md) | Complete testing strategy | ~600 | Active |
| [groomApiTestPlan.md](./groomApiTestPlan.md) | Groom API test plan | ~400 | Active |
| [groomApiTests.postman_collection.json](./groomApiTests.postman_collection.json) | Postman test collection | - | Active |

**Total**: 3 files, ~1,000+ lines

---

## Quick Start

### New to Testing Strategy?
1. Read [testingArchitecture.md](./testingArchitecture.md) for overall approach
2. Review [groomApiTestPlan.md](./groomApiTestPlan.md) for API testing example

### Need Specific Info?
- **Testing methodology?** → [testingArchitecture.md](./testingArchitecture.md)
- **API testing?** → [groomApiTestPlan.md](./groomApiTestPlan.md)
- **Postman tests?** → [groomApiTests.postman_collection.json](./groomApiTests.postman_collection.json)

---

## Testing Methodology

### Test-Driven Development (TDD)

**Process**: RED → GREEN → REFACTOR

1. **RED**: Write failing test first
2. **GREEN**: Write minimal code to pass
3. **REFACTOR**: Improve code while keeping tests green
4. **REPEAT**: For every feature

**Benefits**:
- Better code design
- 30-40% less debugging time
- 95%+ confidence for changes
- Tests serve as documentation

---

## Current Test Coverage

### Overall Metrics (Day 4 Complete)

**Total Tests**: 479/479 passing (100% pass rate)
**Overall Coverage**: 96.09%
- Statements: 96.09%
- Branches: 91.66%
- Functions: 96.67%
- Lines: 96.09%

### Coverage by Domain

| Domain | Tests | Coverage | Status |
|--------|-------|----------|--------|
| Authentication Screens | 81 | 100% | ✅ Complete |
| Navigation | 132 | 100% | ✅ Complete |
| API Client | 60 | 91.78% | ✅ Complete |
| Common Components | 98 | 100% | ✅ Complete |
| State Management | 45 | 100% | ✅ Complete |
| Utilities | 63 | 100% | ✅ Complete |

**Test Execution Time**: 39.5s (82ms per test average)

---

## Test Types

### 1. Unit Tests

**Purpose**: Test individual functions/components in isolation

**Coverage**: 380+ tests

**Examples**:
- Component rendering
- Function logic
- State management
- Validation logic

**Pattern**:
```typescript
describe('ComponentName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render correctly', () => {
    const { getByTestId } = render(<Component />);
    expect(getByTestId('component')).toBeTruthy();
  });
});
```

### 2. Integration Tests

**Purpose**: Test multiple units working together

**Coverage**: 90+ tests

**Examples**:
- API integration with React Query
- Navigation flows
- Form submission with validation
- Redux state updates with API calls

**Pattern**:
```typescript
describe('LoginFlow Integration', () => {
  it('should authenticate user and navigate to dashboard', async () => {
    const { getByTestId } = renderWithProviders(<LoginScreen />);

    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('login-button'));

    await waitFor(() => {
      const store = getTypedStore();
      expect(store.getState().auth.isAuthenticated).toBe(true);
    });
  });
});
```

### 3. E2E Tests

**Purpose**: Test complete user journeys

**Status**: Planned for Day 5

**Framework**: Detox or Maestro (TBD)

**Examples**:
- Complete registration → login → dashboard flow
- Horse creation → groom assignment flow
- Breeding flow end-to-end

---

## Testing Best Practices

### ✅ DO:

1. **Use `waitFor()` for async operations**
   ```typescript
   await waitFor(() => {
     expect(getByText('Loaded')).toBeTruthy();
   });
   ```

2. **Comprehensive cleanup hooks**
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
     jest.clearAllTimers();
   });

   afterEach(() => {
     jest.clearAllMocks();
     jest.clearAllTimers();
     jest.restoreAllMocks();
   });
   ```

3. **Test user behavior, not implementation**
   ```typescript
   // ✅ GOOD: Tests what user sees
   expect(getByText('Login successful')).toBeTruthy();

   // ❌ BAD: Tests implementation detail
   expect(component.state.isLoggedIn).toBe(true);
   ```

4. **Use accessibility queries**
   ```typescript
   getByLabelText('Email')
   getByRole('button', { name: 'Submit' })
   getByPlaceholderText('Enter email')
   ```

### ❌ NEVER:

1. **Wrap render() in act()**
   ```typescript
   // ❌ WRONG: Causes "unmounted test renderer" errors
   await act(async () => {
     render(<Component />);
   });

   // ✅ CORRECT
   render(<Component />);
   await waitFor(() => { ... });
   ```

2. **Use fake timers unnecessarily**
   ```typescript
   // ❌ WRONG: Interferes with React Query
   jest.useFakeTimers();

   // ✅ CORRECT: Use real timers
   // No timer mocking needed
   ```

3. **Assert without waiting**
   ```typescript
   // ❌ WRONG: Fails on async state
   expect(getByText('Loaded')).toBeTruthy();

   // ✅ CORRECT: Wait for async operation
   await waitFor(() => {
     expect(getByText('Loaded')).toBeTruthy();
   });
   ```

---

## Test Configuration

### Jest Configuration

**File**: `jest.config.js`

```javascript
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation)/)',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThresholds: {
    global: {
      statements: 95,
      branches: 90,
      functions: 95,
      lines: 95,
    },
  },
  testTimeout: 10000,
  maxWorkers: '50%',
};
```

### Test Utilities

**File**: `src/test/utils.tsx`

```typescript
export const renderWithProviders = (
  ui: React.ReactElement,
  options?: RenderOptions
) => {
  const store = configureStore({
    reducer: rootReducer,
    preloadedState: options?.preloadedState,
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </Provider>,
    options
  );
};
```

---

## API Testing

### REST API Tests

**Documentation**: [groomApiTestPlan.md](./groomApiTestPlan.md)

**Framework**: Supertest + Jest

**Example**:
```typescript
describe('POST /auth/login', () => {
  it('should authenticate user with valid credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
  });

  it('should reject invalid credentials', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword',
      })
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });
});
```

### Postman Collection

**File**: [groomApiTests.postman_collection.json](./groomApiTests.postman_collection.json)

**Usage**:
1. Import into Postman
2. Set environment variables (API_URL, TOKEN)
3. Run collection
4. View test results

---

## Performance Testing

### Load Testing

**Framework**: Artillery or k6 (TBD)

**Target Metrics**:
- 1000 concurrent users
- <500ms average response time
- <1% error rate
- 99th percentile <2s

### Performance Monitoring

**Tools**:
- React Native Performance Monitor
- Flipper
- Chrome DevTools

**Metrics**:
- Initial load time: <2s
- Screen transitions: <200ms
- API response: <500ms
- Memory usage: <150MB

---

## Quality Gates

### Pre-Commit

**Requirements**:
- All tests passing
- No TypeScript errors
- No ESLint errors
- Minimum coverage maintained

**Command**:
```bash
npm run lint && npm run type-check && npm test
```

### Pre-Merge

**Requirements**:
- All pre-commit checks
- Integration tests passing
- Code review approved
- Documentation updated

### Pre-Deploy

**Requirements**:
- All tests passing (unit + integration + E2E)
- Coverage ≥95%
- Performance benchmarks met
- Security scan passed

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage
      - run: npm run build
```

---

## Test Maintenance

### When to Update Tests

1. **Feature changes**: Update affected tests
2. **Bug fixes**: Add regression test
3. **Refactoring**: Update implementation tests
4. **API changes**: Update integration tests

### Test Smells (Anti-Patterns)

❌ **Flaky tests**: Non-deterministic failures
❌ **Slow tests**: >5s execution time
❌ **Brittle tests**: Break on minor changes
❌ **Duplicate tests**: Same logic tested multiple times
❌ **Unclear tests**: Hard to understand what's being tested

### Test Quality Metrics

✅ **Fast**: <10s for full unit test suite
✅ **Deterministic**: Same result every run
✅ **Isolated**: No dependencies between tests
✅ **Clear**: Obvious what's being tested
✅ **Maintainable**: Easy to update

---

## Related Documentation

- **Frontend Architecture**: [../frontend/frontendArchitecture.md](../frontend/frontendArchitecture.md)
- **Backend Architecture**: [../backend/backendOverview.md](../backend/backendOverview.md)
- **API Specs**: [../backend/apiSpecs.md](../backend/apiSpecs.md)

---

**For complete architecture documentation, see [../README.md](../README.md)**
