/**
 * Sentinel: player-facing text uses US spelling (Equoria-at90e).
 *
 * Owner ruling 2026-10-28 (q190): "It should be Color. Not Colour. I am not in
 * Europe." Every string and JSX text in frontend/src is read through the
 * TypeScript parser (so comments are not text) and checked for British
 * spellings: colour, grey, honour, centre, immortalise, optimise and the like.
 *
 * pages/horse-detail/ was left out until its Color sweep landed (agent/horsepage,
 * ColorGeneticsSection); it is checked like everything else now.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const srcRoot = path.resolve(__dirname, '..', '..');

const british = new RegExp(
  [
    'colour',
    '\\bgrey',
    'honour',
    'favour',
    'behaviour',
    '\\bcentre',
    'catalogue',
    '\\bmould',
    '\\banalys(e|ed|es|ing)\\b',
    '(optim|maxim|minim|special|recogn|real|organ|personal|custom|priorit|harmon|apolog|author|categor|memor|visual|util|summar|character|immortal|normal|final|stabil|familiar)is(e|ed|er|es|ing|ation|ations)\\b',
  ].join('|'),
  'i'
);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'test') continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function textsIn(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const texts: string[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      texts.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return texts;
}

describe('US spelling in player-facing text (Equoria-at90e)', () => {
  it('no string or JSX text in frontend/src uses a British spelling', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(srcRoot)) {
      for (const text of textsIn(file)) {
        if (british.test(text)) {
          offenders.push(`${path.relative(srcRoot, file)}: ${text.trim().slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the pattern catches the spellings it guards against', () => {
    for (const word of [
      'Colour',
      'grey',
      'Visitors Centre',
      'immortalised',
      'Optimises',
      'Minimise',
    ]) {
      expect(british.test(word), word).toBe(true);
    }
    for (const word of [
      'Color',
      'gray',
      'Visitors Center',
      'Falabella',
      'aria-labelledby',
      'specialist',
    ]) {
      expect(british.test(word), word).toBe(false);
    }
  });
});
