/**
 * Sentinel — the OWASP ZAP workflow's Dependency Vulnerability Scan gates on
 * the expiry-tracked audit allowlist, not on raw npm audit counts
 * (Equoria-3csks).
 *
 * Before the fix the job exited 1 whenever `npm audit` reported any high or
 * critical package, so GHSA-vfj7-8cjw-p6xm (braces, no patched release, owner
 * accepted in scripts/audit-allowlist.json on 2026-10-15) reddened it on every
 * master push while the Quality Gate's Security Gate, which reads the same
 * allowlist, stayed clear of it. Two gates over one lockfile disagreed.
 *
 * A workflow is not importable, so this reads the file as text and checks the
 * dependency-scan job only. Raw text on purpose: no YAML parser is resolvable in
 * the backend-only CI jobs (see ciShardExclusivity.sentinel.test.mjs).
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = readFileSync(path.join(ROOT, '.github/workflows/security-scan.yml'), 'utf8');

const start = workflow.indexOf('\n  dependency-scan:');
const end = workflow.indexOf('\n  zap-scan:');
const job = workflow.slice(start, end);

// Slice of one "- name: Run npm audit (<side>)" step, up to the next step.
const auditStep = side => {
  const from = job.indexOf(`- name: Run npm audit (${side})`);
  const rest = job.slice(from + 1);
  const next = rest.search(/\n {6}- name: /);
  return rest.slice(0, next === -1 ? undefined : next);
};

describe('security-scan.yml dependency job gates on the audit allowlist (Equoria-3csks)', () => {
  it('found the dependency-scan job and both audit steps', () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(auditStep('backend')).toContain('npm audit --json');
    expect(auditStep('frontend')).toContain('npm audit --json');
  });

  it.each(['backend', 'frontend'])('the %s audit step runs the allowlist script at high', side => {
    expect(auditStep(side)).toMatch(
      /node \.\.\/scripts\/audit-with-allowlist\.mjs \. high \.\.\/scripts\/audit-allowlist\.json/,
    );
  });

  it.each(['backend', 'frontend'])('the %s audit step does not fail on a raw high or critical count', side => {
    expect(auditStep(side)).not.toMatch(/"\$(CRITICAL|HIGH)" -gt 0/);
  });

  it.each(['backend', 'frontend'])('the %s audit step propagates the allowlist script exit status', side => {
    const step = auditStep(side);
    expect(step).toContain('GATE_EXIT=$?');
    expect(step).toMatch(/exit "\$GATE_EXIT"/);
  });
});
