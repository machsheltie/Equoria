/**
 * Sentinel test (Equoria-h3sij): utils/agent-skills/context-packager.mjs must
 * FAIL LOUD on a genuine grep shell-out failure.
 *
 * Root cause this guards against: the prior script wrapped the whole body in
 * one try/catch whose handler printed "Error searching for files." and then
 * exited 0 — so a failed `grep` shell-out (grep missing, unreadable tree,
 * bad invocation) produced a reassuring message and a SUCCESS exit code with
 * an empty/partial context bundle. Same false-green class as the Equoria-lq5li
 * auditor bug (CLAUDE.md Sections 2/3, EDGE_CASE_FIX_DISCIPLINE Section 3
 * fail-closed).
 *
 * The fix hinges on classifyGrepError(): `grep -r -l` exits 1 for the BENIGN
 * "zero matches" case and >= 2 (or ENOENT when the binary is missing) for a
 * REAL failure. The script tolerates exit-1 loudly (empty bundle is honest)
 * but on any genuine failure it prints "CONTEXT PACKAGER FAILED" to stderr and
 * process.exit(1)s. classifyGrepError is the decision point that determines
 * that exit code, so it is the unit under test here. (A subprocess
 * force-failure is not deterministic cross-platform: POSIX `sh` returns 127
 * for a missing grep while Windows `cmd` returns 1, which would alias the
 * benign no-match code — so the decision function, not the shell, is the
 * reliable sentinel surface.)
 *
 * Importing the module at all also proves the main-module guard works: without
 * it, importing with no CLI arg would call process.exit(1) and abort the
 * runner.
 */

import { classifyGrepError, packageContext } from '../../utils/agent-skills/context-packager.mjs';

describe('context-packager — classifyGrepError fail-loud boundary (Equoria-h3sij)', () => {
  test('SENTINEL-POSITIVE: a genuine grep failure (exit >= 2) classifies as failure', () => {
    // grep exit 2 = "an error occurred" (bad option, unreadable file, etc.).
    // This is the case that MUST NOT be swallowed into a green empty bundle.
    expect(classifyGrepError({ status: 2 })).toBe('failure');
    expect(classifyGrepError({ status: 3 })).toBe('failure');
    expect(classifyGrepError({ status: 127 })).toBe('failure'); // POSIX sh: command not found
  });

  test('SENTINEL-POSITIVE: a missing grep binary (ENOENT) classifies as failure', () => {
    expect(classifyGrepError({ code: 'ENOENT' })).toBe('failure');
  });

  test('SENTINEL-POSITIVE: a process killed by signal (no numeric status) classifies as failure', () => {
    expect(classifyGrepError({ status: null, signal: 'SIGKILL' })).toBe('failure');
  });

  test('SENTINEL-POSITIVE: a malformed/unknown error object classifies as failure (fail closed)', () => {
    expect(classifyGrepError({})).toBe('failure');
    expect(classifyGrepError(undefined)).toBe('failure');
    expect(classifyGrepError(null)).toBe('failure');
  });

  test('SENTINEL-NEGATIVE: grep exit 1 (zero matches) is the ONLY benign case', () => {
    // The one code that legitimately means "no files matched the keyword" —
    // an empty bundle here is honest, not a failure, so the script keeps
    // going and exits 0. Boundary: exactly 1, nothing adjacent.
    expect(classifyGrepError({ status: 1 })).toBe('no-matches');
    expect(classifyGrepError({ status: 0 })).toBe('failure'); // 0 would not throw, but if seen, not no-match
  });
});

describe('context-packager — module shape / main-module guard (Equoria-h3sij)', () => {
  test('exports the fail-loud classifier and the packager without running the CLI on import', () => {
    // The mere fact this import resolved (top of file) proves the
    // main-module guard prevented the CLI body from calling process.exit(1)
    // for the missing feature-keyword arg.
    expect(typeof classifyGrepError).toBe('function');
    expect(typeof packageContext).toBe('function');
  });
});
