# 10. CI/CD Integration

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
