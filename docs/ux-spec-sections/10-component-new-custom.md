# Section 10: New Custom Components

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** Component development
**Source:** UX Spec lines 1477-1738

---

## Implementation Priority

### Phase 1 — Core Infrastructure (P0, blocks all journeys)

| Component               | Purpose                                                                       |
| ----------------------- | ----------------------------------------------------------------------------- |
| **StarfieldBackground** | Global atmosphere — every page (already exists, verify spec compliance)       |
| **NextActionsBar**      | Hub centerpiece — daily loop depends on this                                  |
| **CooldownTimer**       | Appears in training, breeding, competition, groom interactions                |
| **ErrorCard**           | Graceful API failure — every API call needs fallback (already exists, verify) |
| **RewardToast**         | Meaningful feedback — replaces blanket toast spam                             |

### Phase 2 — Journey-Critical (P1)

| Component                   | Journey                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| **BreedSelector**           | J1: Onboarding — starter horse selection (already exists, verify) |
| **DisciplineSelector**      | J3: Training — discipline choice with smart recommendations       |
| **CompetitionFieldPreview** | J4: Competition — scouting who's entered                          |
| **WhileYouWereGone**        | J6: Return — re-engagement overlay                                |

### Phase 3 — Depth & Polish (P2-P3)

| Component                | Journey                                     |
| ------------------------ | ------------------------------------------- |
| **CompatibilityPreview** | J5: Breeding intelligence panel             |
| **DevelopmentTracker**   | J5: 0-2yr foal progression (core retention) |
| **NarrativeChip**        | J2: Story snippets on hub cards             |
| **GoldBorderFrame**      | All: ornate visual polish                   |

---

## Component Specs (Condensed)

### NextActionsBar

- 3-5 narrative chips: "Luna is eager to train after resting 3 days"
- Tap → navigate with context pre-loaded
- Categories: training/competition/breeding/social/discovery
- Never 3 of same category consecutively
- Day-1 mode for new accounts
- `role="navigation"`, `aria-label="Suggested next actions"`
- Mobile: horizontal scroll + snap. Desktop: wrapped grid.

### WhileYouWereGone

- Frosted glass overlay, portal to body, `z-[var(--z-modal)]`
- Max 8 items, priority: exciting > actionable > background
- ONE surprising flavor element per summary
- Tap item → navigate. Dismiss → hub.
- `role="dialog"`, `aria-modal="true"`, focus trapped
- Does NOT trigger on first login or if away < 4 hours

### CooldownTimer

- Dual display: relative ("3 days, 4h") AND absolute ("Ready: March 14")
- States: counting (amber), almost ready (<1h, pulse, gold), ready (green + CTA)
- Variants: inline (compact, cards) and standalone (detail pages)
- `role="timer"`, `aria-live="polite"`

### DisciplineSelector

- Top 3-5 recommended with "best for your horse" badge
- "Show all 23" expander
- Per discipline: name, description, stat weights vs horse stats, trait bonuses
- `role="listbox"`, keyboard arrow nav

### CompetitionFieldPreview

- Per horse: breed, level, top 3 stats, owner name
- Header: total count + days remaining
- States: empty ("Be first!"), partial, full, closed
- Variants: compact (top 3 + count) and expanded (all entries)

### CompatibilityPreview

- Stat ranges (min/max bars), trait probabilities, inbreeding coefficient, pedigree preview
- Tabs: stat / trait / pedigree views
- States: loading, ready, warning (high inbreeding), excellent (>85%)
- Quick preview (summary) and full detail variants

### DevelopmentTracker

- Current age, stage label, available activities, milestones, traits, progress to next stage
- States: active (0-2yr), cooldown (daily limit), graduated (3+)
- Variants: timeline (vertical milestones) and card (current stage focus)

### RewardToast

- Only on meaningful progress: threshold cross, approaching level-up, first-time source, trait discovery
- NOT on routine "+5 XP"
- Slide-in, 3s visible, fade-out. Queued with 0.5s gap.
- `role="status"`, `aria-live="polite"`

### NarrativeChip

- One-line story per horse: "Won 1st at Grand Prix"
- States: current, stale (>7d, faded), none ("Just arrived")

### GoldBorderFrame

- Decorative wrapper: subtle / standard / ornate variants
- Hover: glow intensifies. Featured: animated shimmer.
- `aria-hidden="true"` on border elements

## Implementation Checklist

- [ ] Phase 1: Verify StarfieldBackground matches spec
- [ ] Phase 1: Build NextActionsBar
- [ ] Phase 1: Build CooldownTimer (inline + standalone)
- [ ] Phase 1: Verify ErrorCard matches spec
- [ ] Phase 1: Build RewardToast with trigger rules
- [ ] Phase 2: Verify BreedSelector matches spec
- [ ] Phase 2: Build DisciplineSelector with recommendations
- [ ] Phase 2: Build CompetitionFieldPreview
- [ ] Phase 2: Build WhileYouWereGone overlay
- [ ] Phase 3: Build CompatibilityPreview
- [ ] Phase 3: Build DevelopmentTracker
- [ ] Phase 3: Build NarrativeChip
- [ ] Phase 3: Build GoldBorderFrame
