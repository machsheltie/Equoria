/**
 * Fail a full vitest run when a configured project executed nothing
 * (Equoria-bnwip).
 *
 * The false-green shape this closes: on 2026-08-19 an identical
 * `npm run test:run` dropped the whole `storybook` browser project (~239
 * tests) and still exited 0, with no skip notice and no error. A green exit
 * code therefore stopped proving the browser project ran. Vitest itself is
 * happy to run "the projects that produced files"; this reporter is the check
 * that says "every project you configured must have produced a test module".
 *
 * Scope, deliberately narrow:
 *  - It only runs the check in run mode (not watch), because a watch re-run
 *    legitimately touches one file.
 *  - It stands down when the run was narrowed on purpose: file filters,
 *    `--changed`, `--related`, or `--shard`. A project with no matching file is
 *    expected to be absent then. `--project` needs no special case: Vitest
 *    already removes unselected projects from `ctx.projects`.
 *  - It never starts a browser or touches the environment. It only compares
 *    the projects Vitest configured against the modules it actually ran, so it
 *    is safe where a browser is unsupported (that project then fails on its
 *    own, loudly, instead of vanishing).
 *
 * A failing check sets `process.exitCode = 1` — the same mechanism Vitest's
 * own run-end uses — and prints which projects produced no tests.
 */
import type { Reporter, Vitest } from 'vitest/node';

/** The subset of the Vitest context this reporter reads (kept narrow for tests). */
export interface RunContext {
  /**
   * File filters given on the command line (`vitest run path/to/file`). Vitest
   * keeps them on the context, not on `config`, and marks the field internal;
   * the spawned-run tests below fail if a Vitest upgrade moves it.
   */
  filenamePattern?: string[];
  config: {
    watch?: boolean;
    changed?: boolean | string;
    related?: string[];
    shard?: unknown;
  };
  projects: Array<{ name: string }>;
}

/**
 * True when the user deliberately narrowed which files run, so an absent
 * project is not evidence of a dropped one.
 */
export function isNarrowedRun(ctx: Pick<RunContext, 'filenamePattern' | 'config'>): boolean {
  const { config } = ctx;
  return Boolean(
    (ctx.filenamePattern && ctx.filenamePattern.length > 0) ||
    config.changed ||
    (config.related && config.related.length > 0) ||
    config.shard
  );
}

/**
 * Names of configured projects that produced no test module.
 *
 * A browser project with one instance may report as `name` or as
 * `name (instance)`, so a configured name also matches executed names that
 * start with `name (`.
 */
export function findMissingProjects(configured: string[], executed: Iterable<string>): string[] {
  const ran = Array.from(executed);
  return configured.filter(
    (name) => !ran.some((candidate) => candidate === name || candidate.startsWith(`${name} (`))
  );
}

const label = (name: string): string => (name === '' ? '(unnamed root project)' : name);

export function describeMissingProjects(missing: string[]): string {
  return [
    '',
    'FAIL  A configured vitest project executed no tests.',
    `      Missing: ${missing.map(label).join(', ')}`,
    '      An exit code of 0 would have hidden this (Equoria-bnwip). Run the project on its own',
    '      (for example `npx vitest run --project=storybook`) to see why it was dropped.',
    '',
  ].join('\n');
}

export default class RequireAllProjectsReporter implements Reporter {
  private ctx: RunContext | undefined;

  onInit(ctx: Vitest): void {
    this.ctx = ctx as unknown as RunContext;
  }

  onTestRunEnd(testModules: ReadonlyArray<{ project: { name: string } }>): void {
    const ctx = this.ctx;
    if (!ctx || ctx.config.watch || isNarrowedRun(ctx)) {
      return;
    }
    const missing = findMissingProjects(
      ctx.projects.map((project) => project.name),
      testModules.map((module) => module.project.name)
    );
    if (missing.length === 0) {
      return;
    }
    console.error(describeMissingProjects(missing));
    process.exitCode = 1;
  }
}
