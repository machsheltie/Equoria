# Claude.md Update Instructions
## Quick Reference for Integrating Day 3 Phase 1 Lessons

**Purpose:** This document provides the exact sections to add to CLAUDE.md based on Day 3 Phase 1 lessons learned.

---

## Section 1: Add to Testing Standards (After Line 791)

Insert this section after the existing "## Testing Standards" section:

```markdown
### Web Browser Frontend Testing Standards (Day 3 Phase 1 - Critical)

**ALWAYS DO:**
1. ✅ Use `waitFor()` for all async operations - it handles `act()` internally
2. ✅ Include comprehensive cleanup: `beforeEach`, `afterEach`, `afterAll` hooks
3. ✅ Configure React Query with `retry: false` in test environments
4. ✅ Wait for all async operations to complete before assertions
5. ✅ Mock external dependencies (API, storage, timers) strategically

**NEVER DO:**
1. ❌ Wrap `render()` or `renderHook()` in `act()` - causes unmounted renderer errors
2. ❌ Use fake timers with React Query unless specifically testing timing
3. ❌ Skip cleanup hooks - leads to memory leaks and flaky tests
4. ❌ Assert on async state changes without `waitFor()`
5. ❌ Ignore test warnings - they indicate real problems

### Standard Test Cleanup Template

```typescript
describe('Component/Hook Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  it('should pass with proper cleanup', async () => {
    render(<Component />);
    await waitFor(() => {
      expect(asyncOperation).toHaveCompleted();
    });
  });
});
```

### Frontend Test Coverage Requirements

**Current Status (as of 2025-11-12):**
- Overall Coverage: 71.26%
- Test Pass Rate: 100% (134/134 tests)
- Critical Gap: client.ts at 31.5% (needs 85%+)

**Target Coverage Thresholds:**
```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 85,
      "lines": 85,
      "statements": 85
    }
  }
}
```

**By File Type:**
- API Layer (`src/api/**`): 85%+ minimum
- State Management (`src/state/**`): 100% (achieved ✅)
- Utils (`src/utils/**`): 100% (achieved ✅)
- Components (`src/components/**`): 80%+ minimum
- Screens (`src/screens/**`): 75%+ minimum
- Hooks (`src/hooks/**`): 90%+ minimum

**Priority Coverage Gaps:**
1. 🔴 CRITICAL: `client.ts` - 31.5% → 85%+ (Week 2 target)
2. 🟡 MEDIUM: Future components as they're created
3. 🟡 MEDIUM: Future screens as they're created
```

---

## Section 2: Update Test Automation Agent Configuration (Replace Lines 363-398)

Replace the existing "Test Automation Agent" section with:

```markdown
#### 3. Test Automation Agent (Enhanced - Day 3 Phase 1)
**Role:** Comprehensive testing strategy with proven best practices
**Skills:**
- Jest testing framework with React Native Testing Library
- React Query test patterns with proper async handling
- Memory leak detection and prevention
- Test coverage analysis and gap identification
- Performance testing and regression detection
- E2E testing with Detox (future)

**Use Cases:**
- New component/hook test creation following Day 3 Phase 1 patterns
- Test coverage improvement (current: 71.26%, target: 85%+)
- Integration test design with proper cleanup
- Test warning resolution and prevention
- Memory leak investigation and remediation

**Configuration:**
```json
{
  "agent": "test-automator",
  "max_concurrent": 1,
  "priority": "critical",
  "auto_invoke_for": [
    "New feature testing",
    "Coverage gaps (priority: client.ts at 31.5%)",
    "Test warning detection and resolution",
    "Memory leak investigation"
  ],
  "phase_1_lessons_applied": true,
  "coverage_thresholds": {
    "branches": 80,
    "functions": 85,
    "lines": 85,
    "statements": 85
  },
  "anti_patterns_blocked": [
    "wrapping_render_in_act",
    "fake_timers_with_react_query",
    "missing_cleanup_hooks",
    "async_without_waitFor"
  ]
}
```

**Test Creation Checklist (Mandatory):**
- [ ] Includes `beforeEach`, `afterEach`, `afterAll` cleanup hooks
- [ ] Uses `waitFor()` for all async operations
- [ ] React Query configured with `retry: false`
- [ ] Mocks external dependencies (API, storage, timers)
- [ ] No `act()` wrapping around `render()` or `renderHook()`
- [ ] Fake timers only used when necessary, properly cleaned up
- [ ] All test warnings resolved before merge
- [ ] Coverage meets thresholds (85%+ functions/lines/statements, 80%+ branches)

**Recent Achievements:**
- ✅ Day 3 Phase 1: Eliminated 14+ act() warnings
- ✅ Day 3 Phase 1: Resolved memory leaks (except worker process)
- ✅ Day 3 Phase 1: Achieved 100% test pass rate (134/134)
- 🔄 Day 3 Phase 2: Worker process cleanup (in progress)
- 🔄 Day 3 Phase 2: client.ts coverage improvement (in progress)
```

---

## Section 3: Add New Testing Skill (After Line 559)

Add this new skill after the existing "Game Mechanics Design" skill:

```markdown
#### 6. React Native Testing Excellence
```json
{
  "skill": "react-native-testing-excellence",
  "level": "expert",
  "certification": "Day 3 Phase 1 Proven",
  "includes": [
    "React Native Testing Library best practices",
    "React Query test integration patterns",
    "Memory leak detection and prevention",
    "Async operation testing with waitFor()",
    "Comprehensive test cleanup infrastructure",
    "Coverage gap analysis and resolution",
    "Test warning elimination strategies"
  ],
  "proven_techniques": [
    "act() warning resolution (14+ eliminated)",
    "React Query async testing patterns",
    "Memory leak prevention in test suites",
    "100% test pass rate maintenance"
  ],
  "anti_patterns_prevented": [
    "Wrapping render/renderHook in act()",
    "Using fake timers with React Query",
    "Missing cleanup hooks",
    "Async assertions without waitFor()"
  ]
}
```
```

---

## Section 4: Add to MCP Server Configuration (Update Lines 198-291)

Add this enhanced description to the Sequential Thinking MCP server section:

```markdown
#### 1. Sequential Thinking (Critical - Day 3 Phase 1 Enhanced)
**Purpose:** Complex problem-solving and architectural decisions
```json
{
  "server": "sequential-thinking",
  "enabled": true,
  "use_for": [
    "Architectural design decisions",
    "Complex algorithm development",
    "System integration planning",
    "Performance optimization strategies",
    "Test debugging and failure analysis (Day 3 Phase 1 proven)",
    "Memory leak investigation",
    "Test architecture planning"
  ],
  "proven_applications": [
    "Day 3 Phase 1: act() warning resolution strategy",
    "Day 3 Phase 1: Memory leak identification approach",
    "Day 3 Phase 1: React Query test pattern development"
  ]
}
```

**Testing Use Cases (Specific):**
1. **Debugging Complex Test Failures**
   - Tests fail in CI but pass locally
   - Timing issues and race conditions
   - Environmental difference analysis

2. **Test Architecture Decisions**
   - E2E test strategy design
   - Visual regression testing approach
   - Test performance optimization planning

3. **Memory Leak Investigation**
   - Analyze `--detectOpenHandles` output
   - Identify leak sources (timers, promises, listeners)
   - Design comprehensive cleanup strategies
```

---

## Section 5: Add to Priority Task List (After Line 726)

Update the "Priority Task List" section to include immediate testing priorities:

```markdown
### Testing Priority Tasks (Day 3 Phase 1 Follow-Up)

**Immediate (Week 2):**

1. **Resolve Worker Process Cleanup Warning (4 hours)**
   - Issue: "A worker process has failed to exit gracefully"
   - Impact: Memory leaks in test suite, potential CI instability
   - Action: Run with `--detectOpenHandles`, identify and fix leaks
   - Owner: Test Automation Agent

2. **Improve client.ts Coverage to 85%+ (6 hours)**
   - Current: 31.5% coverage
   - Target: 85%+ coverage
   - Focus: HTTP methods, interceptors, token refresh, error handling
   - Owner: Test Automation Agent

3. **Create Test Utilities Infrastructure (3 hours)**
   - `renderWithProviders` helper
   - Mock data generators
   - Testing documentation guide
   - Owner: Test Automation Agent + Frontend Developer Agent

**Short-Term (Week 3):**

4. **Component Test Infrastructure (12 hours)**
   - Custom render helpers
   - Navigation mocking utilities
   - Component test examples
   - Owner: Frontend Developer Agent

5. **Achieve 85%+ Overall Coverage (8-12 hours)**
   - Current: 71.26%
   - Target: 85%+
   - Focus: Close gaps in all <85% files
   - Owner: Test Automation Agent

**Medium-Term (Week 4-6):**

6. **CI Integration Enhancements (3-4 hours)**
   - Coverage reporting (Codecov/Coveralls)
   - Parallel test execution
   - PR status checks
   - Owner: Backend Architect Agent

7. **E2E Test Framework Setup (6-8 hours)**
   - Detox configuration
   - First critical flow tests
   - CI integration
   - Owner: Test Automation Agent
```

---

## Section 6: Update Hooks Configuration (After Line 617)

Add testing-specific hooks:

```markdown
### Testing Hooks (Day 3 Phase 1 Enforcement)

```json
{
  "hooks": {
    "pre-test": [
      "echo 'Running tests with Day 3 Phase 1 standards...'",
      "jest --clearCache"
    ],
    "post-test": [
      "echo 'Verifying no test warnings...'",
      "grep -q 'Warning:' test-output.log && exit 1 || exit 0"
    ],
    "pre-commit-frontend": [
      "cd frontend && npm run test",
      "cd frontend && npm run test:coverage"
    ],
    "description": "Enforce test quality standards from Day 3 Phase 1"
  }
}
```
```

---

## Section 7: Add Documentation Reference (After Line 867)

Add reference to Day 3 Phase 1 strategy document:

```markdown
**Testing Strategy Documentation:**
- [Day 3 Phase 1 Strategy](./DAY_3_PHASE_1_STRATEGY.md) - Comprehensive testing lessons and roadmap
- [Testing Architecture](./testing-architecture.md) - Backend testing patterns
- [Frontend Testing Guide](./CLAUDE_MD_UPDATES.md) - Quick reference for testing standards
```

---

## Quick Implementation Checklist

Use this checklist to verify all updates have been applied:

- [ ] Section 1: Web Browser Frontend Testing Standards added
- [ ] Section 2: Test Automation Agent configuration updated
- [ ] Section 3: React Native Testing Excellence skill added
- [ ] Section 4: Sequential Thinking MCP server enhanced
- [ ] Section 5: Testing Priority Tasks added
- [ ] Section 6: Testing Hooks configuration added
- [ ] Section 7: Documentation references updated
- [ ] Document version updated at bottom of CLAUDE.md
- [ ] All team members notified of updated standards

---

## Additional Resources Created

**New Documentation:**
1. ✅ `DAY_3_PHASE_1_STRATEGY.md` - Comprehensive 11-part strategy (52+ pages)
2. ✅ `CLAUDE_MD_UPDATES.md` - This quick reference guide

**Existing Documentation Updated:**
- `CLAUDE.md` - To be updated with above sections
- `testing-architecture.md` - Already comprehensive for backend

**Testing Infrastructure:**
- Frontend test suite: 134 tests, 100% pass rate
- Coverage: 71.26% (target: 85%+)
- Cleanup patterns: Fully documented and proven

---

**Last Updated:** 2025-11-12
**Created By:** Claude (Test Automation Agent)
**Purpose:** Enable rapid integration of Day 3 Phase 1 lessons into project standards
