import { test, expect } from '@playwright/test';
import {
  installProductionParityNetworkGuard,
  latestCapturedEmail,
  loginViaUi,
  registerAndCompleteOnboarding,
} from './support/prodParity';

test('auth, email verification signal, onboarding persistence, and password reset use production paths', async ({
  page,
}) => {
  const guard = installProductionParityNetworkGuard(page);
  const suffix = `${Date.now()}_auth`;
  const originalPassword = 'Password123!';
  const newPassword = 'Password456!';

  const player = await registerAndCompleteOnboarding(page, suffix, `Nova ${suffix}`);

  const verificationEmail = await latestCapturedEmail('verification', player.email);
  expect(verificationEmail.preview).toContain('/verify-email');
  expect(verificationEmail.preview).toContain('token=');

  await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h2')).toContainText('Forgot Password?');
  await page.fill('input[name="email"]', player.email);
  const forgotResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/forgot-password') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /Send Reset Link/i }).click();
  expect((await forgotResponse).status()).toBe(200);
  await expect(page.locator('h2')).toContainText('Check Your Inbox');

  const resetEmail = await latestCapturedEmail('password-reset', player.email);
  expect(resetEmail.preview).toContain('/reset-password');
  expect(resetEmail.preview).toContain('token=');

  await page.goto(resetEmail.preview, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h2')).toContainText('Create New Password');
  await page.fill('input[name="password"]', newPassword);
  await page.fill('input[name="confirmPassword"]', newPassword);

  const resetResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/reset-password') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /Reset Password/i }).click();
  expect((await resetResponse).status()).toBe(200);
  await expect(page.locator('h2')).toContainText('Password Reset!');

  await page.getByRole('button', { name: /Go to Login/i }).click();
  await expect(page.locator('h2')).toContainText('Welcome Back');
  await loginViaUi(page, { email: player.email, password: newPassword });
  await expect(page.locator('body')).not.toContainText(originalPassword);

  guard.assertClean();
});
