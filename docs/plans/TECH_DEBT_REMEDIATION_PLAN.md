# Comprehensive Tech Debt Remediation Plan (Zero-Mocking Mandate)

**Generated:** 2026-06-04
**Objective:** Eradicate test mocks, clear technical debt, restore CI/CD build integrity, and eliminate legacy placeholders across the codebase.

## Overview

An adversarial review of the Equoria codebase revealed several critical areas of technical debt masking test failures, hiding incomplete domain logic, and bypassing security checks. Under the strict **"no mocking"** mandate, we are transitioning all tests to rely on real databases, live data, and end-to-end integration flows.

## Action Plan (Beads Issues)

### 1. Eradicate Mock Implementations (Redis & DB)

- **Target:** `backend/__mocks__/ioredis.js`, mock database contexts.
- **Action:** Delete all mock files. Update test setups to utilize local testcontainers or native real Redis/DB instances for integration testing.

### 2. Eradicate Frontend E2E Mock Validation

- **Target:** `profile-activity.spec.ts` and other frontend specs.
- **Action:** Remove logic asserting against `'TODO'`, `'MOCK_'`, and `'allMockHorses'`. Rewrite E2E assertions to evaluate real application state and deterministic seed data.

### 3. Fix Incomplete Schema Migration in Test Fixtures

- **Target:** `userProgressAPI.integration.test.mjs` and up to 25 other legacy tests.
- **Action:** Update Prisma payloads from `user: { connect: { id: X } }` to `userId: X` where `ownerId` was deprecated in favor of `userId`.

### 4. Complete Credentials Migration in E2E Specs

- **Target:** `beta-critical-path.spec.ts`, `feed-system-phase-a.spec.ts`, `horse-detail-coat-genetics.spec.ts`.
- **Action:** Migrate away from `fs.readFileSync('test-credentials.json')` to use the standardized `readTestCredentials()` (`process.env`) helper.

### 5. Resolve Strict Linting and Missing Imports

- **Target:** `audit-fk-drift.mjs`, `diff-breed-profiles-db-vs-json.mjs`, `__tests__/config/test-helpers.mjs`, React Router config.
- **Action:** Fix curly brace and string template ESLint errors. Add `import { expect } from '@jest/globals';` to test helpers. Inject the `v7_startTransition` future flag to silence React Router warnings.

### 6. Address Over-Suppressed Security Warnings

- **Target:** `requestBodySecurity.mjs`, `uploadGuard.mjs`.
- **Action:** Replace `// eslint-disable-next-line no-control-regex` with properly validated, safe regular expressions (or equivalent string validation utilities) to ensure genuine security resilience.

### 7. Implement Missing Domain Logic (No TODOs)

- **Target:** `horseAgingSystem.mjs`, `carePatternAnalysis.mjs`.
- **Action:** Implement real retirement handling and environmental change tracking logic rather than leaving dead TODO comments in core business rules.

### 8. Clean Up Workspace & Agent Clutter

- **Target:** `.claude/worktrees/*`, stale coverage dumps.
- **Action:** Clean out >700 untracked files, refine `.gitignore`, and restore local environment hygiene.

### 9. Deliver Missing E2E Specs for Groom Lifecycle

- **Target:** Epic 21-9 (Equoria-he7i), `inventory.spec.ts`, `community.spec.ts`, `conformation-shows.spec.ts`.
- **Action:** Properly complete the partially delivered epic. Write full (non-mocked) E2E tests for the missing features to officially close the requirement gaps.

All tasks have been recorded in the `bd` issue tracker under a unified Epic.
