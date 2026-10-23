/**
 * Equoria-nlpi5 — `npm run generate` must refuse to write through a linked
 * node_modules (every agent worktree) unless the caller opts in explicitly.
 *
 * Real filesystem, real junctions/symlinks, and the REAL wrapper script spawned
 * as a child process. The wrapper is copied into a throwaway package layout so
 * the "refused" run proves the real script exits before it reaches the step
 * that stops node processes and deletes the engine DLL — a DLL planted in the
 * link TARGET must survive.
 *
 * SAFETY: the wrapper's destructive steps (a PowerShell sweep that force-stops
 * every node process holding the Prisma engine DLL, then `npx prisma
 * generate`) must NEVER run for real from a test — if the guard under test were
 * broken they would stop other sessions' processes and regenerate a shared
 * client. The child therefore runs with a PATH whose `powershell` and `npx` are
 * recording stubs. Whether a destructive step was reached is read from the stub
 * log, so the tests can also run the opted-in path end to end, safely.
 *
 * Child processes get no GIT_* variables (equoria-hook-git-env-leaks-into-tests).
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assessGenerateTarget,
  findLinkedNodeModules,
  sharedOkFlag,
} from '../../../packages/database/scripts/lib/sharedClientGuard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const realScripts = path.resolve(HERE, '..', '..', '..', 'packages', 'database', 'scripts');
const linkType = process.platform === 'win32' ? 'junction' : 'dir';
const DLL = 'query_engine-windows.dll.node';

let sandbox;

/** A throwaway `<repo>/packages/database` with the real wrapper copied in. */
function makeLayout(name) {
  const repo = path.join(sandbox, name);
  const packageDir = path.join(repo, 'packages', 'database');
  mkdirSync(path.join(packageDir, 'scripts'), { recursive: true });
  cpSync(path.join(realScripts, 'prisma-generate.mjs'), path.join(packageDir, 'scripts', 'prisma-generate.mjs'));
  cpSync(path.join(realScripts, 'lib'), path.join(packageDir, 'scripts', 'lib'), { recursive: true });
  return { repo, packageDir };
}

/** A "main checkout" node_modules holding a generated client with an engine DLL. */
function makeSharedNodeModules() {
  const shared = path.join(sandbox, 'main-checkout-node_modules');
  const client = path.join(shared, '.prisma', 'client');
  mkdirSync(client, { recursive: true });
  writeFileSync(path.join(client, DLL), 'engine');
  return { shared, client };
}

/**
 * Recording stand-ins for the two destructive commands the wrapper runs.
 * Each appends its name to stubLog and exits 0.
 */
function makeStubBin() {
  const bin = path.join(sandbox, 'stub-bin');
  mkdirSync(bin, { recursive: true });
  for (const name of ['powershell', 'npx']) {
    if (process.platform === 'win32') {
      writeFileSync(
        path.join(bin, `${name}.cmd`),
        `@echo ${name} %*>>"%stubLog%"
@exit /b 0
`,
      );
    } else {
      const file = path.join(bin, name);
      writeFileSync(
        file,
        `#!/bin/sh
echo "${name} $*" >> "$stubLog"
`,
      );
      chmodSync(file, 0o755);
    }
  }
  return bin;
}

function runWrapper(packageDir, args = [], extraEnv = {}) {
  const stubBin = makeStubBin();
  const stubLog = path.join(sandbox, 'destructive-steps.log');
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('GIT_') || /^path$/i.test(key)) {
      continue;
    }
    env[key] = value;
  }
  delete env.EQUORIA_PRISMA_GENERATE_SHARED_OK;
  const realPath = process.env.PATH ?? process.env.Path ?? '';
  const childEnv = { ...env, PATH: `${stubBin}${path.delimiter}${realPath}`, stubLog, ...extraEnv };

  // FAIL CLOSED: before the real wrapper is allowed to run, prove with the very
  // env it will get — through the same shell resolution execSync/spawnSync use —
  // that `powershell` and `npx` resolve to the recording stubs. If they do not,
  // abort here: the wrapper's real sweep force-stops every node process with the
  // Prisma engine loaded (it killed a Jest run once). Nothing destructive has
  // run at this point; the probe only appends to the stub log.
  execSync('powershell -NoProfile -Command probe', { env: childEnv, stdio: 'ignore' });
  execSync('npx probe', { env: childEnv, stdio: 'ignore' });
  const probeLog = existsSync(stubLog) ? readFileSync(stubLog, 'utf-8') : '';
  if (!/powershell/.test(probeLog) || !/npx/.test(probeLog)) {
    throw new Error(
      `stubs are not first on PATH; refusing to run the real wrapper. stub log: ${JSON.stringify(probeLog)}`,
    );
  }
  rmSync(stubLog, { force: true });

  const result = spawnSync(process.execPath, [path.join(packageDir, 'scripts', 'prisma-generate.mjs'), ...args], {
    encoding: 'utf-8',
    env: childEnv,
    timeout: 60_000,
  });
  const reached = existsSync(stubLog) ? readFileSync(stubLog, 'utf-8') : '';
  return { ...result, reached };
}

beforeEach(() => {
  sandbox = mkdtempSync(path.join(os.tmpdir(), 'equoria-nlpi5-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('findLinkedNodeModules', () => {
  it('reports nothing for a checkout with real node_modules directories', () => {
    const { packageDir } = makeLayout('real');
    mkdirSync(path.join(packageDir, 'node_modules', '.prisma', 'client'), { recursive: true });
    expect(findLinkedNodeModules(packageDir)).toEqual([]);
  });

  it('reports nothing when node_modules does not exist yet (first generate)', () => {
    const { packageDir } = makeLayout('fresh');
    expect(findLinkedNodeModules(packageDir)).toEqual([]);
  });

  it('reports a linked packages/database/node_modules', () => {
    const { packageDir } = makeLayout('linked-pkg');
    const { shared } = makeSharedNodeModules();
    symlinkSync(shared, path.join(packageDir, 'node_modules'), linkType);
    expect(findLinkedNodeModules(packageDir)).toEqual([path.join(packageDir, 'node_modules')]);
  });

  it('reports a linked repo-root node_modules', () => {
    const { repo, packageDir } = makeLayout('linked-root');
    const { shared } = makeSharedNodeModules();
    symlinkSync(shared, path.join(repo, 'node_modules'), linkType);
    expect(findLinkedNodeModules(packageDir)).toEqual([path.join(repo, 'node_modules')]);
  });

  it('reports a real node_modules whose .prisma directory is itself a link', () => {
    const { packageDir } = makeLayout('linked-prisma');
    const { shared } = makeSharedNodeModules();
    mkdirSync(path.join(packageDir, 'node_modules'), { recursive: true });
    symlinkSync(path.join(shared, '.prisma'), path.join(packageDir, 'node_modules', '.prisma'), linkType);
    expect(findLinkedNodeModules(packageDir)).toEqual([path.join(packageDir, 'node_modules', '.prisma')]);
  });
});

describe('assessGenerateTarget', () => {
  const linkedLayout = () => {
    const { packageDir } = makeLayout('assess');
    symlinkSync(makeSharedNodeModules().shared, path.join(packageDir, 'node_modules'), linkType);
    return packageDir;
  };

  it('refuses a linked target by default, naming the link and the opt-in', () => {
    const verdict = assessGenerateTarget({ packageDir: linkedLayout(), argv: [], sharedOkEnvValue: undefined });
    expect(verdict.allowed).toBe(false);
    expect(verdict.message).toContain('REFUSED');
    expect(verdict.message).toContain(sharedOkFlag);
    expect(verdict.message).toContain('EQUORIA_PRISMA_GENERATE_SHARED_OK');
  });

  it('allows a linked target with the explicit flag', () => {
    const verdict = assessGenerateTarget({
      packageDir: linkedLayout(),
      argv: [sharedOkFlag],
      sharedOkEnvValue: undefined,
    });
    expect(verdict).toMatchObject({ allowed: true, optedIn: true });
    expect(verdict.linked).toHaveLength(1);
  });

  it('allows a linked target with the explicit environment opt-in', () => {
    const verdict = assessGenerateTarget({ packageDir: linkedLayout(), argv: [], sharedOkEnvValue: '1' });
    expect(verdict.allowed).toBe(true);
  });

  it('does not accept a look-alike environment value or flag', () => {
    const packageDir = linkedLayout();
    for (const value of ['', '0', 'true', 'yes']) {
      const verdict = assessGenerateTarget({ packageDir, argv: ['--shared'], sharedOkEnvValue: value });
      expect(verdict.allowed).toBe(false);
    }
  });

  it('allows an unlinked checkout without any opt-in', () => {
    const { packageDir } = makeLayout('plain');
    expect(assessGenerateTarget({ packageDir, argv: [], sharedOkEnvValue: undefined })).toMatchObject({
      allowed: true,
      optedIn: false,
    });
  });
});

describe('the real prisma-generate.mjs wrapper (destructive steps stubbed)', () => {
  const linkedPackage = name => {
    const { packageDir } = makeLayout(name);
    const { shared, client } = makeSharedNodeModules();
    symlinkSync(shared, path.join(packageDir, 'node_modules'), linkType);
    return { packageDir, client };
  };

  it('exits non-zero before any destructive step when node_modules is linked', () => {
    const { packageDir, client } = linkedPackage('wrapper-refused');

    const result = runWrapper(packageDir);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('REFUSED');
    // Neither the process sweep nor `prisma generate` was reached, and the
    // shared client's engine DLL is untouched.
    expect(result.reached).toBe('');
    expect(existsSync(path.join(client, DLL))).toBe(true);
  });

  it('refuses even when the opt-in is a look-alike', () => {
    const { packageDir, client } = linkedPackage('wrapper-lookalike');

    const result = runWrapper(packageDir, ['--shared'], { EQUORIA_PRISMA_GENERATE_SHARED_OK: 'true' });

    expect(result.status).toBe(2);
    expect(result.reached).toBe('');
    expect(existsSync(path.join(client, DLL))).toBe(true);
  });

  it.each([
    ['the --shared-ok flag', [sharedOkFlag], {}],
    ['EQUORIA_PRISMA_GENERATE_SHARED_OK=1', [], { EQUORIA_PRISMA_GENERATE_SHARED_OK: '1' }],
  ])('runs through to `prisma generate` with %s', (_label, args, extraEnv) => {
    const { packageDir } = linkedPackage(`wrapper-optin-${args.length}`);

    const result = runWrapper(packageDir, args, extraEnv);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('shared-client opt-in');
    expect(result.reached).toContain('npx prisma generate');
  });

  it('runs without any opt-in in a checkout that owns its node_modules', () => {
    const { packageDir } = makeLayout('wrapper-local');
    mkdirSync(path.join(packageDir, 'node_modules', '.prisma', 'client'), { recursive: true });

    const result = runWrapper(packageDir);

    expect(result.status).toBe(0);
    expect(result.reached).toContain('npx prisma generate');
  });

  it('is import-safe: importing the wrapper runs nothing', async () => {
    const { packageDir, client } = linkedPackage('wrapper-import');

    await import(pathToFileURL(path.join(packageDir, 'scripts', 'prisma-generate.mjs')).href);

    expect(existsSync(path.join(client, DLL))).toBe(true);
  });
});
