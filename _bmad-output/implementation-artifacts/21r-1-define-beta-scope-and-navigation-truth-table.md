# Story 21R-1: Define Beta Scope and Navigation Truth Table

**Epic:** 21R - Beta Deployment Readiness Remediation  
**Priority:** P0  
**Status:** done  
**Corrected:** 2026-04-14

## Current Truth

Earlier 21R-1 artifacts treated hidden and read-only classifications as acceptable beta outcomes. That is no longer the active beta policy. Active beta routes must be implemented as live working routes unless product explicitly removes them from beta scope.

## Corrected Policy

- Active beta routes are `beta-live`.
- `betaRouteScope.ts` no longer exports read-only or hidden route helpers.
- `App.tsx` no longer uses beta route blocking for active routes.
- `NavPanel` exposes the active primary route set in beta mode.
- `docs/beta-route-truth-table.md` documents historical hidden/read-only labels as non-completion states.

## Completed Corrections

- [x] `/onboarding` is beta-live and uses the starter-horse customization contract through `advanceOnboarding`.
- [x] `/stable` is beta-live and renders real backend horses.
- [x] `/horses/:id` is beta-live and no longer blocked by beta routing.
- [x] `/community`, `/my-stable`, `/crafting`, `/forgot-password`, and `/reset-password` are beta-live instead of hidden.
- [x] Production mock sources named in the 21R review were removed or replaced with real API-backed empty states.
- [x] `sprint-status.yaml` marks 21R-1 through 21R-3 done while keeping the broader beta readiness gate blocked for remaining 21R work.

## Verification

- [x] Frontend focused suite passed.
- [x] Backend starter/onboarding integration suite passed.
- [x] Production mock scan passed with no matches.
- [x] Runtime beta-exclusion scan passed with no production matches.
- [x] Required Playwright beta-critical command passed in real beta mode.

## Completion Evidence

21R-1 is complete for the 21R-1 through 21R-3 correction scope. Broader beta deployment readiness remains blocked until the later 21R hardening stories are completed.
