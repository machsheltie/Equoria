# Contributing Guidelines

**Skill:** `/contributing`
**Purpose:** Load contribution standards when reviewing code or preparing PRs

---

## When to Use This Skill

Invoke this skill when:

- Preparing pull requests
- Reviewing code contributions
- Setting up development environment
- Understanding coding standards
- Checking naming conventions

---

## Quick Coding Standards

### Naming Conventions

```javascript
// ✅ Correct
const horseId = 123; // camelCase for variables
class HorseModel {} // PascalCase for classes
import { helper } from './my-file.js'; // kebab-case for files
```

### ES Modules Requirements

```javascript
// ✅ Always include .js extensions
import { foo } from './bar.js';

// ✅ Always use import/export
export default myFunction;
```

### Git Commit Format

```
<type>(<scope>): <subject>

<body>

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:** feat, fix, refactor, test, docs, chore

---

## Pre-Commit Checklist

- [ ] All tests passing
- [ ] ESLint errors fixed (warnings OK)
- [ ] No console.log in production code
- [ ] ES Modules only (no CommonJS)
- [ ] Proper naming conventions
- [ ] Added tests for new features

---

**Load full guidelines:**

```bash
cat .claude/rules/CONTRIBUTING.md
```
