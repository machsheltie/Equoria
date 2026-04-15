import { test, expect } from '@playwright/test';
import {
  installProductionParityNetworkGuard,
  latestCapturedEmail,
  loginViaUi,
  registerAndCompleteOnboarding,
} from './support/prodParity';

test('auth, email verification signal, onboarding persistence, and password reset use production paths', async ({
  page,
  browser,
}) => {
  const guard = installProductionParityNetworkGuard(page);
  const suffix = `${Date.now()}_auth`;
  const originalPassword = 'Password123!';
  const newPassword = 'Password456!';

  const player = await registerAndCompleteOnboarding(page, suffix, `Nova ${suffix}`);

  const verificationEmail = await latestCapturedEmail('verification', player.email);
  expect(verificationEmail.preview).toContain('/verify-email');
  expect(verificationEmail.preview).toContain('token=');

  const recoveryPage = await browser.newPage();
  const recoveryGuard = installProductionParityNetworkGuard(recoveryPage);

  await recoveryPage.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
  await expect(recoveryPage.locator('h2')).toContainText('Forgot Password?');
  await recoveryPage.fill('input[name="email"]', player.email);
  const forgotResponse = recoveryPage.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/forgot-password') && response.request().method() === 'POST'
  );
  await recoveryPage.getByRole('button', { name: /Send Reset Link/i }).click();
  expect((await forgotResponse).status()).toBe(200);
  await expect(recoveryPage.locator('h2')).toContainText('Check Your Inbox');

  const resetEmail = await latestCapturedEmail('password-reset', player.email);
  expect(resetEmail.preview).toContain('/reset-password');
  expect(resetEmail.preview).toContain('token=');

  await recoveryPage.goto(resetEmail.preview, { waitUntil: 'domcontentloaded' });
  await expect(recoveryPage.locator('h2')).toContainText('Create New Password');
  await recoveryPage.fill('input[name="password"]', newPassword);
  await recoveryPage.fill('input[name="confirmPassword"]', newPassword);

  const resetResponse = recoveryPage.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/reset-password') && response.request().method() === 'POST'
  );
  await recoveryPage.getByRole('button', { name: /Reset Password/i }).click();
  expect((await resetResponse).status()).toBe(200);
  await expect(recoveryPage.locator('h2')).toContainText('Password Reset!');

  await recoveryPage.getByRole('button', { name: /Go to Login/i }).click();
  await expect(recoveryPage.locator('h2')).toContainText('Welcome Back');
  await loginViaUi(recoveryPage, { email: player.email, password: newPassword });
  await expect(recoveryPage.locator('body')).not.toContainText(originalPassword);

  guard.assertClean();
  recoveryGuard.assertClean();
  await recoveryPage.close();
});
