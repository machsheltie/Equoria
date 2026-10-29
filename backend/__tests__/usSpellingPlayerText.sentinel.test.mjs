/**
 * Sentinel: backend text uses US spelling (Equoria-at90e).
 *
 * Owner ruling 2026-10-28 (q190): "It should be Color. Not Colour. I am not in
 * Europe." Player messages, shop and staff descriptions and refund lines all
 * start life as backend strings, so every string literal in the backend source
 * (read through the TypeScript parser, so comments are not text) is checked for
 * British spellings: colour, honour, centre, specialised, optimises and
 * the like. Owner ruling q311 (2026-10-29, Equoria-7woyj): coat colors are
 * spelled grey everywhere (Dapple Grey...), so grey is no longer checked.
 * Stored column names and externally owned names are not strings here and
 * are untouched.
 */
import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skippedDirs = new Set(['node_modules', '__tests__', 'tests', 'docs', 'coverage', 'test-results']);

const british = new RegExp(
  [
    'colour',
    'honour',
    'favour',
    'behaviour',
    '\\bcentre',
    'catalogue',
    '\\bmould',
    '\\banalys(e|ed|es|ing)\\b',
    '(optim|maxim|minim|special|recogn|real|organ|personal|custom|priorit|harmon|apolog|author|categor|memor|visual|util|summar|character|immortal|normal|final|stabil|familiar)is(e|ed|er|es|ing|ation|ations)\\b',
  ].join('|'),
  'i',
);

function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name)) {
        out.push(...sourceFiles(full));
      }
    } else if (entry.name.endsWith('.mjs') && !entry.name.includes('.test.')) {
      out.push(full);
    }
  }
  return out;
}

function stringsIn(file) {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const texts = [];
  const visit = node => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      texts.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return texts;
}

describe('US spelling in backend text (Equoria-at90e)', () => {
  it('no string literal in the backend source uses a British spelling', () => {
    const offenders = [];
    for (const file of sourceFiles(backendRoot)) {
      for (const text of stringsIn(file)) {
        if (british.test(text)) {
          offenders.push(`${path.relative(backendRoot, file)}: ${text.slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the pattern catches the spellings it guards against', () => {
    for (const word of ['Colour genetics', 'specialised blend', 'moulds', 'Harmoniser', 'honour']) {
      expect(british.test(word)).toBe(true);
    }
    for (const word of ['Color genetics', 'specialized blend', 'molds', 'Harmonizer', 'specialist']) {
      expect(british.test(word)).toBe(false);
    }
  });
});
