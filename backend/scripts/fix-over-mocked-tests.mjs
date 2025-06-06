#!/usr/bin/env node

/**
 * 🔧 SCRIPT: Fix Over-Mocked Tests - Restore Minimal Mocking Strategy
 *
 * This script identifies and helps fix tests that were corrupted by Copilot
 * with excessive mocking, restoring the proven balanced mocking approach.
 *
 * 📊 PROVEN STRATEGY:
 * ✅ Balanced Mocking (84 files): 90.1% success rate
 * ❌ Over-mocking (16 files): ~1% success rate
 *
 * 🎯 DETECTION CRITERIA:
 * - Heavy use of jest.unstable_mockModule()
 * - Mocking of core business logic (models, controllers)
 * - Mocking database operations that should be tested
 * - Complex mock setups that replicate business logic
 *
 * 🔄 RESTORATION STRATEGY:
 * 1. Remove excessive mocks
 * 2. Use real database operations
 * 3. Keep strategic mocks (logger, external APIs)
 * 4. Focus on testing actual business logic
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const TEST_DIRS = [
  join(__dirname, '../tests'),
  join(__dirname, '../tests/integration'),
  join(__dirname, '../tests/unit'),
];

// Patterns that indicate over-mocking
const OVER_MOCKING_PATTERNS = [
  /jest\.unstable_mockModule.*db\/index/,
  /jest\.unstable_mockModule.*models\//,
  /jest\.unstable_mockModule.*controllers\//,
  /mockPrisma\.\w+\.\w+\.mockResolvedValue/,
  /const mockPrisma = {[\s\S]*?};/,
  /Mock the database module BEFORE importing/,
  /Set up mock response/,
];

// Patterns that indicate good minimal mocking
const GOOD_MOCKING_PATTERNS = [
  /jest\.mock.*logger/,
  /jest\.mock.*Math\.random/,
  /Strategic mocking: Only mock external dependencies/,
  /BALANCED MOCKING APPROACH/,
  /await prisma\.\w+\.create/,
  /await prisma\.\w+\.findMany/,
];

async function scanTestFiles() {
  const results = {
    overMocked: [],
    balanced: [],
    needsReview: [],
  };

  for (const testDir of TEST_DIRS) {
    try {
      const files = await readdir(testDir, { recursive: true });
      
      for (const file of files) {
        if (file.endsWith('.test.mjs') || file.endsWith('.test.js')) {
          const filePath = join(testDir, file);
          const content = await readFile(filePath, 'utf-8');
          
          const overMockingScore = OVER_MOCKING_PATTERNS.reduce(
            (score, pattern) => score + (pattern.test(content) ? 1 : 0),
            0
          );
          
          const goodMockingScore = GOOD_MOCKING_PATTERNS.reduce(
            (score, pattern) => score + (pattern.test(content) ? 1 : 0),
            0
          );
          
          const analysis = {
            file: filePath,
            overMockingScore,
            goodMockingScore,
            ratio: goodMockingScore / Math.max(overMockingScore, 1),
          };
          
          if (overMockingScore >= 3) {
            results.overMocked.push(analysis);
          } else if (goodMockingScore >= 2) {
            results.balanced.push(analysis);
          } else {
            results.needsReview.push(analysis);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not scan directory ${testDir}:`, error.message);
    }
  }

  return results;
}

function generateFixReport(results) {
  const report = `
# 🔧 TEST MOCKING ANALYSIS REPORT

## 📊 SUMMARY
- **Over-Mocked Tests**: ${results.overMocked.length} files (NEED FIXING)
- **Balanced Tests**: ${results.balanced.length} files (GOOD)
- **Need Review**: ${results.needsReview.length} files

## ❌ OVER-MOCKED TESTS (Priority Fix)
${results.overMocked.map(test => `
### ${test.file}
- Over-mocking Score: ${test.overMockingScore}
- Good Mocking Score: ${test.goodMockingScore}
- Ratio: ${test.ratio.toFixed(2)}
- **Action**: Remove excessive mocks, use real database operations
`).join('')}

## ✅ BALANCED TESTS (Keep as Reference)
${results.balanced.slice(0, 5).map(test => `
### ${test.file}
- Over-mocking Score: ${test.overMockingScore}
- Good Mocking Score: ${test.goodMockingScore}
- Ratio: ${test.ratio.toFixed(2)}
- **Status**: Good example of minimal mocking
`).join('')}

## 🔍 NEED REVIEW
${results.needsReview.slice(0, 5).map(test => `
### ${test.file}
- Over-mocking Score: ${test.overMockingScore}
- Good Mocking Score: ${test.goodMockingScore}
- Ratio: ${test.ratio.toFixed(2)}
- **Action**: Review and categorize
`).join('')}

## 🎯 FIXING STRATEGY

### 1. Remove Over-Mocking
\`\`\`javascript
// ❌ REMOVE: Heavy database mocking
jest.unstable_mockModule('../../db/index.mjs', () => ({
  default: { /* complex mock setup */ }
}));

// ✅ REPLACE: Strategic mocking only
jest.mock('../../utils/logger.mjs', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));
\`\`\`

### 2. Use Real Database Operations
\`\`\`javascript
// ❌ REMOVE: Mock expectations
mockPrisma.horse.findMany.mockResolvedValue(mockData);

// ✅ REPLACE: Real database operations
const testHorse = await prisma.horse.create({
  data: { /* real test data */ }
});
\`\`\`

### 3. Test Real Business Logic
\`\`\`javascript
// ❌ REMOVE: Testing mock behavior
expect(mockPrisma.horse.findMany).toHaveBeenCalledWith(/* params */);

// ✅ REPLACE: Testing actual results
expect(response.body.data.horses).toHaveLength(3);
expect(response.body.data.horses[0].name).toBe('TestHorse');
\`\`\`

## 📈 EXPECTED IMPROVEMENT
Following this strategy should restore your **90.1% success rate** by:
1. Testing real business logic instead of mock behavior
2. Validating actual data transformations
3. Ensuring database operations work correctly
4. Maintaining only strategic external dependency mocks
`;

  return report;
}

async function main() {
  console.log('🔍 Scanning test files for over-mocking patterns...\n');
  
  const results = await scanTestFiles();
  const report = generateFixReport(results);
  
  // Save report
  const reportPath = join(__dirname, '../docs/test-mocking-analysis.md');
  await writeFile(reportPath, report);
  
  console.log('📊 ANALYSIS COMPLETE');
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log(`\n🎯 PRIORITY FIXES NEEDED: ${results.overMocked.length} files`);
  
  if (results.overMocked.length > 0) {
    console.log('\n❌ OVER-MOCKED FILES TO FIX:');
    results.overMocked.forEach((test, index) => {
      console.log(`${index + 1}. ${test.file} (Score: ${test.overMockingScore})`);
    });
  }
  
  console.log(`\n✅ BALANCED FILES (Good Examples): ${results.balanced.length}`);
  console.log('\n💡 Run this script after fixing files to track progress');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { scanTestFiles, generateFixReport };
