import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test('Login Page - Layout and Navigation', async ({ page }) => {
    await page.goto('/login');

    // Check Title
    // Note: Title might vary, but "Equoria" is safe.
    // await expect(page).toHaveTitle(/Equoria/i);

    // Check Header
    await expect(page.locator('h2')).toContainText('Welcome Back');

    // Check Inputs
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // Check Buttons/Links
    await expect(page.getByRole('button', { name: 'Enter the Realm' })).toBeVisible();
    await expect(page.getByText('Forgot your password?')).toBeVisible();

    // Navigation to Register
    await page.click('text=Create an Account');
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('h2')).toContainText('Join the Realm');
  });

  test('Login Page - Invalid Credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'WrongPass123!');
    await page.click('button[type="submit"]');

    // Expect error message
    // "Login failed" is in the fallback of the error component
    await expect(page.getByText(/Login failed/i)).toBeVisible();
  });

  test('Register Page - Layout', async ({ page }) => {
    await page.goto('/register');

    await expect(page.locator('h2')).toContainText('Join the Realm');

    // Check inputs exist
    await expect(page.locator('input[name="firstName"]')).toBeVisible();
    await expect(page.locator('input[name="lastName"]')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('input[name="confirmPassword"]')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Begin Your Journey' })).toBeVisible();
  });
});
