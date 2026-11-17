/**
 * Sentinel - the Beta Readiness Gate skips ONLY when every changed path is
 * notes (Equoria-rhet, owner ruling q364), and the skip keeps the skip
 * sentinel and its mirrors honest.
 *
 * Reads .github/workflows/test.yml as text (a workflow is not importable),
 * checks the wiring, then RUNS the real `changes` job script in throwaway git
 * repositories to prove: notes-only -> docsOnly=true; anything else, an empty
 * diff, an unusable or unfetchable base, or a non-push/PR event -> false.
 * js-yaml is deliberately not used: it is unresolved in some CI jobs.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(path.join(ROOT, '.github/workflows/test.yml'), 'utf8');

const sliceJob = name => {
  const from = workflow.indexOf(`\n  ${name}:\n`);
  expect(from).toBeGreaterThan(-1);
  const rest = workflow.slice(from + 1);
  const next = rest.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
};

const changesJob = sliceJob('changes');
const betaJob = sliceJob('beta-readiness-gate');
const deployJob = sliceJob('deployment-gate');
const sentinelJob = sliceJob('critical-jobs-ran');

const runsUnlessDocsOnly = "needs.changes.outputs.docsOnly != 'true'";

const detectScript = () => {
  const lines = changesJob.split('\n');
  const start = lines.findIndex(l => /^ {8}run: \|\s*$/.test(l));
  expect(start).toBeGreaterThan(-1);
  const body = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== '' && !line.startsWith(' '.repeat(10))) {
      break;
    }
    body.push(line.slice(10));
  }
  return body.join('\n');
};

const cleanEnv = () => {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_')) {
      delete env[key];
    }
  }
  return env;
};

describe('workflow wiring for the notes-only skip', () => {
  it('has an unconditional, needs-free changes job that exposes docsOnly', () => {
    expect(changesJob).toMatch(/\n {4}outputs:\n {6}docsOnly: \$\{\{ steps\.detect\.outputs\.docsOnly \}\}/);
    expect(changesJob).not.toMatch(/\n {4}if:/);
    expect(changesJob).not.toMatch(/\n {4}needs:/);
  });

  it('uses plain git diff, no third-party paths-filter action', () => {
    expect(changesJob).toContain('git -c core.quotepath=off diff --name-only --no-renames');
    expect(changesJob).not.toMatch(/dorny|paths-filter/);
    expect(workflow).not.toMatch(/\n\s+paths(-ignore)?:/);
  });

  it('skips the gate only on the docsOnly output, and the gate still needs its upstream jobs', () => {
    expect(betaJob).toContain(`\n    if: ${runsUnlessDocsOnly}\n`);
    expect(betaJob).toMatch(/\n {4}needs: \[changes, coverage-gate, security-gate, frontend-tests\]/);
  });

  it('the Deployment Gate skips with it, stays master-only, and still waits for the beta gate', () => {
    expect(deployJob).toContain(`\n    if: github.ref == 'refs/heads/master' && ${runsUnlessDocsOnly}\n`);
    expect(deployJob).toMatch(/\n {4}needs: \[changes, [^\]]*beta-readiness-gate[^\]]*\]/);
  });

  it('the skip sentinel waits on changes and mirrors both new conditions verbatim', () => {
    expect(sentinelJob).toMatch(/\n {6}- changes\n/);
    expect(sentinelJob).toMatch(/check changes\s+"\$R_CHANGES"\s+true/);
    expect(sentinelJob).toContain(`EXPECT_BETA_READINESS: \${{ ${runsUnlessDocsOnly} }}`);
    expect(sentinelJob).toContain(
      `EXPECT_DEPLOYMENT_GATE: \${{ github.ref == 'refs/heads/master' && ${runsUnlessDocsOnly} }}`,
    );
    expect(sentinelJob).toMatch(/"\$R_BETA_READINESS"\s+"\$EXPECT_BETA_READINESS"/);
    expect(sentinelJob).toMatch(/"\$R_DEPLOYMENT_GATE"\s+"\$EXPECT_DEPLOYMENT_GATE"/);
  });

  it('no other job is gated on docsOnly: only the beta gate and the Deployment Gate may skip', () => {
    const gated = [...workflow.matchAll(/\n {4}if: [^\n]*docsOnly[^\n]*/g)];
    expect(gated).toHaveLength(2);
  });

  it('defaults docsOnly to false first and writes true once, after every path passed', () => {
    const script = detectScript();
    const falseAt = script.indexOf("echo 'docsOnly=false'");
    const trueAt = script.indexOf("echo 'docsOnly=true'");
    expect(falseAt).toBeGreaterThan(-1);
    expect(falseAt).toBeLessThan(trueAt);
    expect(script.match(/docsOnly=true/g)).toHaveLength(1);
    expect(script).toMatch(/\*\.md \| docs\/\*\) ;;/);
  });
});

describe('the changes job script, run for real', () => {
  const git = (cwd, ...args) => {
    const r = spawnSync('git', ['-c', 'user.email=a@b.c', '-c', 'user.name=t', ...args], {
      cwd,
      env: cleanEnv(),
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    return r.stdout.trim();
  };

  let tmp;
  let work;
  let scriptPath;
  let runCount = 0;

  const commitAndPush = (files, message = 'change') => {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(work, rel)), { recursive: true });
      writeFileSync(path.join(work, rel), text);
    }
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', message);
    git(work, 'push', '-q', 'origin', 'HEAD:refs/heads/master');
    return git(work, 'rev-parse', 'HEAD');
  };

  const head = () => git(work, 'rev-parse', 'HEAD');

  const run = (before, event = 'push') => {
    runCount += 1;
    const out = path.join(tmp, `out-${runCount}`);
    writeFileSync(out, '');
    const r = spawnSync('bash', [scriptPath], {
      cwd: work,
      env: {
        ...cleanEnv(),
        ...Object.fromEntries([
          ['GITHUB_OUTPUT', out],
          ['RUNNER_TEMP', tmp],
          ['eventName', event],
          ['pushBefore', before],
          ['prBase', before],
        ]),
      },
      encoding: 'utf8',
      timeout: 30_000,
    });
    expect(r.status).toBe(0);
    const lines = readFileSync(out, 'utf8').trim().split('\n');
    return lines[lines.length - 1];
  };

  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'notesOnly-'));
    const remote = path.join(tmp, 'remote.git');
    work = path.join(tmp, 'work');
    git(tmp, 'init', '-q', '--bare', remote);
    git(tmp, 'clone', '-q', remote, work);
    scriptPath = path.join(tmp, 'detect.sh');
    writeFileSync(scriptPath, detectScript());
    commitAndPush({ 'README.md': 'a\n', 'docs/a.txt': 'a\n', 'src/code.mjs': 'a\n' }, 'base');
  });

  afterAll(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('Markdown anywhere plus anything under docs/ -> docsOnly=true', () => {
    const before = head();
    commitAndPush({ 'README.md': 'b\n', 'notes/deep/x.md': 'b\n', 'docs/a.txt': 'b\n' });
    expect(run(before)).toBe('docsOnly=true');
    expect(run(before, 'pull_request')).toBe('docsOnly=true');
  });

  it('any code path, even next to Markdown -> docsOnly=false', () => {
    const before = head();
    commitAndPush({ 'README.md': 'c\n', 'src/code.mjs': 'c\n' });
    expect(run(before)).toBe('docsOnly=false');
  });

  it('a code change in an earlier commit of a multi-commit push -> docsOnly=false', () => {
    const before = head();
    commitAndPush({ 'src/code.mjs': 'd\n' });
    commitAndPush({ 'README.md': 'd\n' });
    expect(run(before)).toBe('docsOnly=false');
  });

  it('lookalikes that are not Markdown and not under docs/ -> docsOnly=false', () => {
    for (const rel of ['readme.txt', 'package.json', 'docsx/a.md.js', 'src/docs/a.mjs']) {
      const before = head();
      commitAndPush({ [rel]: `${rel}\n` });
      expect(run(before)).toBe('docsOnly=false');
    }
  });

  it('fails open: empty diff, zero/garbage/unfetchable base, schedule or dispatch event -> docsOnly=false', () => {
    expect(run(head())).toBe('docsOnly=false');
    expect(run('0'.repeat(40))).toBe('docsOnly=false');
    expect(run('')).toBe('docsOnly=false');
    expect(run('not-a-sha')).toBe('docsOnly=false');
    expect(run('deadbeef'.repeat(5))).toBe('docsOnly=false');
    const before = head();
    commitAndPush({ 'README.md': 'e\n' });
    expect(run(before, 'schedule')).toBe('docsOnly=false');
    expect(run(before, 'workflow_dispatch')).toBe('docsOnly=false');
  });
});
