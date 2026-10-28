import { expect, type Page } from '@playwright/test';

/**
 * Train a horse from the Training Center and assert the result shows on the
 * page itself (owner ruling q173, 2026-10-28: no popups, no log).
 *
 * Old contract (Equoria-8gwtm): the session popup turned into a "Training
 * Results" view, and this helper read its rendered "Next Training:" date. That
 * view is removed: the popup closes and the horse's row moves to On Cooldown.
 * The 8gwtm guard (the next-eligible date is real, never 'Invalid Date' or the
 * 'Date unavailable' fallback) now reads the real train response, the value
 * the row's cooldown is built from.
 *
 * Shared by core-game-flows.spec.ts (AC4) and training-flow.spec.ts.
 */
export async function trainAndAssertInPlace(page: Page, horseId: number): Promise<void> {
  const startBtn = page.getByRole('button', { name: /start training|train horse/i });
  await expect(startBtn).toBeVisible({ timeout: 10000 });

  const trainResp = page.waitForResponse(
    (r) => r.url().includes('/api/v1/training/train') && r.request().method() === 'POST',
    { timeout: 20000 }
  );
  await startBtn.click();
  const resp = await trainResp;
  expect(resp.status(), 'POST /api/v1/training/train must succeed').toBe(200);
  const body = await resp.json();
  const data = body?.data ?? body;
  const next = String(data?.nextEligibleDate ?? data?.nextEligible ?? '');

  expect(next, 'the next-eligible date must not be empty').not.toBe('');
  const parsed = new Date(next);
  expect(Number.isNaN(parsed.getTime()), `next-eligible "${next}" must be a real date`).toBe(false);
  const nowMs = Date.now();
  expect(parsed.getTime()).toBeGreaterThan(nowMs - 2 * 864e5);
  expect(parsed.getTime()).toBeLessThan(nowMs + 30 * 864e5);

  // No popup: the session dialog closes, and the horse's row moves on the page.
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10000 });
  await expect(page.getByText(/training results|training complete/i)).toHaveCount(0);
  await expect(
    page.locator(`[data-testid="section-cooldown"] [data-testid="horse-card-${horseId}"]`)
  ).toBeVisible({ timeout: 15000 });
}
