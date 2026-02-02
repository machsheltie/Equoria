import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

function getAllTestFiles(dir, files = []) {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && entry !== 'node_modules' && entry !== '.git') {
      getAllTestFiles(fullPath, files);
    } else if (entry.endsWith('.test.mjs') || entry.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function fixFile(filePath) {
  const content = readFileSync(filePath, 'utf8');

  if (!content.includes('jest.unstable_mockModule')) {
    return false;
  }

  // Replace jest.unstable_mockModule pattern with jest.mock
  // Pattern: jest.unstable_mockModule(path, () => ({ ... }));
  // Replace with: jest.mock(path, () => ({ ... }), { virtual: true });
  const newContent = content.replace(
    /jest\.unstable_mockModule\(([\s\S]*?)\}\)\);/g,
    (match, capturedContent) => {
      return `jest.mock(${capturedContent}), { virtual: true });`;
    },
  );

  writeFileSync(filePath, newContent, 'utf8');
  return true;
}

const baseDir = process.cwd();
const testFiles = getAllTestFiles(baseDir);
let fixedCount = 0;

console.log(`Found ${testFiles.length} test files`);

for (const file of testFiles) {
  if (fixFile(file)) {
    console.log(`✓ Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);
