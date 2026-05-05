# ADR-005: Single CSRF Enforcement Path via `csrf-csrf` `doubleCsrfProtection`

**Status:** Accepted
**Date:** 2026-04-22
**Deciders:** Backend Team / 21R-AUTH workstream
**Epic:** 21R — Beta Deployment Readiness Remediation (Story 21R-AUTH-4)
**Implementation:** commit `6da8925e` ("refactor(csrf): unify enforcement path and split authenticated auth routes")
**Tracking:** bd `Equoria-aju`

---

## Context

Until April 2026, Equoria carried two parallel CSRF enforcement implementations in `backend/middleware/csrf.mjs`:

1. **A custom `applyCsrfProtection` wrapper** that pretended to use a session by reading and writing
   `req.session`, mutated `Object.prototype.headers` to inject HMAC fields onto every request,
   and recognized an `x-test-skip-csrf` header that allowed test runs to bypass the entire check.

2. **`csrf-csrf`'s `doubleCsrfProtection`** — the standard double-submit-cookie pattern, with
   no server-side session state, no prototype mutation, and no test-bypass awareness.

Both were live concurrently. The custom path carried three real defects, each independently
unacceptable under 21R doctrine:

- **Prototype pollution surface (CWE-1321).** The custom wrapper mutated `Object.prototype.headers`
  to thread state through Express. Any other code that ever wrote to `Object.prototype` keys could
  collide, and the mutation itself was a permanent global side-effect of importing the module.
  21R-SEC-1 / 21R-SEC-3 / 21R-SEC-4 tightened other prototype-pollution surfaces; leaving an
  intentional one in the auth chain contradicted that work.

- **Fake `req.session` dependency.** Equoria has no server-side session store. The middleware
  read `req.session.csrfToken` from an object that, in production, only existed because a
  separate middleware fabricated it. Tests mocked it carefully; production worked by accident.
  When the fabrication path drifted (e.g., during the 21R-AUTH-1 refresh-cookie hotfix), the
  CSRF check silently degraded.

- **`x-test-skip-csrf` bypass header.** Production middleware code branched on a test-only
  header, meaning the production code path was _aware_ of the test environment. Per 21R doctrine
  (`CLAUDE.md` §"21R Beta Readiness Doctrine"), no bypass-header awareness is permitted in
  production code. Equoria-6gw closed the test-side purge of the header; this ADR closes the
  production-side path that consumed it.

A single live CSRF implementation was required to make the security contract auditable.

---

## Decision

**Collapse to `csrf-csrf`'s `doubleCsrfProtection` as the sole authoritative CSRF enforcement
path.** The custom `applyCsrfProtection` wrapper, the `req.session` dependency, the
`Object.prototype.headers` mutation, and the `x-test-skip-csrf` awareness are deleted from
production code.

The contract is now:

| Element               | Value                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Library               | `csrf-csrf` (`doubleCsrf` factory)                                                                       |
| Pattern               | Double-submit cookie (browser sends cookie automatically; client sends matching token in header)         |
| Cookie name           | `__Host-csrf` in production, `_csrf` otherwise                                                           |
| Token header          | `X-CSRF-Token`                                                                                           |
| Token issuance        | `GET /auth/csrf-token` (body + Set-Cookie); piggybacked on register/login/refresh responses (21R-AUTH-3) |
| Session identifier    | Stable HMAC salt `'equoria-csrf-v1'` (constant per environment)                                          |
| Methods checked       | POST, PUT, PATCH, DELETE                                                                                 |
| Methods ignored       | GET, HEAD, OPTIONS                                                                                       |
| Failure mode          | 403 with `code: INVALID_CSRF_TOKEN`                                                                      |
| Server-side session   | None                                                                                                     |
| Test-bypass awareness | None                                                                                                     |

The exported surface from `backend/middleware/csrf.mjs` is:

- `csrfProtection` — re-export of `doubleCsrfProtection`. Mounted on every authenticated and
  admin router (`backend/app.mjs:159` for `authRouter`, `backend/app.mjs:165` for `adminRouter`).
- `csrfErrorHandler` — translates the library's `EBADCSRFTOKEN` error into the API's canonical
  `{ success: false, message, code: 'INVALID_CSRF_TOKEN' }` envelope at HTTP 403.
- `getCsrfToken` — handler for `GET /auth/csrf-token`.
- `issueCsrfToken` — best-effort piggyback used by the auth handlers (register/login/refresh)
  to seed the cookie + return the token in the response body, so the first authenticated
  mutation can skip the separate token-fetch round-trip.
- `CSRF_COOKIE_NAME` — exported for tests and the `cookieConfig` helper.

The HMAC salt is intentionally constant (per environment) rather than derived from `req.ip`.
This is a deliberate trade-off: see _Consequences > Negative_ below.

---

## Consequences

### Positive

- **Removes the prototype-pollution attack surface** in the auth chain. No code path in
  `backend/middleware/csrf.mjs` mutates `Object.prototype` any more.
- **Removes ~667 net lines of code** across `csrf.mjs` and `authRoutes.mjs` (the unification
  also split authenticated auth routes onto `authRouter` so they inherit the canonical chain —
  see commit `6da8925e` stat: `4 files changed, 186 insertions(+), 853 deletions(-)`).
- **One contract to reason about.** The cookie name, header name, ignored-methods list, error
  shape, and HMAC algorithm now have exactly one source of truth (`csrf-csrf` library
  configuration in `csrf.mjs:48-61`).
- **No server-side session state.** The auth chain remains stateless, consistent with
  Equoria's stateless-JWT model.
- **IP rotation no longer invalidates CSRF tokens mid-session.** Mobile users moving between
  Wi-Fi and cellular, or users behind carrier-grade NAT, can keep using the same token instead
  of being forced through a re-fetch + retry cycle.
- **Test-bypass awareness has been excised from production.** Production code no longer
  recognises `x-test-skip-csrf` in any form. The header still appears in three test files
  as a _sentinel_ (asserting the bypass is ignored, not invoking it) — see _Adjacent locations_
  below for why those occurrences are intentional.

### Negative

- **CSRF tokens are not bound to the user's IP.** A constant HMAC salt means a token captured
  from User A's traffic could in principle be replayed by User B if User B also possesses
  User A's CSRF cookie. This trade-off is acceptable because:
  - The CSRF cookie is intentionally **not** `HttpOnly` (`backend/utils/cookieConfig.mjs:99`,
    `httpOnly: false`) — the double-submit pattern requires the client's first-party JS to
    read the cookie value and copy it into the `X-CSRF-Token` request header.
  - The same-origin policy prevents _cross_-origin scripts from reading the cookie. An attacker
    page on `evil.example` cannot read the cookie set on the Equoria origin, so it cannot
    fabricate a matching `X-CSRF-Token` header — which is the actual security guarantee of
    the double-submit pattern.
  - `sameSite: 'strict'` in production (`cookieConfig.mjs:35, :101`) blocks the cookie from
    being attached to cross-site requests at all, providing defence-in-depth.
  - The HMAC binds the token to `JWT_SECRET`, not to session identity (`cookieConfig.mjs:90-91`),
    so a token issued in one process is verifiable by any process sharing the secret without
    requiring shared session state.
  - IP binding adds nothing once same-origin + `sameSite=strict` are enforced — and it breaks
    legitimate users behind carrier-grade NAT or who switch networks mid-session.
- **Library upgrade introduces supply-chain risk.** `csrf-csrf` is a third-party dependency.
  Mitigated by Dependabot (configured for daily npm audits — see `SECURITY.md`).
- **`req.session` references remain in `backend/middleware/sessionManagement.mjs`.** That
  module is a separate concern (rate-limit-window tracking, multi-session enforcement) and
  uses an in-memory store, not Express session. The aju issue scoped its `req.session`
  removal to `csrf.mjs:26-47` only; sessionManagement is out of scope for this ADR.

### Neutral

- **Tests must use real CSRF tokens.** The test helper `backend/tests/helpers/testAuth.mjs`
  exposes `withAuthCsrf` for state-changing requests, which fetches a real token via
  `GET /auth/csrf-token` before issuing the mutation. Tests that fail to use it now correctly
  fail with 403 — that is the intended behaviour, not a regression.
- **Three test files still mention `x-test-skip-csrf` literally.** Those references are
  sentinels — they assert that the bypass is _ignored_, not that it works. See _Adjacent
  locations_ for the audit list.

---

## Alternatives Considered

1. **Keep both implementations and run them side-by-side.** Rejected. Doubles the maintenance
   surface, leaves the prototype-pollution mutation in place, and prevents auditing the live
   contract — there is no way to be sure which path enforced a given request. 21R doctrine
   specifically calls out "no two-tier system" as not-a-fix.

2. **Build a custom in-house CSRF implementation that addresses the three defects.** Rejected.
   `csrf-csrf` is a well-maintained library (last reviewed for CVEs as of `npm audit`
   2026-04-22) with the same double-submit-cookie semantics. Re-implementing it would be a
   net loss: more code, more maintenance, no security gain.

3. **Move to a session-bound CSRF token (e.g., `express-session` + `csurf`).** Rejected.
   Requires introducing server-side session state which Equoria explicitly does not have.
   Adopting `express-session` would reintroduce a state surface (Redis or memory store) that
   the stateless-JWT architecture has been designed to avoid. `csurf` was also deprecated in
   2022, leaving `csrf-csrf` as the modern replacement.

4. **Bind the CSRF token to `req.ip` as the session identifier.** Rejected. Mobile users and
   users behind carrier-grade NAT see frequent IP rotation; this would force a token re-fetch
   on every IP change, manifesting as random 403s on otherwise-valid mutations. The same-origin
   policy already provides the security boundary that IP binding would attempt to enforce.

---

## Adjacent Locations / Sentinel References

`x-test-skip-csrf` still appears as a literal string in three places. None of them is a
live bypass; all three are intentional doctrine sentinels:

| File                                                                           | Purpose                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `backend/__tests__/integration/csrf-integration.test.mjs:5`                    | Comment documenting that the integration tests must NOT set the header — exercises the real enforcement path.      |
| `backend/__tests__/integration/security/rate-limit-no-bypass.test.mjs:30, :58` | Sentinel test that asserts the bypass header is ignored at runtime. Removing this would lose the regression guard. |
| `backend/tests/helpers/testAuth.mjs:17`                                        | Comment confirming the helper no longer sets the header.                                                           |

These are protected by the doctrine-checks scan (Equoria-5nqe / Equoria-ocy3 work) — any
attempt to _use_ the header in production code or in a non-sentinel test will fail CI.
The sentinels themselves are excluded from the bypass-header gate via the documented
`--exclude-dir=readiness` / sentinel-test convention.

---

## What Was NOT Done in This ADR

Listed for transparency per `.claude/rules/OPTIMAL_FIX_DISCIPLINE.md` §6:

- **Route mount consolidation.** Authentication routes are still served from both `/api/auth/*`
  (legacy) and `/api/v1/auth/*` (canonical). Consolidating to `/api/v1/auth/*` only is tracked
  separately as `Equoria-grt` (21R-AUTH-7).
- **Session-lifetime regression tests + nightly CI job.** Tracked separately as `Equoria-o5f`
  (21R-AUTH-6).
- **`req.session` removal from `sessionManagement.mjs`.** Out of scope; that module's session
  references are an in-memory rate-limit/multi-session store, not the fake `req.session`
  formerly read by csrf.mjs. No defect there.
- **Old unit-style `__tests__/middleware/csrf.test.mjs`.** Already deleted in commit
  `07970fd5` ("test(csrf): add async withAuthCsrf helpers + delete dead mock tests",
  2026-04-22) along with two sibling mock-heavy suites (`bypassHeaderHardening.test.mjs`
  and `unit/security/csrf-validation.test.mjs`) — 950 lines of mock-based coverage
  removed in favour of the real-flow integration suite at
  `backend/__tests__/integration/csrf-integration.test.mjs`, which exercises the live
  enforcement path against the real Express app and is the canonical replacement.

---

## References

- **Implementation commit:** `6da8925e` — `refactor(csrf): unify enforcement path and split authenticated auth routes`
- **Cookie-seeding (piggyback) commit:** `25551e77` — `feat(auth): seed CSRF cookie on register/login/refresh (21R-AUTH-3)`
- **Cookie-parser fallback fix:** `19bd38b8` — `fix(auth): make issueCsrfToken a no-op when cookie-parser is absent (21R-AUTH-3)`
- **Live module:** `backend/middleware/csrf.mjs`
- **Mount points:** `backend/app.mjs:135` (import), `:159` (authRouter), `:165` (adminRouter)
- **Integration coverage:** `backend/__tests__/integration/csrf-integration.test.mjs`
- **Production-parity sentinel:** `backend/__tests__/integration/security/rate-limit-no-bypass.test.mjs`
- **Test helper (real-token path):** `backend/tests/helpers/testAuth.mjs` (`withAuthCsrf`)
- **Doctrine references:** `CLAUDE.md` §"21R Beta Readiness Doctrine", `.claude/rules/EDGE_CASE_FIX_DISCIPLINE.md` §3 (no silent catches), `.claude/rules/OPTIMAL_FIX_DISCIPLINE.md` §3 (adjacent-locations check)
- **Library:** [`csrf-csrf` on npm](https://www.npmjs.com/package/csrf-csrf)
