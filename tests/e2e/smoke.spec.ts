import { test, expect } from '@playwright/test';

test('smoke test - can launch browser', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page.locator('h1')).toContainText('Example Domain');
});
