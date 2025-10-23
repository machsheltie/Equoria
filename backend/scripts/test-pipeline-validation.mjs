/**
 * Automated Testing Pipeline Validation Script
 *
 * This script validates the entire automated testing pipeline including:
 * - CI/CD workflow validation
 * - Test coverage reporting
 * - Performance regression testing
 * - Database migration testing
 * - Integration with GitHub Actions
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pipeline validation configuration
const VALIDATION_CONFIG = {
  timeout: 300000, // 5 minutes
  requiredScripts: [
    'test',
    'test:coverage',
    'test:coverage:ci',
    'test:integration',
    'test:performance',
    'test:performance:regression',
    'test:migration',
    'coverage:report',
    'coverage:badge',
    'health-check',
    'validate-env',
  ],
  requiredFiles: [
    '.github/workflows/ci-cd.yml',
    '.nycrc.json',
    'scripts/performance-tests.mjs',
    'scripts/performance-regression-tests.mjs',
    'scripts/database-migration-tests.mjs',
    'scripts/coverage-report.mjs',
    'scripts/generate-coverage-badge.mjs',
    'scripts/health-check.mjs',
    'scripts/validate-environment.mjs',
  ],
  requiredDependencies: [
    'c8',
    'nyc',
    'codecov',
  ],
};

/**
 * Execute command with error handling
 */
function executeCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      timeout: options.timeout || VALIDATION_CONFIG.timeout,
      cwd: options.cwd || path.resolve(__dirname, '..'),
      stdio: options.silent ? 'pipe' : 'inherit',
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      output: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : '',
    };
  }
}

/**
 * Validate package.json scripts
 */
async function validatePackageScripts() {
  console.log('📋 Validating package.json scripts...');

  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

  const results = {
    valid: true,
    missing: [],
    present: [],
  };

  for (const script of VALIDATION_CONFIG.requiredScripts) {
    if (packageJson.scripts && packageJson.scripts[script]) {
      results.present.push(script);
      console.log(`✅ Script '${script}' found`);
    } else {
      results.missing.push(script);
      results.valid = false;
      console.error(`❌ Script '${script}' missing`);
    }
  }

  return results;
}

/**
 * Validate required files exist
 */
async function validateRequiredFiles() {
  console.log('📁 Validating required files...');

  const results = {
    valid: true,
    missing: [],
    present: [],
  };

  for (const file of VALIDATION_CONFIG.requiredFiles) {
    const filePath = path.resolve(__dirname, '..', file);

    try {
      await fs.access(filePath);
      results.present.push(file);
      console.log(`✅ File '${file}' found`);
    } catch (error) {
      results.missing.push(file);
      results.valid = false;
      console.error(`❌ File '${file}' missing`);
    }
  }

  return results;
}

/**
 * Validate dependencies
 */
async function validateDependencies() {
  console.log('📦 Validating dependencies...');

  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  const results = {
    valid: true,
    missing: [],
    present: [],
  };

  for (const dep of VALIDATION_CONFIG.requiredDependencies) {
    if (allDeps[dep]) {
      results.present.push(dep);
      console.log(`✅ Dependency '${dep}' found (${allDeps[dep]})`);
    } else {
      results.missing.push(dep);
      results.valid = false;
      console.error(`❌ Dependency '${dep}' missing`);
    }
  }

  return results;
}

/**
 * Test environment validation
 */
async function testEnvironmentValidation() {
  console.log('🔧 Testing environment validation...');

  const result = executeCommand('npm run validate-env', { silent: true });

  if (result.success) {
    console.log('✅ Environment validation passed');
    return { success: true };
  } else {
    console.error('❌ Environment validation failed');
    console.error(result.error);
    return { success: false, error: result.error };
  }
}

/**
 * Test health check functionality
 */
async function testHealthCheck() {
  console.log('🏥 Testing health check functionality...');

  const result = executeCommand('npm run health-check', { silent: true });

  if (result.success) {
    console.log('✅ Health check passed');
    return { success: true };
  } else {
    console.error('❌ Health check failed');
    console.error(result.error);
    return { success: false, error: result.error };
  }
}

/**
 * Test coverage reporting
 */
async function testCoverageReporting() {
  console.log('📊 Testing coverage reporting...');

  // Run a quick test with coverage
  const testResult = executeCommand('npm run test:coverage:ci', { silent: true });

  if (!testResult.success) {
    console.error('❌ Coverage test execution failed');
    return { success: false, error: testResult.error };
  }

  // Test coverage report generation
  const reportResult = executeCommand('npm run coverage:report', { silent: true });

  if (!reportResult.success) {
    console.error('❌ Coverage report generation failed');
    return { success: false, error: reportResult.error };
  }

  // Test badge generation
  const badgeResult = executeCommand('npm run coverage:badge', { silent: true });

  if (!badgeResult.success) {
    console.error('❌ Coverage badge generation failed');
    return { success: false, error: badgeResult.error };
  }

  console.log('✅ Coverage reporting system working');
  return { success: true };
}

/**
 * Validate GitHub Actions workflow
 */
async function validateGitHubWorkflow() {
  console.log('🔄 Validating GitHub Actions workflow...');

  const workflowPath = path.resolve(__dirname, '../../.github/workflows/ci-cd.yml');

  try {
    const workflowContent = await fs.readFile(workflowPath, 'utf8');

    // Check for required jobs
    const requiredJobs = [
      'code-quality',
      'database-setup',
      'backend-tests',
      'integration-tests',
      'performance-tests',
      'security-scan',
      'build-validation',
    ];

    const results = {
      valid: true,
      missing: [],
      present: [],
    };

    for (const job of requiredJobs) {
      if (workflowContent.includes(job)) {
        results.present.push(job);
        console.log(`✅ Job '${job}' found in workflow`);
      } else {
        results.missing.push(job);
        results.valid = false;
        console.error(`❌ Job '${job}' missing from workflow`);
      }
    }

    return results;

  } catch (error) {
    console.error('❌ Failed to read GitHub workflow file');
    return { valid: false, error: error.message };
  }
}

/**
 * Generate validation report
 */
async function generateValidationReport(results) {
  const reportDir = path.resolve(__dirname, '../pipeline-validation-results');
  await fs.mkdir(reportDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `pipeline-validation-${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    overallValid: Object.values(results).every(result => result.success !== false && result.valid !== false),
    results,
    summary: {
      scriptsValid: results.scripts.valid,
      filesValid: results.files.valid,
      dependenciesValid: results.dependencies.valid,
      environmentValid: results.environment.success,
      healthCheckValid: results.healthCheck.success,
      coverageValid: results.coverage.success,
      workflowValid: results.workflow.valid,
    },
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  // Save summary for CI
  const summaryPath = path.join(reportDir, 'pipeline-validation-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify({
    timestamp: report.timestamp,
    valid: report.overallValid,
    summary: report.summary,
  }, null, 2));

  return { reportPath, summaryPath };
}

/**
 * Main pipeline validation function
 */
async function validateTestingPipeline() {
  try {
    console.log('🧪 Validating Automated Testing Pipeline');
    console.log('=========================================');

    const results = {};

    // Run all validation checks
    results.scripts = await validatePackageScripts();
    results.files = await validateRequiredFiles();
    results.dependencies = await validateDependencies();
    results.environment = await testEnvironmentValidation();
    results.healthCheck = await testHealthCheck();
    results.coverage = await testCoverageReporting();
    results.workflow = await validateGitHubWorkflow();

    // Generate report
    const reportFiles = await generateValidationReport(results);

    // Display summary
    console.log('\n📊 Pipeline Validation Summary');
    console.log('==============================');
    console.log(`Package Scripts: ${results.scripts.valid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Required Files: ${results.files.valid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Dependencies: ${results.dependencies.valid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Environment Validation: ${results.environment.success ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Health Check: ${results.healthCheck.success ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`Coverage Reporting: ${results.coverage.success ? '✅ WORKING' : '❌ FAILED'}`);
    console.log(`GitHub Workflow: ${results.workflow.valid ? '✅ VALID' : '❌ INVALID'}`);

    const overallValid = Object.values(results).every(result =>
      result.success !== false && result.valid !== false,
    );

    console.log(`\n📁 Validation report saved: ${reportFiles.reportPath}`);

    if (overallValid) {
      console.log('\n✅ Automated Testing Pipeline validation PASSED');
      console.log('🚀 Pipeline is ready for production use');
      process.exit(0);
    } else {
      console.log('\n❌ Automated Testing Pipeline validation FAILED');
      console.log('🔧 Please fix the issues above before using the pipeline');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Pipeline validation failed:', error.message);
    process.exit(1);
  }
}

// Run pipeline validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateTestingPipeline();
}

export {
  validateTestingPipeline,
  validatePackageScripts,
  validateRequiredFiles,
  validateDependencies,
  testEnvironmentValidation,
  testHealthCheck,
  testCoverageReporting,
  validateGitHubWorkflow,
};
