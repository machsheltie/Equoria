# Equoria - Epic Breakdown

**Author:** Heirr
**Date:** 2025-12-03
**Project Level:** Medium Complexity (Brownfield)
**Target Scale:** Web-based Horse Simulation Game

---

## Overview

This document provides the complete epic and story breakdown for Equoria, decomposing the requirements from the PRD into implementable stories.

**Living Document Notice:** This is the initial version aligned with completed Architecture decisions.

---

## Context Validation

### Prerequisites Verified

| Document | Status | Content Summary |
|----------|--------|-----------------|
| **PRD** | ✅ Found | 4 documents (PRD-00 through PRD-04) covering brief, overview, core features, gameplay systems, and advanced systems |
| **Architecture** | ✅ Found | Comprehensive ADD with 8 ADRs, 15+ patterns, 62 files mapped |
| **UX Design** | ⚠️ Not Found | No UX design documents - will proceed without UI/UX specifications |

### Documents Analyzed

**PRD Documents:**
1. **PRD-00-Brief.md** - Product purpose, personas, core value, constraints
2. **PRD-01-Overview.md** - Vision, metrics, personas, feature priority framework
3. **PRD-02-Core-Features.md** - User management, horse management, progression systems
4. **PRD-03-Gameplay-Systems.md** - Training (23 disciplines), competition, grooms, breeding
5. **PRD-04-Advanced-Systems.md** - Epigenetics, flags, ultra-rare traits, discovery system

**Architecture Document:**
- **architecture.md** - Complete Architecture Decision Document with:
  - 8 ADRs (State Management, Form Handling, Auth Storage, API Client, Error Display, Loading States, File Organization, Test Organization)
  - Implementation patterns for React Query, Zod, TailwindCSS
  - Project structure (62 files mapped)
  - API endpoints documented

### Project Context

| Aspect | Detail |
|--------|--------|
| **Platform** | Web browser-based (React 19 + Vite) |
| **Backend Status** | 100% Production-Ready (942+ tests, 90.1% success) |
| **Frontend Status** | ~60% Complete (19 components, 6,424 lines) |
| **Database** | PostgreSQL 15+ with Prisma ORM (30+ tables) |
| **API Endpoints** | 130+ documented endpoints |
| **Testing** | Jest + RTL, MSW for mocking |

---

## Functional Requirements Inventory

### User Management (PRD-02)

| FR ID | Requirement | Priority | Backend Status | Frontend Status |
|-------|-------------|----------|----------------|-----------------|
| **FR-U1** | User registration with email/password | P0 | ✅ Complete | ❌ Pending |
| **FR-U2** | JWT authentication with refresh tokens | P0 | ✅ Complete | ❌ Pending |
| **FR-U3** | Password reset and email verification | P0 | ✅ Complete | ❌ Pending |
| **FR-U4** | Role-based access control (User/Moderator/Admin) | P0 | ✅ Complete | ❌ Pending |
| **FR-U5** | Profile management (avatar, display name, bio) | P1 | ✅ Complete | ❌ Pending |
| **FR-U6** | User level/XP progression system | P0 | ✅ Complete | ❌ Pending |
| **FR-U7** | In-game currency management | P0 | ✅ Complete | ❌ Pending |
| **FR-U8** | User dashboard with statistics | P0 | ✅ Complete | ⚠️ Partial |

### Horse Management (PRD-02)

| FR ID | Requirement | Priority | Backend Status | Frontend Status |
|-------|-------------|----------|----------------|-----------------|
| **FR-H1** | Horse CRUD operations | P0 | ✅ Complete | ⚠️ Partial |
| **FR-H2** | Horse attributes (stats, disciplines, genetics) | P0 | ✅ Complete | ⚠️ Partial |
| **FR-H3** | Horse XP and stat progression | P0 | ✅ Complete | ❌ Pending |
| **FR-H4** | Conformation scoring system (8 regions) | P1 | ✅ Complete | ❌ Pending |
| **FR-H5** | Horse search and filtering | P1 | ✅ Complete | ⚠️ Partial |

### Training System (PRD-03)

| FR ID | Requirement | Priority | Backend Status | Frontend Status |
|-------|-------------|----------|----------------|-----------------|
| **FR-T1** | Training sessions with 23 disciplines | P0 | ✅ Complete | ❌ Pending |
| **FR-T2** | Training eligibility (age 3-20, 7-day cooldown) | P0 | ✅ Complete | ❌ Pending |
| **FR-T3** | Discipline score progression (+5 per session) | P0 | ✅ Complete | ❌ Pending |
| **FR-T4** | Trait integration (bonuses/penalties) | P0 | ✅ Complete | ❌ Pending |
| **FR-T5** | Training status dashboard | P1 | ✅ Complete | ❌ Pending |

### Competition System (PRD-03)

| FR ID | Requirement | Priority | Backend Status | Frontend Status |
|-------|-------------|----------|----------------|-----------------|
| **FR-C1** | Competition entry and eligibility | P0 | ✅ Complete | ⚠️ Partial |
| **FR-C2** | Scoring algorithm with traits | P0 | ✅ Complete | ⚠️ Partial |
| **FR-C3** | Prize distribution (50%/30%/20%) | P0 | ✅ Complete | ⚠️ Partial |
| **FR-C4** | Horse/User XP awards | P0 | ✅ Complete | ⚠️ Partial |
| **FR-C5** | Leaderboards by discipline | P1 | ✅ Complete | ⚠️ Partial |

### Groom System (PRD-03)

| FR ID | Requirement | Priority | Backend Status | Frontend Status |
|-------|-------------|----------|----------------|-----------------|
| **FR-G1** | Groom hiring and assignment | P0 | ✅ Complete | ⚠️ Partial |
| **FR-G2** | Personality-based trait influence | P0 | ✅ Complete | ⚠️ Partial |
| **FR-G3** | Age-based task system (enrichment, grooming) | P0 | ✅ Complete | ⚠️ Partial |
| **FR-G4** | Career lifecycle and retirement | P1 | ✅ Complete | ❌ Pending |
| **FR-G5** | Legacy system (protégé generation) | P2 | ✅ Complete | ❌ Pending |
| **FR-G6** | Talent tree (3 tiers, 24 talents) | P2 | ✅ Complete | ❌ Pending |
| **FR-G7** | Conformation show handling | P1 | ✅ Complete | ❌ Pending |

### Breeding System (PRD-03)

| FR ID | Requirement | Priority | Backend Status | Frontend Status |
|-------|-------------|----------|----------------|-----------------|
| **FR-B1** | Breeding mechanics (pairing, cooldowns) | P0 | ✅ Complete | ❌ Pending |
| **FR-B2** | Foal development (days 0-6 milestones) | P0 | ✅ Complete | ❌ Pending |
| **FR-B3** | Enrichment activities for foals | P0 | ✅ Complete | ❌ Pending |
| **FR-B4** | Milestone evaluation and trait confirmation | P0 | ✅ Complete | ❌ Pending |
| **FR-B5** | Breeding predictions and insights | P1 | ✅ Complete | ❌ Pending |

### Epigenetic System (PRD-04)

| FR ID | Requirement | Priority | Backend Status | Frontend Status |
|-------|-------------|----------|----------------|-----------------|
| **FR-E1** | Epigenetic trait assignment (10+ traits) | P0 | ✅ Complete | ❌ Pending |
| **FR-E2** | Development windows (0-3 years) | P0 | ✅ Complete | ❌ Pending |
| **FR-E3** | Trait stacking rules (max 3 visible) | P0 | ✅ Complete | ❌ Pending |
| **FR-E4** | Epigenetic flag system (9 flags) | P0 | ✅ Complete | ❌ Pending |
| **FR-E5** | Flag assignment engine | P0 | ✅ Complete | ❌ Pending |

### Ultra-Rare Traits (PRD-04)

| FR ID | Requirement | Priority | Backend Status | Frontend Status |
|-------|-------------|----------|----------------|-----------------|
| **FR-R1** | Ultra-rare traits (5 total, <3% chance) | P1 | ✅ Complete | ❌ Pending |
| **FR-R2** | Exotic traits (5 total, conditional) | P1 | ✅ Complete | ❌ Pending |
| **FR-R3** | Groom perk influence on rare traits | P2 | ✅ Complete | ❌ Pending |
| **FR-R4** | Trait discovery system | P1 | ✅ Complete | ❌ Pending |

### Non-Functional Requirements

| NFR ID | Requirement | Target | Status |
|--------|-------------|--------|--------|
| **NFR-1** | API latency | <200ms @ p95 | ✅ Backend enforced |
| **NFR-2** | Dashboard load time | <500ms | React Query caching |
| **NFR-3** | Auth rate limiting | 5 req/15 min | ✅ Backend enforced |
| **NFR-4** | Test coverage | 80% minimum | CI/CD gate |
| **NFR-5** | Server uptime | 99.9% | Production target |

---

## Epic Summary

| Epic | Title | Priority | Stories | FRs Covered | Status |
|------|-------|----------|---------|-------------|--------|
| 1 | Authentication & User Foundation | P0 | 6 | FR-U1, FR-U2, FR-U3, FR-U4 | ❌ Pending |
| 2 | User Dashboard & Profile | P0 | 5 | FR-U5, FR-U6, FR-U7, FR-U8 | ⚠️ Partial |
| 3 | Horse Management | P0 | 6 | FR-H1, FR-H2, FR-H3, FR-H4, FR-H5 | ⚠️ Partial |
| 4 | Training System | P0 | 5 | FR-T1, FR-T2, FR-T3, FR-T4, FR-T5 | ❌ Pending |
| 5 | Competition System | P0 | 5 | FR-C1, FR-C2, FR-C3, FR-C4, FR-C5 | ⚠️ Partial |
| 6 | Breeding & Foal Development | P0 | 6 | FR-B1, FR-B2, FR-B3, FR-B4, FR-B5, FR-E1-E5 | ❌ Pending |
| 7 | Groom System | P0/P1/P2 | 7 | FR-G1, FR-G2, FR-G3, FR-G4, FR-G5, FR-G6, FR-G7, FR-R1-R4 | ⚠️ Partial |

**Total Stories:** 40 | **Total FRs Covered:** 44/44 (100%)

---

## FR Coverage Map

| FR ID | Epic | Story | Implementation Notes |
|-------|------|-------|---------------------|
| FR-U1 | Epic 1 | 1.1 | Registration form with Zod validation |
| FR-U2 | Epic 1 | 1.2, 1.3 | HttpOnly cookies, React Query auth |
| FR-U3 | Epic 1 | 1.4, 1.5 | Password reset flow, email verification |
| FR-U4 | Epic 1 | 1.6 | Role-based route protection |
| FR-U5 | Epic 2 | 2.1 | Profile editor with avatar upload |
| FR-U6 | Epic 2 | 2.2 | XP progress bar, level display |
| FR-U7 | Epic 2 | 2.3 | Currency balance, transaction history |
| FR-U8 | Epic 2 | 2.4, 2.5 | Statistics dashboard, charts |
| FR-H1 | Epic 3 | 3.1, 3.2 | Horse list, detail views |
| FR-H2 | Epic 3 | 3.3 | Attributes panel with genetics |
| FR-H3 | Epic 3 | 3.4 | XP/stat progression display |
| FR-H4 | Epic 3 | 3.5 | Conformation scoring UI (8 regions) |
| FR-H5 | Epic 3 | 3.6 | Search/filter with React Query |
| FR-T1 | Epic 4 | 4.1 | Training session interface |
| FR-T2 | Epic 4 | 4.2 | Eligibility checks (age, cooldown) |
| FR-T3 | Epic 4 | 4.3 | Score progression display |
| FR-T4 | Epic 4 | 4.4 | Trait bonus/penalty integration |
| FR-T5 | Epic 4 | 4.5 | Training dashboard overview |
| FR-C1 | Epic 5 | 5.1 | Competition entry form |
| FR-C2 | Epic 5 | 5.2 | Scoring results display |
| FR-C3 | Epic 5 | 5.3 | Prize distribution UI |
| FR-C4 | Epic 5 | 5.4 | XP award notifications |
| FR-C5 | Epic 5 | 5.5 | Leaderboard pages |
| FR-B1 | Epic 6 | 6.1 | Breeding pair selection |
| FR-B2 | Epic 6 | 6.2 | Foal milestone timeline |
| FR-B3 | Epic 6 | 6.3 | Enrichment activity UI |
| FR-B4 | Epic 6 | 6.4 | Milestone evaluation display |
| FR-B5 | Epic 6 | 6.5 | Breeding predictions panel |
| FR-E1-E5 | Epic 6 | 6.6 | Epigenetic trait visualization |
| FR-G1 | Epic 7 | 7.1 | Groom hiring interface |
| FR-G2 | Epic 7 | 7.2 | Personality trait display |
| FR-G3 | Epic 7 | 7.3 | Task assignment UI |
| FR-G4 | Epic 7 | 7.4 | Career lifecycle dashboard |
| FR-G5 | Epic 7 | 7.5 | Legacy/protégé system UI |
| FR-G6 | Epic 7 | 7.6 | Talent tree visualization |
| FR-G7 | Epic 7 | 7.7 | Show handling interface |
| FR-R1-R4 | Epic 7 | 7.7 | Ultra-rare trait discovery |

---

## FR Summary

| Category | Total FRs | P0 | P1 | P2 | Backend Complete | Frontend Pending |
|----------|-----------|----|----|----|-----------------:|----------------:|
| User Management | 8 | 7 | 1 | 0 | 8 | 7 |
| Horse Management | 5 | 3 | 2 | 0 | 5 | 3 |
| Training | 5 | 4 | 1 | 0 | 5 | 5 |
| Competition | 5 | 4 | 1 | 0 | 5 | 0 |
| Groom | 7 | 3 | 2 | 2 | 7 | 4 |
| Breeding | 5 | 4 | 1 | 0 | 5 | 5 |
| Epigenetics | 5 | 5 | 0 | 0 | 5 | 5 |
| Ultra-Rare | 4 | 0 | 3 | 1 | 4 | 4 |
| **TOTAL** | **44** | **30** | **11** | **3** | **44** | **33** |

---

## Epic 1: Authentication & User Foundation

**Goal:** Enable users to securely register, login, and access the application with role-based permissions.

**Priority:** P0 (BLOCKING - No other features work without authentication)

**Technical Context (from Architecture):**
- Authentication via HttpOnly cookies with `credentials: 'include'`
- React Query for auth state management
- Zod for form validation
- API endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, etc.

**FRs Covered:** FR-U1, FR-U2, FR-U3, FR-U4

---

### Story 1.1: User Registration

As a **new player**,
I want to **register an account with email and password**,
So that **I can start playing Equoria and manage my stable**.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I enter a valid email, password (8+ chars, 1 uppercase, 1 number), and display name
**Then** my account is created and I am redirected to email verification

**And** I see validation errors for invalid inputs (inline, Zod-powered)
**And** I cannot submit with duplicate email (API error displayed)
**And** password strength indicator shows requirements met

**Prerequisites:** None (entry point)

**Technical Notes:**
- Use `RegisterForm` component with Zod schema
- API: `POST /api/v1/auth/register`
- Store auth state via React Query's `useAuth` hook
- Follow ADR-002 (Form Handling) patterns

---

### Story 1.2: User Login

As a **returning player**,
I want to **login with my credentials**,
So that **I can access my horses and continue playing**.

**Acceptance Criteria:**

**Given** I am on the login page
**When** I enter valid email and password
**Then** I am authenticated and redirected to my dashboard

**And** invalid credentials show a generic error (security: no email enumeration)
**And** I can toggle password visibility
**And** "Remember me" extends session duration

**Prerequisites:** Story 1.1 (account exists)

**Technical Notes:**
- API: `POST /api/v1/auth/login`
- HttpOnly cookie set by backend
- React Query invalidates and refetches user data
- Follow ADR-003 (Auth Storage) - cookies only, no localStorage

---

### Story 1.3: Session Management

As an **authenticated user**,
I want to **stay logged in across browser sessions**,
So that **I don't have to login repeatedly**.

**Acceptance Criteria:**

**Given** I have an active session
**When** I close and reopen the browser
**Then** I remain authenticated (if session valid)

**And** expired sessions redirect to login with message
**And** I can manually logout from any page
**And** logout clears all session data

**Prerequisites:** Story 1.2

**Technical Notes:**
- React Query `staleTime` for auth state
- API: `GET /api/v1/auth/me` for session validation
- API: `POST /api/v1/auth/logout`
- Automatic token refresh via backend cookies

---

### Story 1.4: Password Reset Request

As a **user who forgot their password**,
I want to **request a password reset email**,
So that **I can regain access to my account**.

**Acceptance Criteria:**

**Given** I am on the forgot password page
**When** I enter my registered email
**Then** I see confirmation that reset email was sent (if account exists)

**And** same message shown for non-existent emails (security)
**And** rate limiting prevents abuse (5 requests/15 min)
**And** email contains secure, time-limited reset link

**Prerequisites:** Story 1.1 (account exists)

**Technical Notes:**
- API: `POST /api/v1/auth/forgot-password`
- No email enumeration (always show success)
- Backend handles email sending

---

### Story 1.5: Password Reset Completion

As a **user with a reset link**,
I want to **set a new password**,
So that **I can login with my new credentials**.

**Acceptance Criteria:**

**Given** I clicked a valid reset link from email
**When** I enter and confirm a new valid password
**Then** my password is updated and I am redirected to login

**And** expired/invalid links show appropriate error
**And** password must meet strength requirements
**And** I cannot reuse the reset link after use

**Prerequisites:** Story 1.4

**Technical Notes:**
- API: `POST /api/v1/auth/reset-password`
- Token validation on page load
- Redirect to login on success

---

### Story 1.6: Role-Based Access Control

As a **user with specific roles**,
I want to **see only features I have permission to access**,
So that **the interface is relevant to my role**.

**Acceptance Criteria:**

**Given** I am authenticated with a specific role (User/Moderator/Admin)
**When** I navigate the application
**Then** I only see menu items and pages for my role level

**And** direct URL access to unauthorized pages shows 403
**And** Admin can access all features
**And** Moderator can access moderation tools
**And** User has standard player access

**Prerequisites:** Story 1.2

**Technical Notes:**
- React Router protected routes
- Role checks in navigation components
- API returns user role in auth response
- Follow ADR-001 (State Management) for role storage

---

## Epic 2: User Dashboard & Profile

**Goal:** Provide users with a personalized dashboard showing their progress, currency, and profile management.

**Priority:** P0

**Technical Context:**
- React Query for data fetching
- Dashboard components already partially exist (enhance, don't rebuild)
- API endpoints for user stats, currency, profile

**FRs Covered:** FR-U5, FR-U6, FR-U7, FR-U8

---

### Story 2.1: Profile Management

As a **player**,
I want to **edit my profile (avatar, display name, bio)**,
So that **I can personalize my identity in the game**.

**Acceptance Criteria:**

**Given** I am on my profile page
**When** I update my display name, bio, or avatar
**Then** changes are saved and visible immediately

**And** display name has 3-30 character limit
**And** bio has 500 character limit with counter
**And** avatar supports image upload (max 2MB, jpg/png)
**And** changes are validated client-side before submission

**Prerequisites:** Epic 1 complete

**Technical Notes:**
- API: `PATCH /api/v1/users/profile`
- File upload for avatar
- React Query mutation with optimistic updates
- Form validation with Zod

---

### Story 2.2: XP & Level Display

As a **player**,
I want to **see my current level and XP progress**,
So that **I can track my advancement in the game**.

**Acceptance Criteria:**

**Given** I am on the dashboard
**When** I view my profile section
**Then** I see my current level, XP bar, and XP to next level

**And** XP bar animates on XP gain
**And** level-up shows celebration notification
**And** clicking shows detailed XP history

**Prerequisites:** Story 2.1

**Technical Notes:**
- API: `GET /api/v1/users/stats`
- Progress bar component with animation
- Toast notifications for level-up

---

### Story 2.3: Currency Management

As a **player**,
I want to **see my in-game currency balance and transaction history**,
So that **I can manage my spending**.

**Acceptance Criteria:**

**Given** I am on the dashboard
**When** I view the currency section
**Then** I see my current balance prominently displayed

**And** I can view transaction history (paginated)
**And** transactions show source (competition, breeding, etc.)
**And** balance updates in real-time after transactions

**Prerequisites:** Story 2.1

**Technical Notes:**
- API: `GET /api/v1/users/currency`
- API: `GET /api/v1/users/transactions`
- React Query for real-time balance

---

### Story 2.4: Statistics Dashboard

As a **player**,
I want to **see my overall game statistics**,
So that **I can track my achievements and progress**.

**Acceptance Criteria:**

**Given** I am on the dashboard
**When** I view the statistics section
**Then** I see key metrics: horses owned, competitions won, breeding count

**And** statistics update in real-time
**And** I can see trends (this week vs last week)
**And** clicking a stat navigates to detailed view

**Prerequisites:** Story 2.1

**Technical Notes:**
- API: `GET /api/v1/users/stats`
- Chart.js or Recharts for visualizations
- React Query with appropriate staleTime

---

### Story 2.5: Activity Feed

As a **player**,
I want to **see recent activity on my account**,
So that **I can track what's happening with my stable**.

**Acceptance Criteria:**

**Given** I am on the dashboard
**When** I view the activity feed
**Then** I see recent events: competition results, training completions, foal births

**And** feed is chronologically ordered
**And** each item links to relevant detail page
**And** feed updates in real-time

**Prerequisites:** Story 2.4

**Technical Notes:**
- API: `GET /api/v1/users/activity`
- Infinite scroll pagination
- WebSocket for real-time updates (optional enhancement)

---

## Epic 3: Horse Management

**Goal:** Allow users to view, manage, and search their horses with full attribute visibility.

**Priority:** P0

**Technical Context:**
- Partial implementation exists (enhance existing components)
- Horse data includes genetics, stats, disciplines, traits
- 8-region conformation scoring system

**FRs Covered:** FR-H1, FR-H2, FR-H3, FR-H4, FR-H5

---

### Story 3.1: Horse List View

As a **player**,
I want to **see all my horses in a list**,
So that **I can quickly find and select a horse to manage**.

**Acceptance Criteria:**

**Given** I am on the horses page
**When** the page loads
**Then** I see a paginated list of my horses with key info (name, age, breed)

**And** list supports grid and list view toggle
**And** each horse shows thumbnail, name, age, primary discipline
**And** clicking a horse navigates to detail view

**Prerequisites:** Epic 1 complete

**Technical Notes:**
- API: `GET /api/v1/horses`
- React Query with pagination
- Existing HorseListView component - enhance

---

### Story 3.2: Horse Detail View

As a **player**,
I want to **view detailed information about a specific horse**,
So that **I can understand their capabilities and plan their development**.

**Acceptance Criteria:**

**Given** I am on a horse's detail page
**When** the page loads
**Then** I see comprehensive info: stats, disciplines, genetics, traits

**And** page has tabbed sections for organization
**And** I can navigate to training, breeding from here
**And** edit button allows name/description changes

**Prerequisites:** Story 3.1

**Technical Notes:**
- API: `GET /api/v1/horses/:id`
- Tab component for sections
- Existing components - integrate and enhance

---

### Story 3.3: Horse Attributes Panel

As a **player**,
I want to **see all horse attributes including genetics and traits**,
So that **I can make informed breeding and training decisions**.

**Acceptance Criteria:**

**Given** I am viewing a horse's detail page
**When** I view the attributes tab
**Then** I see all stats, discipline scores, genetic traits

**And** genetic traits show inheritance information
**And** epigenetic traits show with discovery status
**And** stats show with visual bars and numeric values

**Prerequisites:** Story 3.2

**Technical Notes:**
- Display genetic alleles and phenotypes
- Trait cards with tooltips for details
- Color-coded trait categories

---

### Story 3.4: XP & Progression Display

As a **player**,
I want to **see my horse's XP and stat progression**,
So that **I can track their development over time**.

**Acceptance Criteria:**

**Given** I am viewing a horse's progression
**When** the section loads
**Then** I see XP progress bar, stat history, recent gains

**And** graph shows stat progression over time
**And** I can see when horse will age up
**And** training recommendations based on potential

**Prerequisites:** Story 3.2

**Technical Notes:**
- API includes progression data
- Chart.js for historical display
- Calculate age-based recommendations

---

### Story 3.5: Conformation Scoring UI

As a **player**,
I want to **view my horse's conformation scores across 8 body regions**,
So that **I can prepare for conformation shows**.

**Acceptance Criteria:**

**Given** I am viewing horse conformation
**When** the section loads
**Then** I see scores for all 8 regions: Head, Neck, Shoulder, Back, Hindquarters, Legs, Hooves, Overall

**And** visual diagram highlights each region
**And** scores show numeric value and quality rating
**And** comparison to breed average available

**Prerequisites:** Story 3.2

**Technical Notes:**
- Horse silhouette SVG with clickable regions
- Tooltips with detailed scores
- API includes conformation data

---

### Story 3.6: Horse Search & Filter

As a **player**,
I want to **search and filter my horses**,
So that **I can quickly find specific horses**.

**Acceptance Criteria:**

**Given** I am on the horses page
**When** I use search or filters
**Then** results update in real-time

**And** search works on name, breed, traits
**And** filters include: age range, discipline, breed, training status
**And** filters persist in URL for bookmarking
**And** clear filters button resets all

**Prerequisites:** Story 3.1

**Technical Notes:**
- URL query params for filter state
- React Query with dynamic filters
- Debounced search input
- Existing filtering - enhance

---

## Epic 4: Training System

**Goal:** Enable users to train horses in 23 disciplines with full eligibility tracking and progression visualization.

**Priority:** P0

**Technical Context:**
- 23 disciplines across 4 categories: Western, English, Racing, Specialty
- Training eligibility: ages 3-20, 7-day cooldown per discipline
- +5 score per training session
- Trait bonuses/penalties affect outcomes

**FRs Covered:** FR-T1, FR-T2, FR-T3, FR-T4, FR-T5

---

### Story 4.1: Training Session Interface

As a **player**,
I want to **train my horse in a discipline**,
So that **they can improve their competitive scores**.

**Acceptance Criteria:**

**Given** I am on the training page for an eligible horse
**When** I select a discipline and start training
**Then** training session executes and I see the results

**And** I can select from 23 disciplines (4 categories)
**And** session shows score gain (+5 base + modifiers)
**And** trait bonuses/penalties are clearly displayed
**And** confirmation before starting session

**Prerequisites:** Epic 3 complete

**Technical Notes:**
- API: `POST /api/v1/training/sessions`
- Discipline picker grouped by category
- Result modal with score breakdown

---

### Story 4.2: Training Eligibility Display

As a **player**,
I want to **see which horses are eligible for training**,
So that **I know who can train and when**.

**Acceptance Criteria:**

**Given** I am on the training page
**When** I view horse eligibility
**Then** I see which horses can train and why others cannot

**And** ineligible horses show reason (too young, cooldown, too old)
**And** cooldown shows time remaining
**And** age requirements clearly displayed (3-20 years)

**Prerequisites:** Story 4.1

**Technical Notes:**
- API returns eligibility status
- Countdown timer for cooldowns
- Filter to show only eligible horses

---

### Story 4.3: Score Progression Display

As a **player**,
I want to **see how my horse's discipline scores are progressing**,
So that **I can plan their training strategy**.

**Acceptance Criteria:**

**Given** I am viewing a horse's training history
**When** the section loads
**Then** I see all discipline scores with progression over time

**And** radar chart shows discipline distribution
**And** I can see training history with dates
**And** score caps and bonuses are explained

**Prerequisites:** Story 4.1

**Technical Notes:**
- API: `GET /api/v1/horses/:id/training-history`
- Radar/spider chart for discipline visualization
- Training log table with pagination

---

### Story 4.4: Trait Bonus Integration

As a **player**,
I want to **understand how traits affect training outcomes**,
So that **I can leverage my horse's strengths**.

**Acceptance Criteria:**

**Given** I am about to train a horse
**When** I view the training preview
**Then** I see all trait modifiers that will apply

**And** positive traits show green bonus indicators
**And** negative traits show red penalty indicators
**And** net effect is calculated and displayed
**And** tooltip explains each trait's effect

**Prerequisites:** Story 4.1, Epic 6 (traits)

**Technical Notes:**
- API returns trait modifiers in training preview
- Visual indicators for positive/negative
- Link to trait documentation

---

### Story 4.5: Training Dashboard

As a **player**,
I want to **see a training overview for all my horses**,
So that **I can efficiently manage training schedules**.

**Acceptance Criteria:**

**Given** I am on the training dashboard
**When** the page loads
**Then** I see all horses with training status at a glance

**And** dashboard shows: ready to train, in cooldown, ineligible
**And** quick-train buttons for eligible horses
**And** bulk training recommendations
**And** weekly training calendar view

**Prerequisites:** Stories 4.1-4.4

**Technical Notes:**
- Summary view of all horses
- Calendar component for schedule
- Batch action support

---

## Epic 5: Competition System

**Goal:** Allow users to enter competitions, view results, and climb leaderboards.

**Priority:** P0

**Technical Context:**
- Competition entry with eligibility checks
- Scoring algorithm incorporates traits
- Prize distribution: 50%/30%/20% for 1st/2nd/3rd
- XP awards for participation and placement

**FRs Covered:** FR-C1, FR-C2, FR-C3, FR-C4, FR-C5

---

### Story 5.1: Competition Entry

As a **player**,
I want to **enter my horse in competitions**,
So that **I can win prizes and earn XP**.

**Acceptance Criteria:**

**Given** I am on the competition page
**When** I select a competition and enter an eligible horse
**Then** my horse is registered for the competition

**And** I see available competitions filtered by discipline
**And** entry requirements are clearly displayed
**And** entry fee (if any) is deducted from balance
**And** I receive confirmation of successful entry

**Prerequisites:** Epic 3, Epic 4 (trained horses)

**Technical Notes:**
- API: `POST /api/v1/competitions/entries`
- Competition browser with filters
- Horse eligibility check before entry

---

### Story 5.2: Competition Results

As a **player**,
I want to **see detailed competition results**,
So that **I can understand how my horse performed**.

**Acceptance Criteria:**

**Given** a competition has completed
**When** I view the results
**Then** I see full rankings with scores and placements

**And** my horse's position is highlighted
**And** I can see score breakdown (base + modifiers)
**And** trait influences are shown
**And** I can compare to other participants

**Prerequisites:** Story 5.1

**Technical Notes:**
- API: `GET /api/v1/competitions/:id/results`
- Results table with sorting
- Score breakdown modal

---

### Story 5.3: Prize Distribution Display

As a **player**,
I want to **see prizes earned from competitions**,
So that **I know what I've won**.

**Acceptance Criteria:**

**Given** my horse placed in a competition
**When** I view results
**Then** I see prizes earned: currency, items, XP

**And** prize amounts match 50%/30%/20% distribution
**And** prizes are automatically added to my account
**And** prize history is viewable in profile

**Prerequisites:** Story 5.2

**Technical Notes:**
- API includes prize data in results
- Celebratory animation for wins
- Link to transaction history

---

### Story 5.4: XP Award Notifications

As a **player**,
I want to **be notified when I earn XP from competitions**,
So that **I can track my progression**.

**Acceptance Criteria:**

**Given** I participated in a competition
**When** results are finalized
**Then** I see XP earned for both horse and player

**And** toast notification shows XP gained
**And** XP breakdown shows competition bonus, placement bonus
**And** level-up triggers special notification

**Prerequisites:** Story 5.2

**Technical Notes:**
- Toast notification system
- API returns XP details
- Integrate with Story 2.2 XP display

---

### Story 5.5: Leaderboards

As a **player**,
I want to **view leaderboards by discipline**,
So that **I can see top performers and my ranking**.

**Acceptance Criteria:**

**Given** I am on the leaderboards page
**When** I select a discipline
**Then** I see top-ranked horses and players

**And** leaderboards available for all 23 disciplines
**And** player leaderboard shows overall points
**And** my position is highlighted
**And** filtering by time period (weekly, monthly, all-time)

**Prerequisites:** Story 5.2

**Technical Notes:**
- API: `GET /api/v1/leaderboards/:discipline`
- Paginated tables
- Time-based filtering

---

## Epic 6: Breeding & Foal Development

**Goal:** Enable users to breed horses, raise foals through developmental milestones, and discover epigenetic traits.

**Priority:** P0

**Technical Context:**
- Breeding mechanics with pairing and cooldowns
- Foal development: 7 milestones (days 0-6)
- Enrichment activities influence trait development
- Epigenetic system: 10+ traits, 9 flags, development windows (0-3 years)

**FRs Covered:** FR-B1, FR-B2, FR-B3, FR-B4, FR-B5, FR-E1, FR-E2, FR-E3, FR-E4, FR-E5

---

### Story 6.1: Breeding Pair Selection

As a **player**,
I want to **select a mare and stallion for breeding**,
So that **I can produce foals with desired traits**.

**Acceptance Criteria:**

**Given** I am on the breeding page
**When** I select a mare and stallion
**Then** I see compatibility analysis and can initiate breeding

**And** I can only select eligible horses (age, cooldown)
**And** genetic compatibility preview is shown
**And** breeding cost is displayed
**And** confirmation required before breeding

**Prerequisites:** Epic 3 (own horses)

**Technical Notes:**
- API: `POST /api/v1/breeding/pairs`
- Side-by-side horse comparison
- Compatibility algorithm display

---

### Story 6.2: Foal Milestone Timeline

As a **player**,
I want to **track my foal's development through milestones**,
So that **I can ensure optimal growth**.

**Acceptance Criteria:**

**Given** I have a foal
**When** I view their development page
**Then** I see a timeline with all 7 milestones (days 0-6)

**And** completed milestones show outcomes
**And** current/upcoming milestones are highlighted
**And** I can see what's needed for each milestone
**And** alerts for approaching milestones

**Prerequisites:** Story 6.1

**Technical Notes:**
- API: `GET /api/v1/foals/:id/milestones`
- Timeline component
- Push notifications for milestones

---

### Story 6.3: Enrichment Activity UI

As a **player**,
I want to **provide enrichment activities to my foals**,
So that **I can influence their trait development**.

**Acceptance Criteria:**

**Given** I have a foal in a development window
**When** I select an enrichment activity
**Then** the activity is applied and I see results

**And** available activities depend on foal age
**And** activity effects on traits are previewed
**And** daily activity limits are displayed
**And** history of completed activities shown

**Prerequisites:** Story 6.2

**Technical Notes:**
- API: `POST /api/v1/foals/:id/enrichment`
- Activity picker with descriptions
- Impact preview before confirmation

---

### Story 6.4: Milestone Evaluation Display

As a **player**,
I want to **see the results of milestone evaluations**,
So that **I understand how my foal is developing**.

**Acceptance Criteria:**

**Given** a milestone has been evaluated
**When** I view the results
**Then** I see confirmed traits and attribute changes

**And** newly discovered traits are highlighted
**And** trait potential changes are shown
**And** comparison to expected outcomes
**And** recommendations for next steps

**Prerequisites:** Story 6.2

**Technical Notes:**
- Milestone result modal
- Before/after comparison
- Trait card animations for discoveries

---

### Story 6.5: Breeding Predictions

As a **player**,
I want to **see predictions for potential offspring**,
So that **I can make informed breeding decisions**.

**Acceptance Criteria:**

**Given** I have selected a breeding pair
**When** I view predictions
**Then** I see probable trait outcomes and stat ranges

**And** predictions show probability percentages
**And** rare trait chances are highlighted
**And** genetic compatibility score displayed
**And** historical breeding success shown

**Prerequisites:** Story 6.1

**Technical Notes:**
- API: `GET /api/v1/breeding/predict`
- Probability visualizations
- Monte Carlo simulation results from backend

---

### Story 6.6: Epigenetic Trait System

As a **player**,
I want to **discover and track epigenetic traits on my horses**,
So that **I can leverage unique abilities**.

**Acceptance Criteria:**

**Given** I am viewing a horse's traits
**When** epigenetic traits are present
**Then** I see them with discovery status and effects

**And** undiscovered traits show as "???" with hints
**And** trait discovery animations celebrate new finds
**And** maximum 3 visible traits rule is enforced
**And** 9 epigenetic flags are tracked and displayed
**And** development window (0-3 years) progress shown

**Prerequisites:** Epic 3, Story 6.4

**Technical Notes:**
- Trait cards with states: hidden, hinted, discovered
- Flag badges for epigenetic status
- Age-based trait lock visualization

---

## Epic 7: Groom System

**Goal:** Enable users to hire grooms, manage their careers, and leverage their abilities for horse development.

**Priority:** Mixed (P0 core, P1/P2 advanced features)

**Technical Context:**
- Groom hiring with personality types
- Task system varies by horse age
- Career lifecycle with retirement
- Talent tree: 3 tiers, 24 talents
- Legacy system for protégé generation
- Ultra-rare trait influence via perks

**FRs Covered:** FR-G1, FR-G2, FR-G3, FR-G4, FR-G5, FR-G6, FR-G7, FR-R1, FR-R2, FR-R3, FR-R4

---

### Story 7.1: Groom Hiring Interface (P0)

As a **player**,
I want to **hire grooms for my stable**,
So that **I can improve horse care and training**.

**Acceptance Criteria:**

**Given** I am on the groom marketplace
**When** I browse available grooms
**Then** I see their stats, personality, and hire cost

**And** I can filter by specialty and price range
**And** personality traits are clearly displayed
**And** hire confirmation shows ongoing costs
**And** hired grooms appear in my stable

**Prerequisites:** Epic 2 (currency)

**Technical Notes:**
- API: `GET /api/v1/grooms/available`
- API: `POST /api/v1/grooms/hire`
- Existing groom components - enhance

---

### Story 7.2: Groom Personality Display (P0)

As a **player**,
I want to **understand my groom's personality and its effects**,
So that **I can assign them to compatible horses**.

**Acceptance Criteria:**

**Given** I am viewing a groom's profile
**When** I view personality section
**Then** I see personality type and trait influences

**And** personality affects specific horse traits
**And** compatibility with horse personalities shown
**And** effectiveness ratings displayed
**And** personality develops over career

**Prerequisites:** Story 7.1

**Technical Notes:**
- Personality type icons and descriptions
- Compatibility matrix visualization
- Tooltip explanations

---

### Story 7.3: Task Assignment UI (P0)

As a **player**,
I want to **assign grooms to specific tasks**,
So that **my horses receive appropriate care**.

**Acceptance Criteria:**

**Given** I have hired grooms and horses
**When** I assign tasks
**Then** grooms are assigned and begin work

**And** tasks vary by horse age (foal enrichment, adult grooming)
**And** task duration and effects are displayed
**And** I can reassign grooms as needed
**And** task completion notifications

**Prerequisites:** Stories 7.1, 7.2

**Technical Notes:**
- API: `POST /api/v1/grooms/:id/assign`
- Drag-and-drop assignment UI
- Task queue visualization

---

### Story 7.4: Career Lifecycle Dashboard (P1)

As a **player**,
I want to **track my groom's career progression**,
So that **I can plan for retirement and succession**.

**Acceptance Criteria:**

**Given** I am viewing groom management
**When** I view career status
**Then** I see experience, level, and retirement timeline

**And** career milestones are tracked
**And** retirement age and benefits displayed
**And** performance history shown
**And** warnings for approaching retirement

**Prerequisites:** Story 7.3

**Technical Notes:**
- Career timeline component
- XP progress visualization
- Retirement countdown

---

### Story 7.5: Legacy System UI (P2)

As a **player**,
I want to **manage groom legacy and protégés**,
So that **experienced grooms can train successors**.

**Acceptance Criteria:**

**Given** I have a senior groom
**When** they mentor a new groom
**Then** skills and traits transfer to the protégé

**And** legacy trees show lineage
**And** trait inheritance preview
**And** mentorship period displayed
**And** bonus effectiveness for legacy grooms

**Prerequisites:** Story 7.4

**Technical Notes:**
- API: `POST /api/v1/grooms/:id/mentor`
- Family tree visualization
- Trait transfer previews

---

### Story 7.6: Talent Tree Visualization (P2)

As a **player**,
I want to **develop my groom's talents**,
So that **they gain specialized abilities**.

**Acceptance Criteria:**

**Given** I am viewing groom development
**When** I open the talent tree
**Then** I see all 24 talents across 3 tiers

**And** available talents are highlighted
**And** talent effects are clearly explained
**And** unlock requirements shown
**And** talent point allocation is saved

**Prerequisites:** Story 7.4

**Technical Notes:**
- Interactive talent tree component
- API: `POST /api/v1/grooms/:id/talents`
- Prerequisite visualization

---

### Story 7.7: Show Handling & Rare Traits (P1)

As a **player**,
I want to **use grooms for conformation show handling and discover rare traits**,
So that **I can maximize show performance and find unique abilities**.

**Acceptance Criteria:**

**Given** I am entering a conformation show
**When** I assign a groom as handler
**Then** their handling skills affect show results

**And** groom perks influence rare trait discovery
**And** ultra-rare traits (<3% chance) can appear
**And** exotic traits require specific conditions
**And** discovery system tracks all found traits

**Prerequisites:** Stories 7.3, Epic 6

**Technical Notes:**
- Handler assignment in show entry
- Trait discovery notifications
- Rare trait collection tracking

---

## FR Coverage Matrix

| Epic | Stories | P0 FRs | P1 FRs | P2 FRs | Coverage |
|------|---------|--------|--------|--------|----------|
| Epic 1: Authentication | 6 | FR-U1, FR-U2, FR-U3, FR-U4 | - | - | 100% |
| Epic 2: Dashboard | 5 | FR-U6, FR-U7, FR-U8 | FR-U5 | - | 100% |
| Epic 3: Horses | 6 | FR-H1, FR-H2, FR-H3 | FR-H4, FR-H5 | - | 100% |
| Epic 4: Training | 5 | FR-T1, FR-T2, FR-T3, FR-T4 | FR-T5 | - | 100% |
| Epic 5: Competition | 5 | FR-C1, FR-C2, FR-C3, FR-C4 | FR-C5 | - | 100% |
| Epic 6: Breeding | 6 | FR-B1, FR-B2, FR-B3, FR-B4, FR-E1-E5 | FR-B5 | - | 100% |
| Epic 7: Grooms | 7 | FR-G1, FR-G2, FR-G3 | FR-G4, FR-G7, FR-R1, FR-R2, FR-R4 | FR-G5, FR-G6, FR-R3 | 100% |

**Total Coverage:** 44/44 FRs (100%)

---

## Summary

### Epic Breakdown Statistics

| Metric | Value |
|--------|-------|
| **Total Epics** | 7 |
| **Total Stories** | 40 |
| **P0 Stories** | 28 |
| **P1 Stories** | 9 |
| **P2 Stories** | 3 |
| **FR Coverage** | 44/44 (100%) |

### Implementation Sequence (Recommended)

1. **Epic 1: Authentication** (BLOCKING) - Must be first
2. **Epic 2: Dashboard** - Foundation for user experience
3. **Epic 3: Horses** - Core entity management
4. **Epic 4: Training** - Primary gameplay loop
5. **Epic 5: Competition** - Rewards and progression
6. **Epic 6: Breeding** - Advanced gameplay
7. **Epic 7: Grooms** - Enhancement features

### Effort Estimation

| Epic | Story Count | Estimated Effort |
|------|-------------|------------------|
| Epic 1 | 6 | 3-4 days |
| Epic 2 | 5 | 2-3 days |
| Epic 3 | 6 | 3-4 days |
| Epic 4 | 5 | 2-3 days |
| Epic 5 | 5 | 2-3 days |
| Epic 6 | 6 | 4-5 days |
| Epic 7 | 7 | 4-5 days |
| **Total** | **40** | **20-27 days** |

### Dependencies

```
Epic 1 ──► Epic 2 ──► Epic 3 ──► Epic 4 ──► Epic 5
                          │
                          └──► Epic 6 ──► Epic 7
```

---

_For implementation: Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown._

_This document will be updated after UX Design completion to incorporate interaction details and visual specifications._
