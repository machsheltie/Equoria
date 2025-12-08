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
- ✅ PRD-03 Gameplay Systems finalized (v2.0.0)
- ✅ PRD-04 Advanced Systems created (epigenetics, ultra-rare traits)
- ✅ PRD-07 Player Guide consolidated from user guides
- ✅ PRD-08 Security Architecture consolidated from rules
- ✅ PRD-09 Development Standards consolidated from best practices
- ✅ PRD-10 Project Milestones consolidated from history
- ✅ Mobile references removed from all PRDs
- ✅ Historical docs consolidated into PRD structure
- Publish OpenAPI + API overview
- Wire frontend to /api/v1 endpoints

## Document Links

### Core PRDs (Game Design)
- [PRD-01 Overview](./PRD-01-Overview.md) - Vision, metrics, personas
- [PRD-02 Core Features](./PRD-02-Core-Features.md) - User & horse management
- [PRD-03 Gameplay Systems](./PRD-03-Gameplay-Systems.md) - Training, competition, grooms, breeding
- [PRD-04 Advanced Systems](./PRD-04-Advanced-Systems.md) - Epigenetics, ultra-rare traits
- [PRD-07 Player Guide](./PRD-07-Player-Guide.md) - Features, strategy, player documentation

### Technical PRDs
- [PRD-05 Deployment Guide](./PRD-05-Deployment-Guide.md) - Docker, CI/CD, monitoring
- [PRD-06 Testing Strategy](./PRD-06-Testing-Strategy.md) - Testing philosophy, coverage
- [PRD-08 Security Architecture](./PRD-08-Security-Architecture.md) - Security, exploit prevention
- [PRD-09 Development Standards](./PRD-09-Development-Standards.md) - Code style, best practices

### Project Management
- [PRD-10 Project Milestones](./PRD-10-Project-Milestones.md) - Achievements, roadmap
- [Documentation Index](../index.md) - Complete documentation map
