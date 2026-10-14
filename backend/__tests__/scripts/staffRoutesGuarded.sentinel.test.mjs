/**
 * Equoria-puj1e.1 / STAFF-CR-05 - doctrine: staff route files match an
 * allow-listed grammar, only backend/app/routers.mjs may import them, and
 * routers.mjs / app.mjs mount the staff Router in one pinned shape.
 *
 * Planted route files live in an OS temp dir laid out as <case>/routes/<file>,
 * so the scanner resolves guard imports to <case>/middleware/... and
 * controller imports to <case>/controllers/..., exactly as the real routes do.
 * The importer and mount checks run against an OS-temp mirror of backend/;
 * the mount cases start from copies of the real routers.mjs and app.mjs.
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Resolved from this file, not process.cwd(): the root `npm run test:backend`
// runs from the repo root, the targeted script from backend/.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.resolve(HERE, '..', '..', '..', 'scripts', 'doctrine-checks', 'check-staff-routes-guarded.mjs');
const MOUNT_CHECK = path.resolve(HERE, '..', '..', '..', 'scripts', 'doctrine-checks', 'check-staff-routes-mount.mjs');
const BACKEND = path.resolve(HERE, '..', '..');
const REAL_ROUTES_FILE = path.resolve(HERE, '..', '..', 'modules', 'staff', 'routes', 'staffRoutes.mjs');

let scanStaffRoutes;
let scanRouteImporters;
let scanStaffMount;
let tmp;

const IMPORT_EXPRESS = "import express from 'express';";
const IMPORT_GUARDS =
  'import { requireStaffCapability, requireAnyStaffCapability, requireStaffRole } from ' +
  "'../middleware/requireStaffCapability.mjs';";
const IMPORT_CONTROLLERS = "import { handler, h, done, replyToTicket } from '../controllers/staffController.mjs';";
// Lines 1-4 of every planted file; the first snippet line is line 5. The file
// ends with `export default router;`.
const HEADER = [IMPORT_EXPRESS, IMPORT_GUARDS, IMPORT_CONTROLLERS, 'const router = express.Router();'];
const file = (...lines) => `${[...HEADER, ...lines, 'export default router;'].join('\n')}\n`;

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
  ({ scanStaffRoutes, scanRouteImporters } = await import(pathToFileURL(CHECK).href));
  ({ scanStaffMount } = await import(pathToFileURL(MOUNT_CHECK).href));
  tmp = mkdtempSync(path.join(tmpdir(), 'equoria-staff-guard-'));
});

afterAll(() => {
  if (tmp) {
    rmSync(tmp, { recursive: true, force: true });
  }
});

describe('check-staff-routes-guarded: guards', () => {
  test('names an unguarded route with file:line', () => {
    const dir = plant('a.mjs', file("router.post('/x', handler);"));
    const failures = scanStaffRoutes(dir);
    expect(failures).toHaveLength(1);
    expect(failures[0].file).toBe(path.join(dir, 'a.mjs'));
    expect(failures[0].line).toBe(5);
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
    expect(lines(failures)).toEqual([5, 6, 7, 8]);
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
    const body = [
      IMPORT_EXPRESS,
      IMPORT_GUARDS,
      "import { replyToTicket } from '../controllers/x.mjs';",
      'const desk = express.Router({ mergeParams: true });',
      'desk.post(',
      "  '/tickets/:id/replies',",
      "  requireAnyStaffCapability(['ticket.file', 'ticket.resolve']),",
      '  replyToTicket,',
      ');',
      'export default desk;',
    ].join('\n');
    expect(scan('multi.mjs', body)).toEqual([]);
  });

  test('a guard placed after the terminal handler fails', () => {
    const failures = scan('after.mjs', file("router.post('/x', handler, requireStaffCapability('roles.manage'));"));
    expect(lines(failures)).toEqual([5]);
    expect(failures[0].reason).toContain('POST /x');
  });

  test('a non-guard middleware before the guard fails (handler, guard, handler)', () => {
    const failures = scan(
      'before.mjs',
      file(
        "router.post('/x', (req, res) => res.send('pwned'), requireStaffCapability('roles.manage'), done);",
        "router.post('/y', handler, requireStaffCapability('roles.manage'), done);",
      ),
    );
    expect(lines(failures)).toEqual([5, 6]);
    expect(failures[1].reason).toContain('first argument after the path');
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
    expect(lines(failures)).toEqual([5, 6, 7, 8]);
  });

  test('a handler that is not a controller import, a call or an inline function fails', () => {
    const failures = scan(
      'handlers.mjs',
      file(
        "router.get('/a', requireStaffCapability('a'), someGlobal);",
        "router.get('/b', requireStaffCapability('a'), validate({ a: 1 }), handler);",
        "router.get('/c', requireStaffCapability('a'), (req, res) => res.send('x'));",
      ),
    );
    expect(lines(failures)).toEqual([5, 6, 7]);
  });

  test('a locally redefined guard name is not a guard', () => {
    const failures = scan(
      'shadow.mjs',
      [
        IMPORT_EXPRESS,
        IMPORT_CONTROLLERS,
        'const requireStaffCapability = () => (req, res, next) => next();',
        'const router = express.Router();',
        "router.get('/x', requireStaffCapability('roles.manage'), handler);",
        'export default router;',
      ].join('\n'),
    );
    expect(lines(failures)).toEqual([3, 5]);
  });

  test('an unimported guard name (globalThis spoof) is not a guard', () => {
    const failures = scan(
      'global.mjs',
      [
        IMPORT_EXPRESS,
        IMPORT_CONTROLLERS,
        'globalThis.requireStaffCapability = () => (req, res, next) => next();',
        'const router = express.Router();',
        "router.get('/x', requireStaffCapability('roles.manage'), handler);",
        'export default router;',
      ].join('\n'),
    );
    expect(lines(failures)).toEqual([3, 5]);
  });

  test('a guard imported from a path that only ends like the middleware fails', () => {
    const failures = scan(
      'fake.mjs',
      [
        IMPORT_EXPRESS,
        "import { requireStaffCapability } from '../../elsewhere/middleware/requireStaffCapability.mjs';",
        IMPORT_CONTROLLERS,
        'const router = express.Router();',
        "router.get('/x', requireStaffCapability('roles.manage'), handler);",
        'export default router;',
      ].join('\n'),
    );
    expect(lines(failures)).toEqual([2, 5]);
  });
});

describe('check-staff-routes-guarded: registration shapes', () => {
  test('router.use passes only when every argument is a direct capability guard', () => {
    const failures = scan(
      'use.mjs',
      file(
        "router.use(requireStaffCapability('roles.manage'));",
        'router.use(handler);',
        "router.use('/sub', requireStaffCapability('roles.manage'), handler);",
        "router.use(noop(requireStaffCapability('roles.manage')));",
        'router.use(requireStaffRole);',
      ),
    );
    expect(lines(failures)).toEqual([6, 7, 8, 9]);
  });

  test('router.route and chained registrations fail', () => {
    const failures = scan(
      'route.mjs',
      file(
        "router.route('/z').get(requireStaffCapability('roles.manage'), handler);",
        "router.get('/a', requireStaffCapability('roles.manage'), handler).post('/b', handler);",
      ),
    );
    expect(lines(failures)).toEqual([5, 6]);
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
    expect(lines(failures)).toEqual([5, 6, 7]);
  });

  test('a Router under any variable name is checked, including a named Router import', () => {
    const alias = [
      IMPORT_EXPRESS,
      IMPORT_GUARDS,
      IMPORT_CONTROLLERS,
      'const staff = express.Router();',
      "staff.post('/x', handler);",
      "staff.get('/ok', requireStaffCapability('roles.manage'), handler);",
      'export default staff;',
    ].join('\n');
    const failures = scan('alias.mjs', alias);
    expect(lines(failures)).toEqual([5]);
    expect(failures[0].reason).toContain('POST /x');
    const named = [
      "import { Router } from 'express';",
      IMPORT_CONTROLLERS,
      'const desk = Router();',
      "desk.get('/x', handler);",
      'export default desk;',
    ].join('\n');
    expect(lines(scan('named.mjs', named))).toEqual([4]);
  });

  test('a second Router, a missing Router and a missing default export fail', () => {
    expect(lines(scan('two.mjs', file('const other = express.Router();')))).toEqual([5]);
    const bare = [IMPORT_EXPRESS, IMPORT_GUARDS].join('\n');
    expect(
      scan('bare.mjs', bare)
        .map(f => f.reason)
        .join(' '),
    ).toMatch(/no `const <router>.*missing `export default/);
  });
});

// Every snippet line in these files is outside the grammar and must be reported
// on its own line (snippets start at line 5).
describe('check-staff-routes-guarded: grammar rejects every unrecognized shape', () => {
  test.each([
    [
      'an imported router (the mounted one)',
      "import realRouter from './staffRoutes.mjs';",
      "realRouter.post('/x', h);",
    ],
    [
      'Express methods outside get/post/put/patch/delete',
      "router.search('/x', requireStaffCapability('a'), h);",
      "router.purge('/x', requireStaffCapability('a'), h);",
      "router.copy('/x', requireStaffCapability('a'), h);",
      "router.propfind('/x', requireStaffCapability('a'), h);",
      "router.trace('/x', requireStaffCapability('a'), h);",
      "router.all('/x', requireStaffCapability('a'), h);",
    ],
    ['router.post.call', "router.post.call(router, '/x', h);"],
    ['a computed method by variable', "router[v]('/x', requireStaffCapability('a'), h);"],
    ['a computed method by template', "router[`post`]('/x', requireStaffCapability('a'), h);"],
    ['Reflect.apply on a route method', "Reflect.apply(router.post, router, ['/x', h]);"],
    ['a destructured route method', 'const { post } = router;', "post('/x', h);"],
    ['router.param', "router.param('id', h);"],
    ['a dynamic import()', "await import('./other.mjs');", "import('./other.mjs').then(m => m.default.post('/x', h));"],
    ['a namespace import of express', "import * as ex from 'express';"],
    ['a default-as import of express', "import { default as ex } from 'express';"],
    ['a Router from the router package', "import Router from 'router';"],
    [
      'createRequire',
      "import { createRequire } from 'node:module';",
      "const ex = createRequire(import.meta.url)('express');",
    ],
    ['a side-effect import', "import './other.mjs';"],
    ['a Router factory taken by reference', 'const make = express.Router;', 'const r = make();', "r.post('/x', h);"],
    ["a computed express['Router']() factory", "const r = express['Router']();", "r.post('/x', h);"],
    ['a sequence-wrapped (0, express.Router)() factory', 'const r = (0, express.Router)();', "r.post('/x', h);"],
    ['a Router destructured from express', 'const { Router: R } = express;', 'const r = R();', "r.post('/x', h);"],
    ['an express() app', 'const app = express();', "app.post('/x', h);"],
    ['a function declaration', 'function sneak() {}'],
    ['a Router passed, aliased or re-exported', 'mount(router);', 'const other = router;', 'export { router };'],
  ])('%s fails', (_name, ...snippet) => {
    const failures = scan('escape.mjs', file(...snippet));
    const expected = snippet.map((_, i) => 5 + i);
    expect(lines(failures)).toEqual(expected);
  });

  test('whole tree: an extras.mjs beside the real staffRoutes.mjs cannot register on the mounted Router', () => {
    const extras = [
      "import realRouter from './staffRoutes.mjs';",
      "realRouter.search('/x', h);",
      "realRouter.param('id', h);",
    ].join('\n');
    const dir = plantMany({ 'staffRoutes.mjs': readFileSync(REAL_ROUTES_FILE, 'utf8'), 'extras.mjs': extras });
    const failures = scanStaffRoutes(dir);
    expect(new Set(failures.map(f => path.basename(f.file)))).toEqual(new Set(['extras.mjs']));
    expect(lines(failures)).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  test('the real staff routes tree passes', () => {
    expect(scanStaffRoutes()).toEqual([]);
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
    expect(scanStaffRoutes(dir).map(f => path.basename(f.file))).toEqual(['extra.ts']);
  });

  test('a file that does not parse fails closed', () => {
    const failures = scan('broken.mjs', file("router.get('/x', (;"));
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toMatch(/parse/i);
  });

  test('a missing routes directory is a failure, not a vacuous pass', () => {
    expect(scanStaffRoutes(path.join(tmp, 'nope'))).toHaveLength(1);
  });
});

// Builds <tmp>/mirror-*/backend with the given relative files.
const mirror = files => {
  const root = path.join(mkdtempSync(path.join(tmp, 'mirror-')), 'backend');
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), body);
  }
  return root;
};

describe('check-staff-routes-guarded: importers of staff routes', () => {
  test('only app/routers.mjs may import staff routes', () => {
    const root = mirror({
      'modules/staff/routes/staffRoutes.mjs': 'export default 1;\n',
      'app/routers.mjs': "import r from '../modules/staff/routes/staffRoutes.mjs';\n",
      'modules/other/evil.mjs': "// sneaks a route on\nimport r from '../staff/routes/staffRoutes.mjs';\n",
      'modules/other/lazy.mjs': 'const m = await import(`../staff/routes/staffRoutes.mjs`);\n',
      'modules/other/__tests__/fine.test.mjs': "import r from '../../staff/routes/staffRoutes.mjs';\n",
    });
    const failures = scanRouteImporters(root);
    expect(failures.map(f => `${path.basename(f.file)}:${f.line}`).sort()).toEqual(['evil.mjs:2', 'lazy.mjs:1']);
  });

  test('import through the barrel: the staff barrel may not re-export the Router', () => {
    const root = mirror({
      'modules/staff/routes/staffRoutes.mjs': 'export default 1;\n',
      'modules/staff/index.mjs':
        "export * from './capabilities.mjs';\nexport { default as staffRoutes } from './routes/staffRoutes.mjs';\n",
      'modules/other/consumer.mjs': "import { staffRoutes } from '../staff/index.mjs';\nstaffRoutes.post('/x', h);\n",
    });
    const failures = scanRouteImporters(root);
    expect(failures.map(f => `${path.basename(f.file)}:${f.line}`)).toEqual(['index.mjs:2']);
  });

  test('the real backend has no other importer', () => {
    expect(scanRouteImporters()).toEqual([]);
  });
});

describe('check-staff-routes-mount: the staff Router is mounted once, in the pinned shape', () => {
  const REAL_ROUTERS = readFileSync(path.join(BACKEND, 'app', 'routers.mjs'), 'utf8');
  const REAL_APP = readFileSync(path.join(BACKEND, 'app.mjs'), 'utf8');
  const MOUNT = "  staffRouter.use('/', staffRoutes);\n";
  const APP_MOUNT = "app.use('/api/v1/staff', staffRouter);\n";
  const TERMINAL = '  staffRouter.use(createNotFoundHandler({ spaHtml: null, logger }));\n';

  /** Replace `from` with `to` (which must be present) and return [text, line of the edit]. */
  const edit = (text, from, to) => {
    const at = text.indexOf(from);
    expect(at).toBeGreaterThanOrEqual(0);
    return [text.replace(from, to), text.slice(0, at).split('\n').length];
  };
  const scanWith = ({ routers = REAL_ROUTERS, app = REAL_APP }) =>
    scanStaffMount(mirror({ 'app/routers.mjs': routers, 'app.mjs': app }));
  const where = failures => failures.map(f => `${path.basename(f.file)}:${f.line}`);

  test('the real routers.mjs and app.mjs pass, in place and mirrored', () => {
    expect(scanStaffMount()).toEqual([]);
    expect(scanWith({})).toEqual([]);
  });

  test.each([
    ['an extra route on staffRoutes', `${MOUNT}  staffRoutes.post('/x', h);\n`],
    ['an extra route on staffRouter', `${MOUNT}  staffRouter.post('/x', h);\n`],
    ['staffRoutes leaked to another binding', `${MOUNT}  globalThis.leak = staffRoutes;\n`],
    ['a /staff route on another router', `${MOUNT}  authRouter.post('/staff/x', h);\n`],
  ])('routers.mjs: %s fails on the added line', (_name, to) => {
    const [routers, line] = edit(REAL_ROUTERS, MOUNT, to);
    expect(where(scanWith({ routers }))).toContain(`routers.mjs:${line + 1}`);
  });

  // Added right after the terminal not-found use, i.e. as the new last line.
  test.each([
    ['a use() after the terminal not-found handler (terminal not last)', `${TERMINAL}  staffRouter.use(h);\n`],
    ['a /staff route given as an expression-free template', `${TERMINAL}  authRouter.post(\`/staff/x\`, h);\n`],
    ['a /STAFF route in another case', `${TERMINAL}  authRouter.post('/STAFF/x', h);\n`],
    ['an array path', `${TERMINAL}  authRouter.post(['/ok', '/staff/x'], h);\n`],
    ['a regex path', `${TERMINAL}  authRouter.post(/^\\/staff/, h);\n`],
  ])('routers.mjs: %s fails on the added line', (_name, to) => {
    const [routers, line] = edit(REAL_ROUTERS, TERMINAL, to);
    expect(where(scanWith({ routers }))).toContain(`routers.mjs:${line + 1}`);
  });

  test.each([
    ['the terminal not-found handler missing', TERMINAL, ''],
    ['the terminal handler given SPA html', TERMINAL, TERMINAL.replace('spaHtml: null', 'spaHtml')],
    ['a different terminal handler', TERMINAL, '  staffRouter.use((req, res) => res.sendStatus(404));\n'],
  ])('routers.mjs: %s fails on the mount line', (_name, from, to) => {
    const [routers] = edit(REAL_ROUTERS, from, to);
    const [, mountLine] = edit(routers, MOUNT, MOUNT);
    expect(where(scanWith({ routers }))).toContain(`routers.mjs:${mountLine}`);
  });

  test.each([
    ['csrfProtection dropped', '  staffRouter.use(csrfProtection);\n', ''],
    [
      'auth and CSRF swapped',
      '  staffRouter.use(authenticateToken);\n  staffRouter.use(csrfProtection);\n',
      '  staffRouter.use(csrfProtection);\n  staffRouter.use(authenticateToken);\n',
    ],
    [
      'options passed to the staff Router',
      '  const staffRouter = express.Router();\n',
      '  const staffRouter = express.Router({ caseSensitive: false });\n',
    ],
    [
      'staffRoutes imported through the barrel',
      "import staffRoutes from '../modules/staff/routes/staffRoutes.mjs';",
      "import { staffRoutes } from '../modules/staff/index.mjs';",
    ],
  ])('routers.mjs: %s fails', (_name, from, to) => {
    const [routers] = edit(REAL_ROUTERS, from, to);
    const failures = scanWith({ routers });
    expect(failures.length).toBeGreaterThan(0);
    expect(failures.every(f => path.basename(f.file) === 'routers.mjs')).toBe(true);
  });

  test.each([
    ['a second staff mount', `${APP_MOUNT}app.use('/api/v1/staff', staffRouter);\n`],
    ['an app-level route under /api/v1/staff', `${APP_MOUNT}app.post('/api/v1/staff/x', h);\n`],
    ['staffRouter mounted somewhere else too', `${APP_MOUNT}app.use('/api/v1/other', staffRouter);\n`],
    ['an app-level route as an expression-free template', `${APP_MOUNT}app.post(\`/api/v1/staff/x\`, h);\n`],
    ['an app-level route in another case', `${APP_MOUNT}app.post('/API/V1/Staff/x', h);\n`],
    ['an app-level array path', `${APP_MOUNT}app.use(['/api/v1/staff'], h);\n`],
  ])('app.mjs: %s fails on the added line', (_name, to) => {
    const [app, line] = edit(REAL_APP, APP_MOUNT, to);
    expect(where(scanWith({ app }))).toContain(`app.mjs:${line + 1}`);
  });

  // Inserted directly ABOVE the staff mount, so the new line takes its line number.
  const AUTH_MOUNT = "app.use('/api/v1', authRouter);\n";
  test.each([
    ['authRouter moved above the staff mount', AUTH_MOUNT],
    ["a new app.use('/api', someRouter)", "app.use('/api', someRouter);\n"],
    ['a pathless router use', 'app.use(sneakyRouter);\n'],
    ["an app.use('/') of an unclassifiable value", "app.use('/', mystery);\n"],
    ['an inline handler use', "app.use((req, res) => res.send('x'));\n"],
    ['a verb handler on a covering path', "app.all('/api/*', h);\n"],
    ['app handed to another helper', 'registerExtras(app);\n'],
  ])('app.mjs ordering: %s fails', (_name, line) => {
    const withoutAuth = line === AUTH_MOUNT ? REAL_APP.replace(AUTH_MOUNT, '') : REAL_APP;
    const [app, at] = edit(withoutAuth, APP_MOUNT, `${line}${APP_MOUNT}`);
    expect(where(scanWith({ app }))).toContain(`app.mjs:${at}`);
  });

  test('app.mjs ordering: covering middleware above the staff mount stays allowed', () => {
    const [app] = edit(REAL_APP, APP_MOUNT, `app.use(express.json());\napp.use('/api', apiLimiter);\n${APP_MOUNT}`);
    expect(scanWith({ app })).toEqual([]);
  });

  // publicRouter is mounted at '/' before the staff Router, so its own paths are pinned.
  const PUBLIC_ANCHOR = "  publicRouter.get('/health', healthHandler);\n";
  test.each([
    ['a covering /api path', "  publicRouter.use('/api', h);\n"],
    ['a path under /api/v1/staff', "  publicRouter.get('/api/v1/staff/x', h);\n"],
    ['a pathless use', '  publicRouter.use(h);\n'],
  ])('routers.mjs: publicRouter with %s fails on the added line', (_name, to) => {
    const [routers, line] = edit(REAL_ROUTERS, PUBLIC_ANCHOR, `${PUBLIC_ANCHOR}${to}`);
    expect(where(scanWith({ routers }))).toContain(`routers.mjs:${line + 1}`);
  });

  test('app.mjs: mounting at another path fails', () => {
    const [app] = edit(REAL_APP, APP_MOUNT, "app.use('/api/v1/stewards', staffRouter);\n");
    expect(where(scanWith({ app })).some(w => w.startsWith('app.mjs:'))).toBe(true);
  });
});
