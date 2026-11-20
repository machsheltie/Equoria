import { test, expect } from '@playwright/test';
import { installProductionParityNetworkGuard } from './support/prodParity';

test('login loads with no test-bypass header on any request', async ({ page }) => {
  const guard = installProductionParityNetworkGuard(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h2')).toContainText('Welcome Back');
  guard.assertClean();
});
