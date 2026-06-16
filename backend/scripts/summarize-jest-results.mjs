#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [, , input = 'test-results/jest-results.json', output = 'test-results/jest-summary.txt'] =
  process.argv;
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function firstFailure(result) {
  const messages = [
    result.message ?? '',
    ...(result.assertionResults ?? []).flatMap(assertion => assertion.failureMessages ?? []),
  ]
    .join('\n')
    .replace(ANSI_PATTERN, '')
    .trim();
  return messages.split(/\r?\n/).find(Boolean)?.slice(0, 500) ?? 'No failure message recorded';
}

let summary;
if (!existsSync(input)) {
  summary = `Jest did not write ${input}. Inspect jest.log for a crash, timeout, or OOM.\n`;
} else {
  const results = JSON.parse(readFileSync(input, 'utf8'));
  const failed = (results.testResults ?? []).filter(
    result => result.status === 'failed' || (result.numFailingTests ?? 0) > 0,
  );
  const lines = [
    `Suites: ${results.numPassedTestSuites ?? 0} passed, ${results.numFailedTestSuites ?? 0} failed, ${results.numTotalTestSuites ?? 0} total`,
    `Tests: ${results.numPassedTests ?? 0} passed, ${results.numFailedTests ?? 0} failed, ${results.numTotalTests ?? 0} total`,
  ];
  for (const result of failed.slice(0, 50)) {
    lines.push(`FAIL ${path.relative(process.cwd(), result.name ?? result.testFilePath ?? '?')}`);
    lines.push(`  ${firstFailure(result)}`);
  }
  summary = `${lines.join('\n')}\n`;
}

writeFileSync(output, summary);
console.log(summary);
