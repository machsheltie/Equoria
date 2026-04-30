#!/usr/bin/env node
/**
 * Equoria-qj75 (B3): PR body evidence parser.
 *
 * Reads a PR body from a file path (CLI arg) or stdin, verifies the
 * "Doctrine evidence" sections from `.github/pull_request_template.md`
 * are filled in, and exits non-zero if anything is missing.
 *
 * Why this exists: the template forces evidence to be pasted into the
 * PR. This parser ensures the template's checkboxes were actually
 * ticked and the evidence blocks are non-empty — otherwise the template
 * is reduced to wallpaper that authors paste in once and never fill
 * out, defeating the entire purpose.
 *
 * Checks (each must pass):
 *
 *   1. Section "Doctrine-gate result" present.
 *   2. "Exit code:" line is followed by a non-placeholder value
 *      (anything other than the literal `_<paste exit code here>_`
 *      template substitution marker, or empty).
 *   3. "Last 5 lines of output:" code block (```...```) is non-empty
 *      and not the placeholder `<paste here>`.
 *   4. Section "No new bypass mechanisms" present with all 4 checkboxes
 *      ticked (`- [x]`, case-insensitive).
 *   5. Section "Gate enforcement" either:
 *        a. has all four sub-fields (Workflow file, Job name, line,
 *           branch-protection checkbox) filled with non-placeholder
 *           values, OR
 *        b. is replaced with the literal string `N/A` (case-insensitive,
 *           anywhere in the section body).
 *   6. Section "Middleware test coverage" same N/A-or-fully-filled rule.
 *
 * Usage:
 *   node scripts/check-pr-body-evidence.mjs <pr-body-file>
 *   echo "$PR_BODY" | node scripts/check-pr-body-evidence.mjs --stdin
 *
 * Exit codes:
 *   0  all evidence present
 *   1  one or more required evidence elements missing
 *   2  could not read PR body input
 */

import { readFileSync } from 'node:fs';
import { argv, exit, stdin } from 'node:process';

function readBody() {
  const args = argv.slice(2);
  if (args[0] === '--stdin' || args.length === 0) {
    let buf = '';
    return new Promise((resolve) => {
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
    console.error(`FAIL: could not read PR body file ${args[0]}: ${e.message}`);
    exit(2);
  }
}

/**
 * Slice the body into named sections by H3 heading. Returns a Map of
 * normalised heading text → section body (everything between this
 * heading and the next H2/H3 or end of input).
 */
function sliceSections(body) {
  const lines = body.split(/\r?\n/);
  const sections = new Map();
  let currentKey = null;
  let currentLines = [];
  for (const line of lines) {
    const h3 = line.match(/^###\s+(.+?)\s*$/);
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h3 || h2) {
      if (currentKey) sections.set(currentKey, currentLines.join('\n'));
      currentKey = (h3 || h2)[1]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      currentLines = [];
      continue;
    }
    if (currentKey) currentLines.push(line);
  }
  if (currentKey) sections.set(currentKey, currentLines.join('\n'));
  return sections;
}

function isNa(text) {
  return /\bn\s*\/?\s*a\b/i.test(text);
}

function isPlaceholder(text) {
  // Common placeholder patterns from the template.
  if (!text || !text.trim()) return true;
  const t = text.trim();
  if (/^_<paste/i.test(t)) return true;
  if (/^<paste/i.test(t)) return true;
  if (t === '_<paste exit code here>_') return true;
  return false;
}

function findFailures(body) {
  const failures = [];
  if (!body || !body.trim()) {
    failures.push('PR body is empty.');
    return failures;
  }

  const sections = sliceSections(body);

  // 1. Doctrine-gate result section
  const gateSection = [...sections.entries()].find(([k]) => k.includes('doctrine gate result'));
  if (!gateSection) {
    failures.push('Missing section: "### 1. Doctrine-gate result".');
  } else {
    const text = gateSection[1];
    // Exit code line
    const exitMatch = text.match(/exit code\s*:\s*\**\s*([^\n]*)/i);
    if (!exitMatch || isPlaceholder(exitMatch[1])) {
      failures.push(
        'Doctrine-gate "Exit code:" is missing or still has the placeholder _<paste exit code here>_.'
      );
    }
    // Code block content. Match ```\n...\n``` and check the inside.
    const codeMatch = text.match(/```[^\n]*\n([\s\S]*?)```/);
    if (!codeMatch) {
      failures.push('Doctrine-gate output code block (```...```) is missing.');
    } else {
      const inside = codeMatch[1].trim();
      if (!inside || isPlaceholder(inside)) {
        failures.push(
          'Doctrine-gate output code block is empty or still has the placeholder <paste here>.'
        );
      }
    }
  }

  // 2. No new bypass mechanisms — all 4 boxes ticked
  const bypassSection = [...sections.entries()].find(([k]) =>
    k.includes('no new bypass mechanisms')
  );
  if (!bypassSection) {
    failures.push('Missing section: "### 2. No new bypass mechanisms".');
  } else {
    const text = bypassSection[1];
    const checked = (text.match(/^[ \t]*-\s*\[x\]/gim) || []).length;
    const unchecked = (text.match(/^[ \t]*-\s*\[\s*\]/gim) || []).length;
    if (checked + unchecked < 4) {
      failures.push(
        `Bypass-mechanisms section has ${checked + unchecked} checkbox(es); expected at least 4.`
      );
    }
    if (unchecked > 0) {
      failures.push(
        `Bypass-mechanisms section has ${unchecked} unticked checkbox(es). Tick every box (add an N/A note inline if a check does not apply).`
      );
    }
  }

  // 3. Gate enforcement — N/A or fully filled
  const gateEnfSection = [...sections.entries()].find(([k]) => k.includes('gate enforcement'));
  if (!gateEnfSection) {
    failures.push('Missing section: "### 3. Gate enforcement".');
  } else {
    const text = gateEnfSection[1];
    if (!isNa(text)) {
      // Must have all 4 sub-fields filled. Note the `[ \t]*` (not `\s*`)
      // after the colon — `\s` matches newlines and would let the
      // greedy capture pull in the NEXT line's content as if it were
      // the field value. Restricting to space/tab keeps the value
      // confined to the same line as the field label.
      const wfMatch = text.match(/workflow file[ \t]*:[ \t]*([^\n]*)/i);
      const jobMatch = text.match(/job name[ \t]*:[ \t]*([^\n]*)/i);
      const lineMatch = text.match(/deployment-gate needs-list line number[ \t]*:[ \t]*([^\n]*)/i);
      // Branch-protection field's label contains a single colon ("for
      // master:") — `[^:\n]*` walks any non-colon prefix, then the
      // first colon is the value separator.
      const bpMatch = text.match(/branch[- ]protection[^:\n]*:[ \t]*([^\n]*)/i);
      const fields = [
        ['Workflow file', wfMatch?.[1]],
        ['Job name', jobMatch?.[1]],
        ['Deployment-gate needs-list line number', lineMatch?.[1]],
        ['Branch-protection rule', bpMatch?.[1]],
      ];
      for (const [label, val] of fields) {
        const trimmed = (val || '').trim();
        // Empty value, lone underscore, or unticked checkbox `[ ]`
        // (the template ships the branch-protection field as `[ ]`
        // pre-filled and the author is supposed to flip it to `[x]`).
        if (!trimmed || /^_$/.test(trimmed) || /^`?\[\s*\]`?$/.test(trimmed)) {
          failures.push(
            `Gate-enforcement field "${label}" is empty or unticked. Either fill it in or replace the whole section with "N/A — <reason>".`
          );
        }
      }
    }
  }

  // 4. Middleware test coverage — N/A or fully filled
  const middlewareSection = [...sections.entries()].find(([k]) =>
    k.includes('middleware test coverage')
  );
  if (!middlewareSection) {
    failures.push('Missing section: "### 4. Middleware test coverage".');
  } else {
    const text = middlewareSection[1];
    if (!isNa(text)) {
      // Same `[ \t]*` not `\s*` rule as gate-enforcement above.
      const newMwMatch = text.match(/new middleware file[ \t]*:[ \t]*([^\n]*)/i);
      const testMatch = text.match(/test file[ \t]*:[ \t]*([^\n]*)/i);
      const fields = [
        ['New middleware file', newMwMatch?.[1]],
        ['Test file', testMatch?.[1]],
      ];
      for (const [label, val] of fields) {
        if (!val || !val.trim()) {
          failures.push(
            `Middleware-coverage field "${label}" is empty. Either fill it in or replace the whole section with "N/A — <reason>".`
          );
        }
      }
    }
  }

  return failures;
}

async function main() {
  const body = await readBody();
  const failures = findFailures(body);
  if (failures.length === 0) {
    console.log('OK: PR body evidence checks passed.');
    exit(0);
  }
  console.error(`FAIL: PR body evidence has ${failures.length} issue(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    '\nFix the PR description per the template at .github/pull_request_template.md and re-run.'
  );
  exit(1);
}

main();
