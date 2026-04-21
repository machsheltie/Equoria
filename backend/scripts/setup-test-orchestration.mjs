#!/usr/bin/env node

/**
 * Setup Script for Test Orchestration
 *
 * Automates the installation and configuration of the optimized test suite.
 *
 * Usage:
 * node scripts/setup-test-orchestration.mjs
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 Test Orchestration Setup');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function main() {
  try {
    // 1. Verify we're in backend directory
    console.log('📍 Step 1: Verifying directory...');
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found. Please run from backend directory.');
    }
    console.log('   ✓ In backend directory\n');

    // 2. Install dependencies
    console.log('📦 Step 2: Installing dependencies...');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const requiredDeps = ['@jest/test-sequencer', 'husky', 'jest-html-reporter', 'jest-junit'];

    const missingDeps = requiredDeps.filter(dep => !packageJson.devDependencies?.[dep]);

    if (missingDeps.length > 0) {
      console.log(`   Installing: ${missingDeps.join(', ')}`);
      await execAsync(`npm install --save-dev ${missingDeps.join(' ')}`);
      console.log('   ✓ Dependencies installed\n');
    } else {
      console.log('   ✓ All dependencies already installed\n');
    }

    // 3. Initialize Husky
    console.log('🪝 Step 3: Initializing Husky...');
    try {
      await execAsync('npm run prepare');
      console.log('   ✓ Husky initialized\n');
    } catch (error) {
      console.log('   ⚠️  Husky initialization skipped (may already be initialized)\n');
    }

    // 4. Create directories
    console.log('📁 Step 4: Creating directories...');
    const directories = ['tests/config', 'test-results', '.jest-cache', '.husky'];

    for (const dir of directories) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   ✓ Created ${dir}`);
      }
    }
    console.log('   ✓ Directories ready\n');

    // 5. Verify configuration files
    console.log('📝 Step 5: Verifying configuration files...');
    const configFiles = [
      'jest.config.optimized.mjs',
      'tests/config/CustomSequencer.mjs',
      'tests/config/DependencyExtractor.mjs',
      'tests/config/globalSetup.mjs',
      'tests/config/globalTeardown.mjs',
      'tests/config/PerformanceReporter.mjs',
      'tests/config/setupTests.mjs',
      'scripts/test-auth.mjs',
      'scripts/pre-commit-tests.mjs',
      '.husky/pre-commit',
    ];

    let allFilesExist = true;
    for (const file of configFiles) {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        console.log(`   ❌ Missing: ${file}`);
        allFilesExist = false;
      }
    }

    if (allFilesExist) {
      console.log('   ✓ All configuration files present\n');
    } else {
      console.log('   ⚠️  Some configuration files missing\n');
      console.log('   Please ensure all files from the implementation are present.\n');
    }

    // 6. Make scripts executable
    console.log('🔧 Step 6: Making scripts executable...');
    const scriptsToMakeExecutable = [
      'scripts/test-auth.mjs',
      'scripts/pre-commit-tests.mjs',
      'scripts/setup-test-orchestration.mjs',
      '.husky/pre-commit',
    ];

    for (const script of scriptsToMakeExecutable) {
      const scriptPath = path.join(process.cwd(), script);
      if (fs.existsSync(scriptPath)) {
        try {
          fs.chmodSync(scriptPath, '755');
          console.log(`   ✓ Made ${script} executable`);
        } catch (error) {
          console.log(`   ⚠️  Could not make ${script} executable (Windows?)`);
        }
      }
    }
    console.log('');

    // 7. Verify git repository
    console.log('📂 Step 7: Verifying git repository...');
    try {
      await execAsync('git rev-parse --git-dir');
      console.log('   ✓ Git repository detected\n');
    } catch {
      console.log("   ⚠️  Not a git repository (hooks won't work)\n");
    }

    // 8. Run test verification
    console.log('🧪 Step 8: Running test verification...');
    console.log('   Running sample test...\n');

    try {
      const { stdout } = await execAsync('npm run test:auth -- --listTests');
      const testFiles = stdout.split('\n').filter(Boolean);
      console.log(`   ✓ Found ${testFiles.length} test files\n`);
    } catch (error) {
      console.log('   ⚠️  Could not list tests (check Jest config)\n');
    }

    // 9. Generate initial performance baseline
    console.log('📊 Step 9: Generating performance baseline...');
    console.log('   This will run the full test suite once...\n');

    try {
      const startTime = Date.now();
      await execAsync('npm run test:auth:benchmark', {
        env: {
          ...process.env,
          NODE_ENV: 'test',
        },
      });
      const duration = Date.now() - startTime;

      console.log(`   ✓ Baseline generated (${duration}ms)\n`);
      console.log('   See: test-results/performance-report.txt\n');
    } catch (error) {
      console.log('   ⚠️  Could not generate baseline (tests may be failing)\n');
      console.log('   Run npm run test:auth manually to debug\n');
    }

    // 10. Print summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Setup Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📚 Next Steps:\n');
    console.log('1. Run tests:');
    console.log('   npm run test:auth\n');

    console.log('2. Enable watch mode:');
    console.log('   npm run test:auth:watch\n');

    console.log('3. View performance report:');
    console.log('   cat test-results/performance-report.txt\n');

    console.log('4. View coverage:');
    console.log('   npm run test:auth:coverage');
    console.log('   open coverage/lcov-report/index.html\n');

    console.log('5. Read documentation:');
    console.log('   cat TESTING_QUICK_REFERENCE.md\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nPlease fix the error and run again.\n');
    process.exit(1);
  }
}

// Run setup
main();
