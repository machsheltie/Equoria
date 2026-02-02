# 3. Test Infrastructure

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
