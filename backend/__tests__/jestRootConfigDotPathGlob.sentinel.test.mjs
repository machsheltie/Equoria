/**
 * Root jest.config.js must select tests when the checkout sits under a
 * dot-prefixed path (Equoria-beqsp, Equoria-9zd7g, Equoria-43y7o).
 *
 * THE DEFECT. Claude Code puts agent worktrees under `<repo>/.claude/worktrees/`.
 * On Windows, Jest rewrites a `<rootDir>/...` glob with replacePathSepForGlob,
 * which deliberately keeps a backslash that precedes `.`. The `\.claude`
 * segment becomes an escaped dot with its separator swallowed, so every
 * `<rootDir>/...` testMatch glob matches nothing. A run that resolves zero test
 * files looks exactly like a run that passed, which is why this hid for weeks.
 * The root config's backend and unit projects now anchor their globs on an
 * absolute forward-slash root (toGlobRoot) instead of `<rootDir>`.
 *
 * WHAT THIS PINS, by asking Jest itself (`--listTests`), not by reading text:
 *  - a repo laid out under a dot-prefixed directory (the root config copied
 *    into a temp tree) still selects its backend, repo-root and unit tests and
 *    still excludes the repo-root tests the project deliberately leaves out;
 *  - the same tree under a `<rootDir>` glob selects nothing on Windows, which
 *    proves the check can fail (sentinel-positive control);
 *  - the live root config contains no `<rootDir>` testMatch glob, and selects
 *    this repository's own tests.
 *
 * jest.config.security.mjs has the same exposure; it cannot be changed without
 * changing securitySuiteScope.sentinel.test.mjs, which pins its `<rootDir>`
 * strings. That is tracked on Equoria-43y7o rather than worked around here.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, test, expect, afterAll } from '@jest/globals';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(backendDir, '..');
const rootConfigPath = path.join(repoRoot, 'jest.config.js');
// The root config is a `.js` ESM file, which the import-extension lint rule reserves
// for legacy modules, so it is loaded by file URL rather than a static specifier.
const { default: rootConfig, toGlobRoot } = await import(pathToFileURL(rootConfigPath).href);
const jestBin = path.join(backendDir, 'node_modules', 'jest', 'bin', 'jest.js');
const listTestsTimeoutMs = 120000;

const scratchRoots = [];
afterAll(() => {
  for (const dir of scratchRoots) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function write(file, text = '') {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/**
 * A miniature repo under `<tmp>/<unique>/.claude/worktrees/agent-x/` holding the
 * given jest.config.js text, the stub files the config names, and one test file
 * per interesting location.
 */
function buildDotPathRepo(configText) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'equoria-dotpath-'));
  scratchRoots.push(scratch);
  const repo = path.join(scratch, '.claude', 'worktrees', 'agent-x');
  write(path.join(repo, 'jest.config.js'), configText);
  write(path.join(repo, 'package.json'), '{"type":"module"}');
  // Files the backend project's config names; Jest checks they exist.
  write(path.join(repo, 'backend', 'tests', 'setup.mjs'));
  write(path.join(repo, 'backend', 'tests', 'teardown.mjs'));
  write(path.join(repo, 'backend', 'tests', 'config', 'PrismaCleanupEnvironment.mjs'), 'export default class {}');
  // Tests.
  write(path.join(repo, 'backend', '__tests__', 'inBackend.test.mjs'));
  write(path.join(repo, 'tests', 'topLevel.test.mjs'));
  write(path.join(repo, 'tests', 'services', 'svc.test.mjs'));
  write(path.join(repo, 'tests', 'unit', 'unitOnly.test.mjs'));
  write(path.join(repo, 'tests', 'e2e', 'excluded.test.mjs'));
  return repo;
}

function listTests(repo, projects) {
  const stdout = execFileSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      jestBin,
      '--config',
      path.join(repo, 'jest.config.js'),
      '--selectProjects',
      ...projects,
      '--listTests',
    ],
    { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 },
  );
  return stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => /\.test\.(js|mjs)$/.test(line))
    .map(file => path.relative(repo, file).split(path.sep).join('/'))
    .sort();
}

describe('toGlobRoot (Equoria-beqsp)', () => {
  test('returns a forward-slash path with no backslash and keeps a dot segment intact', () => {
    const root = toGlobRoot(path.join(tmpdir(), '.claude', 'worktrees', 'agent-x'));
    expect(root).not.toContain('\\');
    expect(root).toContain('/.claude/worktrees/agent-x');
  });

  test('escapes the glob characters Jest itself would escape', () => {
    expect(toGlobRoot(path.join(path.sep, 'a (x86)', 'b{c}'))).toMatch(/a \\\(x86\\\)\/b\\\{c\\\}$/);
  });

  test('refuses a path containing glob characters it cannot escape safely, instead of selecting nothing', () => {
    expect(() => toGlobRoot(path.join(path.sep, 'weird[dir]', 'x'))).toThrow(/cannot build a test glob/);
    expect(() => toGlobRoot(path.join(path.sep, 'star*dir'))).toThrow(/cannot build a test glob/);
  });
});

describe('root jest.config.js under a dot-prefixed checkout (Equoria-beqsp, Equoria-9zd7g)', () => {
  test(
    'backend and unit projects select their tests from <tmp>/.claude/worktrees/agent-x and keep the exclusions',
    () => {
      const repo = buildDotPathRepo('');
      copyFileSync(rootConfigPath, path.join(repo, 'jest.config.js'));

      expect(listTests(repo, ['backend'])).toEqual([
        'backend/__tests__/inBackend.test.mjs',
        'tests/services/svc.test.mjs',
        'tests/topLevel.test.mjs',
        'tests/unit/unitOnly.test.mjs',
      ]);
      expect(listTests(repo, ['unit'])).toEqual(['tests/unit/unitOnly.test.mjs']);
    },
    listTestsTimeoutMs,
  );

  // Windows-only mechanism: elsewhere Jest keeps the separator, so the control
  // has nothing to demonstrate.
  if (process.platform === 'win32') {
    test(
      'CONTROL (Windows): the same layout with a <rootDir> glob selects nothing, so this sentinel can fail',
      () => {
        const repo = buildDotPathRepo(
          [
            'export default {',
            "  projects: [{ displayName: 'backend', rootDir: '<rootDir>/backend',",
            "    testMatch: ['<rootDir>/**/*.test.{js,mjs}'], transform: {},",
            "    testEnvironment: 'node' }],",
            '};',
          ].join('\n'),
        );
        expect(listTests(repo, ['backend'])).toEqual([]);
      },
      listTestsTimeoutMs,
    );
  }
});

describe('live root jest.config.js', () => {
  test('no project anchors a testMatch glob on <rootDir>', () => {
    const offenders = [];
    for (const project of rootConfig.projects) {
      for (const pattern of project.testMatch ?? []) {
        if (pattern.includes('<rootDir>')) {
          offenders.push(`${project.displayName}: ${pattern}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test(
    'the backend project still selects this repository’s own tests',
    () => {
      const selected = listTests(repoRoot, ['backend']);
      expect(selected).toContain('backend/__tests__/jestRootConfigDotPathGlob.sentinel.test.mjs');
      expect(selected).toContain('tests/breeds.integration.test.mjs');
      expect(selected.filter(file => file.startsWith('tests/e2e/'))).toEqual([]);
    },
    listTestsTimeoutMs,
  );
});
