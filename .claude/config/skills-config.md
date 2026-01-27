# Skills Configuration

**Last Updated:** 2025-01-18
**Purpose:** Core competencies and technical skills for Equoria development

---

## Core Skills

### 1. React Frontend Development

**Level:** Expert
**Priority:** CRITICAL (for current frontend completion phase)

**Includes:**

- Component architecture (functional components, hooks)
- Hook patterns (useState, useEffect, useContext, custom hooks)
- Performance optimization (React.memo, useMemo, useCallback)
- Browser game UI patterns (text/graphics based interfaces)
- React 19+ features
- TypeScript integration
- Tailwind CSS styling

**Application:**

- Building browser game interfaces
- Creating reusable component libraries
- Implementing responsive layouts
- Managing component state effectively

**Current Status:** ~60% of frontend complete, 19 major components built

---

### 2. Node.js Backend Development

**Level:** Expert
**Priority:** Low (backend 100% complete)

**Includes:**

- Express.js middleware development
- Async patterns (async/await, promises)
- Error handling strategies
- Security best practices
- RESTful API design
- ES Modules (.mjs)

**Application:**

- API endpoint development (130+ endpoints complete)
- Backend service architecture
- Authentication/authorization
- Request/response handling

**Current Status:** Backend 100% production-ready

---

### 3. PostgreSQL & Prisma

**Level:** Expert
**Priority:** Low (database 100% complete)

**Includes:**

- Schema design (30+ tables)
- Query optimization
- JSONB usage for flexible game data
- Migration management
- Prisma ORM best practices
- Database indexing strategies

**Application:**

- Complex query optimization
- Schema evolution
- Data modeling for game systems
- Performance tuning

**Current Status:** Database schema 100% complete with strategic indexing

---

### 4. Testing & QA

**Level:** Expert
**Priority:** High (continuous testing required)

**Includes:**

- Jest unit testing (backend)
- Vitest + React Testing Library (frontend)
- Integration testing patterns
- E2E testing with Playwright
- Performance testing
- Test-Driven Development (TDD)
- Balanced mocking philosophy

**Application:**

- Writing tests before implementation (TDD)
- Achieving 80%+ test coverage
- Integration testing across systems
- E2E user journey testing

**Current Status:**

- Backend: 468+ tests (90.1% success rate)
- Frontend: 115+ tests (~60% complete)

---

### 5. Game Mechanics Design

**Level:** Expert
**Priority:** Medium (systems already designed)

**Includes:**

- Genetics systems (multi-allele inheritance)
- Epigenetics and trait systems
- Progression mechanics (training, leveling)
- Balance tuning
- Reward systems

**Application:**

- Implementing genetic algorithms
- Balancing competition scoring
- Designing training progressions
- Creating reward mechanisms

**Current Status:** All game systems designed and implemented in backend

---

## Specialized Skills

### TypeScript Strict Mode

**Level:** Expert
**Priority:** CRITICAL

**Key Practices:**

- Zero `any` types tolerated
- Explicit types for all functions
- Proper null/undefined handling
- Type-safe API contracts
- Generics for reusable code

---

### Browser Game UI/UX

**Level:** Expert
**Priority:** CRITICAL (for frontend completion)

**Key Practices:**

- Old-school text/graphics interfaces
- Tabular data presentation
- Form-heavy interfaces
- Progressive enhancement
- Accessibility (WCAG 2.1 AA)

---

### React Query State Management

**Level:** Expert
**Priority:** CRITICAL (for frontend)

**Key Practices:**

- API state management
- Caching strategies
- Optimistic updates
- Background refetching
- Error handling

---

### Performance Optimization

**Level:** Expert
**Priority:** High

**Key Practices:**

- Bundle size optimization
- Code splitting
- Lazy loading
- Memoization strategies
- Database query optimization
- API response time optimization

---

## Skill Development Priorities

### Immediate Focus (Next 23-30 hours)

**High Priority:**

1. **React Frontend Development** - Complete remaining 40% of browser game UI
2. **Testing & QA** - Maintain TDD approach, create tests first
3. **TypeScript Strict Mode** - Zero tolerance for type errors
4. **Browser Game UI/UX** - Old-school text/graphics interfaces

**Medium Priority:** 5. **React Query State Management** - API integration with backend 6. **Performance Optimization** - Lighthouse scores, Core Web Vitals

**Low Priority:**

- Backend skills (already at 100% completion)
- Database skills (schema complete)
- Game mechanics (systems already implemented)

---

## Skill Application Guidelines

### When Building Frontend Components

**Always Apply:**

1. **TypeScript Strict Mode** - Explicit types, no `any`
2. **Testing First** - Write tests before implementation (TDD)
3. **Accessibility** - WCAG 2.1 AA compliance
4. **Performance** - Memoization where appropriate

### When Integrating with Backend

**Always Apply:**

1. **React Query** - For all API calls
2. **Error Handling** - Comprehensive error boundaries
3. **Loading States** - User feedback during async operations
4. **Type Safety** - Backend API contracts match frontend

### When Writing Tests

**Always Apply:**

1. **Balanced Mocking** - Mock only external dependencies
2. **Real Logic Testing** - Test actual implementations
3. **Coverage Goals** - Aim for 80%+ coverage
4. **TDD Workflow** - Red → Green → Refactor

---

## Skill Matrix

| Skill             | Current Level | Priority | Focus Area                             |
| ----------------- | ------------- | -------- | -------------------------------------- |
| React Frontend    | Expert        | CRITICAL | Authentication, Training, Breeding UI  |
| Node.js Backend   | Expert        | Low      | Maintenance only (100% complete)       |
| PostgreSQL/Prisma | Expert        | Low      | Maintenance only (100% complete)       |
| Testing & QA      | Expert        | High     | Frontend TDD, E2E tests                |
| Game Mechanics    | Expert        | Medium   | UI implementation for existing systems |
| TypeScript        | Expert        | CRITICAL | Strict mode, zero errors               |
| Browser Game UI   | Expert        | CRITICAL | Text/graphics interfaces               |
| React Query       | Expert        | CRITICAL | Backend API integration                |
| Performance       | Expert        | High     | Lighthouse optimization                |

---

**Related Documentation:**

- [Agent Configuration](./agents-config.md)
- [MCP Servers](./mcp-servers.md)
- [Testing Guide](../guides/testing-standards.md)
- [Best Practices](../guides/best-practices.md)
