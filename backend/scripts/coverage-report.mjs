/**
 * Coverage Report Generator for CI/CD Pipeline
 * 
 * This script generates comprehensive coverage reports including:
 * - Coverage summary analysis
 * - Threshold validation
 * - Coverage trend tracking
 * - Report formatting for CI/CD
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Coverage configuration
const COVERAGE_CONFIG = {
  thresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 85,
      statements: 85
    },
    controllers: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    services: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    },
    utils: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  reportFormats: ['text', 'html', 'json', 'lcov'],
  outputDir: '../coverage'
};

/**
 * Read coverage summary from Jest output
 */
async function readCoverageSummary() {
  try {
    const summaryPath = path.resolve(__dirname, '../coverage/coverage-summary.json');
    const summaryData = await fs.readFile(summaryPath, 'utf8');
    return JSON.parse(summaryData);
  } catch (error) {
    throw new Error(`Failed to read coverage summary: ${error.message}`);
  }
}

/**
 * Analyze coverage data
 */
function analyzeCoverage(coverageData) {
  const analysis = {
    overall: {},
    byDirectory: {},
    byFile: {},
    thresholdResults: {},
    summary: {}
  };

  // Extract overall coverage
  if (coverageData.total) {
    analysis.overall = {
      lines: coverageData.total.lines.pct,
      statements: coverageData.total.statements.pct,
      functions: coverageData.total.functions.pct,
      branches: coverageData.total.branches.pct
    };
  }

  // Analyze by directory
  const directories = {};
  Object.entries(coverageData).forEach(([filePath, data]) => {
    if (filePath === 'total') return;
    
    const dir = path.dirname(filePath);
    if (!directories[dir]) {
      directories[dir] = {
        files: 0,
        lines: { covered: 0, total: 0 },
        statements: { covered: 0, total: 0 },
        functions: { covered: 0, total: 0 },
        branches: { covered: 0, total: 0 }
      };
    }

    directories[dir].files++;
    directories[dir].lines.covered += data.lines.covered;
    directories[dir].lines.total += data.lines.total;
    directories[dir].statements.covered += data.statements.covered;
    directories[dir].statements.total += data.statements.total;
    directories[dir].functions.covered += data.functions.covered;
    directories[dir].functions.total += data.functions.total;
    directories[dir].branches.covered += data.branches.covered;
    directories[dir].branches.total += data.branches.total;
  });

  // Calculate directory percentages
  Object.entries(directories).forEach(([dir, data]) => {
    analysis.byDirectory[dir] = {
      files: data.files,
      lines: data.lines.total > 0 ? (data.lines.covered / data.lines.total * 100).toFixed(2) : 0,
      statements: data.statements.total > 0 ? (data.statements.covered / data.statements.total * 100).toFixed(2) : 0,
      functions: data.functions.total > 0 ? (data.functions.covered / data.functions.total * 100).toFixed(2) : 0,
      branches: data.branches.total > 0 ? (data.branches.covered / data.branches.total * 100).toFixed(2) : 0
    };
  });

  // Check thresholds
  analysis.thresholdResults = checkCoverageThresholds(analysis.overall, analysis.byDirectory);

  // Generate summary
  analysis.summary = generateCoverageSummary(analysis);

  return analysis;
}

/**
 * Check coverage against thresholds
 */
function checkCoverageThresholds(overall, byDirectory) {
  const results = {
    global: { passed: true, failures: [] },
    directories: {}
  };

  // Check global thresholds
  Object.entries(COVERAGE_CONFIG.thresholds.global).forEach(([metric, threshold]) => {
    if (overall[metric] < threshold) {
      results.global.passed = false;
      results.global.failures.push({
        metric,
        actual: overall[metric],
        threshold,
        difference: (threshold - overall[metric]).toFixed(2)
      });
    }
  });

  // Check directory-specific thresholds
  Object.entries(byDirectory).forEach(([dir, coverage]) => {
    const dirName = path.basename(dir);
    let thresholds = COVERAGE_CONFIG.thresholds.global;

    // Use specific thresholds if available
    if (COVERAGE_CONFIG.thresholds[dirName]) {
      thresholds = COVERAGE_CONFIG.thresholds[dirName];
    }

    results.directories[dir] = { passed: true, failures: [] };

    Object.entries(thresholds).forEach(([metric, threshold]) => {
      const actual = parseFloat(coverage[metric]);
      if (actual < threshold) {
        results.directories[dir].passed = false;
        results.directories[dir].failures.push({
          metric,
          actual,
          threshold,
          difference: (threshold - actual).toFixed(2)
        });
      }
    });
  });

  return results;
}

/**
 * Generate coverage summary
 */
function generateCoverageSummary(analysis) {
  const { overall, thresholdResults } = analysis;
  
  const totalFailures = thresholdResults.global.failures.length +
    Object.values(thresholdResults.directories).reduce((sum, dir) => sum + dir.failures.length, 0);

  return {
    overallPassed: thresholdResults.global.passed && 
      Object.values(thresholdResults.directories).every(dir => dir.passed),
    totalFailures,
    coverage: overall,
    grade: getCoverageGrade(overall),
    recommendations: generateRecommendations(analysis)
  };
}

/**
 * Get coverage grade based on overall coverage
 */
function getCoverageGrade(coverage) {
  const avgCoverage = (coverage.lines + coverage.statements + coverage.functions + coverage.branches) / 4;
  
  if (avgCoverage >= 95) return 'A+';
  if (avgCoverage >= 90) return 'A';
  if (avgCoverage >= 85) return 'B+';
  if (avgCoverage >= 80) return 'B';
  if (avgCoverage >= 75) return 'C+';
  if (avgCoverage >= 70) return 'C';
  if (avgCoverage >= 65) return 'D+';
  if (avgCoverage >= 60) return 'D';
  return 'F';
}

/**
 * Generate coverage improvement recommendations
 */
function generateRecommendations(analysis) {
  const recommendations = [];
  const { overall, thresholdResults } = analysis;

  // Global recommendations
  if (overall.branches < 80) {
    recommendations.push('Add more branch coverage tests (if/else, switch cases, ternary operators)');
  }
  if (overall.functions < 80) {
    recommendations.push('Add tests for uncovered functions and methods');
  }
  if (overall.lines < 85) {
    recommendations.push('Increase line coverage by testing edge cases and error paths');
  }

  // Directory-specific recommendations
  Object.entries(thresholdResults.directories).forEach(([dir, result]) => {
    if (!result.passed) {
      const dirName = path.basename(dir);
      recommendations.push(`Improve coverage in ${dirName}/ directory`);
    }
  });

  return recommendations;
}

/**
 * Format coverage report for console output
 */
function formatConsoleReport(analysis) {
  const { overall, byDirectory, thresholdResults, summary } = analysis;

  let report = '\n📊 Coverage Report\n';
  report += '==================\n\n';

  // Overall coverage
  report += '🎯 Overall Coverage:\n';
  report += `   Lines:      ${overall.lines.toFixed(2)}%\n`;
  report += `   Statements: ${overall.statements.toFixed(2)}%\n`;
  report += `   Functions:  ${overall.functions.toFixed(2)}%\n`;
  report += `   Branches:   ${overall.branches.toFixed(2)}%\n`;
  report += `   Grade:      ${summary.grade}\n\n`;

  // Threshold results
  if (summary.overallPassed) {
    report += '✅ All coverage thresholds PASSED\n\n';
  } else {
    report += '❌ Coverage thresholds FAILED\n\n';
    
    if (thresholdResults.global.failures.length > 0) {
      report += '🔴 Global threshold failures:\n';
      thresholdResults.global.failures.forEach(failure => {
        report += `   ${failure.metric}: ${failure.actual.toFixed(2)}% (need ${failure.threshold}%, short by ${failure.difference}%)\n`;
      });
      report += '\n';
    }
  }

  // Directory breakdown
  report += '📁 Coverage by Directory:\n';
  Object.entries(byDirectory).forEach(([dir, coverage]) => {
    const passed = thresholdResults.directories[dir]?.passed !== false;
    const icon = passed ? '✅' : '❌';
    report += `${icon} ${dir}: ${coverage.lines}% lines, ${coverage.functions}% functions\n`;
  });

  // Recommendations
  if (summary.recommendations.length > 0) {
    report += '\n💡 Recommendations:\n';
    summary.recommendations.forEach(rec => {
      report += `   • ${rec}\n`;
    });
  }

  return report;
}

/**
 * Generate coverage badge data
 */
function generateBadgeData(analysis) {
  const { overall, summary } = analysis;
  const avgCoverage = (overall.lines + overall.statements + overall.functions + overall.branches) / 4;
  
  let color = 'red';
  if (avgCoverage >= 90) color = 'brightgreen';
  else if (avgCoverage >= 80) color = 'green';
  else if (avgCoverage >= 70) color = 'yellow';
  else if (avgCoverage >= 60) color = 'orange';

  return {
    schemaVersion: 1,
    label: 'coverage',
    message: `${avgCoverage.toFixed(1)}%`,
    color,
    grade: summary.grade
  };
}

/**
 * Save coverage reports
 */
async function saveCoverageReports(analysis) {
  const reportsDir = path.resolve(__dirname, '../coverage/reports');
  await fs.mkdir(reportsDir, { recursive: true });

  // Save detailed analysis
  const analysisPath = path.join(reportsDir, 'coverage-analysis.json');
  await fs.writeFile(analysisPath, JSON.stringify(analysis, null, 2));

  // Save summary for CI
  const summaryPath = path.join(reportsDir, 'coverage-ci-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    passed: analysis.summary.overallPassed,
    coverage: analysis.overall,
    grade: analysis.summary.grade,
    failures: analysis.summary.totalFailures
  }, null, 2));

  // Save badge data
  const badgeData = generateBadgeData(analysis);
  const badgePath = path.join(reportsDir, 'coverage-badge.json');
  await fs.writeFile(badgePath, JSON.stringify(badgeData, null, 2));

  return {
    analysisPath,
    summaryPath,
    badgePath
  };
}

/**
 * Main coverage report generation
 */
async function generateCoverageReport() {
  try {
    console.log('📊 Generating coverage report...');

    // Read coverage data
    const coverageData = await readCoverageSummary();

    // Analyze coverage
    const analysis = analyzeCoverage(coverageData);

    // Display console report
    const consoleReport = formatConsoleReport(analysis);
    console.log(consoleReport);

    // Save reports
    const savedReports = await saveCoverageReports(analysis);
    console.log(`📁 Reports saved to: ${path.dirname(savedReports.analysisPath)}`);

    // Exit with appropriate code
    if (analysis.summary.overallPassed) {
      console.log('✅ Coverage report generation completed - All thresholds passed');
      process.exit(0);
    } else {
      console.log('❌ Coverage report generation completed - Some thresholds failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Coverage report generation failed:', error.message);
    process.exit(1);
  }
}

// Run coverage report generation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateCoverageReport();
}

export { 
  generateCoverageReport, 
  analyzeCoverage, 
  checkCoverageThresholds, 
  generateBadgeData 
};
