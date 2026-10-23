/**
 * Equoria-bnwip — a full vitest run in which a configured project executed no
 * tests must fail loudly instead of exiting 0.
 *
 * The behaviour tests spawn the REAL vitest CLI against a throwaway
 * two-project workspace that uses the REAL reporter, and assert the exit
 * code. No browser is started: the throwaway projects are plain node projects,
 * and "ghost" has an include glob that matches nothing — the exact shape of
 * the dropped storybook project.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  describeMissingProjects,
  findMissingProjects,
  isNarrowedRun,
} from '../requireAllProjectsReporter';

const here = path.dirname(fileURLToPath(import.meta.url));
const reporterPath = path.resolve(here, '../requireAllProjectsReporter.ts');
const vitestBin = path.join(
  path.dirname(createRequire(import.meta.url).resolve('vitest/package.json')),
  'vitest.mjs'
);

describe('findMissingProjects', () => {
  it('names a configured project that executed nothing', () => {
    expect(findMissingProjects(['', 'storybook'], [''])).toEqual(['storybook']);
  });

  it('passes when every configured project ran', () => {
    expect(findMissingProjects(['', 'storybook'], ['', 'storybook'])).toEqual([]);
  });

  it('accepts a browser project reported as "name (instance)"', () => {
    expect(findMissingProjects(['storybook'], ['storybook (chromium)'])).toEqual([]);
  });

  it('does not treat a project whose name merely starts with another as having run', () => {
    expect(findMissingProjects(['story'], ['storybook'])).toEqual(['story']);
  });

  it('labels the unnamed root project in the failure message', () => {
    expect(describeMissingProjects([''])).toContain('(unnamed root project)');
    expect(describeMissingProjects(['storybook'])).toContain('Missing: storybook');
  });
});

describe('isNarrowedRun', () => {
  it('is false for a plain full run', () => {
    expect(isNarrowedRun({ config: {} })).toBe(false);
    expect(isNarrowedRun({ filenamePattern: [], config: {} })).toBe(false);
  });

  it.each([
    ['file filter', { filenamePattern: ['src/a.test.ts'], config: {} }],
    ['--changed', { config: { changed: true } }],
    ['--related', { config: { related: ['src/a.ts'] } }],
    ['--shard', { config: { shard: { index: 1, count: 2 } } }],
  ])('is true for %s', (_label, ctx) => {
    expect(isNarrowedRun(ctx)).toBe(true);
  });
});

describe('the repository vitest config', () => {
  it('registers the reporter, so the real full run cannot drop a project silently', () => {
    const config = readFileSync(path.resolve(here, '../../../vitest.config.ts'), 'utf-8');
    expect(config).toMatch(
      /import RequireAllProjectsReporter from '\.\/src\/test\/requireAllProjectsReporter'/
    );
    expect(config.match(/new RequireAllProjectsReporter\(\)/g)?.length).toBe(2);
  });
});

describe('the reporter inside a real vitest run', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'equoria-bnwip-'));
    mkdirSync(path.join(root, 'a'));
    mkdirSync(path.join(root, 'b'));
    writeFileSync(path.join(root, 'a', 'one.test.js'), "test('a runs', () => {});\n");
    writeFileSync(path.join(root, 'b', 'two.test.js'), "test('b runs', () => {});\n");
    const config = (ghostInclude: string) => `
import Reporter from ${JSON.stringify(pathToFileURL(reporterPath).href)};
export default {
  test: {
    globals: true,
    reporters: ['default', new Reporter()],
    projects: [
      { test: { name: 'a', globals: true, include: ['a/**/*.test.js'] } },
      { test: { name: 'ghost', globals: true, include: [${JSON.stringify(ghostInclude)}] } },
    ],
  },
};
`;
    writeFileSync(
      path.join(root, 'ghost-missing.config.mjs'),
      config('does-not-exist/**/*.test.js')
    );
    writeFileSync(path.join(root, 'ghost-present.config.mjs'), config('b/**/*.test.js'));
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const run = (configFile: string, extra: string[] = []) => {
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith('VITEST')) delete env[key];
    }
    const result = spawnSync(
      process.execPath,
      [
        vitestBin,
        'run',
        '--root',
        root,
        '--config',
        path.join(root, configFile),
        '--maxWorkers=1',
        ...extra,
      ],
      { encoding: 'utf-8', env, timeout: 120_000 }
    );
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  };

  it('exits non-zero and names the project that produced no tests', () => {
    const { status, output } = run('ghost-missing.config.mjs');
    expect(output).toContain('one.test.js');
    expect(output).toContain('Missing: ghost');
    expect(status).toBe(1);
  }, 130_000);

  it('exits 0 when every configured project produced tests', () => {
    const { status, output } = run('ghost-present.config.mjs');
    expect(output).not.toContain('Missing:');
    expect(status).toBe(0);
  }, 130_000);

  it('stands down when the run was narrowed to one file on purpose', () => {
    const { status, output } = run('ghost-missing.config.mjs', ['a/one.test.js']);
    expect(output).not.toContain('Missing:');
    expect(status).toBe(0);
  }, 130_000);

  it('stands down when the missing project was excluded with --project', () => {
    const { status, output } = run('ghost-missing.config.mjs', ['--project=a']);
    expect(output).not.toContain('Missing:');
    expect(status).toBe(0);
  }, 130_000);
});
