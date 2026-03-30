# Section 12: User Journey Flows

**Status:** implemented — see tokens.css, index.css, component overrides in src/components/ui/
**Layer:** UX design (validates implementation against user journeys)
**Source:** UX Spec lines 1086-1436

---

## Overview

6 user journeys define how every page and component connects. Use these to validate that implementations serve the actual user flows.

---

## Journey 1: First-Time Player Onboarding

**Goal:** New visitor → engaged player within 5 minutes.

**Flow:** Register → Onboarding wizard (3-step) → Spotlight tutorial → Hub

**Key decisions:**

- Player CHOOSES starter horse (breed, gender, name) — first emotional investment
- ALL breeds available as starters (no gatekeeping)
- Breed selection works for stat-optimizers (tendencies, strengths) AND "pretty one" players (visual preview)
- Onboarding step state persisted (`onboardingStep` 0-10), resumes at exact step
- "While You Were Gone" does NOT trigger on first login

**Error recovery:** Registration failure → inline validation. Wizard abandonment → OnboardingGuard resumes. Spotlight target not found → floating chip with navigation.

---

## Journey 2: Daily Gameplay Loop (Hub-and-Spoke)

**Goal:** Satisfying 10-20 minute session for every player type.

**Flow:** Login → (WYAG if 4+ hours) → Hub → Next Actions → Choose spoke → Action → Reward → Hub

**Entry points by persona:**

- Alex (Collector): Hub → Stable → browse, check foal milestones
- Emma (Enthusiast): Hub → Horse Detail → read narrative, interact with groom
- Mike (Competitor): Hub → Competition → scout, enter, check leaderboards
- Sarah (Breeder): Hub → Breeding → compatibility, plan pairings

**Key decisions:**

- Next Actions uses **narrative flavor text** ("Luna is eager to train"), not task language
- Day-1 mode for accounts < 24h: discovery-oriented suggestions
- XP toasts only on meaningful progress, NOT routine "+5 XP"
- Every spoke returns to hub — hub never a dead end

---

## Journey 3: Training a Horse

**Goal:** Select horse + discipline, execute, see stat gains.

**Flow:** Hub suggestion → Training → Select horse → Select discipline → Confirm → Results → Hub

**Progressive disclosure:**

- Eligible horses shown first (toggle to see all with reason badges)
- Top 3-5 recommended disciplines with "best for your horse" badge
- Full 23 via "Show all" expander
- Trait bonuses only if horse has relevant traits

**Delight moments:**

- 15% chance random stat gain → gold flash
- Trait discovery → CinematicMoment
- FenceJumpBar XP threshold cross → horse icon animation

---

## Journey 4: Competition Entry & Results

**Goal:** Scout shows, enter horse, experience results on return.

**Critical model:** Competitions are player-created, open 7 days, execute overnight. No NPC competitors.

**Flow:** Hub → Competition → Browse → Select show → Scout field → Select horse → Confirm → (7 days) → Results via WYAG

**Key decisions:**

- Scouting is real — full field visible during entry window
- No CinematicMoment per win (hundreds of shows). Wins via WYAG summary + Results page.
- CinematicMoment reserved for lifetime firsts ONLY (first-ever 1st place, first championship)
- Score breakdown via radar chart post-results

---

## Journey 5: Breeding a New Foal

**Goal:** Select parents, assess compatibility, breed, experience birth, begin development.

**Flow:** Hub/Breeding → Select parent → Browse partners → Compatibility preview → Confirm → Foal birth cinematic → Name foal → Assign groom → Development tracker

**Key decisions:**

- Bidirectional entry: start from mare, stallion, or "Breed with..." on any horse detail
- Deep compatibility: stat ranges, trait probabilities, inbreeding coefficient, pedigree preview
- Cost transparency: full breakdown before confirm
- CinematicMoment scaling: first foal = full. After 5th = shorter + skip. Rare trait = always full.
- 0-2 year development arc with age-appropriate activities

---

## Journey 6: Return After Absence ("While You Were Gone")

**Goal:** Re-engage returning player with what happened + surfacing exciting items.

**Trigger:** 4+ hours since last session.

**Flow:** Login → WYAG overlay → Browse items → Tap or dismiss → Hub

**Content (max 8 items, priority order):**

1. Exciting news (wins, milestones, rank changes)
2. Actionable items (cooldowns expired, new shows)
3. Background updates (community, world events)
4. ONE surprising non-formulaic element

**Key decisions:**

- Overlay, not full page — single dismiss to reach hub
- 8-item hard cap + "View all" link
- Competition results arriving via WYAG = primary delivery mechanism
- Does NOT trigger on first login or if away < 4h

---

## Reusable Journey Patterns

### Navigation: Hub Return Loop

Every action → reward → return to hub with updated Next Actions.

### Eligibility Gate

Check → show reason if blocked → ALWAYS suggest alternatives. Never dead ends.

### Deep Link from Suggestion

Next Actions and WYAG items link directly with context pre-loaded.

### Preview Before Commit

Training: stat predictions. Breeding: compatibility. Competition: field scouting. Always BEFORE confirm.

### Tiered Celebration

Routine → subtle. Threshold → toast. Lifetime first → cinematic. Rarer = bigger.

### Cooldown Visibility

Both relative ("3d 4h") AND absolute ("March 14"). Players plan around either.

## Implementation Checklist

- [ ] Validate onboarding flow matches J1 (verify BreedSelector, OnboardingGuard)
- [ ] Validate hub matches J2 (NextActionsBar, hub-spoke navigation)
- [ ] Validate training matches J3 (eligible-first, recommendations, progressive disclosure)
- [ ] Validate competition matches J4 (scouting, overnight results, WYAG delivery)
- [ ] Validate breeding matches J5 (bidirectional entry, compatibility preview, cinematic scaling)
- [ ] Build WYAG overlay matching J6 (trigger logic, priority order, 8-item cap)
- [ ] Verify "no dead ends" principle on all blocked states
- [ ] Verify all flows return to hub
