/**
 * 🔒 VALIDATION-DETAIL EXPOSURE POLICY — explicit-flag resolution (Equoria-hga9h)
 *
 * Centralizes the decision of whether `handleValidationErrors` returns the
 * FULL express-validator error array (field paths, attempted values, validator
 * metadata) or only a single safe `{ message }` to the client. This was gated
 * solely on `process.env.NODE_ENV === 'production'`, so EVERY non-production
 * env — including a real `beta` / `staging` deployment — leaked validator
 * internals to clients (CWE-209, Information Exposure Through an Error Message).
 *
 * WHY (the structural defect class, identical to Equoria-46f0s cookies):
 *   A security boundary must be controllable by an EXPLICIT operator switch,
 *   not implicitly derived from NODE_ENV. An operator deploying under
 *   `NODE_ENV=beta` (or any non-`production` value reused for a real host) had
 *   no way to stop validation internals being echoed back in 400 responses.
 *   This mirrors the same fix already applied to cookies (COOKIE_SECURE /
 *   COOKIE_SAMESITE), rate limiting (RATE_LIMIT_REQUIRE_REDIS), the query cache
 *   (CACHE_REQUIRE_REDIS), and admin MFA (ADMIN_MFA_REQUIRED).
 *
 * DEFAULT (deliberately CLOSED for deployable envs — this is a tightening):
 *   Verbose detail is exposed by default ONLY in the non-deployable local
 *   envs `development` and `test`, where it aids debugging and where the
 *   backend jest suite asserts on the full error array. Every DEPLOYABLE env —
 *   `production`, `beta`, `staging`, and any unknown/undefined NODE_ENV —
 *   defaults CLOSED so internals are never leaked unless an operator opts in.
 *
 *   Note this differs INTENTIONALLY from the cookie resolver, whose `beta`
 *   default preserves the old value (because Playwright E2E runs over HTTP). A
 *   validation 400 carries the same well-formed `{ success, message, errors }`
 *   shape in both modes — only the `errors` payload narrows to
 *   `[{ message }]` — so closing it in beta does not break a correctly-written
 *   E2E flow the way `secure:true` over HTTP would.
 *
 * EXPLICIT OVERRIDE:
 *   - EXPOSE_VALIDATION_DETAILS = 'true'  → always expose the full array.
 *   - EXPOSE_VALIDATION_DETAILS = 'false' → always return only `[{ message }]`.
 *   Any other value is treated as an operator typo and falls through to the
 *   NODE_ENV-derived default rather than being silently honored.
 *
 * Pure function — performs no NODE_ENV read of its own beyond the explicit
 * argument, so the sentinel exercises it with NODE_ENV held constant.
 *
 * @module utils/validationDetailPolicy
 */

/**
 * Resolve whether verbose validation-error detail should be exposed to clients.
 *
 * @param {object}  params
 * @param {string}  [params.nodeEnv]                      deployment NODE_ENV (default source)
 * @param {string}  [params.exposeValidationDetailsEnv]   raw EXPOSE_VALIDATION_DETAILS value (explicit override)
 * @returns {boolean} true → return full error array; false → return only `[{ message }]`
 */
export function resolveExposeValidationDetails({ nodeEnv, exposeValidationDetailsEnv } = {}) {
  if (typeof exposeValidationDetailsEnv === 'string') {
    const normalized = exposeValidationDetailsEnv.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    // Any other non-empty value is an operator typo — fall through to the
    // NODE_ENV-derived default rather than silently honoring garbage.
  }
  // Default: verbose only in the non-deployable local envs. All deployable
  // envs (production / beta / staging / unknown / undefined) default CLOSED.
  return nodeEnv === 'development' || nodeEnv === 'test';
}
