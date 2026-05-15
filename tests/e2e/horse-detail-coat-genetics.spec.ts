/**
 * Horse Detail — Coat & Genetics E2E (Epic 31E-4, Equoria-abjp)
 *
 * Exercises the full real-user flow: authenticated session loads
 * /horses/:id, switches to the Coat tab, and verifies the new 31E-4 panel
 * renders color + genotype data from the backend /horses/:id/color and
 * /horses/:id/genetics endpoints.
 *
 * No bypass headers. No mocks. Uses the project's global-setup storage
 * state + the `testHorseId` written into test-credentials.json by setup.
 *
 * If the starter horse from global-setup happens to be a legacy horse with
 * NULL color data, the spec falls back to asserting the empty-state copy —
 * which is also a real beta-readiness path worth exercising.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CREDENTIALS_FILE = path.resolve(__dirname, 'test-credentials.json');

function readCredentials(): {
  email: string;
  password: string;
  username: string;
  testHorseId?: number;
} {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    throw new Error(
      `test-credentials.json not found — did global-setup run? (${CREDENTIALS_FILE})`
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
}

test.describe('Horse Detail — Coat & Genetics (31E-4)', () => {
  test('owner can view coat color + genotype tab on a real horse', async ({ page }) => {
    const creds = readCredentials();
    const horseId = creds.testHorseId;
    if (!horseId) {
      throw new Error(
        'test-credentials.json has no testHorseId — global-setup must seed a starter horse'
      );
    }

    await page.goto(`/horses/${horseId}`, { waitUntil: 'domcontentloaded' });

    // Wait for the detail page to settle. The header (h1) reflects the horse name.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });

    // The Coat tab was added in Equoria-ea3n. Find it by label text.
    const coatTab = page.getByRole('button', { name: /^Coat$/ }).first();
    await expect(coatTab).toBeVisible({ timeout: 10000 });
    await coatTab.click();

    // The tab content lazy-loads; wait for either the color section or the
    // legacy empty state to appear.
    const colorSection = page.locator('[data-testid="coat-color-section"]');
    await expect(colorSection).toBeVisible({ timeout: 15000 });

    // Either we see real color data, or we see the empty state for a legacy
    // horse. Both are valid real paths — the test verifies one happens.
    const colorName = page.locator('[data-testid="coat-color-name"]');
    const legacyMsg = colorSection.getByText(/No color data available/i);

    const sawColor = await colorName
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (sawColor) {
      // Real color path — must have a non-empty player-facing color name.
      const text = (await colorName.first().textContent())?.trim() ?? '';
      expect(text.length).toBeGreaterThan(0);
    } else {
      // Legacy fallback — the empty-state text must be rendered.
      await expect(legacyMsg).toBeVisible({ timeout: 5000 });
    }

    // The genotype section (Equoria-oovy) must also render — either the table
    // or its own empty state, but the section heading is unconditional.
    const genotypeSection = page.locator('[data-testid="coat-genotype-section"]');
    await expect(genotypeSection).toBeVisible({ timeout: 10000 });
  });
});
