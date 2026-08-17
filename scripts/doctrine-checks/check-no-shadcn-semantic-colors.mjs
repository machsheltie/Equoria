#!/usr/bin/env node
/**
 * Equoria-z7t3l doctrine check: no reintroduction of the shadcn semantic
 * color layer.
 *
 * Problem: Equoria-6mwia removed the shadcn/ui semantic color system from
 * frontend/src — the CSS var layer (--background / --foreground / --card /
 * --popover / --primary / --secondary / --muted / --accent / --destructive /
 * --border / --input / --ring and their -foreground siblings), the
 * theme.extend.colors entries that mapped them in tailwind.config.ts, and the
 * bare utilities that consumed them (bg-primary, text-foreground,
 * border-border, …). DESIGN.md's One Palette Rule makes Celestial Night the
 * only color system; `primary` in the shadcn layer was cobalt #2563eb — a
 * second, contradictory accent. This check fails the doctrine suite when any
 * of those names reappear.
 *
 * Mechanism: the house ratchet pattern (sibling: check-file-size-thresholds
 * .mjs), already ratcheted to ZERO — the 6mwia removal left no legacy
 * occurrences, so there is no baseline file and no allow-list: ANY finding is
 * a failure. (A baseline would only be re-introduced if a future user ruling
 * grandfathers an occurrence, which would itself violate the One Palette
 * Rule — so: none.)
 *
 * THE 437-HIT GREP-ARTIFACT TRAP (documented on Equoria-6mwia): a naive
 * /text-primary/ scan matches the CELESTIAL tokens 437 times, because
 * `text-[var(--text-primary)]`, `--text-secondary`, `--text-muted` and the
 * .text-role-* classes all CONTAIN the shadcn utility names as substrings.
 * Every regex below therefore anchors on what precedes and follows the
 * name, and the sentinel test proves both directions: the check FIRES on a
 * planted real violation and stays SILENT on the Celestial forms.
 *
 * Scope: every .ts/.tsx/.css file under frontend/src, + frontend/tailwind.config.ts.
 * Test files are included — a shadcn utility asserted by a test is a
 * violation-in-waiting. Comment lines are skipped (a comment may
 * legitimately document the ban, as index.css and DESIGN.md do).
 *
 * NOT in scope (per the bead): the legacy alias entries (burnished-gold …)
 * — those belong to the separate legacy-alias migration, and `--radius`
 * (shadcn's radius var, still consumed by tailwind.config borderRadius) —
 * this check covers only the semantic COLOR names.
 *
 * Optional argv[2]: alternate scan root (sentinel-test hook) — production
 * callers (run-all.sh, CI doctrine-gate) pass no argument and scan the repo.
 * Auto-runs via scripts/doctrine-checks/run-all.sh by file-name pattern.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(SCRIPT_DIR, '..', '..');

const BACKSLASH = String.fromCharCode(92);

// The shadcn semantic color names (base set; -foreground siblings are
// matched via the optional suffix in each regex).
const SHADCN_NAMES =
  'background|foreground|card|popover|primary|secondary|muted|accent|destructive|border|input|ring';

/**
 * Rule 1 — CSS custom-property DEFINITIONS of the shadcn names.
 *   Fires:  --primary: 222 47% 11%;   --card-foreground: …;
 *   Silent: --text-primary: …;  --border-default: …;  --celestial-primary: …;
 *           --btn-primary-bg: …;  (name must start immediately after `--`
 *           and be followed by `:` — longer Celestial names never match).
 */
const VAR_DEFINITION_RE = new RegExp(`(?<![-\\w])--(?:${SHADCN_NAMES})(?:-foreground)?\\s*:`);

/**
 * Rule 2 — CONSUMPTION of the shadcn vars: var(--primary), hsl(var(--border)).
 *   Silent: var(--text-primary), var(--border-default) — the name inside
 *   var() must be exactly a shadcn name (plus optional -foreground).
 */
const VAR_CONSUMPTION_RE = new RegExp(`var\\(\\s*--(?:${SHADCN_NAMES})(?:-foreground)?\\s*\\)`);

/**
 * Rule 3 — bare Tailwind UTILITIES consuming the shadcn theme colors:
 * bg-primary, text-foreground, border-border, ring-offset-background, …
 * with any variant-prefix chain (hover:, md:, dark:, group-hover:, …).
 *
 *   Trap-proofing (the 437-hit artifact):
 *   - lookbehind (?<![-\w([]) rejects `--text-primary` / `[var(--text-primary`
 *     (preceded by `-` or `(`), and `.text-role-primary` never matches because
 *     `role` is not in the name set.
 *   - lookahead (?![\w)\]-]) rejects `text-primary)` inside var() fallbacks
 *     and any longer hyphenated name.
 */
const UTILITY_RE = new RegExp(
  `(?<![-\\w([])(?:[a-z][a-z-]*:|\\[[^\\]]*\\]:)*(?:bg|text|border|divide|outline|fill|stroke|from|via|to|ring-offset|ring)-(?:${SHADCN_NAMES})(?:-foreground)?(?![\\w)\\]-])`
);

/**
 * Rule 4 — tailwind.config.ts ONLY: a theme color KEY of a shadcn name mapped
 * to an hsl()/rgb() value (the classic shadcn theme.extend.colors block, even
 * when re-added with inline triplets rather than var() references — which
 * rule 2 would otherwise catch).
 */
const CONFIG_KEY_RE = new RegExp(
  `(?:^|[{,])\\s*(?:'|")?(?:${SHADCN_NAMES})(?:-foreground)?(?:'|")?\\s*:\\s*(?:\\{\\s*)?(?:'|")?\\s*(?:DEFAULT\\s*:\\s*)?(?:'|")?(?:hsl|rgb)`
);

const RULES = [
  { id: 'shadcn-var-definition', re: VAR_DEFINITION_RE, configOnly: false },
  { id: 'shadcn-var-consumption', re: VAR_CONSUMPTION_RE, configOnly: false },
  { id: 'shadcn-utility', re: UTILITY_RE, configOnly: false },
  { id: 'shadcn-config-color-key', re: CONFIG_KEY_RE, configOnly: true },
];

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo']);
const FILE_RE = /\.(ts|tsx|css)$/;

function walk(dir, acc) {
  let ents;
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    // Tolerate only a directory vanishing mid-scan (concurrent sentinel
    // cleanup); anything else is a real fault.
    if (err && err.code === 'ENOENT') {
      console.error(`[no-shadcn-semantic-colors] notice: skipped vanished directory ${dir}`);
      return;
    }
    throw err;
  }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, acc);
    } else if (e.isFile() && FILE_RE.test(e.name)) {
      acc.push(full);
    }
  }
}

/** Comment-line heuristic (house style, mirrors design-audit): a line that is
 *  itself a comment may legitimately NAME the banned utilities to document the
 *  ban — index.css and the DESIGN.md quotes do exactly that. */
function isCommentLine(text) {
  const trimmed = text.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.includes('*/')
  );
}

/**
 * Pure detector — returns [{file, line, rule, text}] for every violation in
 * the given repo root. Exported for the sentinel test.
 */
export function scanShadcnSemanticColors(repoRoot = REPO_ROOT) {
  const findings = [];
  const srcRoot = path.join(repoRoot, 'frontend', 'src');
  const files = [];
  if (fs.existsSync(srcRoot)) walk(srcRoot, files);
  const twConfig = path.join(repoRoot, 'frontend', 'tailwind.config.ts');
  if (fs.existsSync(twConfig)) files.push(twConfig);

  for (const file of files) {
    const rel = path.relative(repoRoot, file).split(BACKSLASH).join('/');
    const isConfig = rel === 'frontend/tailwind.config.ts';
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      if (isCommentLine(text)) return;
      for (const rule of RULES) {
        if (rule.configOnly && !isConfig) continue;
        if (rule.re.test(text)) {
          findings.push({ file: rel, line: i + 1, rule: rule.id, text: text.trim().slice(0, 140) });
        }
      }
    });
  }
  return findings;
}

function main() {
  const findings = scanShadcnSemanticColors();
  if (findings.length > 0) {
    console.error(
      '[no-shadcn-semantic-colors] FAIL — shadcn semantic color layer reintroduced ' +
        `(${findings.length} finding${findings.length === 1 ? '' : 's'}):`
    );
    for (const f of findings) {
      console.error(`  ${f.file}:${f.line}  [${f.rule}]  ${f.text}`);
    }
    console.error('');
    console.error('The shadcn semantic color system was removed by Equoria-6mwia (user decision,');
    console.error('2026-08-13 — DESIGN.md "The One Palette Rule"). Celestial Night tokens in');
    console.error(
      'frontend/src/styles/tokens.css are the only color system: use var(--gold-primary),'
    );
    console.error(
      'var(--text-primary), the .text-role-* classes, or the --role-* semantic tokens.'
    );
    console.error('See Equoria-z7t3l.');
    process.exit(1);
  }
  console.log(
    '[no-shadcn-semantic-colors] OK — no shadcn semantic color vars, utilities, or config keys in frontend'
  );
}

// ESM main-module guard: import-safe (the sentinel imports the pure detector
// without triggering the scan/exit). main() runs only as direct entrypoint.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
