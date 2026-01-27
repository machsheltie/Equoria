# Test Architecture Guide

**Skill:** `/test-architecture`
**Purpose:** Load testing strategy and patterns when writing or debugging tests

---

## When to Use This Skill

Invoke this skill when:

- Writing new test files
- Debugging test failures
- Improving test coverage
- Reviewing test patterns
- Setting up mocking strategy

---

## Testing Philosophy (Balanced Mocking)

### ✅ DO Mock

- External dependencies: Database, HTTP clients, Logger
- Third-party services: Email, payment processors
- File system operations

### ❌ DON'T Mock

- Business logic functions
- Pure algorithmic functions
- Internal utility modules
- Service layer logic (test with real implementations)

### Current Success Rates

- **Balanced mocking:** 90.1% (851/942 tests)
- **Over-mocking:** 1% (proven failure)
- **Pure functions:** 100% (no mocking needed)

---

## Quick Test Commands

```bash
# Run specific test suite
npm test -- auth

# Watch mode for active development
npm test -- --watch

# Coverage report
npm test -- --coverage

# Debug memory leaks
npm test -- --detectOpenHandles
```

---

**Load full testing docs:**

```bash
cat backend/.claude/docs/testing-architecture.md
```
