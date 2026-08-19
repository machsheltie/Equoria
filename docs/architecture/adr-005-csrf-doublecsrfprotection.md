# ADR-005: One CSRF Enforcement Path with `csrf-csrf`

**Status:** Accepted
**Date:** 2026-04-22
**Scope:** CSRF middleware and protected-router placement

## Load rule

Load this ADR only when changing CSRF enforcement, CSRF token delivery, session binding, cookie/header behavior, or where protection is mounted. Verify all details against `backend/middleware/csrf.mjs` and `backend/app/routers.mjs`.

## Context

Equoria previously carried a custom CSRF wrapper alongside `csrf-csrf`. The custom path fabricated session state, mutated a global prototype, and recognized a test-only bypass header. Two live enforcement paths made security behavior ambiguous and allowed tests to exercise behavior production did not share.

## Decision

Use the `csrf-csrf` double-submit-cookie implementation as the only CSRF enforcement path.

Current invariants:

- `backend/middleware/csrf.mjs` owns token generation, validation, cookie naming, and the `x-csrf-token` header contract.
- Safe methods (`GET`, `HEAD`, and `OPTIONS`) are ignored by the CSRF check.
- Protected authenticated auth routes and admin routes receive the same `csrfProtection` middleware through `backend/app/routers.mjs`.
- Public authentication routes remain outside that protected sub-router where a pre-existing authenticated session is not required.
- Production code must not contain a test-bypass header, prototype mutation, or a second hand-written validation path.
- The application exposes the versioned `/api/v1` API; this ADR does not authorize an unversioned compatibility mount.

## Consequences

- Tests must obtain and submit a real CSRF token when exercising protected state-changing requests.
- A change to cookie attributes, token binding, proxy/origin assumptions, or router placement is security-sensitive and must include focused tests.
- This ADR records the single-path choice. Live middleware and router code remain the source of operational details.
