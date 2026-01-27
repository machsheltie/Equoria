# ES Modules Guide

**Skill:** `/es-modules-guide`
**Purpose:** Load ES Modules troubleshooting guide when encountering import/require errors

---

## When to Use This Skill

Invoke this skill when:

- Seeing "require is not defined" errors
- ESLint red underlines stop working
- Import/export syntax errors
- Module resolution issues
- Mixing CommonJS and ES Modules

---

## Quick Fix Commands

### Check for CommonJS Contamination

```bash
grep -r "module.exports\|require(" --include="*.js" --exclude-dir=node_modules backend/
```

### Verify ES Modules Configuration

- ✅ `"type": "module"` in `package.json`
- ✅ All imports use `.js` extensions
- ✅ No `require()` statements in app code

### Restart ESLint

- Ctrl+Shift+P → "ESLint: Restart ESLint Server"
- Or restart VSCode completely

---

**Load full documentation:**

```bash
cat .claude/rules/ES_MODULES_REQUIREMENTS.md
```
