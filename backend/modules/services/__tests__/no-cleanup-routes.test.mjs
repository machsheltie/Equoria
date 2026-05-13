/**
 * Regression guard: no /test/cleanup routes mounted in backend
 *
 * Story 21R-4 — ensures test cleanup endpoints cannot be re-added.
 * If this test fails, someone mounted a cleanup route that could
 * delete real user data in beta/staging environments.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');

/**
 * Recursively find all route files in a directory
 */
function findRouteFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      results.push(...findRouteFiles(fullPath));
    } else if (entry.isFile() && /[Rr]oute/.test(entry.name) && /\.m?js$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('No test cleanup routes in production code', () => {
  const routeDirs = [path.join(projectRoot, 'backend', 'modules'), path.join(projectRoot, 'backend', 'routes')];

  const routeFiles = routeDirs.flatMap(dir => findRouteFiles(dir));

  // Ensure we actually found route files (guard against wrong paths)
  test('route files were found for scanning', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  test('no route file registers a /test/cleanup endpoint', () => {
    const violations = [];

    for (const filePath of routeFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(projectRoot, filePath);

      // Check for cleanup route patterns
      const patterns = [
        /['"`].*test\/cleanup.*['"`]/i,
        /['"`].*cleanupTestData.*['"`]/i,
        /['"`].*test-cleanup.*['"`]/i,
      ];

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          violations.push(`${relativePath} matches ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  test('no route file uses DELETE with test-related path', () => {
    const violations = [];

    for (const filePath of routeFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(projectRoot, filePath);

      // Match router.delete with test-related paths
      if (/router\.delete\s*\(\s*['"`].*test.*['"`]/i.test(content)) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });
});
