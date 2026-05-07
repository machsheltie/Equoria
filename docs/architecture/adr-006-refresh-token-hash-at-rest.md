# ADR-006: Refresh Token and Verification Token Hash-at-Rest (SHA-256)

**Status:** Accepted
**Date:** 2026-04-23
**Deciders:** Backend Team / 21R-AUTH workstream
**Epic:** 21R — Beta Deployment Readiness Remediation
**Implementation:** migration `20260423000000_hash_refresh_and_verification_tokens`, `backend/utils/tokenRotationService.mjs`
**Tracking:** bd `Equoria-uy73` (implementation), `Equoria-ighs` (ADR + sentinel tests)

---

## Context

Prior to April 2026, Equoria stored raw JWT strings in the `refresh_tokens` table (`token VARCHAR`) and raw hex strings in the `email_verification_tokens` table. A database read-only leak (e.g., a compromised read replica, a misconfigured backup export, or a SQL injection with SELECT privilege) would immediately yield:

- **Active session hijacking**: any non-expired raw refresh JWT could be used directly in the `refreshToken` cookie to impersonate the victim.
- **Account verification bypass**: raw email verification tokens could be submitted to the `/verify-email` endpoint without the user's email client involvement.

The vulnerability class is CWE-312 (Cleartext Storage of Sensitive Information). The threat model specifically addresses an adversary with **read-only database access but no application-layer access**.

---

## Decision

Store only the SHA-256 hex digest of tokens at rest. The raw token remains exclusively in the application layer (HTTP cookie / email link) and is hashed at the service boundary before any DB I/O.

**Hash function:** `crypto.createHash('sha256').update(token).digest('hex')` — 64-character lowercase hex string.

**Why SHA-256 (not bcrypt/scrypt)?**

1. **Brute-force infeasibility is already guaranteed by the token itself.** Refresh JWTs are signed with a 256-bit HMAC-SHA256 secret and carry a cryptographically random JTI. Email verification tokens are 64 random hex bytes. Both have ≥128 bits of entropy — the pre-image attack space is effectively infinite; bcrypt's cost factor buys nothing meaningful here (that cost exists to slow password guessing, where passwords have low entropy).
2. **Lookup performance.** Session validation occurs on every authenticated request via `trackSessionActivity`. A bcrypt comparison at every request would add 50–200 ms per request (at cost factor 12). SHA-256 is constant-time at ~500 ns.
3. **Consistency with the password-reset-tokens precedent.** `password_reset_tokens.tokenHash` already used SHA-256 before this migration.

**Migration strategy:** purge-and-rebuild (no backfill).

Raw tokens cannot be recovered from existing rows (the JWT is only persisted, not reconstructible from stored fields). Converting in-place would require the application to handle a mixed table (some rows with `token`, some with `tokenHash`) during the deployment window. The cost — force-logout all users, require re-request of pending email verifications — is acceptable as a one-time event with advance notice.

---

## Implementation

**Service layer** (`backend/utils/tokenRotationService.mjs`):

- `hashRefreshToken(token)` — public export; all callers that need to look up or store a token use this function.
- All DB writes use `tokenHash: hashRefreshToken(rawToken)`.
- All DB reads use `where: { tokenHash: hashRefreshToken(rawToken) }`.
- Log statements emit `tokenHashPrefix: tokenHash.substring(0, 12)` for observability without exposing session material.

**Schema** (`packages/database/prisma/schema.prisma`):

- `RefreshToken.tokenHash String @unique @db.VarChar(64)` — only field; raw token column removed.
- `EmailVerificationToken.tokenHash String @unique @db.VarChar(64)` — same pattern.

**Test helpers** (`backend/__tests__/setup.mjs`, `backend/__tests__/config/test-helpers.mjs`):

- `createTestRefreshToken` hashes a synthetic raw value before insert; exposes `.rawToken` on the returned record (never `.token`).
- Fail-fast guard: passing a `token` override throws immediately (caught legacy callsites before they silently inserted plaintext).

---

## Consequences

**Positive:**

- DB read leak no longer grants active sessions or verification bypass.
- No performance overhead on authentication hot path (SHA-256 ~500 ns).
- Sentinel tests (`token-rotation.test.mjs`) verify both that the hash IS stored and that the raw JWT is NOT stored, catching future regressions.

**Negative / accepted costs:**

- One-time force-logout of all users on deploy.
- Pending email verifications must be re-requested.
- Raw token is now unrecoverable from the DB; if a user's cookie is lost before rotation, the session expires naturally (no recovery path from DB side).

**Out of scope:**

- JWT_REFRESH_SECRET rotation / strength enforcement — see ADR-007 (Equoria-9y69).
- Token family invalidation semantics — governed by `tokenRotationService.mjs` reuse-detection logic, not this ADR.
