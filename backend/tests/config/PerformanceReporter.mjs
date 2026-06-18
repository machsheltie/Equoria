/**
 * Performance Reporter for Jest
 *
 * Tracks test execution performance and generates detailed metrics.
 * Helps identify slow tests and performance regressions.
 *
 * Metrics tracked:
 * - Individual test duration
 * - Test suite duration
 * - Memory usage
 * - Slow test warnings
 */

import fs from 'fs';
import path from 'path';

export default class PerformanceReporter {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options || {};
    this._testResults = [];
    this._startTime = Date.now();
  }

  /**
   * Called when test suite starts
   */
  onRunStart() {
    this._startTime = Date.now();
    console.info('\n📊 Performance Monitoring Started\n');
  }

  /**
   * Called after each test file completes
   */
  onTestResult(test, testResult) {
    const { testFilePath, perfStats, testResults } = testResult;
    const fileName = path.basename(testFilePath);

    // Track individual test performance
    testResults.forEach(result => {
      const duration = result.duration || 0;

      this._testResults.push({
        testName: result.fullName,
        testFile: fileName,
        duration,
        status: result.status,
        slow: duration > 5000, // Slow if >5s
      });

      // Warn about slow tests
      if (duration > 5000) {
        console.warn(`⚠️  Slow test detected: ${result.fullName} (${duration}ms)`);
      }
    });

    // Track file-level performance
    const fileDuration = perfStats?.end - perfStats?.start || 0;
    if (fileDuration > 30000) {
      console.warn(`⚠️  Slow test file: ${fileName} (${fileDuration}ms)`);
    }
  }

  /**
   * Called when all tests complete
   */
  onRunComplete(contexts, results) {
    const duration = Date.now() - this._startTime;

    // Calculate statistics
    const stats = this._calculateStatistics(results, duration);

    // Generate report
    this._generateReport(stats);

    // Print summary
    this._printSummary(stats);
  }

  /**
   * Calculate performance statistics
   */
  _calculateStatistics(results, totalDuration) {
    const { numTotalTests, numPassedTests, numFailedTests } = results;

    const testDurations = this._testResults.map(t => t.duration);
    const avgDuration = testDurations.reduce((sum, d) => sum + d, 0) / testDurations.length || 0;

    const slowTests = this._testResults.filter(t => t.slow).sort((a, b) => b.duration - a.duration);

    const fastestTests = this._testResults
      .filter(t => t.status === 'passed')
      .sort((a, b) => a.duration - b.duration)
      .slice(0, 5);

    const slowestTests = this._testResults
      .filter(t => t.status === 'passed')
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    return {
      totalTests: numTotalTests,
      passedTests: numPassedTests,
      failedTests: numFailedTests,
      totalDuration,
      avgDuration: Math.round(avgDuration),
      slowTests,
      fastestTests,
      slowestTests,
      testsPerSecond: ((numTotalTests / totalDuration) * 1000).toFixed(2),
    };
  }

  /**
   * Generate JSON performance report
   */
  _generateReport(stats) {
    const outputPath = this._options.outputPath || 'test-results/performance.json';
    const outputDir = path.dirname(outputPath);

    try {
      // Ensure directory exists
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Load existing data if available
      let perfData = {
        startTime: new Date().toISOString(),
        testRuns: [],
      };

      if (fs.existsSync(outputPath)) {
        try {
          perfData = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        } catch {
          // Use default if file is corrupted
        }
      }

      // Add current run data
      perfData.testRuns.push({
        timestamp: new Date().toISOString(),
        ...stats,
        tests: this._testResults,
      });

      // Keep only last 10 runs
      if (perfData.testRuns.length > 10) {
        perfData.testRuns = perfData.testRuns.slice(-10);
      }

      // Write report
      fs.writeFileSync(outputPath, JSON.stringify(perfData, null, 2), 'utf8');
    } catch (error) {
      console.warn('Could not write performance report:', error.message);
    }
  }

  /**
   * Print performance summary to console
   */
  _printSummary(stats) {
    console.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('📊 Performance Summary');
    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info(`Total Tests:        ${stats.totalTests}`);
    console.info(`Passed:             ${stats.passedTests} ✓`);
    console.info(`Failed:             ${stats.failedTests} ${stats.failedTests > 0 ? '✗' : ''}`);
    console.info(
      `Total Duration:     ${stats.totalDuration}ms (${(stats.totalDuration / 1000).toFixed(2)}s)`,
    );
    console.info(`Average Duration:   ${stats.avgDuration}ms per test`);
    console.info(`Throughput:         ${stats.testsPerSecond} tests/second`);

    if (stats.slowTests.length > 0) {
      console.info('\n⚠️  Slow Tests (>5s):');
      stats.slowTests.slice(0, 5).forEach(test => {
        console.info(`  • ${test.testName}`);
        console.info(`    ${test.duration}ms in ${test.testFile}`);
      });
    }

    if (stats.slowestTests.length > 0) {
      console.info('\n🐌 Top 5 Slowest Tests:');
      stats.slowestTests.forEach((test, i) => {
        console.info(`  ${i + 1}. ${test.testName} (${test.duration}ms)`);
      });
    }

    if (stats.fastestTests.length > 0) {
      console.info('\n⚡ Top 5 Fastest Tests:');
      stats.fastestTests.forEach((test, i) => {
        console.info(`  ${i + 1}. ${test.testName} (${test.duration}ms)`);
      });
    }

    console.info('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Performance recommendations
    if (stats.avgDuration > 1000) {
      console.info('💡 Performance Recommendation:');
      console.info('  Average test duration is high. Consider:');
      console.info('  - Reducing database queries');
      console.info('  - Mocking external dependencies');
      console.info('  - Splitting large test files');
      console.info('');
    }

    if (stats.slowTests.length > 5) {
      console.info('💡 Many slow tests detected. Consider:');
      console.info('  - Using test.concurrent for parallel execution');
      console.info('  - Optimizing database operations');
      console.info('  - Reviewing test setup/teardown logic');
      console.info('');
    }
  }
}
