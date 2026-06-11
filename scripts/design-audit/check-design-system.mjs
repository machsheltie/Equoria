/**
 * Design-system source audit + ratchet (Equoria-o5hub.23, handoff §16).
 *
 * Scans frontend page/component sources for design-system violations and
 * enforces a monotonic ratchet: no rule's match count may EXCEED the
 * committed baseline (scripts/design-audit/baseline.json). Family
 * migrations lower the baseline; final completion drives it to zero or
 * explicit exceptions.
 *
 * Exceptions: docs/design-system/EXCEPTIONS.md — table rows of
 *   | rule-id | file-or-glob | owner | justification | expiry (YYYY-MM-DD) |
 * A matching, unexpired exception excludes the match from the count.
 * EXPIRED exceptions fail the audit outright.
 *
 * Usage:
 *   node scripts/design-audit/check-design-system.mjs            # audit + ratchet
 *   node scripts/design-audit/check-design-system.mjs --report   # full match listing
 *   node scripts/design-audit/check-design-system.mjs --write-baseline
 *
 * Exit codes: 0 ok; 1 ratchet exceeded or expired exception; 2 internal error.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const FRONTEND_SRC = path.join(repoRoot, 'frontend', 'src');
const BASELINE_PATH = path.join(here, 'baseline.json');
const EXCEPTIONS_PATH = path.join(repoRoot, 'docs', 'design-system', 'EXCEPTIONS.md');

// ── Rules ────────────────────────────────────────────────────────────────────
// Each rule: id, description, dirs (relative to frontend/src), filePattern,
// match regex (per line), and optional lineExclude to skip legitimate forms.

const PAGES = ['pages'];
const PAGES_AND_COMPONENTS = ['pages', 'components'];

const RULES = [
  {
    id: 'palette-classes',
    description: 'Raw Tailwind palette color classes (use text-role-*/status tokens, D-11)',
    dirs: PAGES,
    match:
      /\b(?:text|bg|border|from|via|to|ring|fill|stroke)-(?:red|emerald|green|blue|amber|yellow|orange|slate|gray|zinc|neutral|stone|purple|pink|indigo|teal|cyan|lime|rose|fuchsia|violet|sky)-\d{2,3}(?:\/\d{1,3})?\b/,
  },
  {
    id: 'text-opacity',
    description: 'text-white/NN opacity text (use text-role-* roles, D-12)',
    dirs: PAGES_AND_COMPONENTS,
    match: /\btext-(?:white|black)\/\d{1,3}\b/,
  },
  {
    id: 'unsupported-radius',
    description: 'rounded-2xl/3xl or arbitrary non-token radius in page code (D-09/§3)',
    dirs: PAGES,
    match: /\brounded-(?:2xl|3xl|\[(?!var\())/,
  },
  {
    id: 'page-local-blur',
    description: 'backdrop-blur outside the Surface/GameDialog/layout primitives (D-06)',
    dirs: PAGES,
    match: /backdrop-blur|backdropFilter/,
  },
  {
    id: 'outer-width-wrapper',
    description: 'Page-level max-w-* wrapper (PageContainer owns width, D-02)',
    dirs: PAGES,
    match: /\bmax-w-(?:4xl|5xl|6xl|7xl|\[)/,
  },
  {
    id: 'fixed-overlay',
    description: 'Page-local fixed inset-0 overlay (GameDialog owns overlays, D-14)',
    dirs: PAGES_AND_COMPONENTS,
    match: /fixed inset-0/,
  },
  {
    id: 'window-confirm',
    description: 'Browser confirmation dialog (use GameDialog, D-14)',
    dirs: PAGES_AND_COMPONENTS,
    match: /window\.confirm\s*\(/,
  },
  {
    id: 'deprecated-imports',
    description: 'Deprecated primitives (BaseModal/CelestialTabs/CurrencyDisplay/celestial-input)',
    dirs: PAGES_AND_COMPONENTS,
    match: /\b(?:BaseModal|CelestialTabs|CurrencyDisplay)\b|celestial-input/,
  },
  {
    id: 'usd-game-currency',
    description: 'Game currency formatted as USD (use Currency component, D-23)',
    dirs: PAGES_AND_COMPONENTS,
    match: /currency:\s*['"]USD['"]/,
  },
];

// PageHero allowlist (handoff §16.4): genuine image-backed location pages only.
const PAGEHERO_ALLOWLIST = [
  'pages/VeterinarianPage.tsx',
  'pages/FarrierPage.tsx',
  'pages/FeedShopPage.tsx',
  'pages/TackShopPage.tsx',
  'pages/CraftingPage.tsx',
  'pages/WorldMapPage.tsx',
  'pages/WorldHubPage.tsx',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      yield* walk(p);
    } else if (/\.(tsx|ts)$/.test(name) && !/\.(test|spec|stories)\.tsx?$/.test(name)) {
      yield p;
    }
  }
}

/** Parse the exception registry table. Returns [{rule, fileGlob, expiry}]. */
function parseExceptions() {
  if (!existsSync(EXCEPTIONS_PATH)) return [];
  const lines = readFileSync(EXCEPTIONS_PATH, 'utf8').split('\n');
  const rows = [];
  for (const line of lines) {
    const m = line.match(
      /^\|\s*([a-z-]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/
    );
    if (m && m[1] !== 'rule-id') {
      rows.push({ rule: m[1], fileGlob: m[2], owner: m[3], justification: m[4], expiry: m[5] });
    }
  }
  return rows;
}

function globToRegExp(glob) {
  const esc = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*');
  return new RegExp(`${esc}$`);
}

// ── Scan ─────────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const exceptions = parseExceptions();
const today = new Date().toISOString().slice(0, 10);

const expired = exceptions.filter((e) => e.expiry < today);

const findings = []; // {rule, file, line, text, excepted}

for (const rule of RULES) {
  for (const dir of rule.dirs) {
    const root = path.join(FRONTEND_SRC, dir);
    if (!existsSync(root)) continue;
    for (const file of walk(root)) {
      const rel = path.relative(FRONTEND_SRC, file).replace(/\\/g, '/');
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((text, i) => {
        if (!rule.match.test(text)) return;
        // Comment lines documenting the rule itself don't count — including
        // block-comment continuation lines (which may not start with *).
        const trimmed = text.trim();
        if (
          trimmed.startsWith('//') ||
          trimmed.startsWith('*') ||
          trimmed.startsWith('/*') ||
          trimmed.includes('*/')
        )
          return;
        const excepted = exceptions.some(
          (e) => e.rule === rule.id && globToRegExp(e.fileGlob).test(rel) && e.expiry >= today
        );
        findings.push({
          rule: rule.id,
          file: rel,
          line: i + 1,
          text: trimmed.slice(0, 120),
          excepted,
        });
      });
    }
  }
}

// PageHero allowlist rule
{
  const root = path.join(FRONTEND_SRC, 'pages');
  for (const file of walk(root)) {
    const rel = path.relative(FRONTEND_SRC, file).replace(/\\/g, '/');
    const src = readFileSync(file, 'utf8');
    if (
      /\bPageHero\b/.test(src) &&
      /import .*PageHero/.test(src) &&
      !PAGEHERO_ALLOWLIST.includes(rel)
    ) {
      findings.push({
        rule: 'pagehero-allowlist',
        file: rel,
        line: 0,
        text: 'PageHero import on non-location page',
        excepted: false,
      });
    }
  }
}

// ── Tally + ratchet ──────────────────────────────────────────────────────────

const counts = {};
for (const rule of [...RULES.map((r) => r.id), 'pagehero-allowlist']) counts[rule] = 0;
for (const f of findings) if (!f.excepted) counts[f.rule]++;

if (args.has('--report')) {
  for (const f of findings) {
    console.log(`${f.excepted ? '[excepted] ' : ''}${f.rule}  ${f.file}:${f.line}  ${f.text}`);
  }
}

console.log('\n[design-audit] counts (non-excepted):');
for (const [rule, n] of Object.entries(counts)) console.log(`  ${rule.padEnd(22)} ${n}`);

if (expired.length) {
  console.error(`\n[design-audit] FAIL — ${expired.length} EXPIRED exception(s) in EXCEPTIONS.md:`);
  for (const e of expired) console.error(`  ${e.rule} ${e.fileGlob} expired ${e.expiry}`);
  process.exit(1);
}

if (args.has('--write-baseline')) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`\n[design-audit] baseline written to ${path.relative(repoRoot, BASELINE_PATH)}`);
  process.exit(0);
}

if (!existsSync(BASELINE_PATH)) {
  console.error('\n[design-audit] no baseline.json — run with --write-baseline first');
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
let failed = false;
for (const [rule, n] of Object.entries(counts)) {
  const cap = baseline[rule] ?? 0;
  if (n > cap) {
    failed = true;
    console.error(`[design-audit] RATCHET EXCEEDED: ${rule} = ${n} > baseline ${cap}`);
  }
}

if (failed) {
  console.error(
    '\n[design-audit] FAIL — new design-system violations introduced. Use the canonical primitives (DECISIONS.md) or add a justified, expiring exception to docs/design-system/EXCEPTIONS.md.'
  );
  process.exit(1);
}
console.log('\n[design-audit] OK — no rule exceeds its baseline.');
