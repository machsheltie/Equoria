# 8. Testing Standards

### 8.1 Testing Philosophy (updated 2026-06-10)

**Real-database doctrine** (CLAUDE.md Constitution §3; full strategy in PRD-06 §1):

- Tests run against the canonical PostgreSQL database — no Prisma mocks, no isolated test DB
- Mocking anything Equoria owns (DB, services, controllers) is forbidden; the only legitimate isolation boundary is third-party services we don't own (none today)
- Cleanup is scoped (`TestFixture-` patterns / collected IDs), FK-ordered, and fail-loud
- Pure functions are tested without mocks; user-facing flows get Playwright E2E with real credentials

### 8.2 Coverage Requirements

| Category       | Minimum |
| -------------- | ------- |
| **Branches**   | 80%     |
| **Functions**  | 90%     |
| **Lines**      | 85%     |
| **Statements** | 85%     |

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
