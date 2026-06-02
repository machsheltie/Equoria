#!/usr/bin/env node
/**
 * Equoria-wkdwx breeding-slice one-shot codemod.
 *
 * Removes function-body `try { ... } catch (error) { logger.error(...); throw error; }`
 * wrappers in the 4 backend/modules/breeding/services/*.mjs files carried in the
 * rethrow-after-log doctrine baseline (Equoria-ej9k1). Per OPTIMAL_FIX §3 the
 * global error handler already logs once with full context, so the try/catch
 * wrapper adds nothing — the catch bodies here only re-log a generic
 * `Error: ${error.message}` / `{ error: error.message }` already implied by the
 * stack trace.
 *
 * This mirrors the approved precedent codemod
 * scripts/fix-678jm-genetics-rethrow.mjs (commit 746fd6384) byte-for-byte in
 * strategy; only the FILES list differs.
 *
 * Catches that do anything beyond log-then-throw are left untouched by the
 * isLogThenThrow guard below — specifically the two fail-soft catches in this
 * slice (advancedLineageAnalysisService.calculateInbreedingCoefficient →
 * `return 0`; dynamicCompatibilityScoring.calculateHistoricalModifier →
 * `return 1.0`) have no `throw` and are correctly skipped, so behaviour is
 * unchanged for them.
 *
 * Strategy: for each "  try {" at indent=2 (function-body level), find the
 * matching "  } catch (error) { ... throw error; ... }" closing block, then:
 *   1. Remove the opening "  try {" line
 *   2. Remove the closing catch block lines (from "  } catch" to its closing "  }")
 *   3. Dedent every line in between by 2 spaces
 *
 * Verifies by running the doctrine check after.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const FILES = [
  'backend/modules/breeding/services/advancedLineageAnalysisService.mjs',
  'backend/modules/breeding/services/breedingPredictionService.mjs',
  'backend/modules/breeding/services/dynamicCompatibilityScoring.mjs',
  'backend/modules/breeding/services/enhancedGeneticProbabilityService.mjs',
];

function fixFile(path) {
  const src = readFileSync(path, 'utf8');
  const lines = src.split('\n');
  const out = [];
  let i = 0;
  let changed = 0;

  while (i < lines.length) {
    const line = lines[i];
    // Function-body-level try { (exactly 2 spaces indent)
    if (line === '  try {') {
      // Find the matching closing catch block
      let depth = 1;
      let j = i + 1;
      let catchStart = -1;
      while (j < lines.length) {
        const inner = lines[j];
        // Find catch at the matching indent (2 spaces) — depth==0 only at function-body close
        if (/^ {2}\} catch \(/.test(inner) && depth === 1) {
          catchStart = j;
          break;
        }
        // Track brace depth roughly (just to bail safely if structure is weird)
        const opens = (inner.match(/\{/g) || []).length;
        const closes = (inner.match(/\}/g) || []).length;
        depth += opens - closes;
        // depth goes to 0 BEFORE catch starts means we're inside a nested struct that closed
        if (depth <= 0 && !/^ {2}\} catch/.test(inner)) {
          // not the function-level catch we want; bail this try
          break;
        }
        j++;
      }
      if (catchStart === -1) {
        // No matching function-level catch — leave the line alone
        out.push(line);
        i++;
        continue;
      }
      // Verify catch body is just log + throw + closing brace
      // Find the catch's closing brace at indent 2
      let catchEnd = -1;
      for (let k = catchStart + 1; k < lines.length; k++) {
        if (lines[k] === '  }') {
          catchEnd = k;
          break;
        }
      }
      if (catchEnd === -1) {
        out.push(line);
        i++;
        continue;
      }
      // Inspect catch body: must contain logger.X(...) and throw error; only
      const catchBody = lines.slice(catchStart + 1, catchEnd).join('\n');
      const isLogThenThrow =
        /logger\.(error|warn|info)\(/.test(catchBody) &&
        /throw\s+\w+\s*;?/.test(catchBody) &&
        !/if\s*\(/.test(catchBody) && // no conditional logic
        !/await\s+/.test(catchBody); // no async cleanup
      if (!isLogThenThrow) {
        out.push(line);
        i++;
        continue;
      }
      // Apply transformation:
      // - Skip the "  try {" line (i)
      // - Dedent lines (catchStart-1 down to i+1) by 2 spaces
      // - Skip catchStart through catchEnd
      for (let k = i + 1; k < catchStart; k++) {
        const inner = lines[k];
        if (inner.startsWith('    ')) {
          out.push(inner.slice(2));
        } else if (inner === '') {
          out.push(inner);
        } else {
          // Indent doesn't match expected — keep as-is and log
          out.push(inner);
        }
      }
      // Skip the catch block entirely
      i = catchEnd + 1;
      changed++;
      continue;
    }
    out.push(line);
    i++;
  }

  if (changed > 0) {
    writeFileSync(path, out.join('\n'));
    console.log(`  ${path}: removed ${changed} try/catch wrappers`);
  } else {
    console.log(`  ${path}: no changes`);
  }
  return changed;
}

console.log('=== Equoria-wkdwx breeding-slice codemod ===');
let total = 0;
for (const f of FILES) {
  total += fixFile(f);
}
console.log(`\nTotal: removed ${total} rethrow-after-log wrappers across ${FILES.length} files.`);
console.log('\n=== Re-running doctrine check ===');
try {
  execSync('node scripts/doctrine-checks/check-no-new-rethrow-after-log.mjs', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('✓ Doctrine check PASS');
} catch {
  console.log('✗ Doctrine check FAIL — investigate manually');
  process.exit(1);
}
