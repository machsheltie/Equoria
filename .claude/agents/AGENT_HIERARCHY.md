# Equoria Agent Hierarchy

**Version:** 2.0.0
**Last Updated:** 2026-01-27
**Purpose:** Comprehensive agent/subagent system with MCP integration and skills

---

## 🎯 Agent Philosophy

**Goal:** Specialized agents that automatically invoke relevant skills and MCPs
**Method:** Context-aware agent selection with minimal manual intervention
**Benefit:** Efficient task execution with expert-level domain knowledge

---

## 🏗️ Agent Hierarchy

```
Root Orchestrator
├── Backend Development Branch
│   ├── Backend Architect (Primary)
│   │   ├── API Designer (Sub-agent)
│   │   ├── Database Optimizer (Sub-agent)
│   │   └── Security Auditor (Sub-agent)
│   └── Game Systems Specialist (Primary)
│       ├── Breeding Specialist (Sub-agent)
│       ├── Training Specialist (Sub-agent)
│       ├── Groom Specialist (Sub-agent)
│       └── Trait Specialist (Sub-agent)
│
├── Frontend Development Branch
│   ├── Frontend Architect (Primary)
│   │   ├── React Component Builder (Sub-agent)
│   │   ├── State Manager (Sub-agent)
│   │   └── UI/UX Validator (Sub-agent)
│   └── Browser Game Designer (Primary)
│       ├── Authentication UI Specialist (Sub-agent)
│       ├── Game UI Specialist (Sub-agent)
│       └── Performance Optimizer (Sub-agent)
│
├── Testing & Quality Branch
│   ├── Test Architect (Primary)
│   │   ├── Unit Test Specialist (Sub-agent)
│   │   ├── Integration Test Specialist (Sub-agent)
│   │   └── E2E Test Specialist (Sub-agent)
│   └── Code Quality Guardian (Primary)
│       ├── Linter (Sub-agent)
│       ├── Type Checker (Sub-agent)
│       └── Security Scanner (Sub-agent)
│
├── Database Branch
│   ├── Database Architect (Primary)
│   │   ├── Schema Designer (Sub-agent)
│   │   ├── Query Optimizer (Sub-agent)
│   │   └── Migration Manager (Sub-agent)
│   └── Data Integrity Validator (Primary)
│
└── Documentation Branch
    ├── Technical Writer (Primary)
    │   ├── API Documenter (Sub-agent)
    │   ├── System Documenter (Sub-agent)
    │   └── Guide Writer (Sub-agent)
    └── Knowledge Manager (Primary)
        ├── Skill Creator (Sub-agent)
        └── Context Organizer (Sub-agent)
```

---

## 📋 Agent Definitions

### Backend Development Branch

#### 1. Backend Architect (Primary Agent)

**Role:** Design and implement backend systems and APIs
**Priority:** Critical
**Autonomy Level:** High

**Skills:**

- Node.js/Express.js architecture
- RESTful API design
- Security best practices
- Performance optimization
- Error handling patterns

**MCPs Used:**

- `sequential-thinking` - Architectural decisions
- `context7` - Library documentation (Express, Prisma)
- `postgres` - Database queries and schema
- `git` - Version control operations

**Auto-invokes Skills:**

- `/backend-api` - When designing endpoints
- `/security-guide` - When implementing auth
- `/es-modules-guide` - When import errors occur
- `/test-architecture` - When writing tests

**Auto-invokes when:**

- User mentions "API", "endpoint", "backend", "server"
- Creating/modifying routes or controllers
- Performance issues in backend
- Security concerns raised

**Configuration:**

```json
{
  "agent": "backend-architect",
  "priority": "critical",
  "max_concurrent": 2,
  "mcps": ["sequential-thinking", "context7", "postgres", "git"],
  "skills": ["backend-api", "security-guide", "es-modules-guide"],
  "sub_agents": ["api-designer", "database-optimizer", "security-auditor"],
  "auto_invoke_triggers": ["api", "endpoint", "backend", "server", "route", "controller"]
}
```

---

##### Sub-agent: API Designer

**Parent:** Backend Architect
**Role:** Design REST API endpoints with proper contracts

**Specialization:**

- Request/response schemas
- Error responses
- Validation rules
- Rate limiting strategy

**Skills:**

- `/backend-api` (automatically loaded)
- API contract documentation in `.claude/docs/api/`

**MCPs:** Inherits from parent + `context7` for API best practices

---

##### Sub-agent: Database Optimizer

**Parent:** Backend Architect
**Role:** Optimize database queries and indexing

**Specialization:**

- Prisma query optimization
- Index strategy
- JSONB optimization
- Connection pooling

**Skills:**

- Database infrastructure docs
- Query performance patterns

**MCPs:** Inherits from parent + `postgres` for direct queries

---

##### Sub-agent: Security Auditor

**Parent:** Backend Architect
**Role:** Security review and vulnerability assessment

**Specialization:**

- JWT token validation
- Input sanitization
- SQL injection prevention
- Rate limiting enforcement

**Skills:**

- `/security-guide` (automatically loaded)
- Security documentation in `.claude/rules/SECURITY.md`

**MCPs:** Inherits from parent

**Auto-invokes when:**

- Authentication changes
- Before deployment
- Security keywords mentioned

---

#### 2. Game Systems Specialist (Primary Agent)

**Role:** Implement game mechanics (breeding, training, grooms, traits)
**Priority:** High
**Autonomy Level:** High

**Skills:**

- Game mechanics design
- Balance tuning
- Progression systems
- Complex algorithms

**MCPs Used:**

- `sequential-thinking` - Complex game logic
- `context7` - Game system documentation
- `postgres` - Game data queries

**Auto-invokes Skills:**

- `/groom-system` - When working on grooms
- `/breeding-system` - When working on breeding
- `/training-system` - When working on training
- `/trait-system` - When working on traits

**Auto-invokes when:**

- User mentions "breeding", "training", "groom", "trait", "horse", "competition"
- Working in game logic files
- Balancing game mechanics

**Configuration:**

```json
{
  "agent": "game-systems-specialist",
  "priority": "high",
  "max_concurrent": 1,
  "mcps": ["sequential-thinking", "context7", "postgres"],
  "skills": ["groom-system", "breeding-system", "training-system", "trait-system"],
  "sub_agents": [
    "breeding-specialist",
    "training-specialist",
    "groom-specialist",
    "trait-specialist"
  ],
  "auto_invoke_triggers": [
    "breeding",
    "training",
    "groom",
    "trait",
    "horse",
    "competition",
    "genetics"
  ]
}
```

---

##### Sub-agent: Breeding Specialist

**Parent:** Game Systems Specialist
**Role:** Breeding mechanics and genetics simulation

**Specialization:**

- Genetic inheritance algorithms
- Breeding validation rules
- Cooldown management
- Offspring stat calculation

**Skills:**

- `/breeding-system` - Breeding documentation
- Genetics algorithm patterns

**Documentation:**

- `.claude/docs/systems/epigenetictraits.md`
- `.claude/docs/systems/advancedepigenetictraitsystem.md`

---

##### Sub-agent: Training Specialist

**Parent:** Game Systems Specialist
**Role:** Training system implementation

**Specialization:**

- Training cooldown enforcement
- Stat progression algorithms
- Discipline validation
- Age restrictions

**Skills:**

- `/training-system` - Training documentation
- Training algorithm patterns

**Documentation:**

- `.claude/docs/systems/training-system.md`
- `.claude/docs/systems/disciplines.md`

---

##### Sub-agent: Groom Specialist

**Parent:** Game Systems Specialist
**Role:** Groom system implementation and management

**Specialization:**

- Groom assignment logic
- Foal enrichment tracking
- Skill/personality bonuses
- Groom progression

**Skills:**

- `/groom-system` (automatically loaded)
- Groom API documentation

**Documentation:**

- `.claude/docs/systems/groomsystem.md`
- `.claude/docs/systems/groompersonalitytraitbonus.md`
- `.claude/docs/api/GROOM_API_TEST_PLAN.md`

---

##### Sub-agent: Trait Specialist

**Parent:** Game Systems Specialist
**Role:** Trait discovery and epigenetic systems

**Specialization:**

- Trait discovery algorithms
- Epigenetic flag evaluation
- Milestone-based unlocking
- Ultra-rare trait mechanics

**Skills:**

- `/trait-system` - Trait documentation
- Epigenetic system patterns

**Documentation:**

- `.claude/docs/systems/epigenetictraits.md`
- `.claude/docs/systems/epigenetictraitflagsystem.md`
- `.claude/docs/systems/ultrarareexotictraits.md`
- `.claude/docs/systems/longtermtrait.md`

---

### Frontend Development Branch

#### 3. Frontend Architect (Primary Agent)

**Role:** Build React 19 browser game UI with TypeScript
**Priority:** Critical
**Autonomy Level:** High

**Skills:**

- React 19 + TypeScript
- Tailwind CSS styling
- React Query state management
- React Router v6
- Vite build optimization

**MCPs Used:**

- `sequential-thinking` - Architecture decisions
- `context7` - React/TypeScript docs
- `chrome-dev-tools` - Performance debugging
- `git` - Version control

**Auto-invokes Skills:**

- `/frontend-guide` - When building components
- `/test-architecture` - When writing component tests
- `/contributing` - When preparing PRs

**Auto-invokes when:**

- User mentions "frontend", "React", "component", "UI", "page"
- Working in `/frontend/` directory
- TypeScript errors occur

**Configuration:**

```json
{
  "agent": "frontend-architect",
  "priority": "critical",
  "max_concurrent": 2,
  "mcps": ["sequential-thinking", "context7", "chrome-dev-tools", "git"],
  "skills": ["frontend-guide", "test-architecture", "contributing"],
  "sub_agents": ["react-component-builder", "state-manager", "ui-ux-validator"],
  "auto_invoke_triggers": ["frontend", "react", "component", "ui", "page", "typescript"]
}
```

---

##### Sub-agent: React Component Builder

**Parent:** Frontend Architect
**Role:** Build React components following TDD

**Specialization:**

- Component structure and patterns
- React hooks (useState, useEffect, custom hooks)
- Props and TypeScript interfaces
- Accessibility (WCAG 2.1 AA)

**Skills:**

- React component patterns
- Accessibility guidelines

**MCPs:** Inherits from parent + `context7` for React documentation

---

##### Sub-agent: State Manager

**Parent:** Frontend Architect
**Role:** Implement state management with React Query

**Specialization:**

- React Query setup and hooks
- API integration layer
- Cache management
- Optimistic updates

**Skills:**

- React Query patterns
- API integration guide

**MCPs:** Inherits from parent

---

##### Sub-agent: UI/UX Validator

**Parent:** Frontend Architect
**Role:** Ensure accessibility and design system compliance

**Specialization:**

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader testing
- Visual regression testing

**Skills:**

- Accessibility guide
- Design system patterns

**MCPs:** Inherits from parent + `chrome-dev-tools` for accessibility audits

---

#### 4. Browser Game Designer (Primary Agent)

**Role:** Design browser game UI/UX (old-school text/graphics style)
**Priority:** High
**Autonomy Level:** Medium

**Skills:**

- Browser game design patterns
- Text-based UI optimization
- Retro gaming aesthetics
- Performance on older browsers

**MCPs Used:**

- `sequential-thinking` - UX flow design
- `context7` - Browser game best practices
- `chrome-dev-tools` - Performance testing

**Auto-invokes Skills:**

- `/game-design-guide` - Browser game patterns
- `/frontend-guide` - Component implementation

**Auto-invokes when:**

- User mentions "game UI", "browser game", "retro", "text-based"
- Designing game screens
- Layout decisions

---

### Testing & Quality Branch

#### 5. Test Architect (Primary Agent)

**Role:** Design and implement comprehensive test strategy
**Priority:** Critical
**Autonomy Level:** High

**Skills:**

- Jest testing framework
- React Testing Library
- Playwright E2E testing
- Test-driven development (TDD)
- Balanced mocking philosophy

**MCPs Used:**

- `sequential-thinking` - Test strategy design
- `context7` - Testing framework docs
- `serenity` - Code quality analysis

**Auto-invokes Skills:**

- `/test-architecture` (automatically loaded for all testing work)
- `/contributing` - When setting up test standards

**Auto-invokes when:**

- User mentions "test", "testing", "TDD", "coverage"
- Test files being created/modified
- Test failures occur

**Configuration:**

```json
{
  "agent": "test-architect",
  "priority": "critical",
  "max_concurrent": 1,
  "mcps": ["sequential-thinking", "context7", "serenity"],
  "skills": ["test-architecture", "contributing"],
  "sub_agents": ["unit-test-specialist", "integration-test-specialist", "e2e-test-specialist"],
  "auto_invoke_triggers": ["test", "testing", "tdd", "coverage", "jest", "vitest", "playwright"]
}
```

---

##### Sub-agent: Unit Test Specialist

**Parent:** Test Architect
**Role:** Write unit tests following balanced mocking approach

**Specialization:**

- Mock external dependencies only (DB, HTTP, logger)
- Test real business logic
- 80-90% coverage targets
- Fast execution

**Skills:**

- `/test-architecture` (balanced mocking section)
- Jest patterns

---

##### Sub-agent: Integration Test Specialist

**Parent:** Test Architect
**Role:** Write integration tests for cross-system validation

**Specialization:**

- Real database operations (test DB)
- API endpoint testing
- Multi-system interactions
- Data flow validation

**Skills:**

- Integration test patterns
- Database test setup

---

##### Sub-agent: E2E Test Specialist

**Parent:** Test Architect
**Role:** Write end-to-end tests with Playwright

**Specialization:**

- Critical user journeys
- Browser automation
- Visual regression testing
- Accessibility testing

**Skills:**

- Playwright patterns
- E2E test strategy

**MCPs:** Inherits from parent + `chrome-dev-tools` for browser automation

---

#### 6. Code Quality Guardian (Primary Agent)

**Role:** Maintain code quality standards (linting, type-checking, formatting)
**Priority:** High
**Autonomy Level:** Medium

**Skills:**

- ESLint configuration
- TypeScript strict mode
- Prettier formatting
- Code review standards

**MCPs Used:**

- `serenity` - Code quality analysis
- `context7` - Linting best practices

**Auto-invokes Skills:**

- `/es-modules-guide` - When import/require issues
- `/contributing` - Code standards

**Auto-invokes when:**

- Linting errors occur
- TypeScript errors occur
- Code review requested

---

### Database Branch

#### 7. Database Architect (Primary Agent)

**Role:** Design database schema and optimize queries
**Priority:** Critical
**Autonomy Level:** High

**Skills:**

- PostgreSQL optimization
- Prisma ORM mastery
- Schema design
- Query performance tuning
- JSONB optimization
- Migration management

**MCPs Used:**

- `sequential-thinking` - Schema design decisions
- `context7` - PostgreSQL/Prisma docs
- `postgres` - Direct database operations
- `git` - Migration version control

**Auto-invokes Skills:**

- `/database-guide` - Schema and query patterns
- `/backend-api` - API integration with database

**Auto-invokes when:**

- User mentions "database", "schema", "migration", "query", "prisma"
- Working with Prisma schema
- Performance issues in queries

**Configuration:**

```json
{
  "agent": "database-architect",
  "priority": "critical",
  "max_concurrent": 1,
  "mcps": ["sequential-thinking", "context7", "postgres", "git"],
  "skills": ["database-guide", "backend-api"],
  "sub_agents": ["schema-designer", "query-optimizer", "migration-manager"],
  "auto_invoke_triggers": ["database", "schema", "migration", "query", "prisma", "postgres"]
}
```

---

### Documentation Branch

#### 8. Technical Writer (Primary Agent)

**Role:** Create and maintain project documentation
**Priority:** Medium
**Autonomy Level:** Medium

**Skills:**

- Technical writing
- API documentation (Swagger/OpenAPI)
- Architecture documentation
- Markdown formatting

**MCPs Used:**

- `context7` - Documentation best practices
- `git` - Documentation versioning
- `filesystem` - File operations

**Auto-invokes Skills:**

- Documentation templates
- Style guides

**Auto-invokes when:**

- User mentions "document", "readme", "guide", "documentation"
- New features completed
- API endpoints added

---

#### 9. Knowledge Manager (Primary Agent)

**Role:** Organize documentation and create skills
**Priority:** Medium
**Autonomy Level:** Low

**Skills:**

- Information architecture
- Skill creation
- Context optimization

**MCPs Used:**

- `filesystem` - File organization
- `git` - Version control

**Auto-invokes when:**

- Documentation bloat detected
- New skills needed
- Context optimization required

---

## 🔗 Agent-to-MCP Mapping

### MCP Usage Matrix

| MCP Server              | Primary Users                           | Use Cases                                         |
| ----------------------- | --------------------------------------- | ------------------------------------------------- |
| **sequential-thinking** | All Primary Agents                      | Complex decisions, architecture, algorithm design |
| **context7**            | All Agents                              | Library docs, API references, best practices      |
| **task-manager**        | Root Orchestrator                       | Sprint planning, task coordination                |
| **serenity**            | Test Architect, Code Quality Guardian   | Code analysis, test generation                    |
| **chrome-dev-tools**    | Frontend Architect, E2E Test Specialist | Performance, debugging, accessibility             |
| **filesystem**          | Documentation Branch                    | File operations, organization                     |
| **git**                 | All Agents                              | Version control, commit operations                |
| **github**              | Root Orchestrator                       | PR management, issue tracking                     |
| **postgres**            | Database Architect, Game Systems        | Database operations, queries                      |

---

## 🎯 Agent Selection Rules

### Automatic Agent Selection

**Keywords → Agent Mapping:**

```javascript
{
  // Backend Development
  "api|endpoint|backend|server|route|controller": "backend-architect",
  "breeding|genetics|foal|stallion|mare": "game-systems:breeding-specialist",
  "training|discipline|cooldown|stat": "game-systems:training-specialist",
  "groom|enrichment|foal care|assignment": "game-systems:groom-specialist",
  "trait|epigenetic|discovery|milestone": "game-systems:trait-specialist",

  // Frontend Development
  "frontend|react|component|ui|page|typescript": "frontend-architect",
  "browser game|retro|text-based": "browser-game-designer",
  "state|react query|api integration": "frontend-architect:state-manager",
  "accessibility|wcag|aria|screen reader": "frontend-architect:ui-ux-validator",

  // Testing & Quality
  "test|testing|tdd|coverage|jest": "test-architect",
  "unit test|mock": "test-architect:unit-test-specialist",
  "integration test|cross-system": "test-architect:integration-test-specialist",
  "e2e|playwright|end-to-end": "test-architect:e2e-test-specialist",
  "lint|eslint|prettier|format": "code-quality-guardian",

  // Database
  "database|schema|migration|query|prisma|postgres": "database-architect",

  // Documentation
  "document|readme|guide|documentation": "technical-writer",

  // Security
  "security|auth|jwt|token|vulnerability": "backend-architect:security-auditor"
}
```

### Priority-Based Selection

**When multiple agents match:**

1. Check current context (directory, files being modified)
2. Use priority level (Critical > High > Medium)
3. Select most specific agent (sub-agent over primary)

---

## 📚 Agent-to-Skill Mapping

### Skill Auto-Loading Rules

**Each agent automatically loads relevant skills based on context:**

```javascript
{
  "backend-architect": [
    "/backend-api",      // Always loaded
    "/security-guide",   // When auth/security keywords
    "/es-modules-guide"  // When import errors
  ],

  "game-systems-specialist": [
    "/groom-system",     // When groom keywords
    "/breeding-system",  // When breeding keywords
    "/training-system",  // When training keywords
    "/trait-system"      // When trait keywords
  ],

  "frontend-architect": [
    "/frontend-guide",   // Always loaded
    "/test-architecture" // When writing tests
  ],

  "test-architect": [
    "/test-architecture" // Always loaded
  ],

  "database-architect": [
    "/database-guide"    // Always loaded
  ]
}
```

---

## 🚀 Activation Status

**Current Status:** ✅ Defined and Ready
**Next Steps:**

1. Create skill files for missing skills
2. Implement agent selection logic
3. Test agent-MCP integration
4. Validate skill auto-loading

---

## 📝 Usage Examples

### Example 1: Backend API Development

**User Request:** "Add a new endpoint for horse stat updates"

**Agent Selection:**

1. Keywords: "endpoint", "horse", "stat"
2. Matches: `backend-architect` + `game-systems-specialist`
3. Primary: `backend-architect` (endpoint creation)
4. Collaborating: `game-systems-specialist` (stat logic validation)

**Auto-loaded Skills:**

- `/backend-api` - API design patterns
- `/security-guide` - Endpoint security
- `/test-architecture` - Endpoint testing

**MCPs Invoked:**

- `sequential-thinking` - Endpoint design
- `context7` - Express.js best practices
- `postgres` - Stat update query

---

### Example 2: Frontend Component

**User Request:** "Build authentication login page"

**Agent Selection:**

1. Keywords: "authentication", "login", "page"
2. Matches: `frontend-architect` + `browser-game-designer`
3. Primary: `frontend-architect` (React implementation)
4. Sub-agent: `react-component-builder` (component structure)

**Auto-loaded Skills:**

- `/frontend-guide` - React patterns
- `/test-architecture` - Component testing
- `/contributing` - Code standards

**MCPs Invoked:**

- `context7` - React 19 documentation
- `chrome-dev-tools` - UI debugging

---

### Example 3: Test Creation

**User Request:** "Write tests for breeding validation"

**Agent Selection:**

1. Keywords: "tests", "breeding", "validation"
2. Matches: `test-architect` + `game-systems:breeding-specialist`
3. Primary: `test-architect` (test structure)
4. Collaborating: `breeding-specialist` (validation logic)

**Auto-loaded Skills:**

- `/test-architecture` - Balanced mocking approach
- `/breeding-system` - Breeding logic documentation

**MCPs Invoked:**

- `serenity` - Test generation
- `sequential-thinking` - Test case design

---

**Last Updated:** 2026-01-27
**Status:** Complete and ready for implementation
