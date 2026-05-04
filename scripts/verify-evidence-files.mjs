#!/usr/bin/env node
/**
 * Equoria-ptf7 (B4): re-runnable verification for completed stories.
 *
 * Walks `_bmad-output/test-artifacts/evidence/`, parses every `*.md`
 * file as an evidence document, runs each file's verification command,
 * and asserts that every "Expected output markers" substring appears
 * in the actual stdout+stderr.
 *
 * The format is documented in `_bmad-output/test-artifacts/evidence/README.md`.
 *
 * Exit codes:
 *   0  all evidence files verified (or skipped per directive)
 *   1  one or more files' actual output is missing required markers
 *   2  one or more files are malformed
 *   3  one or more files timed out
 *   4  could not read evidence directory
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { argv, exit, cwd } from 'node:process';

const EVIDENCE_DIR_DEFAULT = '_bmad-output/test-artifacts/evidence';
const DEFAULT_TIMEOUT_SECONDS = 60;

function readArgs() {
  const args = argv.slice(2);
  const dir = args[0] || EVIDENCE_DIR_DEFAULT;
  return { dir };
}

function listEvidenceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (e) {
    console.error(`FAIL: could not read evidence dir ${dir}: ${e.message}`);
    exit(4);
  }
  const files = [];
  for (const name of entries) {
    if (!name.endsWith('.md') || name === 'README.md') continue;
    const full = join(dir, name);
    if (statSync(full).isFile()) files.push(full);
  }
  return files.sort();
}

/**
 * Slice a markdown evidence file into its named H2 sections. Returns
 * a Map of normalised heading text → section body.
 */
function sliceSections(body) {
  const sections = new Map();
  const lines = body.split(/\r?\n/);
  let key = null;
  let buf = [];
  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      if (key) sections.set(key, buf.join('\n'));
      key = m[1]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
      buf = [];
      continue;
    }
    if (key) buf.push(line);
  }
  if (key) sections.set(key, buf.join('\n'));
  return sections;
}

function extractCommand(text) {
  // Find exactly one ```bash ... ``` block. Multiple blocks → malformed.
  const matches = [...text.matchAll(/```bash\s*\n([\s\S]*?)```/g)];
  if (matches.length !== 1)
    return { error: `expected exactly one fenced bash block, found ${matches.length}` };
  return { command: matches[0][1].trim() };
}

function extractMarkers(text) {
  // Pull bullet lines from the section. Each marker is the text of
  // one `- ...` line, with the `- ` prefix stripped. Surrounding
  // backticks (the standard markdown idiom for inline code) are also
  // stripped so authors can write `- \`SOME-MARKER\`` and have the
  // matcher compare against `SOME-MARKER` (without backticks) in the
  // command's stdout.
  const markers = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(/^\s*[-*]\s+(.+?)\s*$/);
    if (!m) continue;
    let value = m[1].trim();
    // Strip a single pair of surrounding backticks if present.
    if (value.length >= 2 && value.startsWith('`') && value.endsWith('`')) {
      value = value.slice(1, -1);
    }
    markers.push(value);
  }
  return markers;
}

function extractDirectives(text) {
  // Optional "Runner directives" section. Parses `runIn: skip|manual`
  // and `timeout: <seconds>` lines.
  const out = { runIn: 'auto', timeout: DEFAULT_TIMEOUT_SECONDS };
  const runMatch = text.match(/runIn\s*:\s*(skip|manual|auto)/i);
  if (runMatch) out.runIn = runMatch[1].toLowerCase();
  const tMatch = text.match(/timeout\s*:\s*(\d+)/i);
  if (tMatch) out.timeout = parseInt(tMatch[1], 10);
  return out;
}

function parseEvidenceFile(path) {
  const raw = readFileSync(path, 'utf8');
  const sections = sliceSections(raw);

  const required = [
    'story',
    'acceptance criteria',
    'verification command',
    'expected output markers',
    'last verified',
  ];
  const missing = required.filter((k) => ![...sections.keys()].some((sk) => sk === k));
  if (missing.length) {
    return { error: `missing required H2 section(s): ${missing.join(', ')}` };
  }

  const cmdSection = sections.get('verification command');
  const cmdRes = extractCommand(cmdSection);
  if (cmdRes.error) return { error: `verification command: ${cmdRes.error}` };

  const markers = extractMarkers(sections.get('expected output markers'));

  const directives = sections.has('runner directives')
    ? extractDirectives(sections.get('runner directives'))
    : { runIn: 'auto', timeout: DEFAULT_TIMEOUT_SECONDS };

  return { command: cmdRes.command, markers, directives };
}

function runCommand(command, timeoutSeconds) {
  // Use bash -c so the command can use shell features (pipes,
  // redirects, &&). spawnSync's `shell: true` would also work but is
  // platform-inconsistent; bash -c is explicit. On GitHub Actions
  // ubuntu-latest, bash is the default shell.
  const res = spawnSync('bash', ['-c', command], {
    encoding: 'utf8',
    timeout: timeoutSeconds * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: res.status,
    signal: res.signal,
    timedOut: res.signal === 'SIGTERM' && res.error?.code === 'ETIMEDOUT',
  };
}

function checkMarkers(output, markers) {
  const missing = [];
  for (const m of markers) {
    if (!output.includes(m)) missing.push(m);
  }
  return missing;
}

function main() {
  const { dir } = readArgs();
  const absDir = resolve(cwd(), dir);
  const files = listEvidenceFiles(absDir);
  if (files.length === 0) {
    console.log(`OK: no evidence files in ${dir} to verify.`);
    exit(0);
  }

  let malformed = 0;
  let timedOut = 0;
  let failed = 0;
  let skipped = 0;
  let verified = 0;

  for (const file of files) {
    const parsed = parseEvidenceFile(file);
    if (parsed.error) {
      console.error(`MALFORMED: ${file}: ${parsed.error}`);
      malformed += 1;
      continue;
    }
    if (parsed.directives.runIn === 'skip') {
      console.log(`SKIP: ${file} (runIn: skip)`);
      skipped += 1;
      continue;
    }
    if (parsed.directives.runIn === 'manual') {
      console.log(`MANUAL: ${file} (runIn: manual — re-run manually before merge)`);
      skipped += 1;
      continue;
    }

    const r = runCommand(parsed.command, parsed.directives.timeout);
    if (r.timedOut) {
      console.error(`TIMEOUT: ${file} exceeded ${parsed.directives.timeout}s`);
      timedOut += 1;
      continue;
    }
    const combined = `${r.stdout}\n${r.stderr}`;
    const missing = checkMarkers(combined, parsed.markers);
    if (missing.length) {
      console.error(`MARKER FAIL: ${file}`);
      console.error(`  command exit: ${r.status}`);
      console.error(`  missing markers (${missing.length}):`);
      for (const m of missing) console.error(`    - ${JSON.stringify(m)}`);
      console.error('  --- combined output ---');
      console.error(
        combined
          .split(/\r?\n/)
          .map((l) => `  | ${l}`)
          .join('\n')
      );
      console.error('  --- end output ---');
      failed += 1;
      continue;
    }
    console.log(`OK: ${file}`);
    verified += 1;
  }

  console.log(
    `\nSummary: ${verified} verified, ${skipped} skipped, ${failed} failed, ${timedOut} timed out, ${malformed} malformed.`
  );

  if (malformed > 0) exit(2);
  if (timedOut > 0) exit(3);
  if (failed > 0) exit(1);
  exit(0);
}

main();
