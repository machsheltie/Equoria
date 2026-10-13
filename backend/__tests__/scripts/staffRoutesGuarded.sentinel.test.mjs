/**
 * Equoria-puj1e.1 / STAFF-CR-05 - doctrine: every staff route carries a
 * capability guard. Planted route files live in an OS temp dir laid out as
 * <case>/routes/<file>, so the scanner's expected guard module is
 * <case>/middleware/requireStaffCapability.mjs and snippets import it the same
 * way the real routes do. The real staff routes tree must pass.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

// Lines 1-3 of every planted file; the first snippet line is line 4.
const HEADER = [
  "import express from 'express';",
  'import { requireStaffCapability, requireAnyStaffCapability, requireStaffRole } from ' +
    "'../middleware/requireStaffCapability.mjs';",
  'const router = express.Router();',
];
const file = (...lines) => `${[...HEADER, ...lines].join('\n')}\n`;
const IMPORTS_ONLY = (...lines) => `${[HEADER[0], HEADER[1], ...lines].join('\n')}\n`;

/** Plant files into <tmp>/case-*\/routes and return that routes dir. */
const plantMany = files => {
  const routes = path.join(mkdtempSync(path.join(tmp, 'case-')), 'routes');
  mkdirSync(routes);
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(path.join(routes, name), body);
  }
  return routes;
};
const plant = (name, body) => plantMany({ [name]: body });
const scan = (name, body) => scanStaffRoutes(plant(name, body));
const lines = failures => failures.map(f => f.line);

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
    const dir = plant('a.mjs', file("router.post('/x', handler);"));
    const failures = scanStaffRoutes(dir);
    expect(failures).toHaveLength(1);
    expect(failures[0].file).toBe(path.join(dir, 'a.mjs'));
    expect(failures[0].line).toBe(4);
    expect(failures[0].reason).toContain('POST /x');
  });

  test('guard text inside comments, strings and templates does not count', () => {
    const failures = scan(
      'text.mjs',
      file(
        "router.get('/a', /* requireStaffCapability('x') */ handler);",
        "router.get('/b', handler); // requireStaffCapability('x')",
        "router.get('/c', 'requireStaffCapability(\"x\")', handler);",
        "router.get('/d', `${requireStaffCapability}('x')`, handler);",
      ),
    );
    expect(lines(failures)).toEqual([4, 5, 6, 7]);
  });

  test('requireStaffRole is rejected off the check-in paths, allowed on the three exempt ones', () => {
    expect(scan('c.mjs', file("router.get('/roles', requireStaffRole, handler);"))).toHaveLength(1);
    expect(scan('c2.mjs', file("router.get('/checkin/request', requireStaffRole, h);"))).toHaveLength(1);
    const ok = file(
      "router.post('/checkin/request', requireStaffRole, h);",
      "router.post('/checkin/verify', requireStaffRole, h);",
      "router.get('/me', requireStaffRole, h);",
    );
    expect(scan('c3.mjs', ok)).toEqual([]);
  });

  test('requireAnyStaffCapability with a literal list passes', () => {
    expect(scan('d.mjs', file("router.get('/t', requireAnyStaffCapability(['a', 'b']), h);"))).toEqual([]);
  });

  test('a supported multi-line route on an aliased Router passes', () => {
    const body = IMPORTS_ONLY(
      'const desk = express.Router();',
      'desk.post(',
      "  '/tickets/:id/replies',",
      "  requireAnyStaffCapability(['ticket.file', 'ticket.resolve']),",
      '  validate({ body: 1 }),',
      '  replyToTicket,',
      ');',
      'export default desk;',
    );
    expect(scan('multi.mjs', body)).toEqual([]);
  });

  test('router.use passes only when every argument is a direct capability guard', () => {
    const failures = scan(
      'use.mjs',
      file(
        "router.use(requireStaffCapability('roles.manage'));",
        'router.use(subRouter);',
        "router.use('/sub', requireStaffCapability('roles.manage'), subRouter);",
        "router.use(noop(requireStaffCapability('roles.manage')));",
        'router.use(requireStaffRole);',
      ),
    );
    expect(lines(failures)).toEqual([5, 6, 7, 8]);
  });

  test('router.route and chained registrations fail', () => {
    const failures = scan(
      'route.mjs',
      file(
        "router.route('/z').get(requireStaffCapability('roles.manage'), handler);",
        "router.get('/a', requireStaffCapability('roles.manage'), handler).post('/b', handler);",
      ),
    );
    expect(lines(failures)).toEqual([4, 5]);
  });

  test('a missing routes directory is a failure, not a vacuous pass', () => {
    expect(scanStaffRoutes(path.join(tmp, 'nope'))).toHaveLength(1);
  });

  test('the real staff routes tree passes', () => {
    expect(scanStaffRoutes()).toEqual([]);
  });
});

describe('check-staff-routes-guarded: misplaced or disguised guards', () => {
  test('a guard placed after the terminal handler fails', () => {
    const failures = scan('after.mjs', file("router.post('/x', handler, requireStaffCapability('roles.manage'));"));
    expect(lines(failures)).toEqual([4]);
    expect(failures[0].reason).toContain('POST /x');
  });

  test('a non-guard middleware before the guard fails (handler, guard, handler)', () => {
    const failures = scan(
      'before.mjs',
      file(
        "router.post('/x', (req, res) => res.send('pwned'), requireStaffCapability('roles.manage'), done);",
        "router.post('/y', validate({ a: 1 }), requireStaffCapability('roles.manage'), done);",
      ),
    );
    expect(lines(failures)).toEqual([4, 5]);
    expect(failures[0].reason).toContain('first argument after the path');
  });

  test('a guard wrapped in another call or given a non-literal capability fails', () => {
    const failures = scan(
      'wrap.mjs',
      file(
        "router.post('/x', noop(requireStaffCapability('roles.manage')), handler);",
        "router.get('/y', requireStaffCapability(...['roles.manage']), handler);",
        "router.get('/z', requireStaffCapability(CAP), handler);",
        "router.get('/w', requireAnyStaffCapability(PARTIES), handler);",
      ),
    );
    expect(lines(failures)).toEqual([4, 5, 6, 7]);
  });

  test('computed methods and spread arguments fail', () => {
    const failures = scan(
      'computed.mjs',
      file(
        "router['post']('/x', requireStaffCapability('roles.manage'), handler);",
        "router[method]('/y', requireStaffCapability('roles.manage'), handler);",
        "router.get('/z', ...[requireStaffCapability('roles.manage'), handler]);",
      ),
    );
    expect(lines(failures)).toEqual([4, 5, 6]);
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
    expect(failures.some(f => f.line === 4 && f.reason.includes('GET /x'))).toBe(true);
  });

  test('an unimported guard name (globalThis spoof) is not a guard', () => {
    const failures = scan(
      'global.mjs',
      [
        "import express from 'express';",
        'globalThis.requireStaffCapability = () => (req, res, next) => next();',
        'const router = express.Router();',
        "router.get('/x', requireStaffCapability('roles.manage'), handler);",
      ].join('\n'),
    );
    expect(lines(failures)).toEqual([4]);
  });

  test('a guard imported from a path that only ends like the middleware fails', () => {
    const failures = scan(
      'fake.mjs',
      [
        "import express from 'express';",
        "import { requireStaffCapability } from '../../elsewhere/middleware/requireStaffCapability.mjs';",
        'const router = express.Router();',
        "router.get('/x', requireStaffCapability('roles.manage'), handler);",
      ].join('\n'),
    );
    expect(failures.some(f => f.line === 4 && f.reason.includes('GET /x'))).toBe(true);
  });
});

describe('check-staff-routes-guarded: only recognized Routers may register routes', () => {
  test('a Router under any variable name is scanned', () => {
    const failures = scan(
      'alias.mjs',
      IMPORTS_ONLY(
        'const staff = express.Router();',
        "staff.post('/x', handler);",
        "staff.get('/ok', requireStaffCapability('roles.manage'), handler);",
      ),
    );
    expect(lines(failures)).toEqual([4]);
    expect(failures[0].reason).toContain('POST /x');
    const named = scan(
      'named.mjs',
      "import { Router } from 'express';\nconst desk = Router();\ndesk.get('/x', handler);\n",
    );
    expect(lines(named)).toEqual([3]);
  });

  // Each escape registers an unguarded route on its line 4 (or later); the
  // route call itself must be reported, not merely something else in the file.
  test.each([
    [
      'a Router factory taken by reference',
      'const make = express.Router;',
      'const r = make();',
      "r.post('/x', handler);",
    ],
    ["a computed express['Router']() factory", "const r = express['Router']();", "r.post('/x', handler);"],
    ['a sequence-wrapped (0, express.Router)() factory', 'const r = (0, express.Router)();', "r.post('/x', handler);"],
    [
      'a Router destructured from express',
      'const { Router: R } = express;',
      'const r = R();',
      "r.post('/x', handler);",
    ],
    ['an express() app', 'const app = express();', "app.post('/x', handler);"],
    ['an imported router', "import { staffRouter } from './other.mjs';", "staffRouter.post('/x', handler);"],
  ])('%s fails', (_name, ...snippet) => {
    const failures = scan('escape.mjs', IMPORTS_ONLY(...snippet));
    const routeLine = 2 + snippet.length;
    expect(lines(failures)).toContain(routeLine);
  });

  test('a Router passed, aliased, re-exported or created inline fails', () => {
    const failures = scan(
      'escape.mjs',
      file('mount(router);', 'const other = router;', 'export { router };', 'export const inline = express.Router();'),
    );
    expect(lines(failures)).toEqual([4, 5, 6, 7]);
  });
});

describe('check-staff-routes-guarded: files', () => {
  test('.js and .cjs route files are scanned too', () => {
    const dir = plantMany({
      'a.js': file("router.post('/x', handler);"),
      'b.cjs': file("router.post('/y', handler);"),
    });
    expect(
      scanStaffRoutes(dir)
        .map(f => path.basename(f.file))
        .sort(),
    ).toEqual(['a.js', 'b.cjs']);
  });

  test('any other file type in the routes directory fails', () => {
    const dir = plantMany({ 'ok.mjs': file(), 'extra.ts': 'export {};\n' });
    const failures = scanStaffRoutes(dir);
    expect(failures.map(f => path.basename(f.file))).toEqual(['extra.ts']);
  });

  test('a file that does not parse fails closed', () => {
    const failures = scan('broken.mjs', file("router.get('/x', (;"));
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toMatch(/parse/i);
  });
});
