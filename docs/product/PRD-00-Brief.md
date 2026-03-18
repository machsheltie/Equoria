# PRD-00: Equoria Product Brief (Web)

**Version:** 2.0.0
**Last Updated:** 2026-03-18
**Status:** Epics 1-21 Complete | Production-Ready

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

- Platform: Web (React 19 + TypeScript + Vite frontend, Express backend). Mobile out-of-scope.
- In-scope systems: breeding, traits/epigenetics, training, competition, grooms, riders, trainers, community (forums, DMs, clubs), marketplace, leaderboards, admin.
- Out-of-scope: mobile client, cloud sync across devices.

## Success Metrics (initial)

- Engagement: 15+ min avg session, 3+ sessions/week.
- Progression: 3+ horses bred per user by week 2; 5+ competitions entered by week 2.
- Reliability: p95 API <200ms; uptime 99.9% (prod).
- Adoption: 60% of active users hire grooms by week 3; 50% reach competitions.

## Current State (2026-03-18)

- Backend: 100% complete — 3651+ tests (226 suites), 18 domain modules, 43 Prisma models
- Frontend: 100% complete — 37 pages, 80+ components, 44+ React Query hooks, all wired to live API
- Deployment: Railway-ready Docker multi-stage build
- Design: "Celestial Night" theme (deep navy, frosted glass, gold accents)

## Constraints / Assumptions

- Brownfield project; all core systems implemented and tested.
- API versioned at /api/v1 with Swagger/OpenAPI docs.
- Data model via Prisma; 43 models with JSONB flexibility for inventory/settings.

## Next Steps

- ✅ PRD-03 Gameplay Systems finalized (v2.0.0)
- ✅ PRD-04 Advanced Systems created (epigenetics, ultra-rare traits)
- ✅ PRD-07 Player Guide consolidated from user guides
- ✅ PRD-08 Security Architecture consolidated from rules
- ✅ PRD-09 Development Standards consolidated from best practices
- ✅ PRD-10 Project Milestones consolidated from history
- ✅ Mobile references removed from all PRDs
- ✅ Historical docs consolidated into PRD structure
- ✅ Frontend wired to /api/v1 endpoints (Epic 8 + Epic 20)
- ✅ 18-module backend architecture refactor (Epic 20)
- ✅ Horse Marketplace (Epic 21)
- Next: Production launch (Railway deploy) or Epics 22-30 (Celestial Night visual rebuild)

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

### UX Design

- [UX Spec — Design Tokens](../ux-spec-sections/01-design-tokens.md) - CSS custom properties, color palette, spacing
- [UX Spec — 4-Layer Strategy](../ux-spec-sections/02-4-layer-strategy.md) - Starfield → gradient → glass → content
- [UX Spec — shadcn Restyling](../ux-spec-sections/03-shadcn-restyling.md) - Component theming overrides
- [UX Spec — Global Atmosphere](../ux-spec-sections/04-global-atmosphere.md) - Celestial Night visual system
- [UX Spec — Frosted Panel System](../ux-spec-sections/05-frosted-panel-system.md) - Glass panel variants
- [UX Spec — Typography](../ux-spec-sections/06-typography-system.md) - Font scale, hierarchy
- [UX Spec — Navigation & Layout](../ux-spec-sections/07-navigation-layout.md) - Sidebar, breadcrumbs, responsive breakpoints
- [UX Spec — Hub Dashboard](../ux-spec-sections/08-hub-dashboard.md) - World hub layout
- [UX Spec — Horse Card Design](../ux-spec-sections/09-horse-card-design.md) - Card variants, care strip
- [UX Spec — Custom Components](../ux-spec-sections/10-component-new-custom.md) - GallopingLoader, FenceJumpBar, CinematicMoment
- [UX Spec — Button & Feedback](../ux-spec-sections/11-button-feedback-patterns.md) - Gold primary buttons, horseshoe borders
- [UX Spec — Journey Flows](../ux-spec-sections/12-journey-flows.md) - User flow audit, WYAG cap
- [UX Spec — Responsive & A11y](../ux-spec-sections/13-responsive-accessibility.md) - Breakpoints, skip-to-content, a11y audit

### Project Management

- [PRD-10 Project Milestones](./PRD-10-Project-Milestones.md) - Achievements, roadmap
- [Documentation Index](../index.md) - Complete documentation map
