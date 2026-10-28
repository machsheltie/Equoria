/**
 * authSessionService.mjs (Equoria-vhv3i)
 *
 * Shared post-credential-verification session issuance. Both the non-MFA
 * login path (loginController.login) and the post-MFA-challenge path
 * (mfaController.mfaChallenge) must produce IDENTICAL sessions — same
 * access/refresh cookies, same CSRF binding, same rate-limit reset, same
 * response shape. Centralizing that here removes the prior duplication
 * inside authController.mjs and keeps the two paths bit-compatible by
 * construction.
 *
 * Security invariants this preserves:
 *   - CWE-384 (session fixation): every login starts a NEW refresh-token
 *     family and ends the session of the refresh cookie it replaces; other
 *     devices stay signed in, at most five sessions (Equoria-wj4bc, owner
 *     ruling q180 — see utils/sessionFamilies.mjs).
 *   - Equoria-ovp9: the role is passed into createTokenPair so requireRole()
 *     can skip a per-request DB lookup for admin-guarded routes.
 *   - Equoria-plw0h: the CSRF token is bound to user.id so the next
 *     mutation's sessionIdentifier matches the CSRF cookie/token pair.
 *   - Brute-force rate-limit counter is reset on successful auth.
 */

import { startSession } from '../../../utils/sessionFamilies.mjs';
import { COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';
import { issueCsrfToken } from '../../../middleware/csrf.mjs';
import { resetAuthRateLimit } from '../../../middleware/authRateLimiter.mjs';
import { recordLoginSighting } from '../../staff/index.mjs';

/**
 * Issue the access/refresh/CSRF triple for a fully-authenticated user and
 * write the session payload to the response. Returns the body-data block
 * the caller should serialize as the response payload.
 *
 * @param {import('express').Request}  req   Express request (used for req.ip + req.headers)
 * @param {import('express').Response} res   Express response (cookies are set here)
 * @param {object} user                       User row (must include id, username, email, money, level, xp, role, settings)
 * @returns {Promise<{ user: object, csrfToken: string }>}
 */
export async function issueAuthenticatedSession(req, res, user) {
  await recordLoginSighting(req, res, user.id);

  // CWE-384 / Equoria-wj4bc: a session of its own; Equoria-ovp9: the role
  // rides in the access token.
  const tokenPair = await startSession(user.id, user.role, {
    presentedRefreshToken: req.cookies?.refreshToken,
  });
  res.cookie('accessToken', tokenPair.accessToken, COOKIE_OPTIONS.accessToken);
  res.cookie('refreshToken', tokenPair.refreshToken, COOKIE_OPTIONS.refreshToken);

  // Equoria-plw0h: bind CSRF token to user.id so the next mutation's
  // sessionIdentifier matches the CSRF cookie/token pair.
  const csrfToken = issueCsrfToken(req, res, { userId: user.id });

  // Reset rate limit on successful login (brute force protection)
  const ip = req.ip || req.connection?.remoteAddress || null;
  resetAuthRateLimit(ip);

  const loginSettings =
    typeof user.settings === 'object' && user.settings !== null ? user.settings : {};

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      money: user.money,
      level: user.level,
      xp: user.xp,
      role: user.role,
      completedOnboarding: loginSettings.completedOnboarding === true,
      onboardingStep:
        typeof loginSettings.onboardingStep === 'number' ? loginSettings.onboardingStep : 0,
    },
    csrfToken,
  };
}
