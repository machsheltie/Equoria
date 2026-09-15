#!/usr/bin/env node
// Doctrine: request-reachable code that writes `horses.name` must know about the
// shared horse-name policy.
//
// Source: Equoria-qkgfh.1. The horse-name rule (length 1-40 raw UTF-16 units,
// non-empty after trim, no `<` or NUL) lives in
// `backend/modules/horses/services/horseNamePolicy.mjs`. Since the 2026-09-14
// owner rulings, EVERY live player-supplied path enforces it — onboarding
// included (Equoria-zalyb), and PUT /horses/:id no longer sets a name at all
// (Equoria-4fnro).
//
// WHY A GATE INSTEAD OF ANOTHER SWEEP
//   The set of paths that write a player's string into `horses.name` was
//   enumerated FIVE times by hand during this task and was wrong or stale every
//   time but the last: the first pass missed `POST /horses/foals`, the second
//   missed `POST /auth/advance-onboarding`, and the count then changed again when
//   `POST /horses` was closed underneath it. An enumeration is a claim with a
//   shelf life. This check turns "every writer knows the rule" from a sentence in
//   a comment into something CI fails on.
//
// WHAT IT ACTUALLY PROVES — read this before trusting it
//   This is a FILE-LEVEL import gate, not per-callsite dataflow. It proves a file
//   that writes `horses.name` imports the policy module (so its author met the
//   rule) or is explicitly allow-listed with a reason. It does NOT prove every
//   write inside such a file is clamped or validated — e.g. `foalingService`
//   writes the shared birth name `UNNAMED_HORSE_NAME` while deliberately passing
//   an already-validated `options.name` through untouched.
//
// WHAT IT CANNOT SEE (stated, not implied)
//   - Seeds and operator scripts (`backend/seed/**`, `backend/scripts/**`): out of
//     scan scope by design. They are owner-operated tooling, not request paths,
//     and no route validator can gate them.
//   - Writes that never pass through the app: migrations, psql, any other process.
//   - Dynamic model or field access: matching is literal, so a write through
//     `prisma[model][op]` with a computed key is invisible.
//   - Raw SQL that updates the column (`UPDATE horses SET name = ...`). Covered
//     by a separate signal below, but only in its literal single-statement form.
//
// SIGNALS (any one makes a file a horse-name writer)
//   A. A Prisma write on the horse model — `prisma.horse.create/createMany/
//      update/updateMany/upsert(...)` (or `tx.` / `client.` / `db.`) with a
//      `name:` key inside its WRITE PAYLOAD (`data:` / `create:` / `update:`).
//      Precision matters: `select: { name: true }` on an unrelated update is a
//      READ, and the first draft of this check flagged five such callsites.
//      Allow-listing those would have padded the list with false positives and
//      turned the gate into noise — a guard that passes without guarding.
//   B. A call to `createHorse(` — the model-level insert in
//      `horses/services/horseModelService.mjs`, which writes `name` and caps
//      nothing itself.
//   C. Raw SQL containing `UPDATE horses ... SET ... name`.
//
// GATE
//   A flagged file passes if it imports `horseNamePolicy.mjs` (directly or by
//   re-export through `routes/_validators.mjs`), or if it is listed in
//   `horse-name-gate-allowlist.json` with a reason and an issue.
//
// The allow-list may only SHRINK: an entry naming a file that no longer exists,
// or that no longer trips any signal, FAILS this check — so a divergence cannot
// be grandfathered and then quietly forgotten. Mirrors the ratchet in
// check-no-unsafe-raw-sql.mjs (Equoria-pc042).
//
// The allow-list's OWN contract is enforced too: an entry without a real `reason`
// and a tracker `issue` fails as loudly as an ungated write. Documenting that
// requirement in the JSON's `_doc` was not enough — a bare `{}` entry silenced
// this gate and still exited 0, which is a guard that can be switched off more
// cheaply than the thing it guards can be fixed.
//
// Per-line exemption marker (for a genuinely non-horse-name write the signals
// misread):
//   // doctrine-allow: horse-name-ungated
//
// Run: `node scripts/doctrine-checks/check-horse-name-gated.mjs`
// Auto-runs via scripts/doctrine-checks/run-all.sh.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { walkFiles, readScannedFileSyncTolerant } from '../lib/doctrine-scan-patterns.mjs';

const CHECK_ID = 'horse-name-gated';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');

// One fixed path, deliberately not overridable. An earlier revision accepted an
// alternate allow-list path as argv[2] so a reviewer could re-run the check
// against an empty list. That is a bypass seam in the one kind of program whose
// entire job is to catch bypasses, and the usual mitigation does not work here:
// `NODE_ENV === 'test'` gates a test-only seam meaningfully in a long-running
// server (a deployed process is never 'test'), but this is a CLI script anyone
// can prefix with `NODE_ENV=test`, so the gate would be theatre. No committed
// test needed the override, so it is gone rather than gated. Verifying the list
// by temporarily emptying this file in a scratch worktree costs the same and
// leaves no permanent door.
const ALLOWLIST_PATH = path.join(SCRIPT_DIR, 'horse-name-gate-allowlist.json');

// Request-reachable backend app code only. `seed/` and `scripts/` are excluded
// deliberately (see "what it cannot see" above), as are test trees.
const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'modules'),
  path.join(REPO_ROOT, 'backend', 'routes'),
  path.join(REPO_ROOT, 'backend', 'services'),
  path.join(REPO_ROOT, 'backend', 'controllers'),
  path.join(REPO_ROOT, 'backend', 'middleware'),
  path.join(REPO_ROOT, 'backend', 'utils'),
];

const EXEMPTION_MARKER = '// doctrine-allow: horse-name-ungated';
const POLICY_MODULE_BASENAME = 'horseNamePolicy.mjs';
const POLICY_REEXPORT_BASENAME = '_validators.mjs';

const skipDir = (name, full) =>
  /(^|[\\/])__tests__([\\/]|$)/.test(full) ||
  /(^|[\\/])tests([\\/]|$)/.test(full) ||
  name === 'node_modules';

const includeFile = (name) => /\.mjs$/.test(name) && !/\.(test|spec)\.mjs$/.test(name);

const HORSE_WRITE_RE =
  /\b(?:prisma|tx|client|db)\s*\.\s*horse\s*\.\s*(create|createMany|update|updateMany|upsert)\s*\(/g;
const CREATE_HORSE_RE = /\bcreateHorse\s*\(/g;
const RAW_HORSE_NAME_UPDATE_RE = /UPDATE\s+"?horses"?[\s\S]{0,200}?\bSET\b[\s\S]{0,200}?\bname\b/gi;
// A `name` KEY, in any of the three forms this codebase actually writes:
//   name: value        (longhand)
//   'name': value      (quoted)
//   name               (ES6 shorthand — `data: { name }`)
// The shorthand form is why this is a key-position test rather than a substring
// search for `name:`. The first draft searched for `name:` only, and a planted
// `data: { name }` write walked straight past it — the shorthand is the idiom
// `renameHorseService` itself uses. A guard that misses the codebase's own idiom
// is the inert-guard failure this project has shipped before.
const NAME_KEY_SEGMENT_RE = /^\s*['"]?name['"]?\s*(?::|$)/;
// Keys whose value IS the write payload. `select` / `include` / `where` are not.
const WRITE_PAYLOAD_KEY_RE = /\b(data|create|update)\s*:\s*[[{]/g;

/**
 * Extract the balanced-parenthesis argument text starting at the '(' that
 * `openIndex` points at. Returns '' when the parentheses never balance (a
 * truncated or unparseable region), which is treated as "no name key found"
 * rather than as a violation — this check must not fail on its own parsing.
 */
function balancedArgs(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return '';
}

/**
 * Extract the balanced `{...}` or `[...]` region whose opening bracket sits at
 * `openIndex`. Returns '' if it never balances.
 */
function balancedBracket(source, openIndex) {
  const open = source[openIndex];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, i);
    }
  }
  return '';
}

/**
 * The WRITE-PAYLOAD regions of a Prisma call's argument text: the values of
 * `data:`, `create:` and `update:`. Everything else (`where`, `select`,
 * `include`, `orderBy`) is excluded, so `select: { name: true }` on an unrelated
 * update is correctly NOT treated as a horse-name write.
 *
 * `isArray` distinguishes `data: [{ … }]` (createMany) from `data: { … }`, which
 * decides where the payload's TOP LEVEL is — and the top level is the only place
 * a `name` key means `horses.name`.
 */
function writePayloadRegions(args) {
  const regions = [];
  WRITE_PAYLOAD_KEY_RE.lastIndex = 0;
  let m;
  while ((m = WRITE_PAYLOAD_KEY_RE.exec(args)) !== null) {
    const openIndex = m.index + m[0].length - 1;
    regions.push({ text: balancedBracket(args, openIndex), isArray: args[openIndex] === '[' });
  }
  return regions;
}

/** Remove every nested `{...}` / `[...]` so only the object's own keys remain. */
function stripNested(objectBody) {
  let out = '';
  let depth = 0;
  for (const ch of objectBody) {
    if (ch === '{' || ch === '[') {
      depth += 1;
      continue;
    }
    if (ch === '}' || ch === ']') {
      depth -= 1;
      continue;
    }
    if (depth === 0) out += ch;
  }
  return out;
}

/** Immediate `{...}` children of an array body — the createMany element objects. */
function arrayElementBodies(arrayBody) {
  const bodies = [];
  for (let i = 0; i < arrayBody.length; i += 1) {
    if (arrayBody[i] === '{') {
      const body = balancedBracket(arrayBody, i);
      bodies.push(body);
      i += body.length + 1;
    }
  }
  return bodies;
}

/**
 * Does this write payload set `horses.name` at its TOP level?
 *
 * Top-level only, deliberately. `riderController` writes
 * `data: { rider: { name: rider.name } }` — that `name` belongs to the rider
 * object stored in a JSON column, not to the horse, and counting it would be a
 * false positive that pushed an unrelated file onto the allow-list.
 */
function payloadWritesName({ text, isArray }) {
  const bodies = isArray ? arrayElementBodies(text) : [text];
  return bodies.some((body) =>
    // Split the flattened object into key/value segments and require `name` in
    // KEY position, so `temperament: name` (a name used as a VALUE for another
    // column) is not mistaken for a write of `horses.name`.
    stripNested(body)
      .split(',')
      .some((segment) => NAME_KEY_SEGMENT_RE.test(segment))
  );
}

/**
 * Does this write payload spread a variable, making its keys unknowable here?
 *
 * `onboardingController` writes `data: { ...updateData, temperament: … }` where
 * `updateData.horseName`-derived `name` was assigned elsewhere — so no literal
 * `name:` appears and a literal-only matcher misses the one path this task
 * already knows is ungated. A payload built from a spread is treated as a
 * POSSIBLE name write: it must be gated or allow-listed. Conservative on
 * purpose — the failure mode this check exists to prevent is a writer nobody
 * noticed, and "I could not see the keys" is not evidence there is no name.
 */
function payloadIsOpaque({ text }) {
  return /\.\.\.\s*[A-Za-z_$]/.test(stripNested(text));
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function lineTextAt(source, index) {
  const lines = source.split(/\r?\n/);
  return lines[lineOf(source, index) - 1] ?? '';
}

/** Every reason this file looks like a writer of `horses.name`. */
function findWriteSignals(source) {
  const signals = [];

  HORSE_WRITE_RE.lastIndex = 0;
  let m;
  while ((m = HORSE_WRITE_RE.exec(source)) !== null) {
    const openIndex = source.indexOf('(', m.index + m[0].length - 1);
    const args = balancedArgs(source, openIndex);
    const regions = writePayloadRegions(args);
    if (regions.some(payloadWritesName)) {
      signals.push({ kind: `prisma.horse.${m[1]} writing name`, index: m.index });
    } else if (regions.some(payloadIsOpaque)) {
      signals.push({
        kind: `prisma.horse.${m[1]} with a spread payload (name not statically visible)`,
        index: m.index,
      });
    }
  }

  CREATE_HORSE_RE.lastIndex = 0;
  while ((m = CREATE_HORSE_RE.exec(source)) !== null) {
    // Skip the definition/export site itself; only CALLERS write a horse.
    const before = source.slice(Math.max(0, m.index - 40), m.index);
    if (/\b(?:function|export function|async function|const|let)\s*$/.test(before)) continue;
    signals.push({ kind: 'createHorse() call', index: m.index });
  }

  RAW_HORSE_NAME_UPDATE_RE.lastIndex = 0;
  while ((m = RAW_HORSE_NAME_UPDATE_RE.exec(source)) !== null) {
    signals.push({ kind: 'raw SQL UPDATE horses SET ... name', index: m.index });
  }

  return signals.filter((s) => !lineTextAt(source, s.index).includes(EXEMPTION_MARKER));
}

/** Does this file route through the shared policy at all? */
function importsPolicy(source) {
  const importRe = /(?:^|\s)(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(source)) !== null) {
    const spec = m[1];
    if (spec.endsWith(POLICY_MODULE_BASENAME)) return true;
    // `routes/_validators.mjs` re-exports the policy, so importing the shared
    // name rule through it counts.
    if (spec.endsWith(POLICY_REEXPORT_BASENAME) && /horseName|HORSE_NAME_/.test(m[0])) return true;
  }
  return false;
}

// The allow-list's own contract, ENFORCED rather than merely documented.
//
// The `_doc` block says every entry MUST carry a reason and an issue. Until this
// existed, nothing checked that: a bare `{}` entry silenced the gate and the
// check still exited 0. That is how an allow-list rots — the next person under
// time pressure adds an empty entry, the gate goes green, and the divergence is
// invisible again. A guard must not be silenceable more cheaply than the thing it
// guards can be fixed.
//
// `reason` must actually explain: a minimum length is crude but it defeats 'n/a',
// 'legacy' and 'TODO', which is the whole failure mode. `issue` must name a real
// tracker id in this repository's convention, so the divergence is traceable to a
// decision instead of to a shrug.
const MIN_REASON_LENGTH = 40;
const ISSUE_REF_RE = /^Equoria-[A-Za-z0-9._-]+$/;

function findAllowlistContractViolations(byPath) {
  const problems = [];
  for (const [rel, entry] of Object.entries(byPath)) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push({ rel, missing: 'an object with { reason, issue } — got ' + typeof entry });
      continue;
    }
    const reason = typeof entry.reason === 'string' ? entry.reason.trim() : '';
    const issue = typeof entry.issue === 'string' ? entry.issue.trim() : '';
    const missing = [];
    if (reason.length === 0) {
      missing.push('a `reason`');
    } else if (reason.length < MIN_REASON_LENGTH) {
      missing.push(`a real \`reason\` (has ${reason.length} chars, needs >= ${MIN_REASON_LENGTH})`);
    }
    if (issue.length === 0) {
      missing.push('an `issue`');
    } else if (!ISSUE_REF_RE.test(issue)) {
      missing.push(`a valid \`issue\` reference (got ${JSON.stringify(entry.issue)})`);
    }
    if (missing.length > 0) {
      problems.push({ rel, missing: missing.join(' and ') });
    }
  }
  return problems;
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) {
    return { entries: [], byPath: {} };
  }
  const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const byPath = parsed && parsed.allowlist ? parsed.allowlist : {};
  return { entries: Object.keys(byPath), byPath };
}

const { entries: allowlistEntries, byPath: allowlistByPath } = loadAllowlist();
const allowlist = new Set(allowlistEntries);
const contractViolations = findAllowlistContractViolations(allowlistByPath);

const violations = [];
const flaggedRelPaths = new Set();

for (const file of walkFiles(SCAN_ROOTS, { skipDir, includeFile })) {
  const source = readScannedFileSyncTolerant(file, CHECK_ID);
  if (source === null) continue;

  const signals = findWriteSignals(source);
  if (signals.length === 0) continue;

  const rel = path.relative(REPO_ROOT, file).split(path.sep).join('/');
  flaggedRelPaths.add(rel);

  if (allowlist.has(rel) || importsPolicy(source)) continue;

  violations.push({
    rel,
    signals: signals.map((s) => `${s.kind} (line ${lineOf(source, s.index)})`),
  });
}

// Ratchet: an allow-list entry must still name a real file that still trips a
// signal. Otherwise the list has stopped shrinking and started rotting.
const staleEntries = [];
for (const rel of allowlistEntries) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    staleEntries.push({ rel, why: 'file no longer exists' });
    continue;
  }
  if (!flaggedRelPaths.has(rel)) {
    staleEntries.push({ rel, why: 'file no longer writes horses.name — remove the entry' });
  }
}

if (violations.length > 0 || staleEntries.length > 0 || contractViolations.length > 0) {
  console.error(`[${CHECK_ID}] DOCTRINE VIOLATION\n`);

  if (contractViolations.length > 0) {
    // Reported as loudly as an ungated write, and first, because a malformed
    // entry means the gate is currently silent about a real divergence.
    console.error('Allow-list entr(ies) do not meet the contract the list itself states:');
    for (const c of contractViolations) {
      console.error(`  ${c.rel} — missing ${c.missing}`);
    }
    console.error(
      '\nEvery entry MUST carry a `reason` that explains why the divergence is' +
        '\nacceptable and an `issue` naming the decision (e.g. "Equoria-zalyb").' +
        '\nAn entry without them silences this gate while recording nothing, which' +
        '\nis how an allow-list rots. Write the reason or remove the entry.'
    );
  }

  if (violations.length > 0) {
    console.error('Request-reachable file(s) write horses.name without the shared policy:');
    for (const v of violations) {
      console.error(`  ${v.rel}`);
      for (const s of v.signals) console.error(`      ${s}`);
      const reason = allowlistByPath[v.rel]?.reason;
      if (reason) console.error(`      (allow-list reason on record: ${reason})`);
    }
    console.error(
      '\nFix (preferred): validate the name through' +
        '\n  backend/modules/horses/services/horseNamePolicy.mjs' +
        '\n  (horseNameRejectionReason for a supplied name; UNNAMED_HORSE_NAME for a newborn foal),' +
        '\n  or import the shared rule via routes/_validators.mjs on a request path.' +
        '\nIf the divergence is deliberate and owner-approved, add the file to' +
        `\n  ${path.relative(REPO_ROOT, ALLOWLIST_PATH).split(path.sep).join('/')}` +
        '\n  with a reason and an issue id. That list may only SHRINK.'
    );
  }

  if (staleEntries.length > 0) {
    console.error('\nStale allow-list entr(ies) — the list may only shrink:');
    for (const e of staleEntries) console.error(`  ${e.rel}: ${e.why}`);
  }

  process.exit(1);
}

console.log(
  `[${CHECK_ID}] OK — ${flaggedRelPaths.size} horse-name writer(s) in request-reachable code, ` +
    `all gated by the shared policy or allow-listed (${allowlist.size} allow-listed).`
);
process.exit(0);
