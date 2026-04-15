---
project_name: 'Equoria'
user_name: 'Heirr'
date: '2026-03-19'
sections_completed:
  [
    'technology_stack',
    'language_rules',
    'framework_rules',
    'testing_rules',
    'code_quality',
    'workflow_rules',
    'critical_rules',
  ]
status: 'complete'
rule_count: 78
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Layer         | Technology           | Version     | Notes                                       |
| ------------- | -------------------- | ----------- | ------------------------------------------- |
| Runtime       | Node.js              | 18 (Alpine) | Docker base image                           |
| Backend       | Express              | 4.18.2      | ES Modules only (`.mjs` files)              |
| Frontend      | React                | 19.1.0      | TypeScript, Vite 7.2.7                      |
| Database      | PostgreSQL           | 12+         | Prisma ORM 6.8.2 (43 models)                |
| CSS           | Tailwind CSS         | 3.4.1       | + CSS custom properties in `tokens.css`     |
| UI Primitives | Radix UI             | Various     | Via shadcn/ui pattern                       |
| State         | TanStack React Query | 5.0         | No Redux/Zustand                            |
| Auth          | jsonwebtoken         | 9.0.2       | JWT access + refresh tokens                 |
| Testing (BE)  | Jest                 | 29.7.0      | `--experimental-vm-modules` flag required   |
| Testing (FE)  | Vitest               | 4.0.15      | + MSW 2.12.4, `onUnhandledRequest: 'error'` |
| Testing (E2E) | Playwright           | 1.55.0      | Core game flows, auth, breeding             |
| Monitoring    | Sentry               | 10.37+      | Backend + Frontend, opt-in via env var      |
| Logging       | Winston              | 3.11.0      | Structured logging                          |
| Linting       | ESLint               | 8.57        | v9 flat config format (`eslint.config.js`)  |
| Formatting    | Prettier             | 3.3.2       | Integrated via eslint-plugin-prettier       |
| Deploy        | Docker               | Multi-stage | → Railway (node:18-alpine)                  |
| Charts        | Recharts             | 3.7.0       | Lazy-loaded via code splitting              |

### Version Constraints

- TypeScript `strict: false` — permissive build (no `noImplicitAny`, no `strictNullChecks`)
- Vite dev server on port `3001`, proxies `/api` → `localhost:3000`
- `@/` path alias maps to `./src/*` (frontend only)
- Backend uses `"type": "module"` — all imports require `.js` extensions

### Codebase Scale (2026-03-19)

- Backend: 721 .mjs files, 18 domain modules, 130+ API endpoints
- Frontend: 53 pages, 356 components, 47 React Query hooks
- Database: 43 Prisma models, 6 enums, 45 migrations
- Tests: 226 backend suites (3651+ tests), Vitest frontend, Playwright E2E
- CI/CD: 5 GitHub Actions workflows

---

## Critical Implementation Rules

### Language-Specific Rules

#### ES Modules (Non-Negotiable)

- **ALWAYS** `import`/`export` — **NEVER** `require()`/`module.exports`
- **ALWAYS** include `.js` extension in backend import paths: `import { fn } from './utils/helper.js'`
- Config files must be `.json` format (`.eslintrc.json`) — never `.js` with `module.exports`
- Exception: `eslint.config.js` uses ESM `export default` (flat config format)

#### TypeScript Conventions

- `strict: false` — do NOT enable strict checks or add `noImplicitAny`
- Unused params: prefix with `_` (e.g., `_foalId`, `_trait`, `_req`)
- Function type params in interfaces: ALWAYS `_` prefix (`onTierUnlock: (_tier: number) => void`)
- ESLint enforces `argsIgnorePattern: '^_'` on BOTH `no-unused-vars` AND `@typescript-eslint/no-unused-vars`
- Test files: `@typescript-eslint/no-explicit-any: off` override — `as any` is acceptable in mocks

#### Naming Standards

- **camelCase**: variables, functions, properties (`horseId`, `taskLog`)
- **PascalCase**: classes, React components (`HorseCard`, `TrainingSession`)
- **kebab-case**: file names (`horse-detail-view.tsx`, `rate-limiting.mjs`)
- Match DB schema naming: `horseId` not `horse_id`, `taskLog` not `task_log`

#### Error Handling

- Backend: Express error middleware catches thrown errors — use `next(error)` or throw
- Frontend: React Query `onError` callbacks for mutations, ErrorBoundary for renders
- Never leak internal error details to client — return structured `{ success, message }` responses

### Framework-Specific Rules

#### React (Frontend)

- **React Query for ALL server state** — no `useState` for API data, no `useEffect` fetch patterns
- `fetchWithAuth` auto-unwraps `data.data` — hooks receive clean types (e.g., `HorseSummary[]` not `{ success, data }`)
- All pages use `React.lazy()` + `<Suspense>` with `<GallopingLoader />` fallback
- Modals: ALWAYS use `BaseModal` component — never create custom modal wrappers
- `within(section).getByTestId()` when a testid appears in multiple DOM sections
- `onUnhandledRequest: 'error'` in MSW — every API call in tests MUST have a handler

#### Express (Backend)

- All endpoints prefixed with `/api/v1/`
- 18 domain modules under `backend/modules/` — each has `routes/`, `controllers/`
- Backward-compat shims at `backend/routes/` and `backend/controllers/` — don't break these
- Module path depth: 4 levels → `'../../../utils/'` for root utils from module controllers
- Shim pattern: `export { default } from '../modules/x/routes/xRoutes.mjs'`
- Auth: JWT access + refresh tokens; `x-test-bypass-rate-limit` header for tests
- Rate limiting active — tests must use bypass header

#### Prisma (Database)

- Schema at `packages/database/prisma/schema.prisma` (43 models)
- After `prisma migrate dev`, ALWAYS run `migrate deploy` for test DB too
- JSONB fields used for flexible data: `User.settings`, `Horse.tack`
- Prisma generate on Windows: DLL rename EPERM is non-fatal (JS/TS files regenerate fine)

#### Design System

- **"Celestial Night" theme everywhere** — deep blue/gold palette, no exceptions
- **No raw hex/rgba in components** — ALWAYS use CSS custom properties from `tokens.css`
- `--discipline-*` tokens: action buttons ONLY — **FORBIDDEN** in nav, sidebar, breadcrumbs, tabs
- `--celestial-primary`: default T1 buttons, active nav states, tab underlines
- Z-index: use `--z-*` tokens (`--z-raised: 10`, `--z-modal: 70`, `--z-celebration: 90`)
- Max ONE `backdrop-filter: blur()` layer visible at any time

### Testing Rules

#### Philosophy: Balanced Mocking

- **Mock external dependencies ONLY**: database (Prisma), HTTP clients, Winston logger
- **Test real business logic** — never mock the function you're testing
- Over-mocking = ~1% success rate; balanced mocking = 90%+ success rate

#### Backend (Jest)

- Run with `node --experimental-vm-modules` (ESM support)
- 226 suites, 3651+ tests — do NOT introduce regressions
- `x-test-bypass-rate-limit` header required on all test requests
- Mock patterns: `jest.unstable_mockModule()` for ESM (not `jest.mock()`)
- Test DB: separate `equoria_test` database — run `prisma migrate deploy` after schema changes

#### Frontend (Vitest + MSW)

- MSW strict mode: `onUnhandledRequest: 'error'` — every API call needs a handler
- Use `within(section).getByTestId()` for duplicate testids across DOM sections
- `@testing-library/react` for component tests — prefer `getByRole` over `getByTestId`
- Test files: `no-explicit-any: off` override — mock typing with `as any` is acceptable

#### E2E (Playwright)

- Core flows: auth, breeding, core-game-flows
- Graceful skips for features not yet wired to live API

#### Anti-Patterns

- Never mock business logic — only external boundaries
- Never use `jest.mock()` in ESM files — use `jest.unstable_mockModule()`
- Never skip the rate-limit bypass header in backend tests
- Never use `getAllByTestId()[0]` when you mean "the one in section X" — use `within()`

### Code Quality & Style Rules

#### ESLint / Prettier

- Root `eslint.config.js` — ESLint v9 flat config with `typescript-eslint`
- Prettier integrated via `eslint-plugin-prettier` — `"prettier/prettier": "error"`
- `no-console: "off"` during development — will switch to `"warn"` pre-production
- `no-undef: "off"` (TypeScript handles this)
- Run `npm run lint:fix` to auto-fix before committing

#### File & Folder Structure

- Backend modules: `backend/modules/{domain}/routes/`, `controllers/`, optionally `models/`, `middleware/`
- Frontend pages: `frontend/src/pages/` — one file per route
- Frontend components: `frontend/src/components/{domain}/` — grouped by feature domain
- Hooks: `frontend/src/hooks/api/` — one file per API domain (e.g., `useBreeding.ts`, `useClubs.ts`)
- UI primitives: `frontend/src/components/ui/` — shadcn/ui + custom (GallopingLoader, FenceJumpBar)
- Styles: `frontend/src/styles/tokens.css` — single source of truth for design tokens
- API client: `frontend/src/lib/api-client.ts` — 57 typed endpoint methods

#### Documentation

- Add comments to all files explaining what that file does
- No raw hex values in component files — always reference which token to use
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`

#### Code Organization

- Do NOT change project structure, dependencies, linting, testing, or DB schema without permission
- Do NOT auto-generate boilerplate unless explicitly requested
- Do NOT rewrite unrelated files when resolving single feature requests

### Development Workflow Rules

#### Git & Branching

- Branch: `master` (direct commits, no feature branches currently)
- Commit style: conventional commits (`feat:`, `fix:`, `docs:`, etc.)
- Pre-push hook active — all tests must pass before push
- Husky manages git hooks (v9 at root, v8 in backend)
- lint-staged: Prettier + ESLint --fix on staged `.js/.jsx/.ts/.tsx/.mjs` files

#### Issue Tracking

- Use `bd` commands (beads) — NOT markdown TODOs, NOT TodoWrite tool
- `bd ready` → find work; `bd show <id>` → review; `bd update <id> --status=in_progress` → claim
- `bd close <id>` when done; `bd sync` at session end

#### Session Protocol

- Start: `bd ready` to find available work
- End: `git status` → `git add` → `bd sync` → `git commit` → `bd sync` → `git push`

#### Deployment

- Multi-stage Dockerfile: `frontend-builder` (Vite build) → `production` (Express serves SPA)
- `railway.toml`: runs `prisma migrate deploy` before server start
- `VITE_API_URL ?? ''` for relative API URLs in production (no hardcoded URLs)
- Sentry opt-in via env var — not required for local dev

#### Do NOT Use `&&` in Terminal Commands

- Windows environment — use separate commands or `;` instead of `&&`

### Critical Don't-Miss Rules

#### Game Mechanic Gotchas

- Training cooldown: 7-day global, uses **ms arithmetic** (`Date.now() + 7*24*60*60*1000`) — NOT `Date.setDate()` (DST clock skew)
- Breeding cooldown: 30 days
- XP per level: `100 * level * (level - 1) / 2`
- Groom/Rider retirement: mandatory 104 weeks, early at L10 or 12 assignments
- Horse age for training: must be 3+ years old
- Competition scoring: weighted 50/30/20 base stats + trait bonus + training + tack + rider ± 9% luck

#### API Client Gotchas

- `fetchWithAuth` auto-unwraps `data.data` — hooks receive `T` directly, NOT `{ success, data: T }`
- `api-client.ts` has 57 endpoints — check if one exists before creating a new one
- All API calls go through `/api/v1/` — never use bare `/api/` paths

#### Inventory System (JSONB-based)

- `User.settings.inventory` — array stored in JSONB, no separate table
- `Horse.tack` — `{ saddle?, bridle? }` object in JSONB
- First-time GET seeds inventory from Horse.tack if settings.inventory is empty
- No schema migration needed — leverages existing JSONB fields

#### Onboarding Flow

- `User.settings.completedOnboarding`: `false` = new user, `true` = done, `undefined` = legacy (no redirect)
- OnboardingGuard skips redirect when `onboardingStep >= 1` (mid-tour)
- 10-step spotlight tutorial with `data-onboarding-target` attributes on DOM elements

#### Club Route Ordering

- Static `/elections/:id/*` routes MUST come BEFORE `/:id` — otherwise Express matches election IDs as club IDs

#### Security (Non-Negotiable)

- Protected stats: speed, stamina, agility, etc. — cannot be directly modified via API
- All stat changes must go through training/competition logic
- Server-side timestamps for all operations — never trust client time
- Rate limiting on all endpoints — tests bypass with `x-test-bypass-rate-limit` header
- Input sanitization: XSS prevention, SQL injection via Prisma ORM parameterized queries

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-19
