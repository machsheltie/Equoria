/**
 * Equoria-puj1e.1 - doctrine: every staff route carries a capability guard.
 * Planted route files live in an OS temp dir and are fed to the exported
 * scanner; the real staff routes tree must pass.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CHECK = path.resolve(process.cwd(), '..', 'scripts', 'doctrine-checks', 'check-staff-routes-guarded.mjs');

let scanStaffRoutes;
let tmp;

const plant = (name, body) => {
  const dir = mkdtempSync(path.join(tmp, 'case-'));
  writeFileSync(path.join(dir, name), body);
  return dir;
};

beforeAll(async () => {
  ({ scanStaffRoutes } = await import(pathToFileURL(CHECK).href));
  tmp = mkdtempSync(path.join(tmpdir(), 'equoria-staff-guard-'));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('check-staff-routes-guarded', () => {
  test('names an unguarded route with file:line', () => {
    const dir = plant('a.mjs', "import x from 'y';\nrouter.post('/x', handler);\n");
    const failures = scanStaffRoutes(dir);
    expect(failures).toHaveLength(1);
    expect(failures[0].file).toBe(path.join(dir, 'a.mjs'));
    expect(failures[0].line).toBe(2);
    expect(failures[0].reason).toContain('POST /x');
  });

  test('a guard name only in a comment or string does not satisfy the check', () => {
    const dir = plant(
      'b.mjs',
      [
        "router.get('/a', /* requireStaffCapability('x') */ handler);",
        "router.get('/b', handler); // requireStaffCapability('x')",
        "router.get('/c', 'requireStaffCapability(', handler);",
      ].join('\n'),
    );
    expect(scanStaffRoutes(dir).map(f => f.line)).toEqual([1, 2, 3]);
  });

  test('requireStaffRole is rejected off the check-in paths, allowed on the three exempt ones', () => {
    const bad = plant('c.mjs', "router.get('/roles', requireStaffRole, handler);\n");
    expect(scanStaffRoutes(bad)).toHaveLength(1);
    const wrongMethod = plant('c2.mjs', "router.get('/checkin/request', requireStaffRole, h);\n");
    expect(scanStaffRoutes(wrongMethod)).toHaveLength(1);
    const ok = plant(
      'c3.mjs',
      [
        "router.post('/checkin/request', requireStaffRole, h);",
        "router.post('/checkin/verify', requireStaffRole, h);",
        "router.get('/me', requireStaffRole, h);",
      ].join('\n'),
    );
    expect(scanStaffRoutes(ok)).toEqual([]);
  });

  test('requireAnyStaffCapability passes', () => {
    const dir = plant('d.mjs', "router.get('/t', requireAnyStaffCapability(['a', 'b']), h);\n");
    expect(scanStaffRoutes(dir)).toEqual([]);
  });

  test('a multi-line call with the guard on a later line passes', () => {
    const dir = plant(
      'e.mjs',
      "router.post(\n  '/multi',\n  validate({ a: 1 }),\n  requireStaffCapability(\n    'roles.manage'\n  ),\n  handler\n);\n",
    );
    expect(scanStaffRoutes(dir)).toEqual([]);
  });

  test('router.use and router.route are reported as unsupported', () => {
    const dir = plant(
      'f.mjs',
      "router.use(subRouter);\nrouter.route('/z').get(h);\nrouter.use(requireStaffCapability('a'));\n",
    );
    expect(scanStaffRoutes(dir).map(f => f.line)).toEqual([1, 2]);
  });

  test('a missing routes directory is a failure, not a vacuous pass', () => {
    expect(scanStaffRoutes(path.join(tmp, 'nope'))).toHaveLength(1);
  });

  test('the real staff routes tree passes', () => {
    expect(scanStaffRoutes()).toEqual([]);
  });
});
