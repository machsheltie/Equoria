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

  // Navigate to the real verify-email page with the captured token and confirm
  // the backend actually verifies the account end-to-end.
  const verifyPage = await browser.newPage();
  const verifyGuard = installProductionParityNetworkGuard(verifyPage);
  // Frontend uses GET /api/auth/verify-email?token=... (see api-client.ts verifyEmail).
  const verifyResponse = verifyPage.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/verify-email') && response.request().method() === 'GET'
  );
  await verifyPage.goto(verificationEmail.preview, { waitUntil: 'domcontentloaded' });
  expect((await verifyResponse).status()).toBe(200);
  await expect(verifyPage.locator('body')).toContainText(/Email Verified|Already Verified/);
  verifyGuard.assertClean();
  await verifyPage.close();

  // Replaying the same verification token must be rejected (no reuse).
  const replayPage = await browser.newPage();
  const replayGuard = installProductionParityNetworkGuard(replayPage);
  const replayToken = new URL(verificationEmail.preview).searchParams.get('token');
  const replayResponse = await replayPage.request.get(
    `/api/auth/verify-email?token=${encodeURIComponent(replayToken ?? '')}`
  );
  expect(
    [400, 401, 404, 410].includes(replayResponse.status()),
    `Reused verification token must be rejected, got ${replayResponse.status()}`
  ).toBe(true);
  replayGuard.assertClean();
  await replayPage.close();

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

  // Reused reset token must be rejected.
  const resetTokenValue = new URL(resetEmail.preview).searchParams.get('token');
  const reusedResetPage = await browser.newPage();
  const reusedResetGuard = installProductionParityNetworkGuard(reusedResetPage);
  const reuseResponse = await reusedResetPage.request.post('/api/auth/reset-password', {
    data: { token: resetTokenValue, password: 'Password789!' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(
    [400, 401, 404, 410].includes(reuseResponse.status()),
    `Reused reset token must be rejected, got ${reuseResponse.status()}`
  ).toBe(true);
  reusedResetGuard.assertClean();
  await reusedResetPage.close();

  // Invalid reset token must be rejected.
  const invalidResetPage = await browser.newPage();
  const invalidResetGuard = installProductionParityNetworkGuard(invalidResetPage);
  const invalidResponse = await invalidResetPage.request.post('/api/auth/reset-password', {
    data: { token: 'invalid-token-that-does-not-exist', password: 'Password789!' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(
    [400, 401, 404, 410].includes(invalidResponse.status()),
    `Invalid reset token must be rejected, got ${invalidResponse.status()}`
  ).toBe(true);
  invalidResetGuard.assertClean();
  await invalidResetPage.close();

  // Logout flow completes against the real backend.
  const logoutResponse = recoveryPage.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/logout') && response.request().method() === 'POST'
  );
  await recoveryPage.evaluate(() =>
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
  );
  expect((await logoutResponse).status()).toBe(200);

  guard.assertClean();
  recoveryGuard.assertClean();
  await recoveryPage.close();
});
