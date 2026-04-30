#!/usr/bin/env node
/**
 * Equoria-0ejw (B7): parse a Blind Hunter review comment for the
 * verdict line and the P0/P1 finding count.
 *
 * Reads the comment body from a file path (CLI arg) or stdin, looks
 * for the literal `BLIND_HUNTER_VERDICT: pass` or
 * `BLIND_HUNTER_VERDICT: fail` line, counts the P0/P1 severity tags in
 * the body, and prints a single verdict word + count to stdout.
 *
 * Output (one line, machine-readable for the workflow's label step):
 *   pass  0
 *   fail  3
 *   error <reason>
 *
 * Exit codes:
 *   0  pass — zero P0/P1 findings AND verdict line says pass
 *   1  fail — one or more P0/P1 findings OR verdict line says fail
 *   2  malformed comment (no verdict line, or verdict says pass but
 *      P0/P1 findings present, or vice versa)
 *
 * The exit code is the source of truth for "should the label be
 * applied"; the stdout is for human-readable workflow logs.
 */

import { readFileSync } from 'node:fs';
import { argv, exit, stdin } from 'node:process';

function readBody() {
  const args = argv.slice(2);
  if (args[0] === '--stdin' || args.length === 0) {
    return new Promise((resolve) => {
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (chunk) => {
        buf += chunk;
      });
      stdin.on('end', () => resolve(buf));
    });
  }
  try {
    return Promise.resolve(readFileSync(args[0], 'utf8'));
  } catch (e) {
    console.error(`error read-failed (${e.message})`);
    exit(2);
  }
}

function countSeverity(body, tag) {
  // Match the tag as a standalone token, optionally inside parens or
  // backticks: ` P0 `, `(P0)`, `**P0**`, etc. Avoid matching it as a
  // substring of something else (e.g., `P0RT`).
  //
  // Lines containing the verdict line are excluded from the count —
  // the verdict text often summarises counts like "fail (2 P0/P1
  // findings)" which would otherwise double-count itself.
  const re = new RegExp(`(?<![A-Z0-9])${tag}(?![A-Z0-9])`, 'g');
  const filtered = body
    .split(/\r?\n/)
    .filter((line) => !/BLIND_HUNTER_VERDICT/i.test(line))
    .join('\n');
  return (filtered.match(re) || []).length;
}

function findVerdict(body) {
  const m = body.match(/^[\s>*-]*BLIND_HUNTER_VERDICT:\s*(pass|fail)/im);
  return m ? m[1].toLowerCase() : null;
}

async function main() {
  const body = await readBody();
  if (!body || !body.trim()) {
    console.log('error empty-comment');
    exit(2);
  }

  const verdict = findVerdict(body);
  const p0 = countSeverity(body, 'P0');
  const p1 = countSeverity(body, 'P1');
  const blocking = p0 + p1;

  if (!verdict) {
    console.log(`error no-verdict-line (P0+P1=${blocking})`);
    exit(2);
  }

  // Verdict says pass but P0/P1 present — contradiction; treat as
  // malformed so the gate falls through to manual review rather than
  // silently passing a bad change.
  if (verdict === 'pass' && blocking > 0) {
    console.log(`error verdict-pass-but-${blocking}-blocking-findings`);
    exit(2);
  }

  // Verdict says fail but no P0/P1 — same contradiction in the other
  // direction. Hold the line: any "fail" verdict blocks regardless.
  if (verdict === 'fail') {
    console.log(`fail ${blocking}`);
    exit(1);
  }

  console.log('pass 0');
  exit(0);
}

main();
