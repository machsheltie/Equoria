import { expect, type Page } from '@playwright/test';

/**
 * Equoria-8gwtm: assert the RENDERED "Next Training:" date VALUE in the
 * TrainingResultsDisplay is a real date — not the static label, and not either
 * invalid-date sentinel.
 *
 * WHY: the date <p> (TrainingResultsDisplay.tsx, the <p> immediately following
 * the "Next Training:" label) rendered the literal 'Invalid Date' pre-fix; the
 * shared formatDateTime guard (frontend/src/lib/formatDate.ts) now yields the
 * 'Date unavailable' fallback for a null / unparseable nextEligibleDate. BOTH
 * are regressions that the previous label-only assertions
 * (`getByText('Next Training:')`) shipped green. This helper fails if the
 * normalizer regresses to either.
 *
 * Shared by core-game-flows.spec.ts (AC4) and training-flow.spec.ts so the
 * locator + format expectations live in exactly one place.
 */
export async function assertValidNextTrainingDate(page: Page): Promise<void> {
  const nextTrainingValue = page
    .getByText('Next Training:', { exact: false })
    .locator('xpath=following-sibling::p[1]');
  await expect(nextTrainingValue).toBeVisible({ timeout: 5000 });

  // Normalise the narrow / no-break spaces (U+202F / U+00A0) some ICU builds
  // insert before AM/PM so parsing + matching are locale-build robust.
  const text = ((await nextTrainingValue.textContent()) ?? '').replace(/[  ]/g, ' ').trim();

  expect(text, 'Next Training date must not be empty').not.toBe('');
  expect(
    text.toLowerCase(),
    'Next Training must not render the literal "Invalid Date"'
  ).not.toContain('invalid date');
  expect(
    text,
    'Next Training must not render the Date-unavailable fallback (null/invalid nextEligibleDate)'
  ).not.toBe('Date unavailable');

  // Must be a real parseable date in a sane window around now. env.beta sets
  // TRAINING_COOLDOWN_DAYS=0 so nextEligibleDate ~ now; production's 7-day
  // cooldown puts it ~+7d. The generous [-2d, +30d] window is robust to the
  // cooldown config while still rejecting epoch / 1970 / garbage timestamps.
  const parsed = new Date(text);
  expect(Number.isNaN(parsed.getTime()), `Next Training "${text}" must parse as a real date`).toBe(
    false
  );
  const nowMs = Date.now();
  expect(parsed.getTime()).toBeGreaterThan(nowMs - 2 * 864e5);
  expect(parsed.getTime()).toBeLessThan(nowMs + 30 * 864e5);
}
