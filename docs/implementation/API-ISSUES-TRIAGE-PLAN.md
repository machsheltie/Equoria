# API Issues Triage and Remediation Plan

## Purpose
Create a single, evidence-driven plan to stabilize API behavior, unblock integration work, and reduce operational risk without guessing.

## Scope (Open Beads)
The following open beads are API-related or API-adjacent and are prioritized here:

| ID | Title | Priority | Owner | Primary Area | Risk |
| --- | --- | --- | --- | --- | --- |
| Equoria-0rf | API issues triage and remediation plan | 1 | unassigned | Planning | Coordination |
| Equoria-0qw | Backend API Integration - Replace mock data with real endpoints | 1 | claude | Frontend integration | Feature correctness |
| Equoria-50n | Fix Backend Redis Test Environment - 62 failing test suites | 1 | claude | Test infrastructure | Reliability gate |
| Equoria-56f | Add rate limiting/backpressure | 1 | unassigned | API protection | Stability at load |
| Equoria-e6l | Scale plan: clustering and DB pool | 1 | unassigned | Runtime/DB | Capacity |
| Equoria-hum | Add caching for hot reads | 2 | unassigned | Data access | Latency/DB load |
| Equoria-vlw | Optimize training status query | 2 | unassigned | Query efficiency | Latency/DB load |
| Equoria-2r2 | Expand MSW coverage for auth and error cases | 3 | unassigned | Frontend test reliability | Regression risk |
| Equoria-3tq | Reduce synchronous logging overhead | 3 | unassigned | Runtime | Throughput |

## Current Artifacts (Authoritative References)
- `BACKEND_API_ENDPOINTS.md` for discovered endpoints and base paths.
- `docs/api-contracts-backend/index.md` for API contracts.
- `docs/implementation/API-CLIENT-PLAN.md` for frontend client wiring.
- `backend/__tests__` and `backend/tests` for existing validation coverage.

## Improved Persona: The Resurrect (API Stabilization)
Role: Senior SRE + TDD specialist focused on API stability, test reliability, and safe integration.

Operating rules:
1) No fix without reproduction: create a failing test or a minimal reproduction script first.
2) Trust runtime evidence over comments: use tests, logs, and response payloads as ground truth.
3) Minimize blast radius: smallest viable change, guard with tests, then refactor.
4) Protect contracts: document response shapes and verify with tests or schema checks.
5) Favor rollback safety: every change should be reversible without data loss.

Standard loop:
- Recon: locate impacted routes, controllers, models, and tests.
- Characterize: baseline behavior with a characterization test if behavior is unclear.
- Reproduce: add a failing test that expresses the desired outcome.
- Remediate: implement the smallest fix that makes the test pass.
- Refactor: clean up and remove temporary scaffolding.

## Triage Summary (Why These Items Matter)
- Integration risk: `Equoria-0qw` depends on reliable API shape and auth flows; test gaps in `Equoria-2r2` hide regressions.
- Stability risk: `Equoria-50n` blocks reliable test runs; `Equoria-56f` and `Equoria-3tq` protect against overload.
- Capacity risk: `Equoria-e6l`, `Equoria-hum`, and `Equoria-vlw` are required for throughput and DB health.

## Remediation Plan (Phased)

Phase 0: Intake and alignment
- Confirm owners for open beads and validate current status from `bd list`.
- Align API base URL and auth strategy across `docs/implementation/API-CLIENT-PLAN.md`, `.env`, and frontend config.
- Identify the current failing test suites and the minimal reproduction steps for each.

Phase 1: Test reliability gates
- Close `Equoria-50n` by reducing backend test flakiness and stabilizing the Redis test environment.
- Expand MSW coverage in `Equoria-2r2` to cover auth and error paths used by API integration.
- Exit criteria: backend tests and frontend API client tests run reliably in CI.

Phase 2: Integration correctness
- Execute `Equoria-0qw` using the API contracts in `docs/api-contracts-backend/`.
- Enforce contract conformance in the frontend client: request/response shapes and error handling.
- Exit criteria: feature routes use real endpoints with consistent error handling and loading states.

Phase 3: Performance protection
- Implement `Equoria-56f` (rate limiting/backpressure) and `Equoria-3tq` (async logging) to harden hot paths.
- Optimize `Equoria-vlw` to eliminate N+1 query patterns in training status.
- Exit criteria: load test results show stable latency and no DB saturation.

Phase 4: Capacity and caching
- Execute `Equoria-e6l` (clustering/DB pool plan) and `Equoria-hum` (cache hot reads).
- Exit criteria: documented scale plan with configuration defaults and verified cache hit paths.

## Risks and Dependencies
- Shared ownership: `Equoria-0qw` and `Equoria-50n` are assigned to another owner; coordinate before changes.
- Contract drift: API docs may not match runtime payloads; verify with integration tests before updating clients.
- Environment drift: API base URL and auth mode must be confirmed across `.env` files and frontend config.

## Verification Gates (Minimum)
- One failing test per change before remediation.
- Contract checks for any API shape change (test or schema).
- Load-safety check after rate limiting/logging changes.
