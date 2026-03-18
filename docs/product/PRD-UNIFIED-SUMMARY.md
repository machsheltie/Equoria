# Equoria — Unified PRD Summary

**Version:** 1.0.0
**Last Updated:** 2026-03-18
**Status:** Epics 1-21 Complete | Production-Ready
**Supersedes:** Individual PRDs 00-10 (retained as detailed references)

---

## 1. Product Vision

Equoria is a web-based horse breeding and competition simulation where players manage multi-generational breeding programs, train horses across disciplines, compete in shows, and build stable empires. Inspired by Horseland, Ludus Equinus, and Equus Ipsum — rebuilt with modern tech and deeper gameplay.

**Platform:** Web (React 19 + TypeScript + Vite frontend, Express backend, PostgreSQL + Prisma ORM)
**Theme:** "Celestial Night" — deep navy, frosted glass panels, gold accents
**Mobile:** Out of scope

---

## 2. Target Personas

| Persona                | Focus                                      | Key Loops                                       |
| ---------------------- | ------------------------------------------ | ----------------------------------------------- |
| **Strategic Breeder**  | Optimizes pairings, multi-generation plans | Breed → evaluate genetics → plan next cross     |
| **Competitive Player** | Training, competitions, leaderboards       | Train → compete → earn → reinvest               |
| **Collector/Builder**  | Rare traits, grooms, stable prestige       | Discover traits → hire staff → build reputation |

---

## 3. Core Systems (All Implemented)

### 3.1 User & Horse Management (PRD-02)

- JWT auth with access + refresh tokens, email verification, password reset
- Horse CRUD with 10 core stats (speed, stamina, agility, balance, precision, intelligence, boldness, flexibility, obedience, focus)
- Age system with foal development stages
- Stable management with horse detail views

### 3.2 Breeding System (PRD-03)

- Mendelian + polygenic inheritance with JSONB genetics storage
- Epigenetic trait system: 60+ traits across 10 categories (PRD-04)
- Trait discovery: progressive revelation through training/competition/bonding
- Ultra-rare traits with special visual indicators
- Breeding cooldown: 30 days, biological validation, self-breed prevention

### 3.3 Training System (PRD-03)

- 8 disciplines: Dressage, Show Jumping, Cross-Country, Endurance, Racing, Western, Eventing, Polo
- Global 7-day cooldown (ms arithmetic, not Date.setDate — DST safe)
- Age requirement: horses must be 3+ years old
- Health check: injured horses cannot train

### 3.4 Competition System (PRD-03)

- Scoring: `BaseStats(50/30/20) + TraitBonus + Training + Tack + Rider ± 9% luck`
- Prize distribution with currency rewards and stat gains
- Show management: eligibility validation, result tracking, leaderboards

### 3.5 Staff Systems (PRD-03)

- **Grooms:** Hire, assign to foals, bonding interactions, skill progression, retirement at 104 weeks
- **Riders:** 4 personalities, 3 skill levels, XP/career progression, discovery system
- **Trainers:** 5 personalities, discipline tendencies, horse compatibility, career milestones

### 3.6 Economy & Services (PRD-02, PRD-03)

- Bank: balance, weekly claims, transaction history
- Marketplace: horse sales, price history, buying flow
- Inventory: JSONB-based tack system (saddle, bridle), equip/unequip
- Farrier, Veterinarian, Feed/Tack shops

### 3.7 Community (PRD-03)

- Forums: threads + posts with view tracking
- Direct Messages: inbox/sent, unread count, auto-mark-read
- Clubs: discipline/breed clubs, governance, elections, voting

### 3.8 Onboarding (PRD-02)

- 3-step wizard (Welcome → Starter Kit → Ready)
- 10-step spotlight tutorial with `data-onboarding-target` DOM attributes
- `completedOnboarding` flag: false = new, true = done, undefined = legacy

---

## 4. Technical Architecture

### 4.1 Backend

- **18 domain modules** under `backend/modules/`: auth, users, horses, breeding, traits, training, competition, grooms, riders, trainers, community, services, leaderboards, admin, docs, health, labs, marketplace
- All endpoints: `/api/v1/` prefix
- Backward-compat shims at `backend/routes/` and `backend/controllers/`
- Swagger/OpenAPI documentation at `/api-docs`

### 4.2 Frontend

- **37 pages**, 80+ components, 44+ React Query hooks
- 57 typed API client methods in `api-client.ts`
- `fetchWithAuth` auto-unwraps `data.data` — hooks receive clean types
- Code splitting: `React.lazy()` + `<Suspense>` with `<GallopingLoader />`
- shadcn/ui primitives + custom components (GallopingLoader, FenceJumpBar, CinematicMoment)

### 4.3 Database

- **43 Prisma models** in `packages/database/prisma/schema.prisma`
- JSONB fields for flexible data: `User.settings`, `Horse.tack`, genetics
- PostgreSQL 12+ with GIN indexes for JSONB queries

### 4.4 Deployment

- Multi-stage Dockerfile: `frontend-builder` (Vite) → `production` (Express serves SPA)
- Railway deploy: `prisma migrate deploy` before server start
- Sentry opt-in via env var for error tracking + performance monitoring

---

## 5. Security (PRD-08)

- OWASP Top 10:2021 — **10/10 categories addressed**, 400+ security tests
- JWT with HMAC-SHA256, bcrypt 12+ rounds, rate limiting (100 req/15min)
- Protected stats: cannot be modified directly via API
- Server-side timestamps for all operations
- Input sanitization: XSS, SQL injection (via Prisma), command injection prevention
- Suspicious activity detection: rapid-fire, multi-IP, error-then-success patterns

---

## 6. Testing (PRD-06 equivalent)

| Layer                    | Framework    | Count                   | Notes                                     |
| ------------------------ | ------------ | ----------------------- | ----------------------------------------- |
| Backend unit/integration | Jest         | 3651+ tests, 226 suites | `--experimental-vm-modules` for ESM       |
| Frontend component       | Vitest + MSW | Growing                 | `onUnhandledRequest: 'error'` strict mode |
| E2E                      | Playwright   | Core flows              | Auth, breeding, core game flows           |

**Philosophy:** Balanced mocking — mock external deps (DB, HTTP, logger), test real business logic.

---

## 7. Success Metrics

| Category    | Target                                              |
| ----------- | --------------------------------------------------- |
| Engagement  | 15+ min avg session, 3+ sessions/week               |
| Progression | 3+ horses bred by week 2, 5+ competitions by week 2 |
| Reliability | p95 API < 200ms, 99.9% uptime                       |
| Adoption    | 60% hire grooms by week 3, 50% reach competitions   |

---

## 8. Current State (2026-03-18)

- **Epics 1-21:** ALL COMPLETE
- **Backend:** 100% — 18 modules, 3651+ tests, 43 models
- **Frontend:** 100% — 37 pages, 80+ components, all wired to live API
- **Deployment:** Railway-ready Docker multi-stage build
- **Next:** Production launch (Railway deploy) or Epics 22-30 (Celestial Night visual rebuild)

---

## 9. PRD Index

| Doc                                         | Title                 | Status                      |
| ------------------------------------------- | --------------------- | --------------------------- |
| [PRD-00](./PRD-00-Brief.md)                 | Product Brief         | v2.0.0 — Updated 2026-03-18 |
| [PRD-01](./PRD-01-Overview.md)              | Overview & Vision     | v2.2.0 — Updated 2026-03-18 |
| [PRD-02](./PRD-02-Core-Features.md)         | Core Features         | v1.1.0 — Updated 2026-03-18 |
| [PRD-03](./PRD-03-Gameplay-Systems.md)      | Gameplay Systems      | v2.1.0 — Updated 2026-03-18 |
| [PRD-04](./PRD-04-Advanced-Systems.md)      | Advanced Systems      | v1.1.0 — Updated 2026-03-18 |
| [PRD-07](./PRD-07-Player-Guide.md)          | Player Guide          | v1.0.0 — Reference          |
| [PRD-08](./PRD-08-Security-Architecture.md) | Security Architecture | v1.0.0 — Reference          |
| [PRD-10](./PRD-10-Project-Milestones.md)    | Project Milestones    | v2.0.0 — Updated 2026-03-18 |

**Note:** PRD-05 (Deployment), PRD-06 (Testing), and PRD-09 (Dev Standards) are covered by `docs/deployment/`, `docs/testing-architecture.md`, and `CLAUDE.md` / `_bmad-output/project-context.md` respectively.
