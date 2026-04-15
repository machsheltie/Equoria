import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { installProductionParityNetworkGuard } from './support/prodParity';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..', '..');

function readFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return readFiles(absolute);
    return absolute.endsWith('.ts') ? [absolute] : [];
  });
}

test('readiness lane has no bypass, skip, or hard-wait contamination', async ({ page }) => {
  const readinessConfig = fs.readFileSync(
    path.join(repoRoot, 'playwright.beta-readiness.config.ts'),
    'utf-8'
  );

  expect(readinessConfig).not.toContain('VITE_E2E_TEST');
  expect(readinessConfig).toContain('retries: 0');
  expect(readinessConfig).toContain('workers: 1');

  const bannedTokens = [
    ['test', '.skip'].join(''),
    ['test', '.fixme'].join(''),
    'x-test-skip-csrf',
    'x-test-bypass-auth',
    'x-test-bypass-rate-limit',
    'waitForTimeout',
  ];

  const readinessFiles = readFiles(__dirname).filter((file) => {
    const relative = path.relative(__dirname, file);
    return relative.endsWith('.spec.ts') && relative !== 'production-parity.guard.spec.ts';
  });
  const offenders: string[] = [];
  for (const file of readinessFiles) {
    const text = fs.readFileSync(file, 'utf-8');
    for (const token of bannedTokens) {
      if (text.includes(token)) {
        offenders.push(`${path.relative(repoRoot, file)} contains ${token}`);
      }
    }
  }

  expect(offenders, offenders.join('\n')).toEqual([]);

  const guard = installProductionParityNetworkGuard(page);
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h2')).toContainText('Welcome Back');
  guard.assertClean();
});
