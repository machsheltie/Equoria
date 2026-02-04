# 🐎 Equoria - Horse Breeding & Competition Simulation

A comprehensive horse breeding and competition simulation game backend built with Node.js, Express, and PostgreSQL.

## Rules
- Review the .augment/rules folder. 
- Review GENERAL_RULES.md after every completed task
- Review DEV_NOTES.md and utilize it
- Review TODO.md and utilize it
- Review PROJECT_MILESTONES.md and utilize it
- Review .augmentignore
- Use camelCase for all variables, properties, and functions.
- Use ESModules syntax only: import/export, not require/module.exports.
- Include .js in all import paths.
- Ensure naming is consistent with schema (e.g., horseId, taskLog).
- Avoid duplicate naming patterns or mismatched property names.
- Assume our files use .js with "type": "module" in package.json.
- Add comments to all files explaining what that file does for easy review of code

## 🔧 Behavior Expectations
- Treat all tasks as a senior full stack developer would: prioritize maintainability, security, and scalability.
- Follow best practices in Node.js, React, PostgreSQL, Prisma, Jest, and ESM.
- Use thoughtful, root-cause debugging. Do not patch over errors just to get tests to pass.
- Always ask "What would you like me to do next?" before continuing beyond the scope of the request.
- Review .rooignore
-Maintain consistency across the codebase.
- Review GENERAL_RULES.md after every completed task
- Review CONTRIBUING.md after every completed task

## 🧪 Test-Driven Development (TDD)
- When writing new features, write Jest tests first based on requirements.
- Then implement only the code necessary to pass the test.
- Avoid shallow mocks unless integration with external services is being isolated intentionally.
- Follow our balanced, minimal mocking strategy

## ❌ Do Not...
- Do not use `&&` in terminal commands. Use Windows-compatible alternatives like running commands on separate lines.
- Do not auto-generate boilerplate code unless explicitly requested.
- Do not rewrite unrelated files when resolving single feature requests.
- Do not use common js
- Do not change eslint settings without permission
- Do not change the project structure without permission
- Do not change the project dependencies without permission
- Do not change the project naming conventions without permission
- Do not change the project linting settings without permission
- Do not change the project testing settings without permission
- Do not change the project database schema without permission
- Do not change the project database migration system without permission

## ✅ Linting
- Use `npm run lint:fix` to auto-fix formatting issues.
- ESLint warnings like "prefer-destructuring" should be auto-corrected when possible.
- ESLint errors must be fixed before committing.
- Do not commit code that does not pass linting.
- Do not commit code that does not pass tests.
- Do not commit code that does not pass security audits.
- Do not commit code that does not pass performance audits.
- Do not commit code that does not pass accessibility audits.
- Do not commit code that does not pass best practices audits.

## 🗂 Project Files to Update
After completing significant tasks, do the following:

### 1. Milestone Tracking
**File:** `PROJECT_MILESTONES.md`
- Add a new entry for each significant feature completion.
- Include date, feature name, and a brief summary of the completion.

### 2. Development Notes
**File:** `DEV_NOTES.md`
- Add a new section for each day's work.
- Include date, change area, and summary of work.
- Describe decisions made, commands run, and context for changes.
- Use bullet points or short entries with timestamps if needed.

### 3. TODO List
**File:** `TODO.md`
- Utilize TODO.md to record tasks, bugs, and areas for improvement.
- Add completed tasks to the "Recently Completed" section.
- Include date, task description, and any relevant notes.

## 📦 File Paths
- Prisma schema: `packages/database/prisma/schema.prisma`
- Main backend: `backend/`
- Frontend app: `frontend/`
- CI/Testing config: `.github/workflows/` and `scripts/`