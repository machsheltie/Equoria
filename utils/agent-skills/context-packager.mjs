import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'node:url';

/**
 * Classify a thrown `execSync` error from the `grep -r -l` shell-out.
 *
 * grep's exit codes: 0 = matches found, 1 = NO matches (NOT an error),
 * >= 2 = a genuine failure (bad option, unreadable tree, etc.). A missing
 * grep binary throws ENOENT. We MUST distinguish the benign no-match case
 * from a real failure so that a failed shell-out can never masquerade as a
 * successful-but-empty context bundle — the false-green class fixed under
 * Equoria-lq5li (auditor) and Equoria-h3sij (this script).
 *
 * @param {{status?: number, code?: string}} err
 * @returns {'no-matches' | 'failure'}
 */
export function classifyGrepError(err) {
  if (err && err.code === 'ENOENT') return 'failure'; // grep not on PATH
  if (err && err.status === 1) return 'no-matches'; // grep: zero matches, clean run
  return 'failure'; // status >= 2, killed by signal, or anything unexpected
}

/**
 * Assemble and print a context bundle for the given feature keyword.
 * Read-only: greps the tree and reads a sample of matched files. Fails
 * loud (process.exit(1)) on a genuine grep failure rather than printing a
 * reassuring message and exiting 0 with an empty bundle.
 *
 * @param {string} featureKeyword
 */
export function packageContext(featureKeyword) {
  console.log(`\n📦 CONTEXT PACKAGER: Assembling context for "${featureKeyword}"...`);
  console.log('==================================================');

  // 1. Find relevant files
  const cmd = `grep -r -l "${featureKeyword}" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=coverage --exclude-dir=logs --exclude=*.log --exclude=*.json --exclude=*.lock`;
  let output = '';
  try {
    output = execSync(cmd, { encoding: 'utf8' });
  } catch (e) {
    if (classifyGrepError(e) === 'no-matches') {
      // Legitimate: the keyword matched nothing. An empty bundle here is
      // honest, not a failure — fall through with no files.
      output = '';
    } else {
      // Fail loud: a real grep failure must NOT yield a green empty bundle.
      console.error(
        `\n❌ CONTEXT PACKAGER FAILED: grep shell-out errored ` +
          `(status=${e?.status ?? 'n/a'}, code=${e?.code ?? 'n/a'}). ` +
          `Cannot assemble a reliable context bundle — refusing to report ` +
          `a partial/empty result as success. ${e?.message ?? ''}`
      );
      process.exit(1);
    }
  }

  const files = output
    .trim()
    .split('\n')
    .filter((f) => f);

  console.log(`Found ${files.length} relevant files.`);

  // 2. Categorize
  const backend = files.filter((f) => f.includes('backend/'));
  const frontend = files.filter((f) => f.includes('frontend/'));
  const tests = files.filter((f) => f.includes('test'));

  console.log(`\n--- 📂 Structure Summary ---`);
  if (backend.length)
    console.log(
      `Backend (${backend.length}): \n  ${backend.slice(0, 5).join('\n  ')}${backend.length > 5 ? '\n  ...' : ''}`
    );
  if (frontend.length)
    console.log(
      `Frontend (${frontend.length}): \n  ${frontend.slice(0, 5).join('\n  ')}${frontend.length > 5 ? '\n  ...' : ''}`
    );
  if (tests.length)
    console.log(
      `Tests (${tests.length}): \n  ${tests.slice(0, 5).join('\n  ')}${tests.length > 5 ? '\n  ...' : ''}`
    );

  console.log(`\n--- 💡 Imports Analysis ---`);
  // Simple analysis of what these files import to find dependencies
  const dependencies = new Set();
  files.slice(0, 10).forEach((file) => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const importLines = content.match(/import .* from ['"](.*)['"]/g) || [];
      importLines.forEach((l) => dependencies.add(l));
    } catch (e) {
      // Loud but non-fatal: one unreadable file (e.g. transient permission
      // error) should not abort the whole bundle, but it must NOT be
      // silently dropped — surface it so a degraded analysis is visible.
      console.warn(`  ⚠️  Could not read ${file} for import analysis: ${e?.message ?? e}`);
    }
  });
  console.log(`Key Dependencies detected: ${dependencies.size} import statements found.`);

  console.log(
    `\n✅ PACKAGING COMPLETE. Agent: Use 'read_file' on the specific files listed above that match your task.`
  );
}

// Equoria-h3sij: main-module guard so importing this module (e.g. from the
// sentinel test that exercises classifyGrepError) does NOT run the CLI or
// call process.exit. This script is read-only, so the guard is for
// testability, not destructive-side-effect protection.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const featureKeyword = process.argv[2];

  if (!featureKeyword) {
    console.error('Usage: node context-packager.mjs <feature-keyword>');
    console.error('Example: node context-packager.mjs breeding');
    process.exit(1);
  }

  packageContext(featureKeyword);
}
