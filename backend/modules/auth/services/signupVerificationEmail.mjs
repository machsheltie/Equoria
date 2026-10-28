/**
 * signupVerificationEmail.mjs (Equoria-nqky1, ACC-09)
 *
 * The first confirm-your-email link a new account gets, sent by register()
 * after the account row is committed. It never throws: the account already
 * exists, so a failure here must not turn the sign-up into "registration
 * failed" (the player's retry would then be told the account is taken). The
 * link can be sent again from the confirm-your-email screen.
 */

import emailService from '../../../utils/emailService.mjs';
import logger from '../../../utils/logger.mjs';
import { maskEmailAddress, maskEmailsInError } from '../../../utils/emailIdentityPolicy.mjs';
import { createVerificationToken } from './emailVerificationService.mjs';

/**
 * Create the account's first verification link and email it.
 *
 * @param {import('express').Request} req  Sign-up request (IP + user agent are recorded on the token).
 * @param {{ id: string, email: string }} user  The account just created.
 * @returns {Promise<boolean>} true when the email was handed to the mail service.
 */
export async function sendFirstVerificationEmail(req, user) {
  try {
    const verificationToken = await createVerificationToken(user.id, user.email, {
      ipAddress: req.ip || req.connection?.remoteAddress || null,
      userAgent: req.headers['user-agent'],
    });
    await emailService.sendVerificationEmail(user.email, verificationToken.token, user);
    logger.info('[authController.register] Verification email sent', {
      userId: user.id,
      email: maskEmailAddress(user.email), // Equoria-5vyuh: never a raw address
    });
    return true;
  } catch (emailError) {
    logger.error(
      '[authController.register] Failed to send verification email:',
      maskEmailsInError(emailError),
    );
    return false;
  }
}
