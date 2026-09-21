import { test, expect } from '@playwright/test';
import {
  installProductionParityNetworkGuard,
  registerAndCompleteOnboarding,
} from './support/prodParity';

// Equoria-jhz6r: OLD CONTRACT (this spec, pre-ruling) — weekly claim credited
// +500 coins. NEW RULING — commit 18287a273 (economy ruling, see
// Equoria-kaheg) raised the weekly reward to 5,000 coins (and starting money
// to 10,000); backend/modules/bank/controllers/bankController.mjs's
// WEEKLY_REWARD_AMOUNT is the live source but is not exported for import
// here (no shared e2e economy-constant helper exists — grepped tests/e2e; the
// closest precedent is backend/modules/bank/__tests__/bankWeeklyClaim.integration.test.mjs,
// which also hardcodes this value with the same ruling citation), so it is
// restated here rather than silently duplicated.
const WEEKLY_REWARD_AMOUNT = 5000; // 2026-07-07 economy ruling (previously 500)

test('bank claim reward updates displayed balance by 5000 coins', async ({ page }) => {
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
  expect(
    body.data.newBalance,
    `API must return newBalance = initialBalance + ${WEEKLY_REWARD_AMOUNT}`
  ).toBe(initialBalance + WEEKLY_REWARD_AMOUNT);

  // Displayed balance must update instantly via setQueryData — no page reload.
  await expect
    .poll(
      async () => {
        const text = (await balanceEl.innerText()).replace(/[^0-9]/g, '');
        return parseInt(text, 10);
      },
      {
        timeout: 5000,
        message: `Expected displayed balance to reach ${initialBalance + WEEKLY_REWARD_AMOUNT}`,
      }
    )
    .toBe(initialBalance + WEEKLY_REWARD_AMOUNT);

  // Claim button must now be disabled — reward already claimed this week.
  await expect(claimBtn).toBeDisabled();

  guard.assertClean();
});
