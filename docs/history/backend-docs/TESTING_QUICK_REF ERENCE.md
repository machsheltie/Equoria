# Testing Quick Reference

Quick reference for the optimized authentication test suite.

## Common Commands

### Run Tests

```bash
# All auth tests (parallel, recommended)
npm run test:auth

# Watch mode (active development)
npm run test:auth:watch

# Only changed files (fastest)
npm run test:auth:changed

# With coverage report
npm run test:auth:coverage

# CI mode (100% workers)
npm run test:auth:ci

# Performance benchmark
npm run test:auth:benchmark
```

### Pre-Commit

```bash
# Run pre-commit tests manually
npm run test:changed

# Bypass hook (emergency only)
git commit --no-verify
```

### Coverage Reports

```bash
# Generate coverage
npm run test:auth:coverage

# View HTML report
open coverage/lcov-report/index.html  # macOS
start coverage/lcov-report/index.html  # Windows
xdg-open coverage/lcov-report/index.html  # Linux
```

## Performance Metrics

| Mode | Duration | Workers | Cache |
|------|----------|---------|-------|
| **Default** | ~25s | 50% | Yes |
| **Watch** | ~3s | 1 | Yes |
| **CI** | ~15s | 100% | No |
| **Changed** | ~5s | 50% | Yes |

## File Locations

```
backend/
├── jest.config.optimized.mjs        # Main config
├── .husky/pre-commit                 # Git hook
├── scripts/
│   ├── test-auth.mjs                 # Test runner
│   └── pre-commit-tests.mjs          # Pre-commit runner
├── tests/
│   └── config/
│       ├── CustomSequencer.mjs       # Test ordering
│       ├── DependencyExtractor.mjs   # Caching
│       ├── globalSetup.mjs           # Setup
│       ├── globalTeardown.mjs        # Teardown
│       ├── PerformanceReporter.mjs   # Metrics
│       └── setupTests.mjs            # Utilities
└── test-results/
    ├── performance.json              # Metrics
    └── performance-report.txt        # Report
```

## Environment Variables

```bash
# Enable test data seeding
SEED_TEST_DATA=true npm run test:auth

# Reset database before tests
RESET_TEST_DB=true npm run test:auth

# Cleanup database after tests
CLEANUP_TEST_DB=true npm run test:auth

# Cleanup cache
CLEANUP_CACHE=true npm run test:auth

# Suppress console logs
SUPPRESS_LOGS=true npm run test:auth

# Enable coverage
COVERAGE=true npm run test:auth

# Enable benchmarking
BENCHMARK=true npm run test:auth
```

## Debugging

```bash
# Detect open handles
npm run test:auth -- --detectOpenHandles

# Verbose output
npm run test:auth -- --verbose

# Run specific test
npm run test:auth -- --testNamePattern="should set httpOnly cookies"

# Run specific file
npm run test:auth -- auth-cookies.test.mjs

# Increase memory
NODE_OPTIONS=--max-old-space-size=4096 npm run test:auth
```

## Custom Matchers

```javascript
// Check for httpOnly cookie
expect(response).toHaveHttpOnlyCookie('accessToken');

// Check for no sensitive data
expect(response.body).toNotContainSensitiveData();
```

## Test Utilities

```javascript
// Wait for async operations
await global.testUtils.wait(100);

// Create mock user
const user = global.testUtils.createMockUser({ id: 2 });

// Create mock request
const req = global.testUtils.createMockRequest({
  body: { email: 'test@example.com' },
});

// Create mock response
const res = global.testUtils.createMockResponse();

// Create mock next function
const next = global.testUtils.createMockNext();
```

## Troubleshooting

### Tests Running Slow

```bash
# Check workers
npm run test:auth -- --maxWorkers=4

# Check for slow tests
npm run test:auth:benchmark
```

### Cache Issues

```bash
# Clear cache
rm -rf .jest-cache/

# Rebuild cache
npm run test:auth
```

### Pre-Commit Failing

```bash
# Run manually
npm run test:changed

# View errors
npm run test:auth:watch

# Fix and commit
git commit -m "Fix tests"
```

## Performance Tips

1. **Use watch mode** during development
2. **Run changed tests only** before committing
3. **Enable caching** for faster re-runs
4. **Use parallel workers** for full suite
5. **Monitor slow tests** with benchmark mode

## CI/CD Integration

```yaml
# GitHub Actions
- name: Run optimized auth tests
  run: npm run test:auth:ci
```

## Reports

**Performance Report:**
```
test-results/performance-report.txt
```

**Coverage Report:**
```
coverage/lcov-report/index.html
```

**Test Summary:**
```
test-results/summary.txt
```

---

**Full Documentation:** See `TEST_ORCHESTRATION.md`

**Last Updated:** 2025-01-18
