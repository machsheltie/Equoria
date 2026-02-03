import fs from 'fs';
import path from 'path';

const logPath = process.argv[2] || 'backend_test_run.log';

if (!fs.existsSync(logPath)) {
  console.error(`Error: Log file not found at ${logPath}`);
  process.exit(1);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split(/\r?\n/);

console.log(`\n🔍 LOG SURGEON REPORT: ${logPath}`);
console.log(`Total lines: ${lines.length}`);
console.log('==================================================');

// 1. Extract Summary Stats
// Search for the line that contains "Tests:" and "failed"
const testLine = lines.find((l) => l.includes('Tests:') && l.includes('failed'));
if (testLine) {
  console.log(`📊 STATUS: ${testLine.trim()}`);
} else {
  // Try a broader search in the whole content
  const broadMatch = content.match(/Tests:.*failed.*/i);
  if (broadMatch) {
    console.log(`📊 STATUS (Broad Match): ${broadMatch[0].trim()}`);
  } else {
    console.log('⚠️ Could not find standard Jest summary line.');
  }
}

// 2. Extract Failed Suites
console.log('\n❌ FAILED SUITES (Sample):');
const failedLines = lines.filter(
  (line) =>
    line.toUpperCase().includes('FAIL') &&
    (line.includes('.') || line.includes('/') || line.includes('\\'))
);
failedLines.slice(0, 15).forEach((line) => {
  console.log(`  • ${line.replace(/[^\x20-\x7E]/g, '').trim()}`);
});
if (failedLines.length > 15) console.log(`  ...and ${failedLines.length - 15} more failed suites.`);

console.log('\n🔎 TOP 5 COMMON ERRORS:');
// Simple frequency analysis
const errorCounts = {};
lines.forEach((line) => {
  if (line.includes('Error:') || line.includes('TypeError:')) {
    const cleanMsg = line.replace(/.*Error:\s+/, '').substring(0, 100);
    errorCounts[cleanMsg] = (errorCounts[cleanMsg] || 0) + 1;
  }
});

Object.entries(errorCounts)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 5)
  .forEach(([msg, count]) => {
    console.log(`  [${count}x] ${msg}`);
  });

console.log('==================================================\n');
