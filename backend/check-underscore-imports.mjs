#!/usr/bin/env node

/**
 * Check for underscore import/export mismatches in MJS files
 * Finds all imports with underscore prefixes and verifies they match actual exports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Regex patterns
const IMPORT_PATTERN = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
const EXPORT_PATTERN = /export\s+(const|function|let|class)\s+(\w+)/g;
const EXPORT_NAMED_PATTERN = /export\s+\{([^}]+)\}/g;

// Track results
const results = {
  filesChecked: 0,
  issuesFound: 0,
  issues: [],
  exportedFunctions: {}, // Map of file -> exported names
};

/**
 * Get all exported names from a file
 */
function getExportsFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const exports = new Set();

    // Find direct exports: export const name, export function name
    let match;
    while ((match = EXPORT_PATTERN.exec(content)) !== null) {
      exports.add(match[2]);
    }

    // Find named exports: export { name1, name2 }
    while ((match = EXPORT_NAMED_PATTERN.exec(content)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(' as ')[0]);
      names.forEach(n => {
        if (n) { exports.add(n); }
      });
    }

    return exports;
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return new Set();
  }
}

/**
 * Check imports in a file for underscore mismatches
 */
function checkImportsInFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = [];

    let match;
    while ((match = IMPORT_PATTERN.exec(content)) !== null) {
      const importedNames = match[1].split(',').map(n => n.trim());
      const fromPath = match[2];

      imports.push({
        file: filePath,
        names: importedNames,
        from: fromPath,
      });
    }

    return imports;
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`);
    return [];
  }
}

/**
 * Resolve import path to actual file
 */
function resolveImportPath(fromPath, relativeTo) {
  const dir = path.dirname(relativeTo);

  // Handle different path formats
  let resolvedPath = path.join(dir, fromPath);

  // Try with .mjs extension
  if (!fs.existsSync(resolvedPath) && !resolvedPath.endsWith('.mjs')) {
    const withMjs = `${resolvedPath}.mjs`;
    if (fs.existsSync(withMjs)) {
      resolvedPath = withMjs;
    }
  }

  // Try with .js extension
  if (!fs.existsSync(resolvedPath) && !resolvedPath.endsWith('.js')) {
    const withJs = `${resolvedPath}.js`;
    if (fs.existsSync(withJs)) {
      resolvedPath = withJs;
    }
  }

  return fs.existsSync(resolvedPath) ? resolvedPath : null;
}

/**
 * Main checking logic
 */
function main() {
  console.log('Checking for underscore import/export mismatches...\n');

  // Get all MJS files
  const backendDir = __dirname;
  const files = [];

  function walkDir(dir, excludeDirs = ['node_modules', '.git', 'coverage']) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(entry => {
        if (excludeDirs.includes(entry.name)) { return; }

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith('.mjs')) {
          files.push(fullPath);
        }
      });
    } catch (error) {
      // Ignore permission errors
    }
  }

  walkDir(backendDir);

  console.log(`Found ${files.length} .mjs files to check\n`);

  // First pass: collect all exports
  const exportMap = {};
  files.forEach(file => {
    const exports = getExportsFromFile(file);
    if (exports.size > 0) {
      exportMap[file] = exports;
      results.exportedFunctions[file] = Array.from(exports);
    }
  });

  // Second pass: check imports
  files.forEach(file => {
    results.filesChecked++;
    const imports = checkImportsInFile(file);

    imports.forEach(({ names, from, file: importingFile }) => {
      const resolvedPath = resolveImportPath(from, importingFile);

      if (!resolvedPath) {
        // Might be external module or invalid path
        return;
      }

      const exportedNames = exportMap[resolvedPath];
      if (!exportedNames) { return; }

      // Check each imported name
      names.forEach(name => {
        // Skip default imports and type imports
        if (name.includes(' as ') || name.includes('default') || name.startsWith('type ')) {
          return;
        }

        const importedName = name.trim();
        const hasUnderscore = importedName.startsWith('_');
        const nameWithoutUnderscore = hasUnderscore ? importedName.substring(1) : importedName;

        // Check if the export exists
        if (exportedNames.has(importedName)) {
          // Good: exact match
          return;
        }

        if (hasUnderscore && exportedNames.has(nameWithoutUnderscore)) {
          // Found issue: importing with underscore but export doesn't have it
          results.issuesFound++;
          results.issues.push({
            file: importingFile,
            lineContent: `import { ${importedName} } from '${from}'`,
            shouldBe: `import { ${nameWithoutUnderscore} } from '${from}'`,
            reason: `Export exists as '${nameWithoutUnderscore}' (without underscore)`,
          });
        } else if (!hasUnderscore && exportedNames.has(`_${importedName}`)) {
          // Found issue: importing without underscore but export has it
          results.issuesFound++;
          results.issues.push({
            file: importingFile,
            lineContent: `import { ${importedName} } from '${from}'`,
            shouldBe: `import { _${importedName} } from '${from}'`,
            reason: `Export exists as '_${importedName}' (with underscore)`,
          });
        }
      });
    });
  });

  // Print results
  console.log('\n=== RESULTS ===\n');
  console.log(`Files checked: ${results.filesChecked}`);
  console.log(`Issues found: ${results.issuesFound}\n`);

  if (results.issuesFound > 0) {
    console.log('UNDERSCORE IMPORT MISMATCHES:\n');
    results.issues.forEach((issue, index) => {
      console.log(`${index + 1}. File: ${path.relative(backendDir, issue.file)}`);
      console.log(`   Current:  ${issue.lineContent}`);
      console.log(`   Should be: ${issue.shouldBe}`);
      console.log(`   Reason: ${issue.reason}\n`);
    });
  } else {
    console.log('No underscore import/export mismatches found!');
  }

  // Print summary
  console.log('\n=== EXPORT SUMMARY ===\n');
  const filesWithExports = Object.keys(exportMap).length;
  console.log(`Files with exports: ${filesWithExports}`);

  return results.issuesFound > 0 ? 1 : 0;
}

process.exit(main());
