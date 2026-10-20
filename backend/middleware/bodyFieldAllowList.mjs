/**
 * Request-body allow-list (Equoria-gu8jk).
 *
 * Owner ruling 2026-10-20: players must never write traits for themselves, by
 * any path. A player route that builds a horse or groom from a request body
 * must accept ONLY the fields it documents. Anything else — a protected trait
 * field such as `temperament`, `epigeneticModifiers` or `bonusTraitMap`
 * included — is refused with 400 before any read or write happens, rather than
 * silently ignored.
 *
 * Cross-domain: used by the auth (onboarding wizard), marketplace (Horse
 * Trader) and grooms (legacy protégé) routes.
 */

/**
 * The first own key of `body` that is not in `allowed`, or null when every key
 * is allowed. A missing or non-object body has no keys.
 *
 * @param {unknown} body
 * @param {ReadonlySet<string>} allowed
 * @returns {string|null}
 */
export function firstUnlistedBodyField(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      return key;
    }
  }
  return null;
}

/**
 * Express middleware: 400 when the body carries a field outside `allowedFields`.
 *
 * @param {Iterable<string>} allowedFields
 * @returns {import('express').RequestHandler}
 */
export function allowOnlyBodyFields(allowedFields) {
  const allowed = new Set(allowedFields);
  return (req, res, next) => {
    const field = firstUnlistedBodyField(req.body, allowed);
    if (field !== null) {
      return res.status(400).json({
        success: false,
        message: `Invalid request: unexpected field \`${field}\``,
      });
    }
    return next();
  };
}
