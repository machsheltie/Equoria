# Sentry Configuration and Telemetry Guardrails

**Status:** active source-aligned guide
**Last verified:** 2026-08-19

Sentry is optional and initializes only when the relevant DSN is configured. Backend behavior lives in `backend/config/sentry.mjs`; frontend behavior lives in `frontend/src/lib/sentry.ts`. Those files and their tests override this guide.

## Loading rule

Load this file only for Sentry setup, telemetry behavior, alert thresholds, monitoring changes, or telemetry privacy. It is not a general security assessment or incident-status document.

## Configuration

Use the tracked environment templates:

- Backend: `SENTRY_DSN` in `backend/.env.example`
- Frontend: `VITE_SENTRY_DSN` in `frontend/.env.example`
- Backend release label: optional `SENTRY_RELEASE` consumed by `backend/config/sentry.mjs`

Store real DSNs in the authorized platform secret store. Do not commit them, paste them into documentation, or print them in logs. Separate environments/projects when operationally useful, but do not assume an external Sentry organization structure from this repository.

## Current runtime behavior

- Backend initialization and error-handler ordering are wired in `backend/app.mjs`.
- Backend trace/profile sampling is `0.1` in production and `1.0` elsewhere.
- Frontend trace sampling is `0.1` for production builds and `1.0` for non-production builds.
- Both sides no-op when their DSN is absent.
- Frontend session replay is intentionally absent because DOM replay can capture sensitive form content. Adding replay requires an explicit privacy/legal decision, masking/blocking controls, and tests.
- Backend security threshold aggregation is an in-process `Map`: it resets on restart and is not scale-accurate across multiple instances. Individual events may still be sent; threshold escalation must not be described as distributed protection.

## Security event thresholds

These values mirror `SecurityAlertThresholds` in `backend/config/sentry.mjs` and are protected by source/tests.

| Event                 | Count     | Window     |
| --------------------- | --------- | ---------- |
| Auth Failures         | 5 events  | 15 minutes |
| IDOR Attempts         | 3 events  | 10 minutes |
| Rate Limit Exceeded   | 10 events | 5 minutes  |
| Ownership Violations  | 3 events  | 10 minutes |
| Privilege Escalation  | 1 event   | 1 minute   |
| XSS Attempt           | 1 event   | 1 minute   |
| SQL Injection Attempt | 1 event   | 1 minute   |

These are telemetry escalation thresholds, not request rate limits. The shared auth request limiter is a different control.

## Privacy rules

- Do not send passwords, tokens, session cookies, secrets, payment data, private message bodies, or unnecessary horse/player payloads.
- Treat automatic SDK scrubbing as defense in depth, not proof that application context is safe.
- Review any new `setUser`, breadcrumb, request-body, replay, profiling, or custom-context capture for minimization and retention consequences.
- Use stable internal identifiers only when needed; avoid email/username unless the authorized incident use requires it.
- Telemetry failure must not break authentication, rate limiting, gameplay mutations, or shutdown.

## Verification

Run current tests rather than triggering an intentional production error:

```bash
npm run test:backend:targeted -- backend/__tests__/sentryConfig.test.mjs
npm --prefix frontend run test:run -- src/lib/__tests__/sentry.test.ts
npm run test:backend:targeted -- backend/__tests__/authRateLimitDocDrift.sentinel.test.mjs
```

For an authorized non-production environment, confirm events arrive with the intended environment/release labels and without sensitive payloads. Dashboard alert rules, notification destinations, quotas, and retention are external configuration and must be verified directly in Sentry; this repository does not claim they exist.

## Change checklist

1. Read both runtime Sentry modules and their tests.
2. Identify data fields and event volume introduced by the change.
3. Preserve no-DSN behavior and application fail-safety.
4. Update source/tests first when thresholds or sampling change, then update this guide.
5. Obtain explicit approval before enabling session replay or materially expanding personal-data capture.
