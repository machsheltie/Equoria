---
paths:
  - "frontend/src/**/*.{ts,tsx}"
  - "tests/e2e/**/*.ts"
---

# Frontend Async-State Contract

**Status:** Active rule
**Owner:** Project owner
**Last verified:** 2026-08-19
**Load only when:** A matching frontend production or E2E file is read
**Do not load for:** Backend, documentation, dependency, or non-player-facing configuration work
**Live sources:** `PRODUCT.md`, `DESIGN.md`, `docs/design-system/DECISIONS.md`, shared state components, query hooks, and applicable tests
**Retire when:** The owner replaces the four-state or mutation-feedback architecture

`PRODUCT.md` and `DESIGN.md` always win. Existing call sites and components are
migration evidence, not permission to reproduce their visual structure.

## 1. Four representable states

Every fetched-data surface must represent these states in this order:

1. **Loading:** unresolved data. Never show zero, empty, or plausible defaults.
2. **Error:** visible, contextual failure with an actual retry where retry is
   meaningful. Never fall through to empty.
3. **Empty:** the request succeeded and the real collection is empty.
4. **Success:** render real returned data.

Use the existing shared state components (`PageLoading`, `SectionLoading`,
`ErrorState`, `InlineError`, and `EmptyState`) after verifying their current
APIs. Do not hand-roll a new SaaS-style alert card, spinner panel, skeleton
card, or floating notification.

```tsx
if (query.isPending) return <SectionLoading label="Loading horses" />;
if (query.isError) {
  return <ErrorState message={userMessageFor(query.error)} retry={{ label: 'Try Again', onClick: query.refetch }} />;
}
if (query.data.items.length === 0) {
  return <EmptyState variant="first-use" title="No horses here yet" />;
}
return <HorseList items={query.data.items} />;
```

- Empty is reachable only after success, never merely after `!isLoading`.
- A destructured `refetch` must be wired to the retry control.
- Apply the contract per section on multi-query pages; one failed query must not
  falsify or blank unrelated real data.

## 2. Fetching and mutations

- TanStack Query owns server state. Query functions propagate errors; they do
  not catch and return fabricated empty shapes.
- Preserve submitted form state until mutation success.
- Mutation controls expose pending state accessibly and cannot be triggered
  repeatedly while in flight.
- Money-moving mutations invalidate every live balance consumer as well as the
  changed domain entity. Verify current query keys before editing.
- Telemetry or global cache handlers are safety nets, never replacements for a
  visible local error state.

## 3. Mutation feedback: Surface-Owned + Stable Log

There is no general floating-toast layer:

| Event | Destination |
| --- | --- |
| Failure | `InlineError` at the failed control, announced accessibly |
| Routine success | Visible state change on the affected surface plus a durable StableLog entry when the change is not self-evident or is off-screen |
| Major ceremony | `CinematicMoment` for births, discoveries, championships, and major rewards |

- Do not import `sonner`, add `toast()` calls, or extend `RewardToast` as a
  replacement. Restyling the overlay does not change the rejected interaction
  model.
- Removing an old toast is incomplete until its information has a valid
  contextual destination.
- If no destination is obvious, stop and ask the owner; do not silently drop
  feedback or invent a generic notification system.

## 4. Honest values and errors

- Never render raw server error messages. Use the current shared error mapper
  and distinguish network, authorization, validation, rate-limit, and server
  failures.
- Loading is not zero. Unknown is not a plausible default. Preserve legitimate
  zeroes with `??`, and use an honest unavailable marker such as `—` where the
  product permits it.
- Prices, fees, balances, timers, eligibility, and rewards come from server
  truth. Do not hardcode a believable value to make a surface look complete.
- Unbuilt functionality is absent or explicitly owner-approved as coming soon;
  it is never simulated with a live-looking card, badge, button, or activity.
- Silent catches are limited to genuine environment guards, image fallback,
  auth/CSRF internals, or optimistic rollback whose call site visibly reports
  the failure. Comment the reason.

## 5. Accessibility and verification

- Loading regions use `role="status"`/`aria-busy`; errors use an announced
  semantic such as `role="alert"`; state is never communicated by color alone.
- User-visible Suspense boundaries cannot use `fallback={null}`.
- Motion follows `docs/design-system/MOTION.md` and reduced-motion settings.
- Tests for a changed surface cover error-with-retry, successful empty, and
  successful data. Mutation tests cover failure feedback and preserved input.
- Run current source, tests, and doctrine checks before claiming compliance;
  dated issue counts or old audit totals are not evidence.
