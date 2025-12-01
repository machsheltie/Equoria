# Frontend Architecture Documentation

**Project:** Equoria Browser Game
**Platform:** Web Browser (NOT mobile)
**Status:** ~60% Complete
**Last Updated:** 2025-11-17

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Components Inventory](#components-inventory)
5. [Pages](#pages)
6. [Testing](#testing)
7. [Completion Status](#completion-status)
8. [Development Roadmap](#development-roadmap)
9. [Integration with Backend](#integration-with-backend)

---

## Overview

Equoria is a **web browser-based horse simulation game** inspired by classic late 90s/early 2000s browser games like:
- Horseland
- Ludus Equinus
- Equus Ipsum

**Style:** Old-school text/graphics browser game (NOT a modern single-page app, NOT a mobile app)

**Current Frontend Status:**
- **Location:** `/frontend/` directory
- **Completion:** ~60% (19 components, 2 pages, 115+ tests)
- **Architecture:** React 19 + TypeScript + Tailwind CSS
- **Missing:** Authentication pages, training UI, breeding UI, full API integration

---

## Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.1.0 | UI framework |
| **TypeScript** | 5.3.0 | Type safety |
| **Tailwind CSS** | 4.1.8 | Styling framework |
| **React Router** | 6.20.0 | Client-side routing |
| **React Query** | 5.0.0+ | Server state management |
| **Vite** | Latest | Build tool & dev server |
| **Lucide React** | 0.460.0 | Icon library |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Jest** | Test runner |
| **Testing Library** | Component testing |
| **Playwright** | E2E testing (planned) |
| **ESLint** | Linting |
| **Prettier** | Code formatting |
| **TypeScript** | Static type checking |

### UI Libraries

- **shadcn/ui** components (FantasyButton, FantasyModal, FantasyForm, FantasyTabs)
- Custom fantasy-themed components
- Tailwind CSS utilities

---

## Project Structure

```
frontend/
├── index.html                    # Entry HTML file
├── tailwind.config.ts            # Tailwind configuration
├── jest.setup.js                 # Jest test configuration
│
├── src/
│   ├── main.tsx                  # React app entry point
│   ├── App.tsx                   # Root app component (routing)
│   ├── index.css                 # Global styles
│   ├── nav-items.tsx             # Navigation configuration
│   │
│   ├── pages/                    # Page components (2 files)
│   │   ├── Index.tsx             # Dashboard/home page
│   │   └── StableView.tsx        # Stable management page
│   │
│   ├── components/               # Reusable components (19 files)
│   │   ├── AdvancedEpigeneticDashboard.tsx
│   │   ├── AssignGroomModal.tsx
│   │   ├── CompetitionBrowser.tsx
│   │   ├── EnhancedReportingInterface.tsx
│   │   ├── FantasyButton.tsx
│   │   ├── FantasyForm.tsx
│   │   ├── FantasyModal.tsx
│   │   ├── FantasyTabs.tsx
│   │   ├── FeaturedHorseCard.tsx
│   │   ├── GroomList.tsx
│   │   ├── HorseCard.tsx
│   │   ├── HorseListView.tsx
│   │   ├── MainNavigation.tsx
│   │   ├── MultiHorseComparison.tsx
│   │   ├── MyGroomsDashboard.tsx
│   │   ├── NewsCard.tsx
│   │   ├── Sidebar.tsx
│   │   ├── StatCard.tsx
│   │   └── UserDashboard.tsx
│   │
│   └── components/__tests__/     # Component tests (10 files)
│       ├── AdvancedEpigeneticDashboard.test.tsx
│       ├── AssignGroomModal.test.tsx
│       ├── CompetitionBrowser.test.tsx
│       ├── EnhancedReportingInterface.test.tsx
│       ├── GroomList.test.tsx
│       ├── HorseListView.test.tsx
│       ├── MainNavigation.test.tsx
│       ├── MultiHorseComparison.test.tsx
│       ├── MyGroomsDashboard.test.tsx
│       └── UserDashboard.test.tsx
│
├── components/                   # Legacy/additional components
│   ├── examples/
│   ├── FoalDevelopmentTab.js
│   ├── GroomAssignmentManager.js
│   ├── GroomListScreen.js
│   ├── MyGroomsDashboardScreen.js
│   ├── TraitCompetitionAnalysis.js
│   ├── TraitDiscoveryNotification.js
│   └── WeeklySalaryReminder.js
│
├── hooks/                        # Custom React hooks
│   ├── useGroomManagement.js
│   └── useTraitDiscovery.js
│
├── __mocks__/                    # Jest mocks
├── navigation/                   # (Empty - browser routing handled by React Router)
└── screens/                      # (Empty - pages are in src/pages/)
```

---

## Components Inventory

### Core UI Components (19 Total)

#### 1. **AdvancedEpigeneticDashboard.tsx**
- **Purpose:** Display advanced epigenetic trait information
- **Tests:** ✅ AdvancedEpigeneticDashboard.test.tsx
- **Status:** Implemented
- **Dependencies:** React Query, custom UI components

#### 2. **AssignGroomModal.tsx**
- **Purpose:** Modal for assigning grooms to horses
- **Tests:** ✅ AssignGroomModal.test.tsx
- **Status:** Implemented
- **Dependencies:** FantasyModal, React Query

#### 3. **CompetitionBrowser.tsx**
- **Purpose:** Browse and view available competitions
- **Tests:** ✅ CompetitionBrowser.test.tsx
- **Status:** Implemented
- **Dependencies:** React Query for competition data

#### 4. **EnhancedReportingInterface.tsx**
- **Purpose:** Advanced reporting and analytics UI
- **Tests:** ✅ EnhancedReportingInterface.test.tsx
- **Status:** Implemented
- **Dependencies:** Chart libraries (if applicable)

#### 5-8. **Fantasy UI Components**
- **FantasyButton.tsx** - Themed button component
- **FantasyForm.tsx** - Form wrapper with fantasy styling
- **FantasyModal.tsx** - Modal dialog component
- **FantasyTabs.tsx** - Tab navigation component
- **Purpose:** Consistent fantasy-themed UI primitives
- **Tests:** Not tested individually (covered by integration tests)
- **Status:** Implemented

#### 9. **FeaturedHorseCard.tsx**
- **Purpose:** Display featured horse with stats
- **Status:** Implemented
- **Used In:** Dashboard (Index page)

#### 10. **GroomList.tsx**
- **Purpose:** List all available grooms
- **Tests:** ✅ GroomList.test.tsx
- **Status:** Implemented
- **Dependencies:** React Query for groom data

#### 11. **HorseCard.tsx**
- **Purpose:** Display individual horse information card
- **Status:** Implemented
- **Used In:** Horse list views, stable view

#### 12. **HorseListView.tsx**
- **Purpose:** List view of all user's horses
- **Tests:** ✅ HorseListView.test.tsx
- **Status:** Implemented
- **Dependencies:** HorseCard, React Query

#### 13. **MainNavigation.tsx**
- **Purpose:** Main navigation header/menu
- **Tests:** ✅ MainNavigation.test.tsx
- **Status:** Implemented
- **Dependencies:** React Router

#### 14. **MultiHorseComparison.tsx**
- **Purpose:** Compare stats/traits between multiple horses
- **Tests:** ✅ MultiHorseComparison.test.tsx
- **Status:** Implemented
- **Dependencies:** React Query

#### 15. **MyGroomsDashboard.tsx**
- **Purpose:** Dashboard view of user's hired grooms
- **Tests:** ✅ MyGroomsDashboard.test.tsx
- **Status:** Implemented
- **Dependencies:** React Query, GroomList

#### 16. **NewsCard.tsx**
- **Purpose:** Display news/announcement cards
- **Status:** Implemented
- **Used In:** Dashboard (Index page)

#### 17. **Sidebar.tsx**
- **Purpose:** Navigation sidebar
- **Status:** Implemented
- **Used In:** Main layout

#### 18. **StatCard.tsx**
- **Purpose:** Display stat cards (coins, level, etc.)
- **Status:** Implemented
- **Used In:** Dashboard (Index page)

#### 19. **UserDashboard.tsx**
- **Purpose:** User profile/account dashboard
- **Tests:** ✅ UserDashboard.test.tsx
- **Status:** Implemented
- **Dependencies:** React Query for user data

---

## Pages

### 1. Index.tsx (Dashboard/Home Page)
**Route:** `/`
**Purpose:** Main dashboard and entry point
**Status:** ✅ Implemented (~90% complete)

**Features:**
- User stats display (coins, level, trophies)
- Featured horse cards
- News feed
- Quick action buttons
- Sidebar navigation

**Components Used:**
- Sidebar
- StatCard
- FeaturedHorseCard
- NewsCard
- FantasyButton
- MainNavigation

**Missing:**
- Authentication check/redirect
- API integration for real-time stats
- User session management

---

### 2. StableView.tsx (Stable Management)
**Route:** `/stable`
**Purpose:** Manage horses in user's stable
**Status:** ✅ Implemented (~80% complete)

**Features:**
- Horse list display
- Horse filtering/sorting
- Groom assignment
- Horse comparison tools

**Components Used:**
- HorseListView
- HorseCard
- AssignGroomModal
- MultiHorseComparison
- GroomList

**Missing:**
- Full API integration
- Real-time updates
- Advanced filtering

---

## Testing

### Test Coverage

**Current Status:**
- **Test Files:** 10 test files
- **Tests:** 115+ tests (estimated)
- **Coverage Target:** 80%+
- **Framework:** Jest + React Testing Library

### Test Files

1. `AdvancedEpigeneticDashboard.test.tsx`
2. `AssignGroomModal.test.tsx`
3. `CompetitionBrowser.test.tsx`
4. `EnhancedReportingInterface.test.tsx`
5. `GroomList.test.tsx`
6. `HorseListView.test.tsx`
7. `MainNavigation.test.tsx`
8. `MultiHorseComparison.test.tsx`
9. `MyGroomsDashboard.test.tsx`
10. `UserDashboard.test.tsx`

### Testing Strategy

**Component Tests:**
- React Testing Library for user-centric tests
- Test user interactions (clicks, form inputs)
- Test data display and transformations
- Mock React Query hooks

**Integration Tests:**
- Test routing between pages
- Test form submissions
- Test API integration (with MSW mocks)

**E2E Tests (Planned):**
- Playwright for critical user journeys
- Authentication flow
- Horse management workflow
- Competition entry workflow

---

## Completion Status

### ✅ Completed Features (~60%)

**Core UI Components:** 19/19 implemented
- Dashboard components (StatCard, NewsCard, FeaturedHorseCard)
- Horse management (HorseCard, HorseListView, MultiHorseComparison)
- Groom system (GroomList, MyGroomsDashboard, AssignGroomModal)
- Competition system (CompetitionBrowser)
- Epigenetic system (AdvancedEpigeneticDashboard)
- Navigation (MainNavigation, Sidebar)
- Fantasy UI primitives (Button, Form, Modal, Tabs)

**Pages:** 2/8+ implemented
- ✅ Dashboard (Index.tsx)
- ✅ Stable View (StableView.tsx)

**Routing:** React Router v6 configured

**State Management:** React Query configured

**Styling:** Tailwind CSS 4.1 configured with fantasy theme

**Testing:** 10 test files, 115+ tests

---

### ⚠️ In Progress / Missing (~40%)

#### 1. Authentication System (NOT STARTED)
**Priority:** CRITICAL
**Time Estimate:** 8-10 hours

**Missing Components:**
- Login page
- Registration page
- Password reset page
- Protected route wrapper
- Authentication state management
- Session persistence

**Backend Integration:**
- POST /auth/login
- POST /auth/register
- POST /auth/forgot-password
- POST /auth/logout
- GET /auth/me

---

#### 2. Training System UI (NOT STARTED)
**Priority:** HIGH
**Time Estimate:** 8-10 hours

**Missing Components:**
- Training session interface
- Training schedule management
- Progress tracking UI
- Training history view

**Backend Integration:**
- POST /training/start
- GET /training/active
- GET /training/history
- PUT /training/:id/update

---

#### 3. Breeding System UI (NOT STARTED)
**Priority:** HIGH
**Time Estimate:** 8-10 hours

**Missing Components:**
- Horse pairing interface
- Breeding compatibility checker
- Offspring preview/prediction
- Breeding records view

**Backend Integration:**
- POST /breeding/pair
- GET /breeding/compatibility
- GET /breeding/records
- GET /breeding/offspring/:id

---

#### 4. Full API Integration (PARTIALLY COMPLETE)
**Priority:** CRITICAL
**Time Estimate:** 12-15 hours

**Current Status:**
- React Query configured ✅
- Mock data in components ⚠️
- API client not implemented ❌

**Required Work:**
- Create API client wrapper
- Implement all React Query hooks
- Connect components to real backend
- Error handling and loading states
- Token refresh mechanism

**Backend Endpoints to Integrate:** 130+ endpoints
- Authentication (5 endpoints)
- Horse management (20+ endpoints)
- Groom system (15+ endpoints)
- Training system (12+ endpoints)
- Breeding system (10+ endpoints)
- Competition system (15+ endpoints)
- Epigenetic system (8+ endpoints)
- User management (10+ endpoints)

---

#### 5. Additional Pages (NOT STARTED)
**Priority:** MEDIUM
**Time Estimate:** 10-12 hours

**Missing Pages:**
- Competition entry page
- Competition results page
- Training session page
- Breeding pairing page
- User profile page
- Settings page

---

## Development Roadmap

### Phase 1: Authentication (8-10 hours)
**Priority:** CRITICAL - BLOCKS PRODUCTION

1. **Create Authentication Pages (4-5 hours)**
   - Login page with form validation
   - Registration page with email/password
   - Password reset flow
   - Form components (email input, password input, submit button)

2. **Authentication State Management (2-3 hours)**
   - React Query mutations for auth endpoints
   - Token storage (localStorage/sessionStorage)
   - Protected route wrapper component
   - Redirect logic (unauthenticated → login, authenticated → dashboard)

3. **Backend Integration (2 hours)**
   - POST /auth/login
   - POST /auth/register
   - POST /auth/forgot-password
   - GET /auth/me

4. **Testing (1 hour)**
   - Login flow tests
   - Registration flow tests
   - Protected route tests

**Deliverables:**
- 3 authentication pages
- Authentication state management
- Protected routes
- 15-20 new tests

---

### Phase 2: API Integration (12-15 hours)
**Priority:** CRITICAL - BLOCKS FULL FUNCTIONALITY

1. **API Client Setup (3-4 hours)**
   - Create axios/fetch wrapper
   - Configure base URL and headers
   - Token interceptors
   - Error handling middleware

2. **React Query Hooks (6-8 hours)**
   - Horse management hooks (useHorses, useHorse, useMutateHorse)
   - Groom system hooks (useGrooms, useAssignGroom)
   - Competition hooks (useCompetitions, useEnterCompetition)
   - Training hooks (useTrainingSessions, useStartTraining)
   - Breeding hooks (useBreedingPairs, useBreed)
   - User hooks (useUser, useUpdateProfile)

3. **Component Integration (3-4 hours)**
   - Replace mock data with real API calls
   - Add loading states
   - Add error handling
   - Add optimistic updates

**Deliverables:**
- API client wrapper
- 30+ React Query hooks
- All components connected to backend
- Error boundaries

---

### Phase 3: Training UI (8-10 hours)
**Priority:** HIGH

1. **Training Session Interface (4-5 hours)**
   - Active training display
   - Training progress bar
   - Training controls (start, pause, stop)
   - Training stats display

2. **Training Management (3-4 hours)**
   - Training schedule interface
   - Training history view
   - Training type selection

3. **Backend Integration (1 hour)**
   - POST /training/start
   - GET /training/active
   - GET /training/history

**Deliverables:**
- 3-4 training components
- Training session page
- 10-15 new tests

---

### Phase 4: Breeding UI (8-10 hours)
**Priority:** HIGH

1. **Breeding Interface (4-5 hours)**
   - Horse pairing selection
   - Compatibility display
   - Offspring prediction
   - Breeding confirmation modal

2. **Breeding Records (2-3 hours)**
   - Breeding history view
   - Offspring tracking
   - Lineage display

3. **Backend Integration (1 hour)**
   - POST /breeding/pair
   - GET /breeding/compatibility
   - GET /breeding/records

**Deliverables:**
- 3-4 breeding components
- Breeding page
- 10-15 new tests

---

### Phase 5: Additional Pages (10-12 hours)
**Priority:** MEDIUM

1. **Competition Pages (4-5 hours)**
   - Competition entry page
   - Competition results page
   - Competition history

2. **User Profile (3-4 hours)**
   - Profile view page
   - Profile edit page
   - Settings page

3. **Backend Integration (2-3 hours)**
   - GET /competitions/:id
   - POST /competitions/:id/enter
   - GET /user/profile
   - PUT /user/profile

**Deliverables:**
- 6+ new pages
- User settings
- 15-20 new tests

---

### Phase 6: Polish & Optimization (6-8 hours)
**Priority:** LOW

1. **Performance Optimization (2-3 hours)**
   - Code splitting
   - Lazy loading
   - Image optimization
   - Bundle size analysis

2. **Accessibility (2-3 hours)**
   - WCAG 2.1 AA compliance
   - Keyboard navigation
   - Screen reader support
   - Focus management

3. **E2E Testing (2-3 hours)**
   - Playwright setup
   - Critical path E2E tests
   - CI/CD integration

**Deliverables:**
- Optimized bundle
- Accessibility compliance
- 10+ E2E tests

---

## Integration with Backend

### Backend API Overview

**Location:** `/backend/`
**Status:** 100% Production-Ready
**Tests:** 468+ tests (90.1% success rate)
**Endpoints:** 130+ fully documented

### Backend Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL 14+ with Prisma ORM
- **Authentication:** JWT tokens
- **Testing:** Jest + Supertest

### API Endpoints Summary

**Authentication (5 endpoints):**
- POST /auth/login
- POST /auth/register
- POST /auth/logout
- POST /auth/forgot-password
- GET /auth/me

**Horse Management (20+ endpoints):**
- GET /horses (list all user's horses)
- GET /horses/:id (get horse details)
- POST /horses (create new horse)
- PUT /horses/:id (update horse)
- DELETE /horses/:id (delete horse)
- GET /horses/:id/traits (get horse traits)
- GET /horses/:id/stats (get horse stats)
- POST /horses/:id/train (start training)
- GET /horses/:id/training (get training status)
- + 11 more endpoints

**Groom System (15+ endpoints):**
- GET /grooms (list available grooms)
- GET /grooms/:id (get groom details)
- POST /grooms/hire (hire new groom)
- PUT /grooms/:id/assign (assign to horse)
- DELETE /grooms/:id/fire (fire groom)
- GET /grooms/:id/stats (get groom stats)
- + 9 more endpoints

**Competition System (15+ endpoints):**
- GET /competitions (list competitions)
- GET /competitions/:id (get competition details)
- POST /competitions/:id/enter (enter competition)
- GET /competitions/:id/results (get results)
- + 11 more endpoints

**Training System (12+ endpoints):**
- POST /training/start (start training session)
- GET /training/active (get active session)
- PUT /training/:id/update (update session)
- GET /training/history (get training history)
- + 8 more endpoints

**Breeding System (10+ endpoints):**
- POST /breeding/pair (breed two horses)
- GET /breeding/compatibility (check compatibility)
- GET /breeding/records (get breeding history)
- GET /breeding/offspring/:id (get offspring details)
- + 6 more endpoints

**Epigenetic System (8+ endpoints):**
- GET /epigenetics/traits (list traits)
- GET /epigenetics/modifiers (list modifiers)
- POST /epigenetics/discover (discover new trait)
- + 5 more endpoints

**For detailed API documentation, see:**
- `.claude/docs/api/backend-overview.md`
- `.claude/docs/api/controllers-layer.md`
- `.claude/docs/api/routes-layer.md`

---

## Best Practices

### Component Development

1. **TypeScript Strict Mode:** Always enabled
2. **Functional Components:** Use React.FC with explicit props interface
3. **Hooks:** Custom hooks in `/hooks/` directory
4. **Styling:** Tailwind CSS utilities, avoid inline styles
5. **Props:** Destructure props, provide default values

### State Management

1. **Server State:** React Query for all API data
2. **Client State:** React useState/useReducer for UI state
3. **Global State:** React Context (if needed)
4. **Form State:** React Hook Form or controlled components

### Testing

1. **User-Centric:** Test user behavior, not implementation
2. **Coverage Target:** 80%+ per component
3. **Mock API:** Use MSW for API mocking
4. **Accessibility:** Test with screen reader queries

### Performance

1. **Code Splitting:** Lazy load routes and heavy components
2. **Memoization:** Use React.memo, useMemo, useCallback judiciously
3. **Image Optimization:** Use WebP, lazy loading
4. **Bundle Analysis:** Monitor bundle size

---

## Getting Started

### Development Commands

```bash
# Install dependencies (from root)
npm install

# Run frontend dev server
cd frontend
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Preview production build
npm run preview

# Lint and format
npm run lint
npm run format
```

### Environment Variables

Create `.env` file in `/frontend/`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=Equoria
```

---

## Related Documentation

- **Backend Architecture:** `.claude/docs/api/backend-overview.md`
- **Backend Controllers:** `.claude/docs/api/controllers-layer.md`
- **Game Systems:** `.claude/docs/systems/`
- **Project Requirements:** `.claude/docs/PRODUCT_REQUIREMENTS_DOCUMENT.md`
- **Tech Stack:** `.claude/docs/TECH_STACK_DOCUMENTATION.md`

---

**Last Updated:** 2025-11-17
**Maintained By:** Development Team
**Status:** Living Document (update as frontend evolves)
