# PRD-00: Equoria Product Brief (Web)

## Purpose
Build a deep, web-based horse simulation where players manage breeding, training, and competition through rich genetics and stable management.

## Users / Personas
- Strategic Breeder: optimizes pairings and multi-generation plans.
- Competitive Player: focuses on training/competitions/leaderboards.
- Collector/Builder: curates rare traits, grooms, and stable prestige.

## Core Value
- Realistic genetics + epigenetic traits and flags.
- Strategic loops: breed → train → compete → reinvest.
- Stable management depth: grooms, environments, reporting.

## Platform / Scope
- Platform: Web (React UI + Express backend). Mobile out-of-scope for now.
- In-scope systems: breeding, traits/epigenetics, training, competition, grooms, leaderboards, admin.
- Out-of-scope now: mobile client, cloud sync across devices, social guilds.

## Success Metrics (initial)
- Engagement: 15+ min avg session, 3+ sessions/week.
- Progression: 3+ horses bred per user by week 2; 5+ competitions entered by week 2.
- Reliability: p95 API <200ms; uptime 99.9% (prod).
- Adoption: 60% of active users hire grooms by week 3; 50% reach competitions.

## Constraints / Assumptions
- Brownfield backend; web UI currently mock data.
- API will be versioned /api/v1 with generated OpenAPI.
- Data model via Prisma; migrations aligned to modules.

## Next Steps
- Finalize PRD-03 Gameplay Systems.
- Publish OpenAPI + API overview.
- Wire frontend to /api/v1 and remove mobile references.
