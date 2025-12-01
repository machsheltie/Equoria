# Import/Export Validation Guide

## Purpose

This guide documents the automated validation process for detecting and preventing underscore import/export mismatches in the Equoria backend codebase.

## Background

During a systematic code quality audit, one underscore import mismatch was discovered:
- File: `__tests__/services/apiDocumentation.test.mjs`
- Issue: `import { _generateDocumentation }` but export was `export function generateDocumentation()`
- Status: FIXED

## Automated Detection Tool

### Overview

**File:** `backend/check-underscore-imports.mjs`

A Node.js utility that scans all `.mjs` files in the backend directory to detect import/export name mismatches.

### Features

1. **Comprehensive Scanning**
   - Scans all 433 .mjs files in backend
   - Excludes node_modules, .git, coverage directories
   - Handles both .mjs and .js file extensions

2. **Pattern Recognition**
   - Detects ES6 import statements: `import { name } from 'path'`
   - Detects export declarations: `export const/function/let/class name`
   - Detects named exports: `export { name1, name2 }`

3. **Path Resolution**
   - Converts relative import paths to absolute
   - Tests multiple file extensions (.mjs, .js)
   - Verifies file existence before comparison

4. **Smart Comparison**
   - Compares imported names with actual exports
   - Detects underscore prefix mismatches
   - Provides clear fix suggestions

### Usage

#### Command Line

```bash
cd backend
node check-underscore-imports.mjs
```

#### Output Format

Success (no issues):
```
Files checked: 433
Issues found: 0
No underscore import/export mismatches found!
```

With issues:
```
Files checked: 433
Issues found: 2

UNDERSCORE IMPORT MISMATCHES:

1. File: path/to/file1.mjs
   Current:  import { _functionName } from '../../service.mjs'
   Should be: import { functionName } from '../../service.mjs'
   Reason: Export exists as 'functionName' (without underscore)

2. File: path/to/file2.mjs
   Current:  import { functionName } from '../../service.mjs'
   Should be: import { _functionName } from '../../service.mjs'
   Reason: Export exists as '_functionName' (with underscore)
```

## Integration Points

### 1. Pre-Commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Checking import/export mismatches..."
node backend/check-underscore-imports.mjs || exit 1

npm run lint
npm run type-check
```

### 2. CI/CD Pipeline

Add to `.github/workflows/test.yml`:

```yaml
- name: Check for underscore import mismatches
  run: cd backend && node check-underscore-imports.mjs

- name: Run backend tests
  run: npm test --prefix backend
```

Add to `.github/workflows/lint.yml`:

```yaml
- name: Validate imports
  run: cd backend && node check-underscore-imports.mjs
```

### 3. Development Workflow

Add to `package.json` scripts:

```json
{
  "scripts": {
    "check:imports": "node check-underscore-imports.mjs",
    "check:all": "npm run check:imports && npm run lint && npm run type-check",
    "pre-commit": "npm run check:all"
  }
}
```

Use in development:
```bash
npm run check:imports  # Check for mismatches
npm run check:all     # Full validation
```

## Naming Conventions

### Recommended Convention

Define a clear underscore usage policy in your project:

**Option 1: Private Functions (Underscore Prefix)**
```javascript
// These are internal functions, not part of public API
export function _internalHelper() { }

// Import with underscore
import { _internalHelper } from './module.mjs';
```

**Option 2: Public Functions (No Underscore)**
```javascript
// These are public API functions
export function publicFunction() { }

// Import without underscore
import { publicFunction } from './module.mjs';
```

**Option 3: Mixed Usage**
```javascript
// Public API - no underscore
export function getUser(id) { }

// Internal helper - with underscore
export function _validateUserInput(user) { }

// Import matching the convention
import { getUser, _validateUserInput } from './module.mjs';
```

### Best Practice

1. **Be Consistent:** If using underscores, use them everywhere or nowhere
2. **Document Convention:** Add to CODING_STANDARDS.md
3. **Enforce via Linting:** Add ESLint rules to enforce convention
4. **Use Type Safety:** TypeScript strict mode helps catch many import errors

## ESLint Configuration

Add to `eslint.config.mjs`:

```javascript
{
  files: ['**/*.mjs', '**/*.js'],
  rules: {
    'no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    // Add custom rule to enforce naming convention
    'id-match': ['warn', '^[a-z_][a-z0-9_]*$', {
      properties: true,
      classFields: true,
      onlyDeclarations: true
    }]
  }
}
```

## TypeScript Configuration

If using TypeScript, enable strict mode in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

This will catch many import resolution errors at compile time.

## Testing Strategy

### Unit Tests

Ensure all test files are executed:

```bash
npm test
```

Tests validate that imports are correctly resolved.

### Integration Tests

Run specific test file to verify import fix:

```bash
npm test -- __tests__/services/apiDocumentation.test.mjs
```

### Automated Validation

Run import checker before committing:

```bash
npm run check:imports
```

## Troubleshooting

### Issue: Tool reports false positives

**Cause:** Dynamic imports or complex patterns not covered by regex

**Solution:**
1. Check the specific import in the file
2. Verify it's a genuine issue vs. edge case
3. Update regex patterns in check-underscore-imports.mjs if needed
4. Report to team for discussion

### Issue: Import works at runtime but checker complains

**Cause:** Possible dynamic re-export or unusual pattern

**Solution:**
1. Verify the import works (npm test)
2. Document the exception
3. Review the actual export statement
4. Consider refactoring for clarity

### Issue: TypeScript compilation fails but checker passes

**Cause:** TypeScript strict mode or module resolution issue

**Solution:**
1. Enable TypeScript strict mode
2. Check tsconfig.json module settings
3. Verify import paths are correct
4. Use `--listFiles` flag to debug resolution

## Monitoring

### Daily Checks

Include in your daily workflow:
```bash
npm run check:imports
```

### Pre-Commit Checks

Run automatically before commits via Husky:
```bash
git commit -m "message"
# check-underscore-imports.mjs runs automatically
```

### CI/CD Checks

Automated in GitHub Actions:
- Pull request: Runs on every PR
- Pre-merge: Must pass before merge
- Post-merge: Verification for release builds

## File Reference

| File | Purpose | Location |
|------|---------|----------|
| `check-underscore-imports.mjs` | Detection tool | `backend/` |
| `UNDERSCORE_IMPORT_FIX_SUMMARY.md` | This fix summary | `backend/` |
| `IMPORT_VALIDATION_GUIDE.md` | This guide | `backend/` |

## Related Documentation

- [Code Style Guide](./CODE_STYLE_GUIDE.md) (if exists)
- [Testing Guide](./TEST_GUIDE.md) (if exists)
- [Contributing](./CONTRIBUTING.md) (if exists)

## Quick Reference

### Check imports
```bash
node check-underscore-imports.mjs
```

### Fix a mismatch
1. Run checker to identify issue
2. Read the "Should be" line
3. Edit import statement
4. Run checker again to verify
5. Commit changes

### Add to workflow
```bash
# Add to pre-commit hook
echo "node check-underscore-imports.mjs" >> .husky/pre-commit
```

## Contact & Questions

For questions about this guide or the validation tool, refer to:
- Project documentation
- Code comments in check-underscore-imports.mjs
- Team standards and conventions

---

**Last Updated:** 2025-11-18
**Version:** 1.0
**Status:** Active and Verified
