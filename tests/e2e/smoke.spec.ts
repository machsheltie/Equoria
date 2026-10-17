import { test, expect } from '@playwright/test';

// Smoke: the browser launches and loads a page. It used to load
// https://example.com and look for its "Example Domain" <h1>; that page no
// longer has an <h1> and now says it must not be relied on for testing
// (Equoria-g3n8c). It loads Equoria's own front end instead, so the check
// needs no third-party site.
test('smoke test - can launch browser', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle('Equoria - Fantasy Horse Simulation');
  await expect(page.locator('h1')).toContainText('Equoria');
});
