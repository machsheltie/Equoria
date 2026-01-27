# Plugin Configuration - wshobson/agents

**Last Updated:** 2025-01-18
**Marketplace:** wshobson/agents
**Project Phase:** Frontend Completion (~60% complete, 23-30 hours remaining)

---

## Installation Commands

### Step 1: Add Marketplace

```
/plugin marketplace add wshobson/agents
```

### Step 2: Install Priority Plugins

**Install all priority plugins at once:**

```bash
/plugin install frontend-mobile-development:frontend-developer && \
/plugin install javascript-typescript:typescript-pro && \
/plugin install unit-testing:test-automator && \
/plugin install accessibility-compliance:ui-visual-validator && \
/plugin install tdd-workflows:tdd-orchestrator && \
/plugin install code-review-ai:architect-review && \
/plugin install application-performance:performance-engineer
```

**Or install individually as needed (see priority sections below)**

---

## Priority 1: CRITICAL (Frontend Completion)

### 1. Frontend Developer Agent

**Plugin:** `frontend-mobile-development:frontend-developer`

**Installation:**

```
/plugin install frontend-mobile-development:frontend-developer
```

**Purpose:** Build React components, implement responsive layouts, handle client-side state management

**Expertise:**

- React 19 + Next.js 15
- Modern frontend architecture
- Performance optimization
- Accessibility compliance

**Use For (Equoria):**

- ✅ Authentication pages (login, register, password reset)
- ✅ Training UI components (session management, progress tracking)
- ✅ Breeding UI components (horse pairing, breeding records)
- ✅ API integration with backend (connect to 130+ endpoints)
- ✅ React Query state management
- ✅ Form validation and error handling

**Auto-invoke When:**

- Creating new React components
- Implementing page layouts
- Building forms (authentication, training, breeding)
- Integrating with backend API

**Configuration:**

```json
{
  "plugin": "frontend-mobile-development:frontend-developer",
  "enabled": true,
  "priority": "critical",
  "auto_invoke": true,
  "use_cases": [
    "Authentication pages implementation",
    "Training UI implementation",
    "Breeding UI implementation",
    "React Query integration",
    "Form validation",
    "API error handling"
  ]
}
```

---

### 2. TypeScript Pro

**Plugin:** `javascript-typescript:typescript-pro`

**Installation:**

```
/plugin install javascript-typescript:typescript-pro
```

**Purpose:** Master TypeScript with advanced types, generics, and strict type safety

**Expertise:**

- TypeScript strict mode
- Complex type systems
- Advanced typing patterns
- Type inference optimization

**Use For (Equoria):**

- ✅ Strict mode compliance (zero `any` types)
- ✅ Type-safe API contracts
- ✅ Generic components and utilities
- ✅ Complex type definitions for game data (genetics, breeding)

**Auto-invoke When:**

- TypeScript errors occur
- Creating complex type definitions
- Optimizing type inference
- Refactoring with type safety

**Configuration:**

```json
{
  "plugin": "javascript-typescript:typescript-pro",
  "enabled": true,
  "priority": "critical",
  "auto_invoke": true,
  "strict_mode": true,
  "use_cases": [
    "Fix TypeScript errors",
    "Complex type definitions",
    "Generic components",
    "Type-safe API integration"
  ]
}
```

---

### 3. Test Automator (Unit Testing)

**Plugin:** `unit-testing:test-automator`

**Installation:**

```
/plugin install unit-testing:test-automator
```

**Purpose:** Master AI-powered test automation with modern frameworks and TDD

**Expertise:**

- Vitest + React Testing Library
- TDD methodology (Red-Green-Refactor)
- Component testing patterns
- Integration testing

**Use For (Equoria):**

- ✅ Write tests BEFORE implementation (TDD approach)
- ✅ Component tests for authentication pages
- ✅ Component tests for training/breeding UI
- ✅ Integration tests for API integration
- ✅ Achieve 80%+ test coverage target

**Auto-invoke When:**

- Starting new component development
- Before implementing features (TDD)
- Coverage gaps identified
- Test failures need debugging

**Configuration:**

```json
{
  "plugin": "unit-testing:test-automator",
  "enabled": true,
  "priority": "critical",
  "auto_invoke": true,
  "tdd_mode": true,
  "coverage_target": 80,
  "use_cases": [
    "Write tests before implementation",
    "Component testing (React Testing Library)",
    "Integration testing",
    "Achieve 80%+ coverage"
  ]
}
```

---

### 4. UI Visual Validator

**Plugin:** `accessibility-compliance:ui-visual-validator`

**Installation:**

```
/plugin install accessibility-compliance:ui-visual-validator
```

**Purpose:** Visual validation, UI testing, design system compliance, accessibility verification

**Expertise:**

- WCAG 2.1 AA compliance
- Visual regression testing
- Component validation
- Accessibility auditing (axe-core)

**Use For (Equoria):**

- ✅ Accessibility testing for all new components
- ✅ WCAG 2.1 AA compliance verification
- ✅ Visual validation of authentication pages
- ✅ Form accessibility (keyboard navigation, screen readers)
- ✅ Color contrast validation

**Auto-invoke When:**

- New UI components created
- Forms implemented
- Visual changes made
- Before production deployment

**Configuration:**

```json
{
  "plugin": "accessibility-compliance:ui-visual-validator",
  "enabled": true,
  "priority": "high",
  "auto_invoke": true,
  "wcag_level": "AA",
  "use_cases": [
    "WCAG 2.1 AA compliance",
    "Form accessibility",
    "Visual regression testing",
    "Component validation"
  ]
}
```

---

## Priority 2: HIGH (Quality & Testing)

### 5. TDD Orchestrator

**Plugin:** `tdd-workflows:tdd-orchestrator`

**Installation:**

```
/plugin install tdd-workflows:tdd-orchestrator
```

**Purpose:** Master TDD orchestrator for red-green-refactor discipline

**Expertise:**

- TDD best practices enforcement
- Multi-agent workflow coordination
- Test-first development patterns
- Refactoring with test safety

**Use For (Equoria):**

- ✅ Enforce TDD workflow (write tests first)
- ✅ Coordinate testing across components
- ✅ Ensure red-green-refactor cycle followed
- ✅ Maintain test quality standards

**Auto-invoke When:**

- Starting new feature development
- Coordinating multiple test files
- Ensuring TDD compliance
- Code review for test quality

**Configuration:**

```json
{
  "plugin": "tdd-workflows:tdd-orchestrator",
  "enabled": true,
  "priority": "high",
  "auto_invoke": true,
  "enforce_tdd": true,
  "use_cases": [
    "Enforce test-first development",
    "Red-Green-Refactor workflow",
    "Test quality standards",
    "TDD governance"
  ]
}
```

---

### 6. Code Reviewer (Architect Review)

**Plugin:** `code-review-ai:architect-review`

**Installation:**

```
/plugin install code-review-ai:architect-review
```

**Purpose:** Master software architect for architecture patterns and code review

**Expertise:**

- Clean architecture
- Modern design patterns
- React architecture patterns
- Code quality review

**Use For (Equoria):**

- ✅ Review new component architecture
- ✅ Ensure clean architecture principles
- ✅ Review API integration patterns
- ✅ Code quality assessment before commits

**Auto-invoke When:**

- Completing major features
- Before pull requests
- Architecture decisions needed
- Code quality concerns

**Configuration:**

```json
{
  "plugin": "code-review-ai:architect-review",
  "enabled": true,
  "priority": "high",
  "auto_invoke": false,
  "use_cases": [
    "Architecture review",
    "Code quality assessment",
    "Design pattern validation",
    "Pre-commit review"
  ]
}
```

---

### 7. Performance Engineer

**Plugin:** `application-performance:performance-engineer`

**Installation:**

```
/plugin install application-performance:performance-engineer
```

**Purpose:** Expert performance engineer for optimization and observability

**Expertise:**

- React performance optimization
- Lighthouse optimization
- Core Web Vitals
- Bundle size optimization

**Use For (Equoria):**

- ✅ Optimize React components (React.memo, useMemo)
- ✅ Lighthouse score optimization (target: >90)
- ✅ Bundle size analysis
- ✅ Code splitting implementation
- ✅ Performance monitoring

**Auto-invoke When:**

- Performance issues identified
- Lighthouse scores <90
- Before production deployment
- Bundle size growing too large

**Configuration:**

```json
{
  "plugin": "application-performance:performance-engineer",
  "enabled": true,
  "priority": "high",
  "auto_invoke": false,
  "lighthouse_target": 90,
  "use_cases": [
    "React optimization",
    "Lighthouse optimization",
    "Bundle size reduction",
    "Core Web Vitals"
  ]
}
```

---

## Priority 3: MEDIUM (Backend Support - Standby)

### 8. Backend Architect

**Plugin:** `backend-development:backend-architect`

**Installation:**

```
/plugin install backend-development:backend-architect
```

**Purpose:** Expert backend architect for API design and scalability

**Expertise:**

- RESTful API design
- Node.js/Express architecture
- Microservices patterns
- API optimization

**Use For (Equoria):**

- ✅ Backend maintenance (backend 100% complete)
- ✅ New API endpoint design (if needed)
- ✅ API optimization (if performance issues)
- ✅ Architecture consultation

**Auto-invoke When:**

- New backend features needed
- API performance issues
- Backend architecture questions
- Database schema changes

**Configuration:**

```json
{
  "plugin": "backend-development:backend-architect",
  "enabled": true,
  "priority": "medium",
  "auto_invoke": false,
  "status": "standby",
  "use_cases": [
    "Backend maintenance",
    "API endpoint design",
    "Performance optimization",
    "Architecture consultation"
  ]
}
```

---

### 9. Security Auditor

**Plugin:** `full-stack-orchestration:security-auditor`

**Installation:**

```
/plugin install full-stack-orchestration:security-auditor
```

**Purpose:** Expert security auditor for DevSecOps and vulnerability assessment

**Expertise:**

- Authentication/authorization review
- OWASP security standards
- Vulnerability assessment
- Security best practices

**Use For (Equoria):**

- ✅ Review authentication implementation (JWT, OAuth)
- ✅ Security audit before deployment
- ✅ Vulnerability scanning
- ✅ Compliance verification

**Auto-invoke When:**

- Implementing authentication
- Before production deployment
- Security concerns raised
- Periodic security audits

**Configuration:**

```json
{
  "plugin": "full-stack-orchestration:security-auditor",
  "enabled": true,
  "priority": "medium",
  "auto_invoke": false,
  "use_cases": [
    "Authentication security review",
    "Pre-deployment audit",
    "Vulnerability assessment",
    "OWASP compliance"
  ]
}
```

---

## Priority 4: OPTIONAL (Advanced Features)

### 10. Playwright E2E Tester

**Plugin:** `full-stack-orchestration:test-automator`

**Installation:**

```
/plugin install full-stack-orchestration:test-automator
```

**Purpose:** E2E testing setup and automation with Playwright

**Use For (Equoria):**

- ✅ E2E test suite setup (Playwright)
- ✅ Critical user journey tests
- ✅ Authentication flow testing
- ✅ Browser automation

**Configuration:**

```json
{
  "plugin": "full-stack-orchestration:test-automator",
  "enabled": false,
  "priority": "low",
  "install_when": "E2E testing phase (after frontend completion)"
}
```

---

### 11. Deployment Engineer

**Plugin:** `full-stack-orchestration:deployment-engineer`

**Installation:**

```
/plugin install full-stack-orchestration:deployment-engineer
```

**Purpose:** CI/CD pipelines and deployment automation

**Use For (Equoria):**

- ✅ Production deployment setup
- ✅ Vercel/Netlify configuration (frontend)
- ✅ AWS/Heroku configuration (backend)
- ✅ Environment variable management

**Configuration:**

```json
{
  "plugin": "full-stack-orchestration:deployment-engineer",
  "enabled": false,
  "priority": "low",
  "install_when": "Deployment phase (after frontend completion)"
}
```

---

## Plugin Usage Workflow

### Phase 1: Frontend Development (Current - 23-30 hours)

**Active Plugins:**

1. **frontend-developer** (CRITICAL) - Component implementation
2. **typescript-pro** (CRITICAL) - Type safety
3. **test-automator** (CRITICAL) - TDD workflow
4. **ui-visual-validator** (HIGH) - Accessibility
5. **tdd-orchestrator** (HIGH) - Test governance

**Workflow:**

```
1. Start feature → test-automator (write tests first)
2. Implement component → frontend-developer
3. Fix types → typescript-pro (auto-invoke on errors)
4. Validate accessibility → ui-visual-validator
5. Review quality → architect-review (before commit)
```

### Phase 2: Testing & Polish (15-20 hours)

**Additional Plugins:** 6. **performance-engineer** - Lighthouse optimization 7. **test-automator** (E2E) - Playwright setup

### Phase 3: Deployment (20-30 hours)

**Additional Plugins:** 8. **security-auditor** - Pre-deployment audit 9. **deployment-engineer** - Production setup

---

## Plugin Priority Matrix

| Plugin               | Priority | Phase       | Auto-Invoke | Use Case                 |
| -------------------- | -------- | ----------- | ----------- | ------------------------ |
| frontend-developer   | CRITICAL | 1 (Current) | Yes         | Component implementation |
| typescript-pro       | CRITICAL | 1 (Current) | Yes         | Type safety              |
| test-automator       | CRITICAL | 1 (Current) | Yes         | TDD workflow             |
| ui-visual-validator  | HIGH     | 1 (Current) | Yes         | Accessibility            |
| tdd-orchestrator     | HIGH     | 1 (Current) | Yes         | Test governance          |
| architect-review     | HIGH     | 1 (Current) | No          | Code review              |
| performance-engineer | HIGH     | 2 (Testing) | No          | Optimization             |
| backend-architect    | MEDIUM   | Standby     | No          | Backend maintenance      |
| security-auditor     | MEDIUM   | 3 (Deploy)  | No          | Security audit           |
| E2E test-automator   | LOW      | 2 (Testing) | No          | E2E testing              |
| deployment-engineer  | LOW      | 3 (Deploy)  | No          | Production setup         |

---

## Quick Installation Guide

### Minimal Setup (Start Here)

```bash
/plugin install frontend-mobile-development:frontend-developer
/plugin install javascript-typescript:typescript-pro
/plugin install unit-testing:test-automator
```

### Recommended Setup (Frontend Phase)

```bash
/plugin install frontend-mobile-development:frontend-developer
/plugin install javascript-typescript:typescript-pro
/plugin install unit-testing:test-automator
/plugin install accessibility-compliance:ui-visual-validator
/plugin install tdd-workflows:tdd-orchestrator
```

### Full Setup (All Phases)

```bash
/plugin install frontend-mobile-development:frontend-developer
/plugin install javascript-typescript:typescript-pro
/plugin install unit-testing:test-automator
/plugin install accessibility-compliance:ui-visual-validator
/plugin install tdd-workflows:tdd-orchestrator
/plugin install code-review-ai:architect-review
/plugin install application-performance:performance-engineer
/plugin install backend-development:backend-architect
/plugin install full-stack-orchestration:security-auditor
```

---

## Troubleshooting

### Plugin Not Found

- Verify marketplace added: `/plugin marketplace list`
- Re-add marketplace: `/plugin marketplace add wshobson/agents`
- Check plugin name spelling

### Plugin Conflicts

- Disable conflicting plugins: `/plugin disable <plugin-name>`
- Check auto-invoke settings
- Review priority settings

### Performance Issues

- Limit auto-invoke plugins to 3-4 max
- Disable unused plugins: `/plugin disable <plugin-name>`
- Use manual invocation for non-critical plugins

---

## Next Steps

1. **Add Marketplace:**

   ```
   /plugin marketplace add wshobson/agents
   ```

2. **Install Minimal Setup (Start):**

   ```
   /plugin install frontend-mobile-development:frontend-developer
   /plugin install javascript-typescript:typescript-pro
   /plugin install unit-testing:test-automator
   ```

3. **Verify Installation:**

   ```
   /plugin list
   ```

4. **Start Development:**
   - Begin with authentication pages (TDD approach)
   - Let plugins auto-invoke as needed
   - Review code quality with architect-review

---

**Related Documentation:**

- [Agent Configuration](./agents-config.md)
- [MCP Servers](./mcp-servers.md)
- [Skills Configuration](./skills-config.md)
- [Testing Standards](../guides/testing-standards.md)
- [Best Practices](../guides/best-practices.md)
