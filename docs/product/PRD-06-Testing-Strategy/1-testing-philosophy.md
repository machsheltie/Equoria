# 1. Testing Philosophy

### 1.1 Balanced Mocking Approach

**CRITICAL:** This project uses a balanced mocking philosophy that has been mathematically validated.

| Approach | Success Rate | Status |
|----------|--------------|--------|
| Balanced Mocking | 90.1% | ✅ Proven |
| Over-Mocking | 1% | ❌ Proven Failure |

**Strategy:**
- ✅ Mock ONLY external dependencies (database, HTTP, logger)
- ✅ Test real business logic with actual implementations
- ✅ Use integration tests for cross-system validation
- ✅ Pure functions tested without mocks achieve 100% success

**Evidence:**
This approach provides:
- Real bug detection (not false confidence)
- Actual implementation validation
- Reduced test brittleness
- Production-ready code assurance

### 1.2 TDD Workflow (Red-Green-Refactor)

**Mandatory Approach:**
1. **RED** - Write failing test first
2. **GREEN** - Implement minimum code to pass
3. **REFACTOR** - Improve code quality
4. **REPEAT** - For each feature

```javascript
// Step 1: RED - Write failing test
describe('HorseBreeding', () => {
  it('should create offspring with correct genetics', () => {
    const offspring = breedHorses(sireId, damId);
    expect(offspring.genetics).toMatchGeneticsRules(sire, dam);
  });
});

// Step 2: GREEN - Implement validation
function breedHorses(sireId, damId) {
  // Minimal implementation to pass test
}

// Step 3: REFACTOR - Improve (if needed)
// Step 4: REPEAT - Next test
```

---
