import { test, expect } from '@playwright/test';
import {
  installProductionParityNetworkGuard,
  registerAndCompleteOnboarding,
} from './support/prodParity';

test('bank claim reward updates displayed balance by 500 coins', async ({ page }) => {
  const guard = installProductionParityNetworkGuard(page);
  const suffix = `${Date.now()}_bank`;

  // Fresh user has settings.lastWeeklyClaimDate = null, so claim is immediately available.
  await registerAndCompleteOnboarding(page, suffix, `BankTest Horse ${suffix}`);

  // Set up listener before navigation so we don't miss the claim-status response.
  const claimStatusSettled = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/bank/claim-status') && response.request().method() === 'GET'
  );

  await page.goto('/bank', { waitUntil: 'domcontentloaded' });
  await claimStatusSettled;

  // Balance element is populated from the cached profile query.
  const balanceEl = page.locator('[data-testid="balance-amount"]');
  await balanceEl.waitFor({ state: 'visible' });

  const initialText = (await balanceEl.innerText()).replace(/[^0-9]/g, '');
  const initialBalance = parseInt(initialText, 10);
  expect(Number.isFinite(initialBalance), 'initial balance must be a finite number').toBe(true);

  // Fresh user has never claimed — button must be enabled.
  const claimBtn = page.locator('[data-testid="claim-button"]');
  await expect(claimBtn).toBeEnabled();

  // Set up listener before click so we don't miss the claim response.
  const claimApiSettled = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/bank/claim') && response.request().method() === 'POST'
  );

  await claimBtn.click();

  const claimResponse = await claimApiSettled;
  expect(claimResponse.status(), 'claim endpoint must return 200').toBe(200);
  const body = await claimResponse.json();
  expect(body.data.newBalance, 'API must return newBalance = initialBalance + 500').toBe(
    initialBalance + 500
  );

  // Displayed balance must update instantly via setQueryData — no page reload.
  await expect
    .poll(
      async () => {
        const text = (await balanceEl.innerText()).replace(/[^0-9]/g, '');
        return parseInt(text, 10);
      },
      { timeout: 5000, message: `Expected displayed balance to reach ${initialBalance + 500}` }
    )
    .toBe(initialBalance + 500);

  // Claim button must now be disabled — reward already claimed this week.
  await expect(claimBtn).toBeDisabled();

  guard.assertClean();
});
