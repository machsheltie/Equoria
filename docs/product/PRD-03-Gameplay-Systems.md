# PRD-03: Gameplay Systems (Web)

## Goal
Specify the core gameplay loops that match the existing backend domains and guide the web UI integration.

## Core Loops
- Breed → Train → Compete → Reward → Reinvest (horses, traits, grooms, facilities).
- Discover & Refine Traits: unlock epigenetic traits/flags, manage compatibility and personality evolution.

## Entities
- Horses: stats (speed, stamina, agility, strength, intelligence, health), age, lineage.
- Foals/Breeding: parents, cooldowns, rarity tiers, ultra-rare trait chances.
- Traits/Epigenetics: visible, hidden, flags, ultra-rare traits, dynamic compatibility.
- Grooms: hiring, assignments, salaries, performance, marketplace, handlers.
- Training: sessions, cooldowns, XP/level, injury risk, milestones.
- Competition: disciplines, entry fees, scoring, rewards, leaderboards.
- Environment/Events: environmental modifiers, reporting/optimization (labs).

## Systems & Requirements
### Breeding
- Pairing rules, cooldowns, inheritance tables; support ultra-rare traits.
- Compatibility checks with flags/traits; reject invalid pairings with reasons.
- API: create breeding request, simulate outcome preview, confirm, record lineage.
- Source notes: see `docs/history/claude-systems/advancedepigenetictraitsystem.md`, `epigenetictraitflagsystem.md`, `groomsystem.md` for deeper rules to incorporate.

### Traits / Epigenetics
- Trait discovery flow; hidden/flagged traits surfaced through training/competition milestones.
- Ultra-rare traits gated by rarity and compatibility.
- Dynamic compatibility and personality evolution as optional “labs” endpoints.
- Source notes: reference `docs/history/claude-systems/epigenetictraits.md`, `epigeneticexpansionphase2.md`, `ultrarareexotictraits.md`.

### Training
- Session types with cost, time, cooldown; XP gain and injury risk.
- Milestones that unlock traits/flags or competitions.
- API: create session, complete session, apply outcomes, list plans.
- Source notes: training flows in `docs/history/claude-systems/training-system.md`.

### Competition
- Disciplines with scoring rubrics; entry validation; rewards (coins, XP, prestige).
- Leaderboards per discipline; pagination and filters.
- API: list events, enter event, submit results, fetch leaderboard.

### Grooms
- Hire/fire, assign to horses; salaries and performance decay; marketplace supply.
- Handlers and assignment limits; performance impacts training/recovery.
- API: list candidates, hire, assign, evaluate, pay.
- Source notes: groom docs in `docs/history/claude-systems/groomsystem.md`, `groompersonalitytraitbonus.md`, `groomprogressionpersonality.md`.

### Economy & Progression
- Currency: coins; sinks (training, grooms, breeding fees) vs rewards (competitions, milestones).
- Player level gates advanced systems; ensure early-game on-ramps.

## UX Notes (Web)
- Stable dashboard: horses, cooldowns, groom assignments, alerts.
- Horse detail: lineage, traits/flags, training plan, competition history.
- Actions should use /api/v1 endpoints with clear error/resolution messages.

## Risks / Assumptions
- Frontend currently mock-only; wiring needed.
- Some backend routes are “enhanced/advanced” experiments—treat as labs until validated.
- Data model changes must stay backward-compatible during refactor.

## Acceptance
- Endpoints exist and are documented in OpenAPI.
- Frontend flows for: breeding request → result, training session, competition entry, groom hire/assign.
- Leaderboards and trait discovery visible in UI.
