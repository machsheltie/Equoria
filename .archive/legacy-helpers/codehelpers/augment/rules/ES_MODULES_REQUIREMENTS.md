# 🚨 ES MODULES ONLY - CRITICAL PROJECT REQUIREMENT

## ⚠️ **ABSOLUTE RULE: NO COMMONJS MIXING**

This project **STRICTLY uses ES modules only**. Mixing CommonJS causes **MAJOR issues** with:
- ESLint integration and VSCode red underlines
- Module resolution and imports
- Build processes and tooling
- Development workflow

## ✅ **REQUIRED ES MODULES PATTERNS:**

### **Import Syntax:**
```javascript
// ✅ CORRECT - ES Modules
import express from 'express';
import { someFunction } from './utils/helper.js';
import * as utils from './utils/index.js';

// ❌ NEVER USE - CommonJS
const express = require('express');
const { someFunction } = require('./utils/helper');
```

### **Export Syntax:**
```javascript
// ✅ CORRECT - ES Modules
export default function myFunction() {}
export { helper1, helper2 };
export const CONSTANT = 'value';

// ❌ NEVER USE - CommonJS
module.exports = myFunction;
exports.helper = helper1;
```

### **Configuration Files:**
```javascript
// ✅ CORRECT - Use .json for configs
// .eslintrc.json
{
  "env": { "node": true },
  "extends": ["eslint:recommended"]
}

// ❌ NEVER USE - .js config files with module.exports
// .eslintrc.js
module.exports = {
  env: { node: true }
};
```

## 🔧 **ESLint Integration Troubleshooting Checklist:**

When ESLint red underlines stop working, check these in order:

### **1. Check for CommonJS Contamination:**
```bash
# Search for CommonJS patterns in app code (not node_modules)
grep -r "module.exports\|require(" --include="*.js" --exclude-dir=node_modules .
```

### **2. Verify ES Modules Configuration:**
- ✅ `"type": "module"` in `backend/package.json`
- ✅ All imports use `.js` extensions
- ✅ No `require()` statements in application code

### **3. Check ESLint Configuration:**
- ✅ Use `.eslintrc.json` (JSON format)
- ❌ Never use `.eslintrc.js` (CommonJS format)
- ✅ Ensure `"sourceType": "module"` in parserOptions

### **4. VSCode Settings:**
```json
{
  "eslint.workingDirectories": ["./backend", "."],
  "eslint.enable": true,
  "eslint.run": "onType"
}
```

### **5. Backend ESLint Config Must Have Root:**
```json
{
  "root": true,
  "env": { "node": true, "es2021": true },
  "overrides": [
    {
      "files": ["**/*.test.js", "**/*.spec.js", "**/tests/**/*.js"],
      "env": { "jest": true }
    }
  ]
}
```

### **6. Import Plugins Cause Issues:**
- ❌ `plugin:import/recommended` breaks with ES modules
- ❌ `plugin:prettier/recommended` causes hanging
- ✅ Use core ESLint rules only for ES modules projects

### **7. Restart ESLint Server:**
- Ctrl+Shift+P → "ESLint: Restart ESLint Server"
- Restart VSCode completely if needed

## 🎯 **Project Structure Requirements:**

### **Package.json Configuration:**
```json
{
  "type": "module",
  "scripts": {
    "start": "node server.js"
  }
}
```

### **Import Extensions Required:**
```javascript
// ✅ REQUIRED - Always include .js extension
import { helper } from './utils/helper.js';

// ❌ WILL BREAK - Missing extension
import { helper } from './utils/helper';
```

## 🚨 **CRITICAL WARNINGS:**

### **Never Create These Files:**
- ❌ `.eslintrc.js` (use `.eslintrc.json`)
- ❌ `babel.config.js` (use `babel.config.json`)
- ❌ Any config file with `module.exports`

### **Dependencies vs Application Code:**
- ✅ **Dependencies** (node_modules) can use CommonJS
- ❌ **Application code** must be pure ES modules
- ✅ **Prisma generated files** use CommonJS (that's normal)

## 📋 **Quick Fix Commands:**

### **If ESLint Breaks:**
```bash
# 1. Remove any CommonJS config files
rm .eslintrc.js

# 2. Ensure backend has proper config
cat backend/.eslintrc.json

# 3. Check package.json
grep '"type": "module"' backend/package.json

# 4. Restart ESLint in VSCode
# Ctrl+Shift+P → "ESLint: Restart ESLint Server"
```

## 🎯 **Remember:**
**ES MODULES ONLY = WORKING TOOLING**
**COMMONJS MIXING = BROKEN EVERYTHING**

This is a **non-negotiable** project requirement for maintaining a functional development environment.
