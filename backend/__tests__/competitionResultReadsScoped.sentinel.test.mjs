/**
 * competitionResultReadsScoped.sentinel.test.mjs (Equoria-4q02c, owner ruling q01)
 *
 * CompetitionResult.scoreInputs holds the luck roll and score inputs, which
 * only the Owner and Admins may see. Every read of a result row in backend
 * source must therefore name its columns (a top-level `select`) or `omit`
 * scoreInputs, so no new column ever leaks through a whole-row read, a player
 * response or the GDPR export. A top-level `include` alone returns every
 * scalar column, so it is not enough.
 *
 * The scan is structural: it finds each prisma.competitionResult.find* call
 * and reads the keys at the top level of its argument object.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skipDirs = new Set(['node_modules', '__tests__', 'tests', 'coverage']);
const readCall = /\.competitionResult\.(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow)\(\s*\{/g;

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return skipDirs.has(entry.name) ? [] : sourceFiles(full);
    }
    return entry.name.endsWith('.mjs') ? [full] : [];
  });
}

/** The top-level key names of the object literal whose `{` is at `open`. */
function topLevelKeys(text, open) {
  const keys = [];
  let depth = 0;
  let i = open;
  let key = '';
  for (; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{' || ch === '[' || ch === '(') {
      depth += 1;
    } else if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    } else if (depth === 1) {
      if (/[A-Za-z0-9_$]/.test(ch)) {
        key += ch;
      } else {
        if (ch === ':' && key) {
          keys.push(key);
        }
        if (ch === ',' || ch === ':' || ch === '\n') {
          key = '';
        }
      }
    }
  }
  return keys;
}

describe('every CompetitionResult read names its columns or omits scoreInputs', () => {
  it('the scanner sees a whole-row read as unscoped', () => {
    const text = 'x.competitionResult.findMany({ where: { a: 1 }, include: { horse: { select: { id: true } } } })';
    const keys = topLevelKeys(text, text.indexOf('{'));
    expect(keys).toEqual(['where', 'include']);
    expect(keys.includes('select') || keys.includes('omit')).toBe(false);
  });

  it('holds for all backend source', () => {
    const offenders = [];
    let reads = 0;
    for (const file of sourceFiles(backendRoot)) {
      // Comments blanked (same length, so line numbers hold): a word in a comment is no key.
      const text = fs.readFileSync(file, 'utf8').replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length));
      for (const match of text.matchAll(readCall)) {
        reads += 1;
        const keys = topLevelKeys(text, match.index + match[0].length - 1);
        if (!keys.includes('select') && !keys.includes('omit')) {
          const line = text.slice(0, match.index).split('\n').length;
          offenders.push(`${path.relative(backendRoot, file)}:${line}`);
        }
      }
    }
    expect(reads).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });
});
