/**
 * relocate-orphan-services-tests.mjs (Equoria-orbud)
 *
 * One-off migration helper: moves orphan platform/middleware/security test
 * files OUT of backend/modules/services/__tests__/ INTO backend/__tests__/
 * and re-levels their relative imports.
 *
 * Depth change: backend/modules/services/__tests__/  ->  backend/__tests__/
 * is 2 directory levels shallower, so backend-root-or-above relative imports
 * lose two `../` segments:
 *   '../../../../X'  (project root)  -> '../../X'
 *   '../../../X'     (backend root)  -> '../X'
 *   '../../<module>' (sibling module) -> '../modules/<module>'  (rare; flagged)
 *
 * Same-dir (`./`) helper imports do NOT exist in this corpus (verified), so
 * only the `../`-prefixed forms are rewritten.
 *
 * Usage:
 *   node backend/scripts/relocate-orphan-services-tests.mjs <file1> <file2> ...
 *   node backend/scripts/relocate-orphan-services-tests.mjs --dry-run <files>
 *
 * The script ONLY rewrites import/from path strings; it does not touch test
 * logic. It uses `git mv` so history is preserved. It also re-keys any matching
 * entries in scripts/doctrine-checks/silent-cleanup-catch-baseline.json.
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..', '..');

const SRC_DIR = 'backend/modules/services/__tests__';
const DST_DIR = 'backend/__tests__';
const BASELINE = 'scripts/doctrine-checks/silent-cleanup-catch-baseline.json';

/**
 * Rewrite a single relative-import path string by stripping two `../` levels
 * for backend-root-or-above targets. Returns the rewritten path, plus a flag
 * if the import points sideways into another module (needs manual review).
 */
function relevelImport(rel) {
  // Project-root targets: ../../../../X -> ../../X
  if (rel.startsWith('../../../../')) {
    return { next: '../../' + rel.slice('../../../../'.length), sideways: false };
  }
  // backend-root targets: ../../../X -> ../X
  if (rel.startsWith('../../../')) {
    return { next: '../' + rel.slice('../../../'.length), sideways: false };
  }
  // Sibling-module targets: ../../<module>/... -> ../modules/<module>/...
  if (rel.startsWith('../../')) {
    return { next: '../modules/' + rel.slice('../../'.length), sideways: true };
  }
  // Anything shallower (./ or ../) we leave untouched and flag.
  return { next: rel, sideways: false, untouched: true };
}

function rewriteContent(content, fileName) {
  const importRe = /(from\s+['"])(\.\.\/[^'"]+)(['"])/g;
  const notes = [];
  const out = content.replace(importRe, (m, pre, rel, post) => {
    const { next, sideways, untouched } = relevelImport(rel);
    if (sideways) notes.push(`  ⚠ ${fileName}: sideways module import ${rel} -> ${next} (review)`);
    if (untouched && rel !== next) notes.push(`  ⚠ ${fileName}: unhandled prefix ${rel}`);
    return pre + next + post;
  });
  return { out, notes };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const files = args.filter(a => a !== '--dry-run');
  if (files.length === 0) {
    console.error('No files supplied. Usage: node ... <file basenames or paths>');
    process.exit(1);
  }

  const allNotes = [];
  const movedKeys = [];

  for (const f of files) {
    const base = path.basename(f);
    const srcPath = path.join(repoRoot, SRC_DIR, base);
    const dstPath = path.join(repoRoot, DST_DIR, base);
    if (!existsSync(srcPath)) {
      console.error(`✗ missing: ${SRC_DIR}/${base}`);
      process.exit(1);
    }
    if (existsSync(dstPath)) {
      console.error(`✗ collision: ${DST_DIR}/${base} already exists`);
      process.exit(1);
    }

    const original = readFileSync(srcPath, 'utf8');
    const { out, notes } = rewriteContent(original, base);
    allNotes.push(...notes);

    if (dryRun) {
      console.log(
        `DRY: would git mv ${SRC_DIR}/${base} -> ${DST_DIR}/${base} (${out !== original ? 'imports rewritten' : 'no import change'})`,
      );
    } else {
      execSync(`git mv "${SRC_DIR}/${base}" "${DST_DIR}/${base}"`, {
        cwd: repoRoot,
        stdio: 'pipe',
      });
      writeFileSync(dstPath, out, 'utf8');
      console.log(`✓ moved + rewrote ${base}`);
    }
    movedKeys.push(base);
  }

  // Re-key the doctrine baseline for any moved files.
  const baselinePath = path.join(repoRoot, BASELINE);
  if (existsSync(baselinePath)) {
    const json = JSON.parse(readFileSync(baselinePath, 'utf8'));
    let changed = false;
    for (const base of movedKeys) {
      const oldKey = `${SRC_DIR}/${base}`;
      const newKey = `${DST_DIR}/${base}`;
      if (Object.prototype.hasOwnProperty.call(json, oldKey)) {
        json[newKey] = json[oldKey];
        delete json[oldKey];
        changed = true;
        console.log(`  re-keyed baseline: ${oldKey} -> ${newKey} (${json[newKey]})`);
      }
    }
    if (changed && !dryRun) {
      writeFileSync(baselinePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    } else if (changed && dryRun) {
      console.log('  DRY: baseline would be re-keyed (not written)');
    }
  }

  if (allNotes.length) {
    console.log('\nNOTES (manual review):');
    for (const n of allNotes) console.log(n);
  }
}

// Equoria-5z0if: main-module guard — this script mutates the working tree
// (git mv + file writes), must NOT run on bare import. Use pathToFileURL so the
// comparison is correct on Windows (drive-letter paths need file:///C:/...).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { relevelImport, rewriteContent };
