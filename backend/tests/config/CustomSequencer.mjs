/**
 * Custom Test Sequencer for Optimized Execution
 *
 * Execution Strategy:
 * 1. Unit tests first (fast, no dependencies)
 * 2. Integration tests second (database dependencies)
 * 3. E2E tests last (full stack, slowest)
 *
 * Within each category:
 * - Auth tests prioritized (critical path)
 * - Smaller files first (faster feedback)
 * - Previously failed tests first (fail fast)
 */

import Sequencer from '@jest/test-sequencer';
import fs from 'fs';
import path from 'path';

export default class CustomSequencer extends Sequencer {
  /**
   * Sort test files for optimal execution order
   */
  sort(tests) {
    // Load previous test results for failure-first strategy
    const failedTests = this.loadFailedTests();

    // Categorize tests
    const categorized = tests.map(test => ({
      test,
      category: this.categorizeTest(test.path),
      size: this.getFileSize(test.path),
      previouslyFailed: failedTests.has(test.path),
      priority: this.calculatePriority(test.path),
    }));

    // Sort by:
    // 1. Previously failed (fail fast)
    // 2. Category (unit → integration → e2e)
    // 3. Priority (auth tests first)
    // 4. Size (smaller first for faster feedback)
    categorized.sort((a, b) => {
      // Failed tests first
      if (a.previouslyFailed !== b.previouslyFailed) {
        return a.previouslyFailed ? -1 : 1;
      }

      // Then by category
      if (a.category !== b.category) {
        return a.category - b.category;
      }

      // Then by priority (higher priority first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      // Finally by size (smaller first)
      return a.size - b.size;
    });

    return categorized.map(item => item.test);
  }

  /**
   * Categorize test by type
   * 0 = Unit (fastest)
   * 1 = Integration (medium)
   * 2 = E2E (slowest)
   */
  categorizeTest(testPath) {
    if (testPath.includes('/unit/')) return 0;
    if (testPath.includes('/integration/')) return 1;
    if (testPath.includes('/e2e/')) return 2;
    return 1; // Default to integration
  }

  /**
   * Get file size in bytes
   */
  getFileSize(filePath) {
    try {
      return fs.statSync(filePath).size;
    } catch {
      return 0;
    }
  }

  /**
   * Calculate test priority based on filename
   * Higher number = higher priority
   */
  calculatePriority(testPath) {
    const fileName = path.basename(testPath);

    // Auth tests highest priority
    if (fileName.includes('auth')) return 10;

    // Cookie tests high priority
    if (fileName.includes('cookie')) return 9;

    // Security tests high priority
    if (fileName.includes('security')) return 8;

    // API tests medium priority
    if (fileName.includes('api')) return 5;

    // Default priority
    return 1;
  }

  /**
   * Load previously failed tests from cache
   */
  loadFailedTests() {
    const failedTestsPath = path.join(
      process.cwd(),
      '.jest-cache',
      'failed-tests.json'
    );

    try {
      if (fs.existsSync(failedTestsPath)) {
        const content = fs.readFileSync(failedTestsPath, 'utf8');
        const failedList = JSON.parse(content);
        return new Set(failedList);
      }
    } catch (error) {
      console.warn('Could not load failed tests cache:', error.message);
    }

    return new Set();
  }

  /**
   * Save failed tests to cache for next run
   */
  async allTestsRun(tests) {
    const failedTests = tests
      .filter(test => test.numFailingTests > 0)
      .map(test => test.testFilePath);

    const cacheDir = path.join(process.cwd(), '.jest-cache');
    const failedTestsPath = path.join(cacheDir, 'failed-tests.json');

    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      fs.writeFileSync(
        failedTestsPath,
        JSON.stringify(failedTests, null, 2),
        'utf8'
      );
    } catch (error) {
      console.warn('Could not save failed tests cache:', error.message);
    }
  }
}
