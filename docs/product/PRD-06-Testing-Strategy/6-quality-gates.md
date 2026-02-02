# 6. Quality Gates

### 6.1 Pre-Commit

```bash
npm run lint
npm run type-check  # Frontend only
npm run test:affected
```

**Must Pass:**
- ESLint (errors only, warnings allowed)
- TypeScript type-check (frontend)
- Tests for changed files

### 6.2 Pre-Push

```bash
npm run test
npm run test:integration
npm run build
```

**Must Pass:**
- Full test suite (468+ backend, 115+ frontend)
- Integration tests
- Build succeeds

### 6.3 Pre-Deploy

```bash
npm run test:e2e
npm run test:performance
npm run security:audit
```

**Must Pass:**
- E2E tests (critical user journeys)
- Performance tests (Lighthouse scores >90)
- Security audit (npm audit)
- Zero critical vulnerabilities

---
