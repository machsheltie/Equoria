# PRD-01: Equoria Overview

**Version:** 2.0.0
**Last Updated:** 2025-12-01
**Status:** Backend ✅ Complete | Frontend ❌ Pending
**Source Integration:** Consolidated from docs/history/

---

## Executive Summary

### Product Vision

Equoria is a sophisticated web-based horse simulation game that combines realistic breeding mechanics, strategic training systems, and competitive gameplay. The game creates a deeply engaging experience where players manage every aspect of horse development - from foal birth through competitive careers - using scientifically-inspired genetics, epigenetic trait systems, and professional stable management.

### Market Positioning

- **Genre:** Web Simulation / Strategy / Horse Management
- **Platform:** Web Application (React + Vite)
- **Monetization:** Free-to-play with optional premium features for cosmetics, analytics tools
- **Target Audience:** Web gamers aged 13-45 interested in simulation, strategy, and horse enthusiasts
- **Unique Value Proposition:** Most realistic horse breeding genetics system combined with strategic long-term gameplay and professional-grade backend architecture

### Key Differentiators

1. **Advanced Genetics System:** Multi-allele inheritance with epigenetic trait discovery
2. **Strategic Depth:** Long-term breeding programs requiring multi-generation planning
3. **Professional Systems:** Groom management, conformation shows, detailed training mechanics
4. **Scientific Accuracy:** Realistic horse development, age restrictions, and competitive mechanics
5. **Production Quality:** 942+ tests, enterprise-grade security, scalable architecture

---

## Product Goals and Success Metrics

### Primary Business Goals

1. **User Acquisition:** 100K downloads in first 6 months
2. **User Retention:** 40% Day 7 retention, 20% Day 30 retention
3. **Monetization:** $2.50 average revenue per user (ARPU) by month 6
4. **Engagement:** Average session length of 15+ minutes, 3+ sessions per day
5. **Community:** Active user-generated content and social features

### Key Performance Indicators (KPIs)

#### User Engagement Metrics
- Daily Active Users (DAU) / Monthly Active Users (MAU) ratio: Target 30%
- Average session length: Target 15-20 minutes
- Sessions per user per day: Target 3-5
- Feature adoption rate: 70% users engaging with core systems within first week

#### Gameplay Metrics
- Horses bred per user: Target 5+ horses by week 2
- Competition entries per week: Target 10+ per active user
- Training sessions completed: Target 15+ per week per active user
- Groom system adoption: Target 60% of users hiring grooms by week 3

#### Monetization Metrics
- Conversion rate to paying user: Target 5% by month 3
- Average Revenue Per Paying User (ARPPU): Target $25
- Lifetime Value (LTV): Target $15 per user
- Churn rate: Target <10% monthly

#### Technical Metrics
- API response time: <200ms for 95th percentile
- App crash rate: <1% of sessions
- Server uptime: 99.9%
- Test coverage: Maintain >90% with balanced mocking approach

---

## Target Audience

### Primary Personas

#### Persona 1: "The Strategic Breeder" (Sarah, 28)
- **Demographics:** Female, 25-35, urban professional
- **Gaming Experience:** Moderate - plays mobile simulation games regularly
- **Horse Knowledge:** High - former rider or horse enthusiast
- **Motivation:** Enjoys complex systems, long-term planning, achieving breeding goals
- **Pain Points:** Most horse games too simplistic, lack strategic depth
- **Success Criteria:** Building championship bloodlines, mastering genetics system

#### Persona 2: "The Casual Competitor" (Mike, 19)
- **Demographics:** Male, 18-24, college student
- **Gaming Experience:** High - plays various mobile games competitively
- **Horse Knowledge:** Low to Medium - interested in competition aspects
- **Motivation:** Daily progression, competition victories, social comparison
- **Pain Points:** Needs quick gameplay sessions, wants clear progression
- **Success Criteria:** Winning competitions, climbing leaderboards, visible achievement

#### Persona 3: "The Horse Enthusiast" (Emma, 42)
- **Demographics:** Female, 35-50, horse owner or former rider
- **Gaming Experience:** Low to Moderate - new to mobile gaming
- **Horse Knowledge:** Very High - real-world horse experience
- **Motivation:** Realistic simulation, educational value, nostalgia
- **Pain Points:** Games feel unrealistic, miss authentic horse management
- **Success Criteria:** Realistic horse behavior, accurate breeding, authentic disciplines

#### Persona 4: "The Collector" (Alex, 16)
- **Demographics:** Non-binary, 14-18, high school student
- **Gaming Experience:** Very High - plays multiple mobile games daily
- **Horse Knowledge:** Low - interested in collection and progression
- **Motivation:** Collecting horses, unlocking content, completing achievements
- **Pain Points:** Wants variety, cosmetic customization, achievement hunting
- **Success Criteria:** Rare trait collection, complete breed catalog, all achievements

---

## Feature Priority Framework

- **P0 (Critical):** Must-have for MVP, blocking launch
- **P1 (High):** Core features for engaging experience, launch window
- **P2 (Medium):** Important enhancements, post-launch priority
- **P3 (Low):** Nice-to-have features, future roadmap

---

## Implementation Status

### Backend Systems
- **Status:** 942+ tests, 90.1% success rate with balanced mocking
- **Completion:** ~95% of core game systems implemented
- **Testing:** Comprehensive integration testing (67 tests, 100% passing)
- **CI/CD:** Automated GitHub Actions pipeline (9-job workflow)

### Frontend Systems
- **Status:** Scaffolding Complete, Components Pending
- **Technology:** React 19, Vite 5.2, TailwindCSS 3.4
- **Components:** Radix UI primitives, react-router-dom, @tanstack/react-query
- **State Management:** React Query for server state

### Database
- **Technology:** PostgreSQL 14+ with Prisma ORM
- **Schema:** 30+ tables with JSONB for flexible data
- **Performance:** Optimized queries with strategic indexing
- **Migrations:** Automated testing with rollback validation

---

## Cross-References

### Game Design Documents
- **Core Features:** See [PRD-02-Core-Features.md](./PRD-02-Core-Features.md)
- **Gameplay Systems:** See [PRD-03-Gameplay-Systems.md](./PRD-03-Gameplay-Systems.md)
- **Advanced Systems:** See [PRD-04-Advanced-Systems.md](./PRD-04-Advanced-Systems.md)
- **Player Guide:** See [PRD-07-Player-Guide.md](./PRD-07-Player-Guide.md)

### Technical Documents
- **Deployment Guide:** See [PRD-05-Deployment-Guide.md](./PRD-05-Deployment-Guide.md)
- **Testing Strategy:** See [PRD-06-Testing-Strategy.md](./PRD-06-Testing-Strategy.md)
- **Security Architecture:** See [PRD-08-Security-Architecture.md](./PRD-08-Security-Architecture.md)
- **Development Standards:** See [PRD-09-Development-Standards.md](./PRD-09-Development-Standards.md)

### Project Management
- **Project Milestones:** See [PRD-10-Project-Milestones.md](./PRD-10-Project-Milestones.md)
- **Documentation Index:** See [docs/index.md](../index.md)
- **Historical Source:** `docs/history/` (archived, consolidated into PRDs)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-07 | Initial breakdown from comprehensive PRD |
| 2.0.0 | 2025-12-01 | Updated platform (web), fixed cross-references, consolidated from history |
| 2.1.0 | 2025-12-01 | Added references to PRD-07 through PRD-10 |

---

**Next Document:** [PRD-02-Core-Features.md](./PRD-02-Core-Features.md)
