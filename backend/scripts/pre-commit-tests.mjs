#!/usr/bin/env node

/**
 * Pre-Commit Test Runner
 *
 * Runs only tests for changed files to provide fast feedback.
 * Part of git pre-commit hook for quality gate enforcement.
 *
 * Features:
 * - Detects changed files using git
 * - Runs only affected tests
 * - Fast execution (typically <10s)
 * - Blocks commit if tests fail
 *
 * Usage:
 * - Automatic: Triggered by git commit
 * - Manual: node scripts/pre-commit-tests.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

async function main() {
  console.log('🔍 Pre-commit test check...\n');

  try {
    // 1. Get list of changed files
    const changedFiles = await getChangedFiles();

    if (changedFiles.length === 0) {
      console.log('✅ No relevant files changed, skipping tests\n');
      return 0;
    }

    console.log(`📝 Changed files (${changedFiles.length}):`);
    changedFiles.forEach(file => console.log(`  - ${file}`));
    console.log('');

    // 2. Determine which test suites to run
    const testSuites = determineTestSuites(changedFiles);

    if (testSuites.length === 0) {
      console.log('✅ No tests affected by changes\n');
      return 0;
    }

    console.log(`🧪 Running test suites: ${testSuites.join(', ')}\n`);

    // 3. Run tests
    const success = await runTests(testSuites);

    if (success) {
      console.log('\n✅ All pre-commit tests passed!\n');
      return 0;
    } else {
      console.log('\n❌ Pre-commit tests failed!\n');
      console.log('💡 Fix the failing tests before committing.\n');
      return 1;
    }
  } catch (error) {
    console.error('❌ Pre-commit test error:', error.message);
    return 1;
  }
}

/**
 * Get list of changed files from git
 */
async function getChangedFiles() {
  try {
    // Get staged files
    const { stdout } = await execAsync('git diff --cached --name-only');
    const stagedFiles = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .filter(file => {
        // Only include relevant file types
        return (
          file.endsWith('.mjs') ||
          file.endsWith('.js') ||
          file.endsWith('.ts') ||
          file.endsWith('.tsx')
        );
      })
      .filter(file => {
        // Exclude test files themselves
        return !file.includes('__tests__') && !file.includes('.test.');
      });

    return stagedFiles;
  } catch (error) {
    console.warn('⚠️  Could not get changed files:', error.message);
    return [];
  }
}

/**
 * Determine which test suites to run based on changed files
 */
function determineTestSuites(changedFiles) {
  const suites = new Set();

  changedFiles.forEach(file => {
    // Auth-related files
    if (
      file.includes('auth') ||
      file.includes('middleware/auth') ||
      file.includes('controllers/authController')
    ) {
      suites.add('auth');
    }

    // API-related files
    if (file.includes('app.mjs') || file.includes('routes/')) {
      suites.add('api');
    }

    // Database-related files
    if (file.includes('prisma') || file.includes('database')) {
      suites.add('integration');
    }
  });

  return Array.from(suites);
}

/**
 * Run specified test suites
 */
async function runTests(testSuites) {
  try {
    // Construct test pattern
    const testPattern = testSuites.length === 1
      ? testSuites[0]
      : `(${testSuites.join('|')})`;

    // Run Jest with optimized config
    const jestCommand = `node --experimental-vm-modules node_modules/jest/bin/jest.js --config=jest.config.optimized.mjs --testPathPattern="${testPattern}" --bail --onlyChanged --passWithNoTests`;

    console.log(`Running: ${jestCommand}\n`);

    const { stdout, stderr } = await execAsync(jestCommand, {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CI: 'false',
      },
    });

    // Print output
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    return true;
  } catch (error) {
    // Jest exits with non-zero code on test failure
    if (error.stdout) console.log(error.stdout);
    if (error.stderr) console.error(error.stderr);
    return false;
  }
}

/**
 * Check if we're in a git repository
 */
async function isGitRepository() {
  try {
    await execAsync('git rev-parse --git-dir');
    return true;
  } catch {
    return false;
  }
}

// Run main function
(async () => {
  // Check if in git repository
  const isGit = await isGitRepository();
  if (!isGit) {
    console.log('⚠️  Not a git repository, skipping pre-commit tests\n');
    process.exit(0);
  }

  // Run tests
  const exitCode = await main();
  process.exit(exitCode);
})();
