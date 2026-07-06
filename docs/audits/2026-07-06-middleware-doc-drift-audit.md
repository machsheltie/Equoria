# Middleware Behavior & Documentation-Drift Audit — 2026-07-06

## Scope

- Areas (per user instruction): `backend/middleware/auth.mjs` (JWT/cookie), `backend/middleware/csrf.mjs` (double-submit + per-user binding), rate limiting (`rateLimiting.mjs`, `authRateLimiter.mjs`, global `apiLimiter` in `app.mjs`), request-body/query guards (`requestBodySecurity.mjs`), and the doctrine checks keeping test-only header shortcuts out of production.
- Doc audited: `.claude/rules/SECURITY.md` — every claim in §1–§5, Sentry/monitoring, A07, A09, plus spot-checks of A08/GDPR/upload/MFA implementation existence.
- Test-quality pass (hunt-mocks tiers 1–5) scoped to the security-middleware test surface.
- Mode: read/verify only — no code changes made.
- Existing `bd` issues cross-checked via `bd list --status=open` (grep for suspicious/fingerprint/sanitiz/audit/bypass/SECURITY/password/drift/doctrine).

## Summary

**Verified-backed (no action needed):** the large majority of SECURITY.md's claims about the five audited areas are accurately implemented — see "Claims verified as backed" below.

**Documentation drift found: 4 clusters** (D1–D4). **Code gaps found while verifying: 4** (C1–C4). **Test-quality pass: clean** (no skips, no bypass headers, no assertion-free tests, no internal-code mocks in the security test surface) with one structural finding (C3).

---

## D. Documentation drift (doc asserts behavior the code doesn't implement)

### D1 — Suspicious-activity detection + Sentry threshold alerting is entirely unwired (HIGH)

- **Claims:** SECURITY.md §1 "Suspicious Activity Detection" (the five patterns: 10+ failures, 20+ req/30s, 3+ IPs, 15+ sensitive ops/5min, error-then-success), §4 "Anti-Automation: Detects and blocks rapid-fire requests", §5 "Security Alerts / Automatic Detection", Sentry §"Alert Thresholds" (auth failures 5/15min, IDOR 3/10min, privilege escalation immediate), A09 "in-process suspicious-activity detection remain wired".
- **Reality:** the five patterns ARE implemented (`detectSuspiciousPatterns`, `backend/middleware/auditLog.mjs:339`) but are reachable only through the per-route `auditLog()` factory (`auditLog.mjs:49` → `logOperation` → `checkSuspiciousActivity`). Grep across production code (excluding tests) shows the factory middlewares (`auditAuth`, `auditBreeding`, `auditTransaction`, …, `auditLog.mjs:575-580`) are **mounted on zero routes**. The globally-mounted `globalAuditTrail` (`app.mjs:240`) calls `storeAuditLog` directly and never invokes the detector. `trackSecurityEventWithThreshold` (`backend/config/sentry.mjs:263`) has **zero live producers** — its only call sites are the three dead paths in `auditLog.mjs` (lines 137, 152, 317). The only live `trackSecurityEvent` caller is the rate-limit Redis-degradation alert (`rateLimiting.mjs:167`).
- **Note:** `backend/__tests__/auditLogProductionPath.test.mjs` unit-covers the dead pipeline (function-level, env-flipped) — coverage is green while the production wiring is absent. Coverage ≠ wired.
- **Adjacent:** sibling of Equoria-oey96.30 (gameIntegrity.mjs unmounted dead code documented as active). Same defect class: "documented security middleware with no mount".

### D2 — "Token Fingerprinting" has no implementation

- **Claim:** SECURITY.md §1 "Token Fingerprinting: Anti-tampering measures with user fingerprints".
- **Reality:** grep for `fingerprint` (case-insensitive) across backend production code: zero matches outside test files and `backend/tests/helpers/authHelper.mjs`. `auth.mjs` token verification has no fingerprint mechanism.

### D3 — Stale-text corrections (SECURITY.md, batchable)

1. "Password Requirements: Minimum 8 characters with complexity rules" → actual policy is **min 12 / max 128** + all 4 character classes (`authRoutes.mjs:41-52`, Equoria-ie4wc OWASP ASVS L1).
2. Env var documented as `BCRYPT_ROUNDS=12` → code reads **`BCRYPT_SALT_ROUNDS`** (`authController.mjs:151`, `passwordController.mjs:140,326`). The documented knob is silently ignored (fallback 12 masks the impact).
3. "`rejectPollutedRequestBody` … walks the parsed body **iteratively (DFS with explicit depth cap, not recursion** — guards against stack-overflow DoS)" → `assertNoPollutingKeys` (`requestBodySecurity.mjs:507`) is **plain recursion with a depth cap** (the module's own comments at line 156 say "recursive"). Property holds; mechanism description is wrong.
4. "rejecting any own property named `__proto__`, **`constructor`**, or the path `constructor.prototype`" → a bare `constructor` key in the **body** is NOT rejected — only `constructor` carrying an own `prototype` child (`requestBodySecurity.mjs:528-534`). (Query stage-1 raw scan IS stricter and rejects bare `constructor`/`prototype` segments.) Doc overstates the body-side rule.
5. A09 retention path "`backend/services/auditLogRetentionService.mjs#purgeExpiredAuditLogs()`" → moved to **`backend/modules/admin/services/auditLogRetentionService.mjs`** (wired via `backend/services/jobs/impl/retentionMaintenance.mjs`). Functionally intact; path stale.

### D4 — Stale code-comment references (in-code drift, not SECURITY.md)

1. `authRateLimiter.mjs:16` cites "rateLimiting.mjs:434-440" for the auth limiter config — actual location is now ~686-692.
2. `security.mjs:33` cites the CSP-shape sentinel at `modules/services/__tests__/security.test.mjs` — that path no longer exists (relocated per Equoria-0ys7m; `backend/__tests__/security.test.mjs` exists).
3. `rateLimiting.mjs:13,22-23` module header still claims "Graceful degradation (allows requests if Redis unavailable)" and "Defense in depth (fails open, not closed)" globally — breeding/competition/financial limiters now fail CLOSED and startup can fail-fast (already tracked as Equoria-nzhu8; noted here as the in-code twin of that doc issue).

---

## C. Code gaps found while verifying

### C1 — `sanitizeLogData` is shallow; nested secrets persist unredacted into audit_logs (P2)

- `auditLog.mjs:416-451`: redaction iterates **top-level own keys only** (`{ ...data }`, no recursion). A body like `{ user: { password: "x" } }` or `[{ token: "y" }]` persists its secret verbatim into `audit_logs.metadata` for the 90-day retention window. Arrays additionally get mangled into index-keyed objects by the spread. Doc claim affected: A09 "Secrets are redacted in stored metadata via sanitizeLogData()". Adjacent occurrence: the stale copy in `jest.setup.mjs` (C3) has the same shape plus an older field list (missing `birth`/`dob` from Equoria-iqzn). Related prior fixes: Equoria-wp0ib (params/query routed through redactor), backfillAuditLogRedaction.
- Top-level login/register bodies ARE covered (their `password` is top-level) — the exposure is nested payload shapes on sensitive-prefix mutations.

### C2 — `auth.mjs` `suspiciousActivityCache` is dead code

- Declared (`auth.mjs:13`) and periodically cleaned by a `setInterval` (`auth.mjs:470-488`, non-test only) but **never written to**. The interval runs forever doing nothing (also an unref'd-less timer in prod). Remove cache + interval, or wire it — decision leans remove (detection belongs in auditLog pipeline, see D1).

### C3 — `jest.setup.mjs` is an orphan carrying a ~300-line drifted copy of the auditLog middleware

- Not wired as a Jest setup file (configs use `tests/setup.mjs` / `__tests__/setup.mjs`). Its only consumer is `__tests__/prismaCleanupLifecycle.sentinel.test.mjs:15` importing the `cleanupPrismaInstances` re-export. The embedded auditLog copy has already drifted (pre-iqzn `sensitiveFields` without `birth`/`dob`; no DB-backed `storeAuditLog`; no `globalAuditTrail`). Risk: a maintainer greps `sanitizeLogData`/`auditLog` and edits the dead copy. Fix: slim the file to the prisma-lifecycle re-export (or repoint the one import and delete).

### C4 — Bypass-header doctrine gate does not guard the backend production tree

- `scripts/doctrine-checks/check-no-bypass-headers.sh` + `equoria_scan_bypass_headers` (scripts/lib/beta-readiness-scans.sh:107-116) scan only `tests/e2e/` and `frontend/src/lib/api-client.ts`. Backend structural coverage exists only for two files (`__tests__/middleware/bypassHeaderHardening.test.mjs` asserts `csrf.mjs` + `rateLimiting.mjs` contain no bypass literals). Grep confirms the backend production tree is clean today — but nothing prevents a future backend file (auth middleware, a route) from honoring `x-test-*` headers. Extend the scan to `backend/` (excluding test dirs) using the existing `doctrine-allow: bypass-header-literal` marker mechanism, with a sentinel-positive self-test per the existing pattern.

---

## Claims verified as backed (evidence spot list)

- **Auth:** cookie-primary + Bearer-header fallback with `req.authTokenSource` recorded (`auth.mjs:96-119,258`); HS256-only key-ring verify (`auth.mjs:160-179`); token-type gate rejects challenge/refresh as access (`auth.mjs:185-190`); 7-day max session age (`auth.mjs:192-200`); CWE-613 `passwordChangedAt` check with 30s TTL cache and **fail-closed** DB-error handling (`auth.mjs:221-252`); `requireRole` fail-closed 500 on lookup error (`auth.mjs:296-309`); `requireAdminMfa` default-off, fail-closed, mounted after `requireRole('admin')` on adminRouter (`routers.mjs:120`) AND on the app-level admin mounts `/api/v1/performance` (`app.mjs:313-319`), `/optimization`, `/memory` (`routers.mjs:219-220`).
- **CSRF:** double-submit via csrf-csrf, `X-CSRF-Token`, 403 error config (`csrf.mjs:164-177`); per-user binding via `resolveSessionIdentifier` with the documented resolution order and the Bearer-header exemption exactly as the SECURITY.md contract describes (`csrf.mjs:128-146`); `__Host-` prefix guard both set and clear paths; no fallback secret; mounted on authRouter + adminRouter (`routers.mjs:109,122`); sentinels exist (`csrfBearerHeaderBinding.sentinel.test.mjs`, `csrfPerUserBinding.test.mjs`).
- **Rate limiting:** global apiLimiter 100/15min in production with documented env table (`app.mjs:147-216`); auth limiter 200 failed/15min, `skipSuccessfulRequests: true` (`rateLimiting.mjs:686-692`); per-user keying with IP fallback and the 8xdqo X-Forwarded-For hardening; fail-closed 503 wrappers on breeding/competition/financial; startup fail-fast under `RATE_LIMIT_REQUIRE_REDIS`; no header bypasses (test knobs are env-only).
- **Body/query guards:** raw-byte JSON scan pre-parse with duplicate-key detection incl. escape-collapse (`w45l`), depth cap 32 with validated override ceiling 256, fail-closed unexpected-error handling in all four guards, two-stage query scan, urlencoded duplicate-key detection with percent-decode, sentinel-class + `Symbol.for` dispatch in the error handler, all mounted pre-route in the documented order (`app.mjs:219-225`).
- **A09:** `globalAuditTrail` mounted once after requestLogger (`app.mjs:231-240`); verbs POST/PUT/PATCH/DELETE; sensitive prefixes auth/account/bank/transactions/breeding|breed/training/admin/grooms|groom- (`auditLog.mjs:472-483`); /api and /api/vN normalization; fail-soft `storeAuditLog`; `finish`+`close` persistence; retention purge exists (moved path — D3.5).
- **Doctrine checks (scope they claim):** `check-no-bypass-headers.sh` absolute (no exclude-dirs), marker-based exemption only, sources the shared union regex (`EQUORIA_SCAN_RE_BYPASS_HEADER` incl. x-test-bypass-ownership/x-bypass/VITE_E2E_TEST); scan-library sentinel self-tests plant-and-detect.
- **Existence spot-checks:** `uploadGuard.mjs`, `fieldEncryption.mjs`, `gdprAccountService.mjs`, `mfaService.mjs` all exist as documented.

## Test-quality pass (hunt-mocks tiers) — security middleware test surface

- **Tier 1 (internal mocks):** none. Only matches are legitimate test mechanics: console/fs spies driving the doctrine scanner's error branches (`doctrineScanVanishedFile.sentinel.test.mjs`), and planted fixture strings carrying `doctrine-allow` markers (`doctrineScanPatterns.sentinel.test.mjs`). Flagged as legitimate isolation, not scheduled.
- **Tier 2 (fake data):** none in scope.
- **Tier 3 (bypass headers):** none; `tests/helpers/testAuth.mjs` explicitly documents it no longer sets `x-test-skip-csrf`.
- **Tier 4 (skips):** zero `.skip`/`fixme`/`xit` in the security test surface.
- **Tier 5 (vacuous):** zero `expect.assertions(0)` / empty-body tests.
- **Structural finding:** C3 (drifted middleware copy inside test infra). Also D1's coverage-without-wiring note.

## Cross-references to existing bd issues (not duplicated)

- Equoria-oey96.30 — gameIntegrity.mjs unmounted (covers SECURITY.md §2 protected-stats/5s-dedup/timestamp claims; verified: `gameIntegrity.mjs` contains exactly the documented controls and is unmounted).
- Equoria-nzhu8 — rate-limit fail-open/fail-closed mischaracterization (D4.3 is its in-code twin).
- Equoria-mi64z (CWE-613 missing from A07 docs) and Equoria-7rc1q (performance-metrics gating undocumented) — still valid per this audit.
- **Likely stale** (doc now contains these sections; verify + close with user approval): Equoria-49dzc (21R-SEC-5 documented), Equoria-pey97 (21R-SEC-4 documented), Equoria-xbir9 (Bearer-header CSRF contract has a full dedicated subsection).

## Issues filed from this audit

- Equoria-hjnrc — P2 — D1: suspicious-activity detection + Sentry threshold alerting unwired (decision: wire vs remove)
- Equoria-3giol — P3 — D2: Token Fingerprinting claim has no implementation
- Equoria-wvf0z — P3 — D3: SECURITY.md stale-text corrections batch (5 items)
- Equoria-hi41p — P2 — C1: sanitizeLogData shallow — nested secrets persist unredacted. **Post-filing: found to DUPLICATE Equoria-oierg (2026-07-02 review, P2).** Spec content merged into oierg (now canonical); hi41p recommended for user closure as duplicate.
- Equoria-2ghng — P3 — C2: auth.mjs suspiciousActivityCache dead code
- Equoria-xbabf — P3 — C3: jest.setup.mjs stale auditLog copy
- Equoria-3khb1 — P2 — C4: bypass-header doctrine gate backend-tree coverage
- Equoria-caqrq — P3 — D4: stale code-comment references (authRateLimiter, security.mjs)
