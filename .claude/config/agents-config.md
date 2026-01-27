# Agent Configuration

**Last Updated:** 2025-01-18
**Purpose:** Claude Code agent configurations for Equoria project

---

## Primary Agents

### 1. Backend Architect Agent

**Role:** Backend system design and implementation
**Priority:** High
**Max Concurrent:** 2

**Skills:**

- Node.js/Express.js architecture
- PostgreSQL optimization
- Prisma ORM mastery
- RESTful API design
- Security best practices

**Use Cases:**

- New API endpoint design
- Database schema modifications
- Performance optimization
- Security vulnerability assessment

**Configuration:**

```json
{
  "agent": "backend-architect",
  "max_concurrent": 2,
  "priority": "high",
  "auto_invoke_for": [
    "API design",
    "Database schema changes",
    "Performance issues",
    "Security concerns"
  ]
}
```

**Current Status:** Backend is 100% complete (468+ tests, 90.1% success rate)

---

### 2. Frontend Developer Agent

**Role:** Browser game UI implementation
**Priority:** **CRITICAL** (Frontend is ~60% complete)
**Max Concurrent:** 2
**Estimated Work:** 23-30 hours remaining

**Skills:**

- React 19+ development
- TypeScript strict mode
- Tailwind CSS styling
- React Query state management
- Vite build optimization
- Browser game UI/UX (text/graphics based)
- Performance optimization

**Use Cases:**

- Page implementation (authentication, training, breeding)
- Component development
- State management with React Query
- React Router v6 navigation
- API integration with backend

**Configuration:**

```json
{
  "agent": "frontend-developer",
  "max_concurrent": 2,
  "priority": "critical",
  "auto_invoke_for": [
    "UI implementation",
    "Component creation",
    "State management",
    "React Router setup",
    "API integration"
  ],
  "estimated_work": "23-30 hours for completion (40% remaining)"
}
```

**Current Focus:**

- Authentication pages (login, register, password reset)
- Training UI (session management, progress tracking)
- Breeding UI (pairing logic, record management)
- API integration (connect to 130+ backend endpoints)

---

### 3. Test Automation Agent

**Role:** Comprehensive testing strategy
**Priority:** High
**Max Concurrent:** 1

**Skills:**

- Jest testing framework
- Vitest + React Testing Library (frontend)
- Integration test design
- Playwright E2E testing
- Test coverage analysis
- Performance testing

**Use Cases:**

- New test creation (TDD approach)
- Test coverage improvement (target: 80%+)
- Integration test design
- Performance regression testing
- E2E test suite development

**Configuration:**

```json
{
  "agent": "test-automator",
  "max_concurrent": 1,
  "priority": "high",
  "auto_invoke_for": [
    "New feature testing",
    "Coverage gaps",
    "Integration testing",
    "Performance validation"
  ],
  "coverage_thresholds": {
    "branches": 80,
    "functions": 90,
    "lines": 85,
    "statements": 85
  }
}
```

**Current Status:**

- Backend: 468+ tests (90.1% success rate)
- Frontend: 115+ tests (~60% complete)

---

### 4. Database Architect Agent

**Role:** Database design and optimization
**Priority:** High
**Max Concurrent:** 1

**Skills:**

- PostgreSQL optimization
- Prisma schema design
- Query performance tuning
- Migration management
- JSONB optimization

**Use Cases:**

- Schema modifications
- Query optimization
- Index strategy
- Migration creation and testing
- JSONB field optimization for game data

**Configuration:**

```json
{
  "agent": "database-architect",
  "max_concurrent": 1,
  "priority": "high",
  "auto_invoke_for": [
    "Schema changes",
    "Query optimization",
    "Performance issues",
    "Migration creation"
  ]
}
```

**Current Status:** Database schema is 100% complete (30+ tables)

---

### 5. Documentation Engineer Agent

**Role:** Documentation creation and maintenance
**Priority:** Medium
**Max Concurrent:** 1

**Skills:**

- Technical writing
- API documentation (Swagger/OpenAPI)
- Architecture documentation
- User guide creation

**Use Cases:**

- API documentation updates
- Feature documentation
- System architecture docs
- User guides

**Configuration:**

```json
{
  "agent": "docs-architect",
  "max_concurrent": 1,
  "priority": "medium",
  "auto_invoke_for": ["New API endpoints", "Feature completion", "Architecture changes"],
  "doc_standards": {
    "max_lines": 500,
    "format": "markdown",
    "cross_references": true
  }
}
```

---

## Sub-Agents

### Security Auditor Sub-Agent

**Parent:** Backend Architect
**Purpose:** Security review and vulnerability assessment
**Auto-invoke:** Before deployment, after auth changes

**Responsibilities:**

- Security vulnerability scanning
- Authentication/authorization review
- API endpoint security audit
- Dependency vulnerability checks

---

### Performance Engineer Sub-Agent

**Parent:** Backend Architect
**Purpose:** Performance profiling and optimization
**Auto-invoke:** Load testing, slow API detection

**Responsibilities:**

- Query performance analysis
- API response time optimization
- Load testing and stress testing
- Caching strategy optimization

---

### UI/UX Validator Sub-Agent

**Parent:** Frontend Developer
**Purpose:** Design system compliance and accessibility
**Auto-invoke:** New screen completion, component library updates

**Responsibilities:**

- WCAG 2.1 AA compliance checking
- Design system consistency validation
- Accessibility testing (axe-core)
- User experience review

---

## Agent Workflow Guidelines

### When to Use Parallel Agents

**Independent Tasks** - Run agents in parallel for:

- Different feature implementations
- Test creation for separate modules
- Documentation for different systems
- UI screens with no interdependencies

**Example:**

```json
{
  "parallel_agents": [
    {
      "agent": "frontend-developer",
      "task": "Implement authentication pages"
    },
    {
      "agent": "test-automator",
      "task": "Create tests for existing components"
    }
  ],
  "max_parallel": 2
}
```

### When to Use Sequential Agents

**Dependent Tasks** - Run agents sequentially for:

- Feature implementation → Test creation
- Schema changes → Migration → Testing
- API changes → Documentation updates

### When to Invoke Sub-Agents

**Quality Gates:**

- Security audits before major releases
- Performance profiling after optimization work
- UI/UX validation after design changes
- Code review for critical systems

---

## Agent Priorities for Current Phase

**Phase:** Frontend Completion (Next 23-30 hours)

**Priority Order:**

1. **Frontend Developer** (CRITICAL) - Complete remaining 40% of frontend
2. **Test Automator** (HIGH) - Maintain TDD approach, create tests first
3. **Documentation Engineer** (MEDIUM) - Document new frontend features
4. **UI/UX Validator** (MEDIUM) - Ensure accessibility compliance

**Backend agents on standby** (Backend is 100% complete)

---

**Related Documentation:**

- [MCP Servers](./mcp-servers.md)
- [Skills Configuration](./skills-config.md)
- [Hooks Configuration](./hooks-config.md)
- [Workflow Automation](../guides/workflow-automation.md)
