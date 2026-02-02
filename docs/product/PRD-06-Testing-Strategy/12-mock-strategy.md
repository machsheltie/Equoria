# 12. Mock Strategy

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
