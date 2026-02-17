# Testing Strategy Update

**Version:** 1.0
**Created:** 2026-02-17 (action-6-3, from Epic 6 retrospective)
**Owner:** Senior Dev + QA Engineer

---

## Core Rule

> **Business logic, calculations, and algorithms are NEVER deferred.**
> UI rendering tests may be batched to end of epic if needed.

---

## MUST TEST INLINE (During Story Development)

Test these **before marking the story complete**:

| Category             | Examples                                                                | Why                                            |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Helper functions     | `calculateCompatibilityScore`, `getPlacementSuffix`, `formatPrizeMoney` | Core correctness; catching bugs early is cheap |
| Algorithms           | Prediction engines, scoring formulas, genetic calculations              | Incorrect logic compounds — fix it when fresh  |
| Type guards          | `isValidDiscipline`, `isEpigeneticTrait`                                | Silent failures are the worst kind             |
| Business rules       | Eligibility checks, cooldown validation, age requirements               | Game integrity depends on these                |
| Data transformations | Sorting/filtering logic, normalization functions                        | Easy to break, hard to debug later             |
| State machines       | Milestone transitions, trait discovery states                           | Each state transition must be verified         |

**Threshold:** Any pure function with > 2 branches → test inline.

---

## CAN DEFER (Batch at End of Epic)

These can be written during a Testing Sprint if necessary:

| Category               | Examples                                           | Condition for Deferral                            |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------- |
| Component rendering    | "renders with correct text", "shows loading state" | Logic is already tested; only display is deferred |
| Layout/styling         | CSS class assertions, responsive tests             | Low risk; visual, not logical                     |
| User interaction flows | Click handlers, form submission                    | Acceptable if underlying handler is tested        |
| Snapshot tests         | Visual regression                                  | Low priority                                      |

**Rule:** Only defer if the component is a **pure presentational layer** over tested logic. If the component contains logic, that logic must be tested inline.

---

## Epic 6 Lessons

**What went wrong:** 6 stories, ~5,000 lines, 33 helper functions — all deferred. Testing Sprint required after the fact.

**Root cause:** No clear rule distinguishing "must test now" from "can defer."

**What we found during the Testing Sprint:**

- `BreedingPairSelection.tsx` contained dead code paths (helpers referenced but never called)
- Several `as any` casts in test mocks revealed typing gaps in production code
- ESLint config needed `argsIgnorePattern: '^_'` — discovered because we finally ran linting on test files

**Impact:** A 5-day Testing Sprint that could have been 2 days of inline testing spread across the epic.

---

## Test Organization Standards

### File Structure

```
src/
├── components/
│   └── MyComponent/
│       ├── MyComponent.tsx
│       └── __tests__/
│           └── MyComponent.test.tsx
├── types/
│   ├── myFeature.ts          ← helpers live here
│   └── __tests__/
│       └── myFeature.test.ts ← helper tests live here
└── utils/
    ├── myUtil.ts
    └── __tests__/
        └── myUtil.test.ts
```

### Naming Conventions

- `ComponentName.test.tsx` — component tests
- `helperFile.test.ts` — utility/helper tests
- `ComponentName.story-N-M.test.tsx` — story-specific acceptance criteria tests

### Mock Strategy

- **External deps only**: Mock API calls, React Query hooks, router
- **No business logic mocks**: Test the real helper functions
- **Type-safe mocks**: Prefer `as ReturnType<typeof hook>` over `as any` in production code; `as any` is acceptable in test files per ESLint override

### Test Count Targets (per story)

| Story size                         | Min tests |
| ---------------------------------- | --------- |
| Simple (1-2 components, no logic)  | 15        |
| Medium (3-5 components + helpers)  | 40        |
| Large (6+ components + algorithms) | 60        |

---

## Integration with Definition of Done

Before marking a story **complete**, verify:

1. ✅ All helper functions and business logic have unit tests
2. ✅ All acceptance criteria are verifiable (not just "it renders")
3. ✅ `npm run lint` passes with 0 errors on new files
4. ✅ `npx vitest run <story-files>` passes with 0 failures
5. ✅ No known critical bugs (P0/P1) in the story scope

See: `docs/processes/definition-of-done.md` for the full DoD.

---

## Framework-Specific Notes

### Vitest + React Testing Library

```typescript
// ✅ Correct pattern for testing helpers in type files
import { calculateCompatibilityScore } from '@/types/breeding';

describe('calculateCompatibilityScore', () => {
  it('returns high score for compatible bloodlines', () => {
    expect(calculateCompatibilityScore(horse1, horse2)).toBeGreaterThan(70);
  });
});
```

```typescript
// ✅ Correct pattern for mocking React Query in component tests
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: mockData,
    isLoading: false,
    error: null,
  }),
}));
```

```typescript
// ✅ Correct pattern for async user events
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /submit/i }));
```
