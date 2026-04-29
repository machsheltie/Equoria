# Migration Deploy Checklist

**Status:** active
**Effective:** 2026-04-29
**Owners:** backend / SRE
**Trigger:** any Prisma migration that purges, rehashes, or restructures rows in **authenticated tables** — `User`, `RefreshToken`, `EmailVerificationToken`, `Session`, or any future table whose values gate access decisions.

---

## Why this exists

The `20260423000000_hash_refresh_and_verification_tokens` migration (PR #97) purged every row in `RefreshToken` to swap raw JWTs for SHA-256 digests. Workers serving `/api/auth/refresh` between the migration commit and worker restart computed a hash that no longer matched anything, then mis-classified the miss as **token reuse**. The audit log filled with false reuse alerts; rate limits triggered against legitimate retry storms.

The runtime guard in `validateRefreshToken` (Phase 5 follow-up) now distinguishes "this user has zero tokens at all" from "this specific token is missing while others remain" and emits `SESSION_UPGRADE_REQUIRED` for the former — a real fix at the code layer. This checklist is the matching operational layer: prevent the storm in the first place.

Both layers are required. The runtime guard saves audit-log clarity; the checklist prevents the storm and the user-visible 401 wave.

---

## Pre-flight

- [ ] Identify whether the migration touches an authenticated table (see list above). If no, this checklist does not apply.
- [ ] If yes: write a one-paragraph migration plan into the migration's `migration.sql` header comment. Include: which rows are purged/rehashed, expected row count delta, expected user impact ("all users re-login on next refresh", "no user impact", etc.).
- [ ] Confirm the runtime guard for the affected auth path returns a sensible non-reuse signal when its lookup misses on a user with zero rows — e.g. `validateRefreshToken` returns `error: 'SESSION_UPGRADE_REQUIRED'`. If a new auth path is involved, add an equivalent guard before deploying.
- [ ] Confirm the deploy environment has its rate-limit window configured to absorb the expected re-login storm without locking out legitimate users. The default `authRateLimiter` is 5 attempts per 15 min; on a force-relogin event with N active users, only ~ (limit × users/min over the window) succeed per minute. Raise the cap temporarily if N is large.

---

## Deploy sequence

1. **Build A (drain build):** ship a build that returns `401 SESSION_UPGRADE_REQUIRED` from auth endpoints touching the about-to-be-migrated table. The frontend already treats 401 as "redirect to /login" — no UX change required, but the audit log stays clean. Wait for the rate-limit window (default 15 min) so any in-flight stampede is absorbed by the rate-limiter, not the database.
2. **Run the migration.** Block on this — do not roll forward to Build B until the migration commit succeeds AND a post-migration row count assertion confirms the expected delta.
3. **Build B (final build):** ship the final build that consumes the migrated schema. This may be the same artifact as the migration itself if Prisma's `migrate deploy` is wired into the deploy pipeline; the key requirement is that no traffic hits the migrated schema with a stale code build.

For Railway / similar platform-as-a-service deploys where Build A and Build B are typically the same artifact: add a feature flag (env var) to disable the affected auth path explicitly during the rollout window. The flag flips at the platform level before the migration step and flips back after.

---

## Post-flight

- [ ] Watch Sentry for the 30 minutes following the migration. Expected: a brief spike of `SESSION_UPGRADE_REQUIRED` audit entries equal to the active-session count from the previous 15 minutes. Unexpected: any spike of `Token reuse detected` events from the same user IDs — this means the runtime guard is not catching the cohort, and the migration is poisoning the audit log. Pause further migrations and investigate.
- [ ] Confirm the auth rate-limiter is back below saturation. If `RATE_LIMIT_EXCEEDED` events outnumber `SESSION_UPGRADE_REQUIRED` events, the limit is too tight; raise it for the next migration.
- [ ] Update this checklist's "Why this exists" section if the migration revealed a new failure mode.

---

## Out of scope

- This checklist does NOT cover schema changes that ADD nullable columns, add indexes, or otherwise leave existing rows valid. Those are non-destructive and can deploy normally.
- This checklist does NOT cover application-layer secrets rotation (JWT_SECRET, JWT_REFRESH_SECRET). Those have their own coordinated procedure (see `docs/SECURITY.md`).
- This checklist does NOT cover database engine upgrades or storage-class migrations. Those have their own runbook.

---

## Future work tracked separately

- A `migrationCohort` field on auth tables (deferred — runtime guard plus this checklist handle the common case; revisit when frequent destructive auth migrations make the audit-history value pencil out).
- Automated post-deploy assertion that the affected row count matches expectations (currently manual).
