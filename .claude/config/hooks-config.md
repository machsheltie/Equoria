# Hooks Configuration

**Last Updated:** 2025-01-18
**Purpose:** Git hooks and automation configurations for Equoria project

---

## Pre-Commit Hooks

**Purpose:** Fast quality checks before commit
**Execution Time:** <10 seconds

```json
{
  "hooks": {
    "pre-commit": ["npm run lint", "npm run format", "npm run test:affected"],
    "description": "Code quality and affected test validation"
  }
}
```

**What Gets Checked:**

- ESLint (code quality, style violations)
- Prettier formatting
- Tests for changed files only (fast feedback)

**Configuration:** Uses `lint-staged` for efficiency

- Only checks staged files
- Runs in parallel for speed
- Warnings allowed, errors block commit

---

## Pre-Push Hooks

**Purpose:** Comprehensive validation before push
**Execution Time:** 1-3 minutes

```json
{
  "hooks": {
    "pre-push": ["npm run test", "npm run test:integration", "npm run build"],
    "description": "Full test suite and build validation"
  }
}
```

**What Gets Checked:**

- **Full test suite** (backend: 468+ tests, frontend: 115+ tests)
- **Integration tests** (cross-system validation)
- **Build validation** (ensure production build works)

**Why Pre-Push Instead of Pre-Commit:**

- Faster commit workflow (pre-commit < 10s)
- Full validation happens before sharing code
- CI/CD pipeline gets clean code

---

## Post-Generate Hooks

**Purpose:** Auto-format generated code
**Execution Time:** <5 seconds

```json
{
  "hooks": {
    "post-generate": ["npm run format", "npm run lint:fix"],
    "description": "Auto-format generated code"
  }
}
```

**When Triggered:**

- After code generation (Prisma, OpenAPI, etc.)
- After scaffolding new components
- After automated migrations

---

## Pre-Deploy Hooks

**Purpose:** Comprehensive pre-deployment validation
**Execution Time:** 5-10 minutes

```json
{
  "hooks": {
    "pre-deploy": ["npm run test:e2e", "npm run test:performance", "npm run security:audit"],
    "description": "Comprehensive pre-deployment validation"
  }
}
```

**What Gets Checked:**

- **E2E Tests** (Playwright for critical user journeys)
- **Performance Tests** (Lighthouse CI, Core Web Vitals)
- **Security Audit** (npm audit, dependency scanning)

---

## Recommended Hook Tools

### 1. Husky

**Purpose:** Git hooks management
**Configuration:** `.husky/` directory

```bash
# Install
npm install --save-dev husky

# Initialize
npx husky init
```

### 2. lint-staged

**Purpose:** Run linters on staged files only
**Configuration:** `package.json`

```json
{
  "lint-staged": {
    "*.{js,mjs,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### 3. commitlint

**Purpose:** Enforce conventional commit messages
**Configuration:** `.commitlintrc.json`

```json
{
  "extends": ["@commitlint/config-conventional"],
  "rules": {
    "type-enum": [2, "always", ["feat", "fix", "docs", "style", "refactor", "test", "chore"]]
  }
}
```

---

## Hook Performance Optimization

### Parallel Execution

**Strategy:** Run independent checks in parallel

```bash
# Sequential (slow)
npm run lint && npm run format && npm test

# Parallel (fast) - using npm-run-all
npm-run-all --parallel lint format test:affected
```

**Performance Gain:** 56% faster with parallel execution

### Selective Testing

**Strategy:** Only test changed files in pre-commit

```json
{
  "test:affected": "jest --findRelatedTests --passWithNoTests"
}
```

**Performance Gain:** <10s vs 1-3 minutes for full suite

### Caching

**Strategy:** Cache test results and ESLint results

```json
{
  "lint": "eslint --cache .",
  "test": "jest --cache"
}
```

---

## Hook Best Practices

### Do's ✅

- **Keep pre-commit fast** (<10 seconds)
- **Run full tests on pre-push** (not pre-commit)
- **Use lint-staged** for efficiency
- **Allow warnings** in pre-commit (only block on errors)
- **Cache results** for repeated runs
- **Run checks in parallel** when possible

### Don'ts ❌

- **Don't run full test suite** in pre-commit (too slow)
- **Don't block on warnings** (only on errors)
- **Don't run E2E tests** in pre-commit (save for pre-deploy)
- **Don't check all files** (only changed/staged files)
- **Don't skip hooks** (they exist for a reason!)

---

## Troubleshooting

### Hooks Too Slow

**Solution:** Move heavy checks to pre-push or CI/CD

### Hooks Failing

**Common Issues:**

1. **Node modules not installed** - Run `npm install`
2. **Husky not initialized** - Run `npx husky init`
3. **Wrong Node version** - Use Node 18+ (check `.nvmrc`)

### Skipping Hooks (Emergency Only)

```bash
# Use --no-verify flag (not recommended)
git commit --no-verify -m "emergency fix"
git push --no-verify
```

**Warning:** Only use in emergencies! Hooks exist to catch issues.

---

## Custom Hooks

### Frontend-Specific Hook

**Trigger:** Before frontend commits

```bash
#!/bin/sh
cd frontend
npm run type-check
npm run test -- --onlyChanged
```

### Backend-Specific Hook

**Trigger:** Before backend commits

```bash
#!/bin/sh
cd backend
npm run lint
npm test -- --onlyChanged
```

---

**Related Documentation:**

- [Testing Standards](../guides/testing-standards.md)
- [Best Practices](../guides/best-practices.md)
- [Agent Configuration](./agents-config.md)
