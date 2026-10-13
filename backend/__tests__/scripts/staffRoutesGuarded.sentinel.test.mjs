/**
 * Equoria-puj1e.1 - doctrine: every staff route carries a capability guard.
 * Planted route files live in an OS temp dir and are fed to the exported
 * scanner; the real staff routes tree must pass.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolved from this file, not process.cwd(): the root `npm run test:backend`
// runs from the repo root, the targeted script from backend/.
const CHECK = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'scripts',
  'doctrine-checks',
  'check-staff-routes-guarded.mjs',
);

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
  if (tmp) {
    rmSync(tmp, { recursive: true, force: true });
  }
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

// STAFF-CR-05: the scanner reads the AST, so each of these shapes is judged by
// structure rather than by whether a guard name appears somewhere in the text.
describe('check-staff-routes-guarded: AST route analysis (STAFF-CR-05)', () => {
  const IMPORTS = [
    "import express from 'express';",
    "import { requireStaffCapability, requireAnyStaffCapability, requireStaffRole } from '../middleware/requireStaffCapability.mjs';",
  ].join('\n');
  const file = (...lines) => `${IMPORTS}\n${lines.join('\n')}\n`;
  const scan = (name, body) => scanStaffRoutes(plant(name, body));

  test('a guard placed after the terminal handler fails', () => {
    const failures = scan(
      'after.mjs',
      file('const router = express.Router();', "router.post('/x', handler, requireStaffCapability('roles.manage'));"),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].line).toBe(4);
    expect(failures[0].reason).toContain('POST /x');
  });

  test('a guard wrapped in another call (a no-op wrapper can discard it) fails', () => {
    const failures = scan(
      'wrap.mjs',
      file(
        'const router = express.Router();',
        "router.post('/x', noop(requireStaffCapability('roles.manage')), handler);",
        "router.get('/y', requireStaffCapability(...['roles.manage']), handler);",
        "router.get('/z', requireStaffCapability(CAP), handler);",
        "router.get('/w', requireAnyStaffCapability(PARTIES), handler);",
      ),
    );
    expect(failures.map(f => f.line)).toEqual([4, 5, 6, 7]);
  });

  test('a Router under any variable name is scanned', () => {
    const failures = scan(
      'alias.mjs',
      file(
        'const staff = express.Router();',
        "staff.post('/x', handler);",
        "staff.get('/ok', requireStaffCapability('roles.manage'), handler);",
      ),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].line).toBe(4);
    expect(failures[0].reason).toContain('POST /x');
    const named = scan(
      'named.mjs',
      "import { Router } from 'express';\nconst desk = Router();\ndesk.get('/x', handler);\n",
    );
    expect(named.map(f => f.line)).toEqual([3]);
  });

  test('computed methods and spread arguments fail', () => {
    const failures = scan(
      'computed.mjs',
      file(
        'const router = express.Router();',
        "router['post']('/x', requireStaffCapability('roles.manage'), handler);",
        "router[method]('/y', requireStaffCapability('roles.manage'), handler);",
        "router.get('/z', ...[requireStaffCapability('roles.manage'), handler]);",
      ),
    );
    expect(failures.map(f => f.line)).toEqual([4, 5, 6]);
  });

  test('a supported multi-line route on an aliased Router passes', () => {
    const failures = scan(
      'multi.mjs',
      file(
        'const desk = express.Router();',
        'desk.post(',
        "  '/tickets/:id/replies',",
        '  validate({ body: 1 }),',
        "  requireAnyStaffCapability(['ticket.file', 'ticket.resolve']),",
        '  replyToTicket,',
        ');',
        'export default desk;',
      ),
    );
    expect(failures).toEqual([]);
  });

  test('guard text inside comments, strings and templates does not count', () => {
    const failures = scan(
      'text.mjs',
      file(
        'const router = express.Router();',
        "router.get('/a', /* requireStaffCapability('x') */ handler);",
        "router.get('/b', handler); // requireStaffCapability('x')",
        "router.get('/c', 'requireStaffCapability(\"x\")', handler);",
        "router.get('/d', `${requireStaffCapability}('x')`, handler);",
      ),
    );
    expect(failures.map(f => f.line)).toEqual([4, 5, 6, 7]);
  });

  test('router.use passes only when every argument is a direct capability guard', () => {
    const failures = scan(
      'use.mjs',
      file(
        'const router = express.Router();',
        "router.use(requireStaffCapability('roles.manage'));",
        'router.use(subRouter);',
        "router.use('/sub', requireStaffCapability('roles.manage'), subRouter);",
        "router.use(noop(requireStaffCapability('roles.manage')));",
        'router.use(requireStaffRole);',
      ),
    );
    expect(failures.map(f => f.line)).toEqual([5, 6, 7, 8]);
  });

  test('router.route and chained registrations fail', () => {
    const failures = scan(
      'route.mjs',
      file(
        'const router = express.Router();',
        "router.route('/z').get(requireStaffCapability('roles.manage'), handler);",
        "router.get('/a', requireStaffCapability('roles.manage'), handler).post('/b', handler);",
      ),
    );
    expect(failures.map(f => f.line)).toEqual([4, 5]);
  });

  test('a Router passed, aliased, re-exported or created inline fails', () => {
    const failures = scan(
      'escape.mjs',
      file(
        'const router = express.Router();',
        'mount(router);',
        'const other = router;',
        'export { router };',
        'export const inline = express.Router();',
      ),
    );
    expect(failures.map(f => f.line)).toEqual([4, 5, 6, 7]);
  });

  test('a locally redefined guard name is not a guard', () => {
    const failures = scan(
      'shadow.mjs',
      [
        "import express from 'express';",
        'const requireStaffCapability = () => (req, res, next) => next();',
        'const router = express.Router();',
        "router.get('/x', requireStaffCapability('roles.manage'), handler);",
      ].join('\n'),
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.some(f => f.line === 4 && f.reason.includes('GET /x'))).toBe(true);
  });

  test('a file that does not parse fails closed', () => {
    const failures = scan('broken.mjs', "const router = express.Router();\nrouter.get('/x', (;\n");
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toMatch(/parse/i);
  });
});
