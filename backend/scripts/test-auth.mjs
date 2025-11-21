#!/usr/bin/env node

/**
 * Optimized Authentication Test Runner
 *
 * Usage:
 * npm run test:auth           - Run all auth tests (parallel)
 * npm run test:auth:watch     - Watch mode (single worker, fast feedback)
 * npm run test:auth:ci        - CI mode (100% workers, no watch)
 * npm run test:auth:coverage  - With coverage report
 * npm run test:auth:benchmark - With performance benchmarking
 *
 * Features:
 * - Intelligent test batching
 * - Parallel execution
 * - Result caching
 * - Performance monitoring
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args[0] || 'default';

// Configuration for different modes
const configs = {
  default: {
    configPath: 'jest.config.optimized.mjs',
    env: {
      NODE_ENV: 'test',
      TEST_TYPE: 'auth',
    },
    jestArgs: [
      '--config=jest.config.optimized.mjs',
      '--testPathPattern=auth',
      '--colors',
      '--maxWorkers=50%',
    ],
  },

  watch: {
    configPath: 'jest.config.optimized.mjs',
    env: {
      NODE_ENV: 'test',
      TEST_TYPE: 'auth',
    },
    jestArgs: [
      '--config=jest.config.optimized.mjs',
      '--testPathPattern=auth',
      '--watch',
      '--colors',
      '--maxWorkers=1', // Single worker for watch mode
      '--onlyChanged', // Only re-run changed tests
    ],
  },

  ci: {
    configPath: 'jest.config.optimized.mjs',
    env: {
      NODE_ENV: 'test',
      TEST_TYPE: 'auth',
      CI: 'true',
    },
    jestArgs: [
      '--config=jest.config.optimized.mjs',
      '--testPathPattern=auth',
      '--colors',
      '--maxWorkers=100%',
      '--ci',
      '--bail=false', // Run all tests in CI
      '--coverage',
      '--coverageReporters=text-summary',
      '--coverageReporters=lcov',
      '--coverageReporters=cobertura',
    ],
  },

  coverage: {
    configPath: 'jest.config.optimized.mjs',
    env: {
      NODE_ENV: 'test',
      TEST_TYPE: 'auth',
      COVERAGE: 'true',
    },
    jestArgs: [
      '--config=jest.config.optimized.mjs',
      '--testPathPattern=auth',
      '--coverage',
      '--colors',
      '--maxWorkers=50%',
    ],
  },

  benchmark: {
    configPath: 'jest.config.optimized.mjs',
    env: {
      NODE_ENV: 'test',
      TEST_TYPE: 'auth',
      BENCHMARK: 'true',
    },
    jestArgs: [
      '--config=jest.config.optimized.mjs',
      '--testPathPattern=auth',
      '--colors',
      '--maxWorkers=50%',
      '--verbose',
    ],
  },

  changed: {
    configPath: 'jest.config.optimized.mjs',
    env: {
      NODE_ENV: 'test',
      TEST_TYPE: 'auth',
    },
    jestArgs: [
      '--config=jest.config.optimized.mjs',
      '--testPathPattern=auth',
      '--onlyChanged',
      '--colors',
      '--maxWorkers=50%',
    ],
  },
};

// Get configuration for selected mode
const config = configs[mode] || configs.default;

// Print banner
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Authentication Test Suite');
console.log(`📋 Mode: ${mode.toUpperCase()}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Check if optimized config exists
const configPath = path.join(process.cwd(), config.configPath);
if (!fs.existsSync(configPath)) {
  console.error(`❌ Config file not found: ${configPath}`);
  console.error('   Run: npm run setup:test to generate optimized config');
  process.exit(1);
}

// Prepare Jest command
const jestPath = path.join(
  process.cwd(),
  'node_modules',
  'jest',
  'bin',
  'jest.js'
);

const jestCommand = 'node';
const jestArgs = [
  '--experimental-vm-modules',
  jestPath,
  ...config.jestArgs,
  ...args.slice(1), // Pass through additional arguments
];

// Set environment variables
const env = {
  ...process.env,
  ...config.env,
};

// Show configuration
console.log('Configuration:');
console.log(`  Workers: ${config.jestArgs.find(arg => arg.includes('maxWorkers'))}`);
console.log(`  Config: ${config.configPath}`);
console.log(`  Coverage: ${env.COVERAGE === 'true' ? 'Yes' : 'No'}`);
console.log(`  CI Mode: ${env.CI === 'true' ? 'Yes' : 'No'}\n`);

// Run Jest
const jest = spawn(jestCommand, jestArgs, {
  env,
  stdio: 'inherit',
  shell: true,
});

// Handle exit
jest.on('close', code => {
  if (code === 0) {
    console.log('\n✅ All authentication tests passed!\n');
  } else {
    console.log(`\n❌ Tests failed with exit code ${code}\n`);
  }

  // Show coverage report location if generated
  if (env.COVERAGE === 'true' || config.jestArgs.includes('--coverage')) {
    const coveragePath = path.join(process.cwd(), 'coverage', 'lcov-report', 'index.html');
    if (fs.existsSync(coveragePath)) {
      console.log(`📊 Coverage report: ${coveragePath}\n`);
    }
  }

  process.exit(code);
});

// Handle errors
jest.on('error', error => {
  console.error('❌ Failed to start Jest:', error);
  process.exit(1);
});
