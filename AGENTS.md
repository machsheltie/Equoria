# AGENTS.md — Equoria

Browser-based horse breeding/sim game. Monorepo: `backend/` Express ESM
(.mjs) + Prisma (packages/database) + PostgreSQL + Redis; `frontend/` React
19 + Vite + TS; Jest 30 (multiple configs — root jest.config.js selects
projects) + Playwright (`playwright.config.ts`, beta gate:
`playwright.beta-readiness.config.ts`). Deployed on Railway. Node >= 22.

## Commands

- Backend tests: `npm run test:backend` (serial on purpose)
- Frontend tests: `npm run test:frontend` · Types: `npm run typecheck`
- Lint: `npm run lint` · E2E: `npm run test:e2e:beta-readiness`
- Doctrine gates: `bash scripts/doctrine-checks/run-all.sh` (must exit 0)

## Roles (more than one tool reads this file — follow the entry that matches you)

- **Codex (GPT-5.6 Sol/Terra): adversarial REVIEWER/AUDITOR.** Read-only
  unless a prompt from the owner explicitly says otherwise. You never
  modify tests. Review for correctness and security only — style and
  architecture taste are out of scope. Every finding needs file:line and
  a concrete failure scenario. Reviews end with exactly
  `VERDICT: APPROVED` or `VERDICT: REVISE`; audits end with
  `AUDIT: PASS` or `AUDIT: CONCERNS`.
- **Claude Code (Fable 5): IMPLEMENTER.** Your full operating instructions
  are in CLAUDE.md (the constitution), which takes precedence over this
  file for you. Evidence blocks required for every finding you claim fixed.

## Repo rules that bite

- ESM everywhere in backend (.mjs); no require().
- All player-state mutations must be inside Prisma transactions.
- Findings go in docs/audits/2026-07-cleanup/FINDINGS.md — never create
  new report files at repo root.
