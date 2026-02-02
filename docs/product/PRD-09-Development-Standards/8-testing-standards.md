# 8. Testing Standards

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
