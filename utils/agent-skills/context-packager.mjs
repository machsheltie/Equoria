import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const featureKeyword = process.argv[2];

if (!featureKeyword) {
  console.error('Usage: node context-packager.mjs <feature-keyword>');
  console.error('Example: node context-packager.mjs breeding');
  process.exit(1);
}

console.log(`\n📦 CONTEXT PACKAGER: Assembling context for "${featureKeyword}"...`);
console.log('==================================================');

try {
  // 1. Find relevant files
  const cmd = `grep -r -l "${featureKeyword}" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=coverage --exclude-dir=logs --exclude=*.log --exclude=*.json --exclude=*.lock`;
  const output = execSync(cmd, { encoding: 'utf8' });
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
    } catch (e) {}
  });
  console.log(`Key Dependencies detected: ${dependencies.size} import statements found.`);

  console.log(
    `\n✅ PACKAGING COMPLETE. Agent: Use 'read_file' on the specific files listed above that match your task.`
  );
} catch (e) {
  console.log('Error searching for files. Ensure grep is available.');
}
