# 12. Mock Strategy

> **Rewritten 2026-06-10:** the former table allowed "Database (Prisma) — unit tests only". That is no longer true and has not been practice since the 21R doctrine: mocking the database is forbidden in all backend tests, enforced by `scripts/doctrine-checks/check-no-db-mocks.mjs`. Full rationale: CLAUDE.md Constitution §3 ("Why mocks aren't part of Equoria's toolkit").

### 12.1 What to Mock

| Mock                                      | When                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Third-party HTTP APIs Equoria doesn't own | Only if no real sandbox/test endpoint exists (none today)                               |
| Time functions                            | For time-dependent tests — prefer passing `now` explicitly (see `horseAge.mjs` pattern) |
| Random generators                         | For predictable outcomes in pure-function tests                                         |

### 12.2 What NOT to Mock — anything Equoria owns

| Don't Mock                         | Why                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Database (Prisma)                  | A mocked DB can't deadlock, return stale state, or drift — the exact failure modes production has. Forbidden in all tests; doctrine-checked. |
| Business logic / internal services | Defeats the purpose of testing; we own them, tests verify we own them correctly                                                              |
| Validation / calculation functions | Need real validation and real calculations                                                                                                   |
| The Express app / middleware       | Integration tests exercise the real request pipeline (supertest)                                                                             |

### 12.3 Instead of a Mock

- **Backend:** real-DB integration test with scoped `TestFixture-` fixtures and ID-scoped, fail-loud cleanup.
- **Frontend/cross-boundary:** Playwright E2E with real credentials, real backend, real DB.
- **Missing data in UI:** honest empty/error/loading states — never placeholder data.

```javascript
// ❌ FORBIDDEN - mocking our own database (fails check-no-db-mocks.mjs)
jest.mock('@prisma/client');
import { prismaMock } from '../__mocks__/prisma';

// ❌ FORBIDDEN - mocking internal logic
jest.mock('../services/geneticsCalculator');

// ✅ The replacement is a real-DB test — see §2.1 for the canonical pattern.
```

**Grandfather clause:** existing frontend unit tests with `vi.mock`-of-API-client predate this doctrine and may remain; when one breaks, replace it with E2E coverage rather than patching the mock. No new ones.

---
