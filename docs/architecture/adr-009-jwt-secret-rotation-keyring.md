# ADR-009: JWT Secret Rotation via Two-Key Ring (current + optional previous)

**Status:** Accepted
**Date:** 2026-05-18
**Deciders:** Backend / Security
**Epic:** 21R — Beta Deployment Readiness
**Implementation:** `backend/utils/jwtKeyRing.mjs`; wired into
`backend/middleware/auth.mjs` (access verify + `generateToken`) and
`backend/utils/tokenRotationService.mjs` (refresh verify)
**Tracking:** bd `Equoria-gjdj`

---

## Context

Before this change, every JWT sign/verify call site read a single static env
var directly (`process.env.JWT_SECRET` / `process.env.JWT_REFRESH_SECRET`).
Consequence: rotating either secret **instantly invalidated every live
session** — all old, still-unexpired access and refresh tokens failed
signature verification the moment the new secret was deployed. There was no
multi-key verification window, so secret rotation was effectively a forced
global logout. This is the gap flagged by the security report's A02
recommendation ("key rotation schedule for JWT_SECRET").

Refresh-token _rotation_ (the per-token family/jti rotation in
`tokenRotationService.mjs`) already existed; that is orthogonal — it rotates
token _identifiers_, not the signing _key_.

## Decision

Introduce a two-key ring per token kind in `backend/utils/jwtKeyRing.mjs`:

- **Sign** always with the **current** secret (`JWT_SECRET` for access,
  `JWT_REFRESH_SECRET` for refresh). The previous secret is **never** used to
  sign — enforced by `getSigningSecret()` (no previous-key path) and a unit
  test.
- **Verify** with the **current** secret first; only on a pure signature
  mismatch (`JsonWebTokenError`) retry against an **optional previous**
  secret (`JWT_SECRET_PREVIOUS` / `JWT_REFRESH_SECRET_PREVIOUS`) — and only if
  that env var is set.

Invariants (locked by `modules/services/__tests__/jwtKeyRing.test.mjs`):

- Token signed with current secret → verifies.
- Token signed with previous secret → verifies **only while** the
  `*_PREVIOUS` var is set (the overlap window).
- Token signed with previous secret after the window closes
  (`*_PREVIOUS` unset) → rejected.
- Token signed with an unknown secret → rejected even when a previous secret
  is configured.
- `TokenExpiredError` / `NotBeforeError` / algorithm-confusion errors are
  propagated immediately and are **not** retried against the previous key
  (an expired token must read as expired, not be masked by a fallback).

### Alternative considered

**JWT `kid` header + a keyed map of secrets.** Standard for asymmetric
multi-key setups. Rejected for now: this codebase uses symmetric HS256 with
exactly two secrets in play during a rotation; a `kid` registry adds a token
header field and migration concerns (old tokens have no `kid`) for no benefit
over "try current, then previous." If the system ever moves to >2
simultaneous keys or asymmetric keys, revisit and adopt `kid`. Noted here so
the choice is explicit, not accidental.

## Rotation Runbook

Rotating the access secret (`JWT_SECRET`). Same steps apply to the refresh
secret using `JWT_REFRESH_SECRET` / `JWT_REFRESH_SECRET_PREVIOUS`.

1. **Generate** a new strong secret (≥32 chars; the deploy will fail fast
   otherwise — see `backend/utils/runtimeSecretPolicy.mjs`):
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
2. **Open the overlap window.** In the environment manager set:
   - `JWT_SECRET_PREVIOUS` = the **old** `JWT_SECRET` value
   - `JWT_SECRET` = the **new** secret
     Deploy. New tokens sign with the new secret; tokens still in flight that
     were signed with the old secret continue to verify via
     `JWT_SECRET_PREVIOUS`. **No user is logged out.**
3. **Wait out the longest token lifetime.** Access tokens:
   `JWT_ACCESS_TOKEN_EXPIRY` (default 24h). Refresh tokens:
   `JWT_REFRESH_TOKEN_EXPIRY` (default 7d). Wait at least the **refresh**
   lifetime (the longer of the two) so no old-secret token can still be live.
   Conservative default: wait 8 days after step 2.
4. **Close the window.** Unset `JWT_SECRET_PREVIOUS` (remove the env var).
   Deploy. Any token still signed with the old secret is now rejected — the
   old key is fully retired.
5. **Verify.** Confirm logins, refreshes, and authenticated requests work and
   that no `JWT_SECRET_PREVIOUS` remains set in the environment.

**Rollback:** if step 2 causes problems, restore the old `JWT_SECRET` and
remove the new value; because old tokens were never invalidated, this is safe.

**Do not** leave `JWT_SECRET_PREVIOUS` set indefinitely — an indefinitely-open
window means a compromised old secret stays valid forever. Closing the window
(step 4) is mandatory, not optional.

## Consequences

- Secret rotation no longer forces a global logout.
- `.env.example` documents the optional `JWT_SECRET_PREVIOUS` /
  `JWT_REFRESH_SECRET_PREVIOUS` vars.
- All access/refresh JWT verification routes through `verifyWithKeyRing`;
  signing routes through `getSigningSecret`. CSRF's HMAC (csrf-csrf, keyed by
  `JWT_SECRET`) is **out of scope** for this ADR — it is not a JWT and would
  need its own rotation design; rotating `JWT_SECRET` per this runbook will
  invalidate outstanding CSRF tokens (acceptable: CSRF tokens are short-lived
  and re-minted per session).
- The security report A02 note is updated to reference this ADR.
