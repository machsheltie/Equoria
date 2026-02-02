#!/usr/bin/env node

/**
 * Naming Consistency Verification Script
 *
 * This script verifies that all naming consistency fixes have been properly applied
 * without requiring database access. It performs static analysis of the codebase
 * to ensure route consistency and proper imports.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

/**
 * Verification tests to run
 */
const verificationTests = [
  {
    name: 'Route Registration Consistency',
    description: 'Verify all routes are properly registered with correct paths',
    test: async () => {
      const appContent = await readFile(join(__dirname, 'backend/app.mjs'), 'utf-8');

      const issues = [];

      // Check for route conflicts
      if (
        appContent.includes("app.use('/api/traits', traitRoutes)") &&
        appContent.includes("app.use('/api/traits', enhancedMilestoneRoutes)")
      ) {
        issues.push(
          'Route conflict: Both traitRoutes and enhancedMilestoneRoutes registered to /api/traits'
        );
      }

      // Check for correct new routes
      if (!appContent.includes("app.use('/api/milestones', enhancedMilestoneRoutes)")) {
        issues.push('Missing: /api/milestones route registration');
      }

      if (!appContent.includes("app.use('/api/users', userRoutes)")) {
        issues.push('Missing: /api/users route registration');
      }

      if (!appContent.includes("app.use('/api/leaderboards', leaderboardRoutes)")) {
        issues.push('Missing: /api/leaderboards route registration');
      }

      // Check API documentation consistency
      if (!appContent.includes("milestones: '/api/milestones'")) {
        issues.push('API documentation missing milestones endpoint');
      }

      if (!appContent.includes("users: '/api/users'")) {
        issues.push('API documentation missing users endpoint');
      }

      if (!appContent.includes("leaderboards: '/api/leaderboards'")) {
        issues.push('API documentation missing leaderboards endpoint');
      }

      return {
        passed: issues.length === 0,
        issues,
      };
    },
  },

  {
    name: 'Test File Updates',
    description: 'Verify test files use updated API endpoints',
    test: async () => {
      const testFiles = [
        'backend/tests/integration/userRoutes.test.mjs',
        'backend/tests/integration/leaderboardRoutes.test.mjs',
        'backend/tests/groomPersonalityTraitBonus.test.mjs',
        'backend/tests/integration/userProgressAPI.integration.test.mjs',
      ];

      const issues = [];

      for (const testFile of testFiles) {
        try {
          const content = await readFile(join(__dirname, testFile), 'utf-8');

          // Check for old API paths that should be updated
          if (content.includes('/api/user/') && !testFile.includes('userRoutes')) {
            issues.push(`${testFile}: Still contains old /api/user/ paths`);
          }

          if (content.includes('/api/leaderboard/')) {
            issues.push(`${testFile}: Still contains old /api/leaderboard/ paths`);
          }

          if (
            content.includes('/api/traits/evaluate-milestone') ||
            content.includes('/api/traits/milestone-status')
          ) {
            issues.push(`${testFile}: Still contains old milestone paths under /api/traits/`);
          }
        } catch (error) {
          issues.push(`${testFile}: Could not read file - ${error.message}`);
        }
      }

      return {
        passed: issues.length === 0,
        issues,
      };
    },
  },

  {
    name: 'Route Documentation Updates',
    description: 'Verify route documentation reflects new paths',
    test: async () => {
      const routeFiles = [
        'backend/routes/enhancedMilestoneRoutes.mjs',
        'backend/controllers/enhancedMilestoneController.mjs',
      ];

      const issues = [];

      for (const routeFile of routeFiles) {
        try {
          const content = await readFile(join(__dirname, routeFile), 'utf-8');

          // Check for updated documentation
          if (
            content.includes('/api/traits/evaluate-milestone') ||
            content.includes('/api/traits/milestone-status') ||
            content.includes('/api/traits/milestone-definitions')
          ) {
            issues.push(`${routeFile}: Documentation still references old /api/traits/ paths`);
          }
        } catch (error) {
          issues.push(`${routeFile}: Could not read file - ${error.message}`);
        }
      }

      return {
        passed: issues.length === 0,
        issues,
      };
    },
  },

  {
    name: 'Schema Validator Consistency',
    description: 'Verify schema validator uses correct model references',
    test: async () => {
      const content = await readFile(join(__dirname, 'backend/utils/schemaValidator.mjs'), 'utf-8');

      const issues = [];

      // Check for removed Foal model references
      if (content.includes("model: 'Foal'")) {
        issues.push('Schema validator still references non-existent Foal model');
      }

      // Check for foal-specific fields in Horse model
      if (
        !content.includes('consecutiveDaysFoalCare') ||
        !content.includes('taskLog') ||
        !content.includes('epigeneticModifiers')
      ) {
        issues.push('Horse model validation missing foal-specific fields');
      }

      return {
        passed: issues.length === 0,
        issues,
      };
    },
  },
];

/**
 * Run all verification tests
 */
async function runVerification() {
  console.log(`${colors.bold}${colors.blue}🔧 Naming Consistency Verification${colors.reset}\n`);

  let totalTests = 0;
  let passedTests = 0;
  const allIssues = [];

  for (const test of verificationTests) {
    totalTests++;
    console.log(`${colors.yellow}Testing: ${test.name}${colors.reset}`);
    console.log(`Description: ${test.description}\n`);

    try {
      const result = await test.test();

      if (result.passed) {
        console.log(`${colors.green}✅ PASSED${colors.reset}\n`);
        passedTests++;
      } else {
        console.log(`${colors.red}❌ FAILED${colors.reset}`);
        result.issues.forEach((issue) => {
          console.log(`   ${colors.red}• ${issue}${colors.reset}`);
          allIssues.push(`${test.name}: ${issue}`);
        });
        console.log();
      }
    } catch (error) {
      console.log(`${colors.red}❌ ERROR: ${error.message}${colors.reset}\n`);
      allIssues.push(`${test.name}: Test execution error - ${error.message}`);
    }
  }

  // Summary
  console.log(`${colors.bold}📊 VERIFICATION SUMMARY${colors.reset}`);
  console.log(`Tests Passed: ${colors.green}${passedTests}/${totalTests}${colors.reset}`);

  if (allIssues.length === 0) {
    console.log(
      `${colors.green}${colors.bold}🎉 ALL NAMING CONSISTENCY FIXES VERIFIED!${colors.reset}`
    );
    console.log(`${colors.green}✅ Route conflicts resolved${colors.reset}`);
    console.log(`${colors.green}✅ API endpoints standardized${colors.reset}`);
    console.log(`${colors.green}✅ Test files updated${colors.reset}`);
    console.log(`${colors.green}✅ Documentation consistent${colors.reset}`);
    return true;
  } else {
    console.log(`${colors.red}${colors.bold}⚠️  ISSUES FOUND:${colors.reset}`);
    allIssues.forEach((issue) => {
      console.log(`${colors.red}• ${issue}${colors.reset}`);
    });
    return false;
  }
}

// Run verification if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runVerification()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(`${colors.red}Verification failed: ${error.message}${colors.reset}`);
      process.exit(1);
    });
}

export { runVerification };
