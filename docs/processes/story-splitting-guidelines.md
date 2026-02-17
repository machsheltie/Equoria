# Story Splitting Guidelines

**Version:** 1.0
**Created:** 2026-02-17 (action-6-2, from Epic 6 retrospective)
**Owner:** Scrum Master

---

## Rule: Split Any Story Estimated > 1 Day

When a story is estimated to take more than one day, examine it for natural split points before committing to the work.

**Trigger:** Estimate > 1 day OR scope > ~300 lines of production code

---

## Decision Tree

```
Is estimate > 1 day?
│
├── NO → Proceed as-is
│
└── YES → Identify split candidates:
          │
          ├── Type system / data model  vs  UI components?
          │     → Split: "Story X-a: Types & helpers" + "Story X-b: UI components"
          │
          ├── Business logic  vs  display layer?
          │     → Split: "Story X-a: Logic & calculations" + "Story X-b: Rendering & styles"
          │
          ├── Read  vs  write operations?
          │     → Split: "Story X-a: Display view" + "Story X-b: Edit/mutation"
          │
          ├── Core feature  vs  edge cases/polish?
          │     → Split: "Story X-a: Core" + "Story X-b: Edge cases"
          │
          └── Multiple independent sub-features?
                → Split into one story per feature
```

---

## Epic 6 Case Study: Story 6-6 (Epigenetic Trait System)

**Original estimate:** 2 days | **Actual:** 2,000+ lines | **Tests delivered:** 0

**Should have been split into:**

| Story | Scope                                                                | Estimate |
| ----- | -------------------------------------------------------------------- | -------- |
| 6-6a  | `types/traits.ts` — 11 type definitions, 16 helper functions         | 0.5 days |
| 6-6b  | `EpigeneticTraitDisplay`, `EpigeneticFlagBadge` — display components | 0.5 days |
| 6-6c  | `TraitCard`, `CompetitionImpactPanel` — interaction components       | 0.5 days |
| 6-6d  | Integration tests for trait discovery flow                           | 0.5 days |

**Result:** 4 stories × 0.5 days each = same total time, but each story ships tested and verified.

---

## Natural Split Points

### By Layer

- **Type/schema** → separate story
- **Business logic / helpers** → separate story (MUST include tests)
- **Presentation components** → separate story
- **Page/route integration** → separate story

### By Complexity

- Any function > 50 lines → its own story
- Any component with > 5 props → examine for decomposition
- Any file > 200 lines → consider splitting

### By Risk

- New external dependency → its own story (de-risk in isolation)
- Algorithm or calculation → its own story (must be tested before integration)
- State management changes → its own story (blast radius control)

---

## Integration with Sprint Planning

1. **During backlog refinement:** Flag any story with estimate > 1 day for split review
2. **Apply decision tree:** Identify 2-4 sub-stories
3. **Re-estimate sub-stories:** Each should be ≤ 1 day
4. **Sequence them:** Types → Logic → UI → Integration
5. **Accept:** Only move to sprint once all sub-stories are ≤ 1 day each

---

## Anti-Patterns to Avoid

- **"Just one big story"** — Hard to test, hard to review, hard to verify
- **Combining types + UI + logic** — One PR with 2,000 lines is unverifiable
- **Deferring the "easy part"** — If the type system isn't built first, UI is guessing
- **Calling a spike a story** — Spikes produce knowledge, not shippable features
