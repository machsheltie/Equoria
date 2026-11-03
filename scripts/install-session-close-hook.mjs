#!/usr/bin/env node
/**
 * Equoria-urtx (B6): one-shot installer for the SessionEnd hook in
 * `.claude/settings.json`.
 *
 * The hook runs `scripts/session-close.sh` on every Claude Code session
 * end, surfacing uncommitted code, doctrine-gate failures, and bd-sync
 * drift. The hook itself can't be shipped directly because `.claude/`
 * is gitignored (per repo policy — `.claude/` holds personal settings
 * and per-machine overrides). This installer adds the hook entry to
 * the local `.claude/settings.json` non-destructively.
 *
 * Idempotent — running it twice does nothing on the second run.
 *
 * Usage:
 *   node scripts/install-session-close-hook.mjs            # install
 *   node scripts/install-session-close-hook.mjs --check    # report only
 *   node scripts/install-session-close-hook.mjs --uninstall # remove
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { argv, exit, cwd } from 'node:process';
import { resolve } from 'node:path';

const settingsPath = resolve(cwd(), '.claude', 'settings.json');
const hookCommand = 'bash "$CLAUDE_PROJECT_DIR"/scripts/session-close.sh';
const hookEntry = {
  hooks: [{ type: 'command', command: hookCommand }],
};
const commentKey = '_SessionEnd_comment';
const commentValue =
  'Equoria-urtx (B6): runs scripts/session-close.sh on every session end. Surfaces uncommitted code, doctrine-gate failures, and bd-sync drift as terminal output. Add `--warn` to the command above to exit 0 unconditionally during the doctrine-baseline cleanup window (Equoria-5nqe).';

function loadSettings() {
  if (!existsSync(settingsPath)) {
    console.error(
      `FAIL: ${settingsPath} does not exist; run Claude Code at least once to initialize.`
    );
    exit(2);
  }
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    console.error(`FAIL: ${settingsPath} is not valid JSON: ${e.message}`);
    exit(2);
  }
}

function hasHook(settings) {
  const sessionEnd = settings.hooks?.SessionEnd;
  if (!Array.isArray(sessionEnd)) return false;
  for (const block of sessionEnd) {
    for (const h of block.hooks || []) {
      if (h.type === 'command' && h.command === hookCommand) return true;
    }
  }
  return false;
}

function install(settings) {
  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {};
  if (!Array.isArray(settings.hooks.SessionEnd)) settings.hooks.SessionEnd = [];
  settings.hooks.SessionEnd.push(hookEntry);
  if (!settings.hooks[commentKey]) settings.hooks[commentKey] = commentValue;
  return settings;
}

function uninstall(settings) {
  const sessionEnd = settings.hooks?.SessionEnd;
  if (!Array.isArray(sessionEnd)) return settings;
  for (const block of sessionEnd) {
    block.hooks = (block.hooks || []).filter(
      (h) => !(h.type === 'command' && h.command === hookCommand)
    );
  }
  // Drop empty blocks.
  settings.hooks.SessionEnd = sessionEnd.filter((b) => (b.hooks || []).length > 0);
  if (settings.hooks.SessionEnd.length === 0) delete settings.hooks.SessionEnd;
  if (settings.hooks[commentKey] === commentValue) delete settings.hooks[commentKey];
  return settings;
}

function save(settings) {
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function main() {
  const mode = argv[2] || 'install';
  const settings = loadSettings();

  if (mode === '--check') {
    if (hasHook(settings)) {
      console.log('OK: session-close.sh hook is installed in SessionEnd.');
      exit(0);
    }
    console.error('NOT INSTALLED: SessionEnd does not invoke scripts/session-close.sh.');
    console.error('Run `node scripts/install-session-close-hook.mjs` to install.');
    exit(1);
  }

  if (mode === '--uninstall') {
    if (!hasHook(settings)) {
      console.log('OK: hook was not installed; nothing to do.');
      exit(0);
    }
    save(uninstall(settings));
    console.log(`OK: removed session-close.sh hook from ${settingsPath}.`);
    exit(0);
  }

  // default: install
  if (hasHook(settings)) {
    console.log('OK: session-close.sh hook already installed; nothing to do.');
    exit(0);
  }
  save(install(settings));
  console.log(`OK: added session-close.sh hook to ${settingsPath}.`);
  console.log('It will run on every Claude Code session end. Disable with `--uninstall`.');
  exit(0);
}

main();
