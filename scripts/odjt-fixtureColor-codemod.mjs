/**
 * odjt-fixtureColor-codemod.mjs (Equoria-odjt)
 *
 * Bulk-migrates legacy backend test suites that create fixture horses via raw
 * `prisma.horse.create({ data: { ... } })` (no color fields) to spread
 * `...fixtureColor()` as the first property of the horse `data` object, so the
 * row is never born NULL-phenotype (NULL-phenotype fixture defect class,
 * Equoria-dm1i / lfj5 / g9sa).
 *
 * Brace-matched, not regex-line-based: for each `prisma.horse.create(` call it
 * finds the call argument object, locates its top-level `data:` value object,
 * and inserts `...fixtureColor(),` as the first element — ONLY if that data
 * object has no spread element yet. Other `*.create()` calls (user, breed,
 * etc.) are untouched because the scan anchors on the literal
 * `.horse.create(`.
 *
 * Invoked with an explicit list of files (one batch at a time). Adds the
 * import if missing, with a correct relative path to
 * backend/tests/helpers/fixtureColor.mjs.
 *
 * Usage: node scripts/odjt-fixtureColor-codemod.mjs <file> [<file> ...]
 */
import fs from 'node:fs';
import path from 'node:path';

const HELPER_ABS = path.resolve('backend/tests/helpers/fixtureColor.mjs');

/** Find index of the matching close brace for an open brace at openIdx. */
function matchBrace(src, openIdx) {
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    const prev = src[i - 1];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Given source and the index just after `prisma.horse.create(`, return the
 * insertion offset (right after the `data: {` of the call's first object arg)
 * and the indentation to use, or null if not applicable / already spread.
 */
function planInsertion(src, afterParenIdx) {
  // Skip whitespace to the call argument's opening brace.
  let i = afterParenIdx;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '{') return null; // not an object-literal arg
  const argOpen = i;
  const argClose = matchBrace(src, argOpen);
  if (argClose < 0) return null;

  // Locate the top-level `data:` key within the arg object.
  const argBody = src.slice(argOpen + 1, argClose);
  const dataKeyRel = argBody.search(/(^|[\s,{])data\s*:/);
  if (dataKeyRel < 0) return null;
  // Absolute index of the `data` keyword's colon region.
  const dataColon = src.indexOf(':', argOpen + 1 + dataKeyRel);
  if (dataColon < 0 || dataColon > argClose) return null;
  // Find the `{` that opens the data value object.
  let j = dataColon + 1;
  while (j < src.length && /\s/.test(src[j])) j++;
  if (src[j] !== '{') return null; // e.g. data: someVar — skip
  const dataOpen = j;
  const dataClose = matchBrace(src, dataOpen);
  if (dataClose < 0) return null;

  const dataInner = src.slice(dataOpen + 1, dataClose);
  if (dataInner.includes('...')) return null; // already has a spread

  // Determine indentation: look at the first non-space char after `{`.
  let k = dataOpen + 1;
  while (k < src.length && (src[k] === '\n' || src[k] === '\r')) k++;
  let indent = '';
  let p = k;
  while (p < src.length && (src[p] === ' ' || src[p] === '\t')) {
    indent += src[p];
    p++;
  }
  if (!indent) indent = '  ';

  return {
    at: dataOpen + 1,
    text: `\n${indent}...fixtureColor(),`,
    dataInnerEmpty: dataInner.trim() === '',
  };
}

function migrateFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;

  // Collect all insertion plans first (right-to-left apply to keep offsets).
  const plans = [];
  const needle = '.horse.create(';
  let searchFrom = 0;
  let hit = src.indexOf(needle, searchFrom);
  while (hit >= 0) {
    searchFrom = hit + needle.length;
    // Guard: must be `prisma`/something`.horse.create(` not e.g. `.notHorse`.
    const plan = planInsertion(src, hit + needle.length);
    if (plan) plans.push(plan);
    hit = src.indexOf(needle, searchFrom);
  }
  if (plans.length === 0) return { file, changed: false, count: 0 };

  plans.sort((a, b) => b.at - a.at);
  for (const pl of plans) {
    src = src.slice(0, pl.at) + pl.text + src.slice(pl.at);
  }

  // Ensure the import exists.
  if (!/from\s+['"][^'"]*fixtureColor\.mjs['"]/.test(src)) {
    let rel = path.relative(path.dirname(path.resolve(file)), HELPER_ABS).replace(/\\/g, '/');
    if (!rel.startsWith('.')) rel = './' + rel;
    const importLine =
      `// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture\n` +
      `// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.\n` +
      `import { fixtureColor } from '${rel}';\n`;
    // Insert after the last top-level import statement. Imports may span
    // multiple lines (`import {\n  a,\n  b,\n} from 'x';`), so we scan for
    // each `import` at column 0 and walk to its terminating `;` (skipping
    // semicolons that appear inside the import's brace/paren/string spans).
    let lastImportEnd = 0;
    const importStartRe = /^import\b/gm;
    let m;
    while ((m = importStartRe.exec(src)) !== null) {
      let p = m.index;
      let inStr = null;
      let depth = 0;
      for (; p < src.length; p++) {
        const c = src[p];
        const prev = src[p - 1];
        if (inStr) {
          if (c === inStr && prev !== '\\') inStr = null;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') {
          inStr = c;
          continue;
        }
        if (c === '{' || c === '(' || c === '[') depth++;
        else if (c === '}' || c === ')' || c === ']') depth--;
        else if (c === ';' && depth === 0) {
          p++;
          break;
        }
      }
      if (p > lastImportEnd) lastImportEnd = p;
      importStartRe.lastIndex = p;
    }
    if (lastImportEnd > 0) {
      src = src.slice(0, lastImportEnd) + '\n' + importLine + src.slice(lastImportEnd);
    } else {
      src = importLine + src;
    }
  }

  if (src === original) return { file, changed: false, count: 0 };
  fs.writeFileSync(file, src, 'utf8');
  return { file, changed: true, count: plans.length };
}

const files = process.argv.slice(2);
let totalFiles = 0;
let totalSites = 0;
for (const f of files) {
  const r = migrateFile(f);
  if (r.changed) {
    totalFiles++;
    totalSites += r.count;
    console.log(`MIGRATED ${r.count} site(s): ${r.file}`);
  } else {
    console.log(`SKIP (no eligible raw horse.create): ${r.file}`);
  }
}
console.log(`\nTOTAL: ${totalFiles} files, ${totalSites} insertion sites`);
