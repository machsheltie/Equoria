/**
 * Error-stack exposure policy (Equoria-x928y).
 *
 * Mirrors utils/validationDetailPolicy.mjs (Equoria-hga9h) so error-stack
 * exposure is an EXPLICIT, operator-controllable boundary flag rather than a
 * hard-coded NODE_ENV check. There is NO security gap today — the prior gate
 * (`NODE_ENV === 'development'`) already closed stack exposure for every
 * deployable env (production / beta / staging) — so this is purely a
 * consistency / DX enhancement: an operator can enable stack traces for a
 * non-dev debug session (or force them OFF in dev) via env, no code change.
 *
 * EXPLICIT OVERRIDE:
 *   - EXPOSE_ERROR_STACK = 'true'  → always include `stack` in the error body.
 *   - EXPOSE_ERROR_STACK = 'false' → never include it (even in development).
 *   Any other value is treated as an operator typo and falls through to the
 *   NODE_ENV-derived default rather than being silently honored.
 *
 * Pure function — performs no NODE_ENV read of its own beyond the explicit
 * argument, so the sentinel exercises it with NODE_ENV held constant.
 *
 * @module utils/errorStackPolicy
 */

/**
 * Resolve whether the error `stack` should be exposed in the response body.
 *
 * @param {object}  params
 * @param {string}  [params.nodeEnv]            deployment NODE_ENV (default source)
 * @param {string}  [params.exposeErrorStackEnv] raw EXPOSE_ERROR_STACK value (explicit override)
 * @returns {boolean} true → include `stack`; false → omit it
 */
export function resolveExposeErrorStack({ nodeEnv, exposeErrorStackEnv } = {}) {
  if (typeof exposeErrorStackEnv === 'string') {
    const normalized = exposeErrorStackEnv.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    // Any other non-empty value is an operator typo — fall through to the
    // NODE_ENV-derived default rather than silently honoring garbage.
  }
  // Default PRESERVES the prior errorHandler behavior: stack only in local
  // development. Every deployable env (production / beta / staging / unknown /
  // undefined) defaults CLOSED — no stack leaked by default.
  return nodeEnv === 'development';
}
