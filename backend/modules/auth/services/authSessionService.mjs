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
 *   - CWE-384 (session fixation): existing refresh tokens for the user are
 *     deleted BEFORE the new token pair is created so the new login session
 *     is the only valid session.
 *   - Equoria-ovp9: the role is passed into createTokenPair so requireRole()
 *     can skip a per-request DB lookup for admin-guarded routes.
 *   - Equoria-plw0h: the CSRF token is bound to user.id so the next
 *     mutation's sessionIdentifier matches the CSRF cookie/token pair.
 *   - Brute-force rate-limit counter is reset on successful auth.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTokenPair } from '../../../utils/tokenRotationService.mjs';
import { COOKIE_OPTIONS } from '../../../utils/cookieConfig.mjs';
import { issueCsrfToken } from '../../../middleware/csrf.mjs';
import { resetAuthRateLimit } from '../../../middleware/authRateLimiter.mjs';

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
  // CWE-384: invalidate all existing sessions on a new login.
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  // Equoria-ovp9: pass role so the access token carries it.
  const tokenPair = await createTokenPair(user.id, undefined, user.role);
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
