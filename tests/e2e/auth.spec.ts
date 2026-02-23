import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  // All auth tests use a fresh session (no saved cookies)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Login Page - Layout and Navigation', async ({ page }) => {
    await page.goto('/login');

    // CardTitle renders as <h3> in shadcn/ui — not <h2>
    await expect(page.locator('h3')).toContainText('Welcome Back');

    // Login form uses type attributes — no name attributes on the Input elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Actual button and link text from LoginPage.tsx
    await expect(page.getByRole('button', { name: 'Enter Realm' })).toBeVisible();
    await expect(page.getByText('Forgot password?')).toBeVisible();

    // Navigation to Register — link text is "Register Now"
    await page.click('text=Register Now');
    await expect(page).toHaveURL(/\/register/);
    // RegisterPage renders a real <h2> for "Join the Realm"
    await expect(page.locator('h2')).toContainText('Join the Realm');
  });

  test('Login Page - Invalid Credentials', async ({ page }) => {
    // Bypass auth rate limiter so this test does not hit 429
    await page.route('**/api/auth/**', (route) => {
      const headers = { ...route.request().headers(), 'x-test-bypass-rate-limit': 'true' };
      route.continue({ headers });
    });

    await page.goto('/login');

    // Login form uses type selectors (no name attribute)
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'WrongPass123!');
    await page.click('button[type="submit"]');

    // Error container becomes visible on failed login (text-red-200 class is unique to this element)
    await expect(page.locator('.text-red-200')).toBeVisible({ timeout: 10000 });
  });

  test('Register Page - Layout', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('h2')).toContainText('Join the Realm');

    // RegisterPage uses FantasyInput with name attributes — selectors are correct
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Begin Your Journey' })).toBeVisible();
  });
});
