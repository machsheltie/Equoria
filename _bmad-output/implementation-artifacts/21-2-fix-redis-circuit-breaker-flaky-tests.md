# Story 21-2: Fix Redis Circuit Breaker Flaky Tests

**Epic:** 21 — Test Architecture Quality Sprint
**Priority:** P0 (MITIGATE risk R-02, Score 6)
**Status:** in-progress

---

## Story

**As a** backend developer,
**I want** the Redis circuit breaker tests to be deterministic and fully passing,
**So that** the CI pipeline has a reliable green signal on the circuit breaker's most critical paths, including CLOSED→OPEN→HALF_OPEN→CLOSED state transitions.

---

## Background

`backend/__tests__/integration/redis-circuit-breaker.test.mjs` contains 26 tests; 13 are
`.skip`'d. The file's own JSDoc states the reason:

> *"Some tests are skipped (.skip) due to timing-sensitive async event handlers. Event
> handlers are async and don't guarantee completion timing, making these tests inherently
> flaky."*

The current workarounds use real `setTimeout` delays (50–1000 ms) between operations to
wait for opossum's `EventEmitter`-based callbacks. This is non-deterministic: slow CI
machines can still miss the window, and the tests effectively stop asserting the state
they were written for (several degraded to asserting `failureCount > 0` rather than
specific state values).

The CLOSED→OPEN→HALF_OPEN→CLOSED path — the single most critical behaviour of the
circuit breaker — is completely untested.

---

## Root Cause

Opossum's circuit state machine advances synchronously **within** a `.fire()` call only
when the wrapped promise settles. However, the `open`, `halfOpen`, `close`, `success`,
`failure`, and `timeout` **events** are emitted via Node.js `EventEmitter`, whose
listeners execute in the **next iteration of the event loop** (microtask / next tick).

Real `setTimeout` delays tried to give that event loop time, but the required delays are
unpredictable across environments.

The deterministic fix:
1. `jest.useFakeTimers()` — replaces `setTimeout`/`setInterval`/`Date` with Jest
   controlled versions so `resetTimeout` (30 000 ms by default) can be skipped
   instantly.
2. `await jest.runAllTimersAsync()` or manual `jest.advanceTimersByTime()` + flushing
   with `await Promise.resolve()` — drains pending microtasks after each timer advance.
3. Restore `.skip`-removed tests with **exact** state assertions (not just
   `> 0` guards).

---

## Acceptance Criteria

- **AC1:** Zero `.skip`'d tests remain in `redis-circuit-breaker.test.mjs` — every
  previously skipped test is either passing or has been replaced by an equivalent test
  that passes deterministically.
- **AC2:** The CLOSED→OPEN→HALF_OPEN→CLOSED state transition cycle is covered by at
  least one end-to-end test that asserts each state explicitly (not just `failureCount > 0`).
- **AC3:** No test uses `await new Promise(resolve => setTimeout(resolve, N))` with a
  real delay for synchronisation; `jest.useFakeTimers()` + timer advance helpers are used
  instead.
- **AC4:** All tests run deterministically — the full suite passes on three consecutive
  `npm test` runs without a single non-deterministic failure.
- **AC5:** `npm test` in CI remains green — no regressions in any other suite.

---

## Tasks / Subtasks

- [ ] **Task 1 — ATDD: write failing acceptance tests**
  - [ ] 1.1 Write an AT that documents the `.skip` count is zero (currently fails)
  - [ ] 1.2 Write an AT for the OPEN state transition (fails — currently skipped)
  - [ ] 1.3 Write an AT for the HALF_OPEN transition (fails — currently skipped)
  - [ ] 1.4 Write an AT for the full CLOSED→OPEN→HALF_OPEN→CLOSED cycle (fails)
  - [ ] 1.5 Write an AT for failure-count accuracy (fails — currently skipped)

- [ ] **Task 2 — Implementation: replace setTimeout with fakeTimers**
  - [ ] 2.1 Add `jest.useFakeTimers()` to top-level `beforeEach`
  - [ ] 2.2 Add `jest.useRealTimers()` to `afterEach` teardown
  - [ ] 2.3 Replace all `new Promise(r => setTimeout(r, N))` with
             `jest.advanceTimersByTime(N)` + `await flushPromises()`
  - [ ] 2.4 Remove every `.skip` annotation — tests must pass, not be suppressed
  - [ ] 2.5 Add `flushPromises()` helper (single `await Promise.resolve()` loop or
             `setImmediate` flush) to drain EventEmitter microtasks

- [ ] **Task 3 — Verification**
  - [ ] 3.1 Run full suite three times locally; all green each time
  - [ ] 3.2 Confirm no other suite regressed

---

## Technical Notes

### opossum event model

Each `CircuitBreaker` instance emits `'success'`, `'failure'`, `'open'`, `'halfOpen'`,
`'close'`, `'timeout'` via `EventEmitter`. Listeners are called synchronously by
`EventEmitter.emit()` — they are **not** async. The timing issue is that opossum calls
`emit()` inside a `Promise.then()` chain, so the listeners execute in the **microtask
queue** after the `.fire()` promise resolves.

Concretely:
```
await circuitBreaker.operations.get.fire(...)
  → resolves the outer Promise
  → opossum's internal .then() runs (microtask)
    → emits 'success'/'failure' (synchronous, but in microtask)
      → our listener increments metrics
```

So the fix is:
```javascript
await circuitBreaker.operations.get.fire('key').catch(() => {});
await flushPromises(); // one await Promise.resolve() is enough
// now metrics are guaranteed to be updated
```

### resetTimeout with fake timers

```javascript
// Create breaker with 500ms reset to test HALF_OPEN
circuitBreaker = createRedisCircuitBreaker(mockRedisClient, {
  resetTimeout: 500,
  volumeThreshold: 3,
  errorThresholdPercentage: 50,
});

// Open it
for (let i = 0; i < 4; i++) {
  await circuitBreaker.operations.get.fire('k').catch(() => {});
  await flushPromises();
}
// state: OPEN

jest.advanceTimersByTime(600); // past resetTimeout
await flushPromises();         // opossum schedules HALF_OPEN via internal timer
// state: HALF_OPEN
```

### Scope

Only `backend/__tests__/integration/redis-circuit-breaker.test.mjs` is in scope.
The implementation `backend/utils/redisCircuitBreaker.mjs` is NOT changed — this story
fixes the tests only.

---

## Test File Location

```
backend/__tests__/integration/redis-circuit-breaker.test.mjs
```

(Cross-cutting integration test — NOT co-located, per the convention that
`backend/__tests__/` is for cross-cutting/integration tests only.)

---

## Definition of Done

- [ ] AC1–AC5 all pass
- [ ] TEA:TA + TEA:RV completed
- [ ] `/bmad-code-review` passes all 3 layers
- [ ] `sprint-status.yaml` updated to `done`
