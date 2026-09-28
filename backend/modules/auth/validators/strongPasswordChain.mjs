/**
 * strongPasswordChain.mjs
 *
 * Equoria-bvddn.5: change-password required only 8 chars / 3 classes / no
 * max, while register and reset-password required 12 chars / 4 classes with
 * a 128-char max (OWASP ASVS L1, Equoria-ie4wc). A logged-in player could
 * downgrade their password below the floor enforced at signup.
 *
 * This is the SAME express-validator chain register (authRoutes.mjs) and
 * reset-password (authRoutes.mjs) already used — extracted here so
 * change-password (authenticatedAuthRoutes.mjs) reuses it exactly instead of
 * duplicating the rule. Do not fork the length/regex between call sites;
 * change the policy here and every write site picks it up.
 */

import { body } from 'express-validator';

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;
const PASSWORD_COMPLEXITY_MESSAGE =
  'must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)';

/**
 * Build the ASVS L1 password-strength validator chain for `fieldName`.
 * `label` customizes the length-error prefix (e.g. "New password") so each
 * call site keeps its own wording while sharing the rule. Pass
 * `{ optional: true }` for fields (like reset-password's two aliases) that
 * are allowed to be absent — the field is skipped entirely when missing,
 * matching the pre-existing `.optional()` behavior at those call sites.
 */
export function strongPasswordChain(fieldName, label, { optional = false } = {}) {
  const chain = body(fieldName);
  if (optional) {
    chain.optional();
  }
  return chain
    .isLength({ min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_LENGTH })
    .withMessage(
      `${label} must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters long`,
    )
    .matches(PASSWORD_COMPLEXITY_REGEX)
    .withMessage(`${label} ${PASSWORD_COMPLEXITY_MESSAGE}`);
}
