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

  // Only fix files that have the problematic pattern: jest.mock() followed by const { } = () => moduleExports
  if (!content.includes('jest.mock(') || !content.match(/const\s+\{[^}]+\}\s+=\s+\(\)\s+=>\s+moduleExports/)) {
    return false;
  }

  // Pattern to match:
  // jest.mock(path, factory, options);
  // let moduleExports;
  // beforeAll(async () => {
  //   moduleExports = await import('...');
  // });
  // const { ... } = () => moduleExports;
  //
  // Replace with:
  // jest.mock(path, factory, options);
  // let moduleExports;
  // let requireOwnership, findOwnedResource, validateBatchOwnership;
  // beforeAll(async () => {
  //   moduleExports = await import('...');
  //   ({ requireOwnership, findOwnedResource, validateBatchOwnership } = moduleExports);
  // });

  const newContent = content.replace(
    /(jest\.mock\([^;]+;)\s*\n\s*let\s+moduleExports;\s*\n\s*beforeAll\(async\s+\(\)\s+=>\s+\{\s*\n\s*moduleExports\s+=\s+await\s+import\(([^)]+)\);\s*\n\s*\}\);\s*\n\s*const\s+(\{[^}]+\})\s+=\s+\(\)\s+=>\s+moduleExports;/,
    (match, jestMock, importPath, destructure) => {
      // Extract the individual variable names from the destructure pattern
      const varNames = destructure
        .replace(/[{}]/g, '')
        .split(',')
        .map(v => v.trim())
        .join(', ');

      return `${jestMock}

let moduleExports;
let ${varNames};

beforeAll(async () => {
  moduleExports = await import(${importPath});
  (${destructure} = moduleExports);
});`;
    },
  );

  if (newContent !== content) {
    writeFileSync(filePath, newContent, 'utf8');
    return true;
  }

  return false;
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
