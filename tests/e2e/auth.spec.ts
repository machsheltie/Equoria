import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  // All auth tests use a fresh session (no saved cookies)
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Login Page - Layout and Navigation', async ({ page }) => {
    await page.goto('/login');

    // LoginPage renders <h2> "Welcome Back"
    await expect(page.locator('h2')).toContainText('Welcome Back');

    // Login form uses name attributes
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // Button text is "Enter", link texts match LoginPage.tsx
    await expect(page.getByRole('button', { name: 'Enter' })).toBeVisible();
    await expect(page.getByText('Forgot Your Password?')).toBeVisible();

    // Navigation to Register — link text is "Create an Account"
    await page.click('text=Create an Account');
    await expect(page).toHaveURL(/\/register/);
    // RegisterPage renders <h2> "Join the Realm"
    await expect(page.locator('h2')).toContainText('Join the Realm');
  });

  test('Login Page - Invalid Credentials', async ({ page }) => {
    // Auth rate limiter uses skipSuccessfulRequests:true with max:200 failed attempts.
    // A single invalid-credentials test will not trigger rate limiting.

    await page.goto('/login');

    // Login form uses name selectors
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'WrongPass123!');
    await page.click('button[type="submit"]');

    // The rejected login must surface an accessible error region, not just red
    // text. Equoria-c2erw: this assertion used to pin the Tailwind utility
    // `.text-red-400`. The Celestial Night token migration (Equoria-o5hub.16,
    // docs/design-system/DECISIONS.md section 7) replaced that literal with the
    // `text-role-danger` role token inside AuthError, which has carried
    // role="alert" throughout (frontend/src/components/auth/AuthLayout.tsx).
    // Re-pointed at the semantic locator per the issue ruling: assert the alert
    // region AND the ruled 401 copy from
    // frontend/src/lib/http/authErrorMessages.ts (deliberately generic, so it
    // is not an account-enumeration oracle — Equoria-gm4fg). Strictly stronger
    // than the class check it replaces.
    const loginError = page.getByRole('alert');
    await expect(loginError).toBeVisible({ timeout: 10000 });
    await expect(loginError).toContainText("That email and password don't match an account.");
  });

  test('Register Page - Layout', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('h2')).toContainText('Join the Realm');

    // RegisterPage uses name attributes on all inputs
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Begin Your Journey' })).toBeVisible();
  });
});
