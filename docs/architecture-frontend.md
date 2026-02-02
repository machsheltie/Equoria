# Equoria Frontend Architecture

**Generated:** 2025-12-01
**Framework:** React 19
**Build Tool:** Vite 5.2
**Styling:** TailwindCSS 3.4

## Integration Points (Training/Breeding/Auth)
- Modules impacted: extend `frontend/src/lib/api-client.ts` (credentialed fetch with refresh) and add React Query hooks under `frontend/src/hooks/api/` (`useAuth`, `useTraining`, `useBreeding`, `useHorses`) that components consume.
- Components: new feature folders `frontend/src/components/training/` (dashboard, session modal, history) and `frontend/src/components/breeding/` (center, pair selector, foal tracker) mounted from route shells in `frontend/src/pages/`.
- APIs/services: training endpoints (`/api/training/check-eligibility`, `/train`, `/status/:horseId/:discipline`, `/horse/:horseId/all-status`, `/trainable-horses/:userId`); breeding/foal endpoints (`/api/foals/breeding/breed`, `/foals/:id`, `/foals/:id/development`, `/foals/:id/activity`, `/foals/:id/activities`, `/foals/:id/enrich`, `/foals/:id/traits`, `/foals/:id/reveal-traits`, `/foals/:id/develop`); auth endpoints under `/api/auth/*` with HttpOnly cookies.
- Data flow: `api-client` → React Query hooks (typed queries/mutations, cache keys like `['training', horseId]`, `['breeding', 'pairs']`, `['foals', foalId]`, `['horses']`) → feature components. Mutations invalidate relevant keys; errors bubble to UI toasts or inline states; loading via shared skeletons/spinners.
- Interop: navigation remains in `App.tsx`/router; shared UI primitives in `components/ui/` reused by new training/breeding/auth surfaces to keep consistent styling.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VITE DEV SERVER                                 │
│                           Hot Module Replacement                             │
│                           Port 3000 → Proxy /api → 3001                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REACT 19 APP                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         App.tsx (Root)                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                      │                                       │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                      ROUTING (react-router-dom)                       │  │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────────────────────┐  │  │
│  │  │  Index  │  │  Stable │  │  Grooms  │  │  Component Routes      │  │  │
│  │  │  Page   │  │  View   │  │Dashboard │  │  (modals, panels)      │  │  │
│  │  └─────────┘  └─────────┘  └──────────┘  └────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         COMPONENT LAYER                               │  │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐  │  │
│  │  │ Feature Components   │  │ UI Primitives (Radix-based)          │  │  │
│  │  │ UserDashboard        │  │ dialog, tabs, tooltip, card,         │  │  │
│  │  │ HorseListView        │  │ button, input, select, dropdown      │  │  │
│  │  │ MyGroomsDashboard    │  │                                      │  │  │
│  │  │ CompetitionBrowser   │  │                                      │  │  │
│  │  └──────────────────────┘  └──────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                       │
│  ┌───────────────────────────────────┴───────────────────────────────────┐  │
│  │                         STATE MANAGEMENT                              │  │
│  │  ┌──────────────────┐  ┌──────────────────────────────────────────┐  │  │
│  │  │ React Query      │  │ React Hooks (useState, useEffect, etc.)  │  │  │
│  │  │ Server State     │  │ Local Component State                    │  │  │
│  │  └──────────────────┘  └──────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
frontend/src/
├── components/
│   ├── ui/                    # Radix UI primitives
│   │   ├── dialog.tsx
│   │   ├── tabs.tsx
│   │   ├── tooltip.tsx
│   │   ├── card.tsx
│   │   ├── button.tsx
│   │   └── ...
│   ├── __tests__/            # Component tests
│   ├── UserDashboard.tsx     # Main user interface
│   ├── HorseListView.tsx     # Horse management
│   ├── MyGroomsDashboard.tsx # Groom management
│   ├── CompetitionBrowser.tsx # Competition interface
│   ├── MultiHorseComparison.tsx # Horse comparison tool
│   ├── MainNavigation.tsx    # App navigation
│   └── ...
├── pages/
│   ├── Index.tsx             # Landing page
│   └── StableView.tsx        # Stable management
├── hooks/
│   └── useAuth.tsx           # Authentication hook
├── lib/
│   └── utils.ts              # Utility functions
├── App.tsx                   # Root component
└── main.tsx                  # Entry point
```

## Feature Components

### UserDashboard.tsx (17.9 KB)
Primary user interface displaying:
- User stats and progress
- Recent activity
- Quick actions
- Notifications

### HorseListView.tsx (21.8 KB)
Horse management interface:
- Horse inventory grid/list view
- Filtering and sorting
- Quick stats preview
- Action buttons (train, breed, sell)

### MyGroomsDashboard.tsx (17.2 KB)
Groom management interface:
- Groom roster
- Performance metrics
- Assignment management
- Salary/payment tracking

### CompetitionBrowser.tsx (14.9 KB)
Competition discovery and entry:
- Available shows listing
- Entry requirements
- Prize information
- Registration flow

### MultiHorseComparison.tsx (29.8 KB)
Horse comparison tool:
- Side-by-side stats comparison
- Trait analysis
- Breeding compatibility
- Performance history

### EnhancedReportingInterface.tsx (35.2 KB)
Advanced reporting and analytics:
- Performance charts
- Trend analysis
- Export functionality
- Custom report builder

## UI Component Library

Based on **Radix UI** primitives with **TailwindCSS** styling.

### Available Primitives

| Component | File | Purpose |
|-----------|------|---------|
| Dialog | `ui/dialog.tsx` | Modal dialogs |
| Tabs | `ui/tabs.tsx` | Tab navigation |
| Tooltip | `ui/tooltip.tsx` | Hover tooltips |
| Card | `ui/card.tsx` | Content containers |
| Button | `ui/button.tsx` | Action buttons |
| Input | `ui/input.tsx` | Form inputs |
| Select | `ui/select.tsx` | Dropdown selects |
| DropdownMenu | `ui/dropdown-menu.tsx` | Context menus |

### Fantasy-Themed Components

| Component | Size | Purpose |
|-----------|------|---------|
| FantasyButton | 2.3 KB | Styled action buttons |
| FantasyForm | 8.8 KB | Themed form wrapper |
| FantasyModal | 5.6 KB | Styled modal dialogs |
| FantasyTabs | 7.6 KB | Themed tab navigation |

### Display Components

| Component | Size | Purpose |
|-----------|------|---------|
| HorseCard | 6.7 KB | Horse preview card |
| FeaturedHorseCard | 3.2 KB | Highlighted horse display |
| StatCard | 2.0 KB | Statistics display |
| NewsCard | 3.1 KB | News/update cards |
| Sidebar | 3.5 KB | Navigation sidebar |

## Routing Configuration

**Library:** react-router-dom

```typescript
// Main routes
const routes = [
  { path: '/', element: <Index /> },
  { path: '/stable', element: <StableView /> },
  // Additional routes...
];
```

## State Management

### React Query
Server state management for:
- API data fetching
- Caching and invalidation
- Optimistic updates
- Background refetching

### Local State
React hooks for component state:
- `useState` for UI state
- `useEffect` for side effects
- Custom hooks for shared logic

## Styling Architecture

### TailwindCSS Configuration

**File:** `frontend/tailwind.config.ts`

```typescript
// Custom theme extensions for Equoria
// - Fantasy color palette
// - Custom spacing
// - Animation presets
```

### CSS Organization

- Utility-first approach
- Component-scoped styles
- Dark mode support (planned)

## Build Configuration

### Vite Configuration

**File:** `frontend/vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
```

### TypeScript Configuration

**File:** `frontend/tsconfig.json`

- Strict mode enabled
- Path aliases configured
- React JSX transform

## API Integration

### Proxy Configuration
Development server proxies `/api/*` requests to backend:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

### Authentication Hook

**File:** `frontend/src/hooks/useAuth.tsx`

```typescript
// Provides:
// - Login/logout functions
// - Current user state
// - Token management
// - Auth status
```

## Component Patterns

### Container/Presentational Pattern
- Container components handle data fetching
- Presentational components handle rendering
- Clear separation of concerns

### Composition Pattern
- Compound components for complex UIs
- Render props where needed
- Custom hooks for reusable logic

## Performance Considerations

### Code Splitting
- Route-based code splitting
- Dynamic imports for heavy components
- Lazy loading for modals

### Optimization
- React.memo for expensive renders
- useMemo/useCallback for computed values
- Virtual scrolling for large lists (planned)

## Testing

### Framework
- Jest + React Testing Library
- Component unit tests
- Integration tests

### Coverage
- 15+ test files
- Component rendering tests
- User interaction tests
