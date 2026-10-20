#!/usr/bin/env node
// Doctrine: the staff Router is mounted in exactly one pinned shape
// (Equoria-puj1e.1, STAFF-CR-05). Companion to check-staff-routes-guarded.mjs,
// which makes backend/app/routers.mjs the only importer of staff/routes/.
//
// backend/app/routers.mjs must contain exactly:
//   import staffRoutes from '../modules/staff/routes/staffRoutes.mjs';  (the only staff/routes reference)
//   const staffRouter = express.Router();
//   staffRouter.use(authenticateToken);      // from ../middleware/auth.mjs
//   staffRouter.use(csrfProtection);         // from ../middleware/csrf.mjs
//   staffRouter.use('/', staffRoutes);
//   staffRouter.use(createNotFoundHandler({ spaHtml: null, logger }));  // ../middleware/notFoundHandler.mjs
//   return { ..., staffRouter };
// staffRoutes is referenced nowhere else, staffRouter nowhere else. The
// terminal not-found use is the last call on staffRouter, so an unmatched
// /api/v1/staff path gets the app's ordinary 404 instead of falling through to
// the /api/v1 authRouter.
//
// backend/app.mjs must take staffRouter from buildRouters() (./app/routers.mjs)
// and reference it exactly once, in `app.use('/api/v1/staff', staffRouter)`.
//
// Order (app.mjs): before the staff mount, any app.use / app.<verb> whose path
// covers /api/v1/staff ('/', '/api', '/api/v1', any pattern path such as '*'
// or '/:x', or no path) must be middleware, never something that can serve a
// request: a verb handler fails,
// and every argument of a covering use() must be an identifier or call bound
// to an import from backend/{middleware,config,services,utils}/ or from cors,
// helmet or cookie-parser, express.json/urlencoded/raw/text, or a local const
// built from one; a name matching /route|router/i never counts as middleware,
// nor does an import from a module that names Router, imports or re-exports
// from a path naming a route, or cannot be read. Anything unclassifiable fails
// closed. The single exception is `app.use('/', publicRouter)`, allowed
// because routers.mjs pins every publicRouter registration to a static path
// that does not cover /api/v1/staff; app.mjs names publicRouter nowhere else.
// Before the staff mount `app` may only be passed to
// setupSwaggerDocs (middleware/swaggerSetup.mjs, which registers /api-docs).
//
// In both files, no other route-method or use() call may name a path under
// /api/v1/staff (app.mjs) or /staff (routers.mjs, where the auth router is
// mounted at /api/v1), compared case-insensitively as Express does. String
// and expression-free template paths are read; array, regex and other
// template paths cannot be judged and fail closed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STAFF_MOUNT,
  ROUTE_CALL_METHODS,
  isStringLiteral,
  samePath,
  load,
  references,
  importedLocal,
  isUseStatement,
  staticPath,
  opaquePath,
} from './staff-routes-ast.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');

/**
 * Route-method / use() calls whose first argument names a path under any of
 * `prefixes` (case-insensitive), or whose path cannot be judged statically.
 */
function pathCallsUnder({ nodes }, prefixes) {
  const lower = prefixes.map((p) => p.toLowerCase());
  return nodes.filter((n) => {
    if (n.type !== 'CallExpression' || n.callee.type !== 'MemberExpression') return false;
    const m = n.callee.computed ? staticPath(n.callee.property) : n.callee.property.name;
    if (!ROUTE_CALL_METHODS.has(m)) return false;
    const [first] = n.arguments;
    if (opaquePath(first)) return true;
    const value = staticPath(first)?.toLowerCase();
    return value != null && lower.some((p) => value === p || value.startsWith(`${p}/`));
  });
}

/** Does a mount path cover /api/v1/staff? `null` means no path (covers everything). */
const coversStaff = (p) => {
  if (p === null) return true;
  const v = p.toLowerCase().replace(/\/+$/, '');
  // A pattern path (wildcard, parameter, optional, group) may match the staff
  // mount; it cannot be judged, so it counts as covering.
  if (/[*:()?+[\]]/.test(v)) return true;
  return v === '' || STAFF_MOUNT === v || STAFF_MOUNT.startsWith(`${v}/`);
};
const isUnderStaff = (p) => {
  const v = p.toLowerCase().replace(/\/+$/, '');
  return v === STAFF_MOUNT || v.startsWith(`${STAFF_MOUNT}/`);
};
const nodeBefore = (a, b) =>
  a.loc.start.line < b.loc.start.line ||
  (a.loc.start.line === b.loc.start.line && a.loc.start.column < b.loc.start.column);

const MIDDLEWARE_DIRS = ['middleware', 'config', 'services', 'utils'];
const MIDDLEWARE_PACKAGES = new Set(['cors', 'helmet', 'cookie-parser']);
const EXPRESS_MIDDLEWARE = new Set(['json', 'urlencoded', 'raw', 'text']);
const ROUTERISH = /route|router/i;

/**
 * Could the module at `file` hand out a Router (Equoria-fvdru)? True when it
 * names Router at all, imports or re-exports from a path naming a route, or
 * cannot be read: a router never passes as middleware for want of 'route' in
 * its binding name.
 */
function mayExportRouter(file) {
  let nodes;
  try {
    ({ nodes } = load(file));
  } catch {
    return true;
  }
  return nodes.some((n) => {
    if (n.type === 'Identifier') return n.name === 'Router';
    const v = isStringLiteral(n) ? n.value : n.type === 'TemplateElement' ? n.value.cooked : null;
    return v === 'Router' || (v?.startsWith('.') && ROUTERISH.test(v));
  });
}

/** Is `name` bound to middleware: a middleware-module import, or a const built from one? */
function isMiddlewareName(idx, file, backendRoot, name, depth = 0) {
  if (ROUTERISH.test(name) || depth > 3) return false;
  for (const stmt of idx.ast.body) {
    if (stmt.type !== 'ImportDeclaration') continue;
    if (!stmt.specifiers.some((sp) => sp.local.name === name)) continue;
    const src = String(stmt.source.value);
    if (MIDDLEWARE_PACKAGES.has(src)) return true;
    if (!src.startsWith('.')) return false;
    const target = path.resolve(path.dirname(file), src);
    const rel = path.relative(backendRoot, target);
    return MIDDLEWARE_DIRS.includes(rel.split(path.sep)[0]) && !mayExportRouter(target);
  }
  const decl = idx.ast.body
    .filter((st) => st.type === 'VariableDeclaration' && st.kind === 'const')
    .flatMap((st) => st.declarations)
    .find((d) => d.id.type === 'Identifier' && d.id.name === name);
  return Boolean(decl?.init) && isMiddlewareArg(idx, file, backendRoot, decl.init, depth + 1);
}

/** Is a use() argument middleware (see the header), as opposed to a router or handler? */
function isMiddlewareArg(idx, file, backendRoot, arg, depth = 0) {
  if (arg.type === 'Identifier') return isMiddlewareName(idx, file, backendRoot, arg.name, depth);
  if (arg.type !== 'CallExpression' || arg.optional) return false;
  const c = arg.callee;
  if (c.type === 'Identifier') return isMiddlewareName(idx, file, backendRoot, c.name, depth);
  return (
    c.type === 'MemberExpression' &&
    !c.computed &&
    c.object.type === 'Identifier' &&
    EXPRESS_MIDDLEWARE.has(c.property.name) &&
    idx.ast.body.some(
      (st) =>
        st.type === 'ImportDeclaration' &&
        st.source.value === 'express' &&
        st.specifiers.some(
          (sp) => sp.type === 'ImportDefaultSpecifier' && sp.local.name === c.object.name
        )
    )
  );
}

/** routers.mjs: every publicRouter registration has a static path that does not cover /api/v1/staff. */
function checkPublicRouter(idx, fail, at) {
  const ret = idx.nodes.find(
    (n) =>
      n.type === 'Property' &&
      !n.computed &&
      n.key.type === 'Identifier' &&
      n.key.name === 'publicRouter' &&
      n.value.type === 'Identifier' &&
      idx.parents.get(idx.parents.get(n))?.type === 'ReturnStatement'
  );
  if (!ret) return;
  const name = ret.value.name;
  const declIds = idx.nodes.filter(
    (n) => n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === name
  );
  for (const ref of references(idx, name, new Set(declIds.map((d) => d.id)))) {
    if (ref === ret.value) continue;
    const member = idx.parents.get(ref);
    const call = idx.parents.get(member);
    const p = call?.type === 'CallExpression' ? staticPath(call.arguments[0]) : null;
    const ok =
      member.type === 'MemberExpression' &&
      member.object === ref &&
      !member.computed &&
      ROUTE_CALL_METHODS.has(member.property.name) &&
      call.callee === member &&
      idx.parents.get(call)?.type === 'ExpressionStatement' &&
      p !== null &&
      !coversStaff(p) &&
      !isUnderStaff(p);
    if (!ok) {
      fail(
        at(ref),
        `${name} is mounted at '/' ahead of the staff Router, so each registration needs a static path that does not cover ${STAFF_MOUNT}`
      );
    }
  }
}

/** app.mjs: nothing that can serve a request covers /api/v1/staff before the staff mount. */
function checkCoveringBeforeMount(idx, file, backendRoot, mountCall, publicLocal, fail) {
  const appName = mountCall.callee.object.name;
  const appDecl = idx.nodes.find(
    (n) => n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === appName
  );
  const swagger = importedLocal(
    idx.ast,
    file,
    path.join(backendRoot, 'middleware', 'swaggerSetup.mjs'),
    'setupSwaggerDocs'
  );
  for (const ref of references(idx, appName, new Set([appDecl?.id]))) {
    if (!nodeBefore(ref, mountCall)) continue;
    const parent = idx.parents.get(ref);
    if (parent.type === 'CallExpression' && parent.arguments.includes(ref)) {
      const helper =
        parent.callee.type === 'Identifier' && swagger && parent.callee.name === swagger.name;
      if (!helper)
        fail(
          ref.loc.start.line,
          `${appName} may not be handed to another function before the staff mount`
        );
      continue;
    }
    if (parent.type !== 'MemberExpression' || parent.object !== ref) {
      fail(ref.loc.start.line, `${appName} may not be aliased before the staff mount`);
      continue;
    }
    const call = idx.parents.get(parent);
    if (call?.type !== 'CallExpression' || call.callee !== parent) continue; // e.g. app.locals
    const method = parent.computed ? staticPath(parent.property) : parent.property.name;
    if (parent.computed && method === null) {
      fail(
        call.loc.start.line,
        `computed ${appName}[...] call before the staff mount cannot be judged`
      );
      continue;
    }
    if (!ROUTE_CALL_METHODS.has(method)) continue; // app.set(...), app.disable(...)
    const [first] = call.arguments;
    if (opaquePath(first)) {
      fail(
        call.loc.start.line,
        `${appName}.${method}( path before the staff mount cannot be judged`
      );
      continue;
    }
    const p = staticPath(first);
    if (!coversStaff(p)) continue;
    const handlers = p === null ? call.arguments : call.arguments.slice(1);
    const isPublicMount =
      method === 'use' &&
      p === '/' &&
      handlers.length === 1 &&
      publicLocal !== null &&
      handlers[0].type === 'Identifier' &&
      handlers[0].name === publicLocal.name;
    const ok =
      isPublicMount ||
      (method === 'use' &&
        handlers.length > 0 &&
        handlers.every((h) => isMiddlewareArg(idx, file, backendRoot, h)));
    if (!ok) {
      fail(
        call.loc.start.line,
        `${appName}.${method}(${p === null ? '' : `'${p}', `}...) covers ${STAFF_MOUNT} and comes before the staff mount; only middleware may (routers and handlers go after it)`
      );
    }
  }
}

export function checkRoutersFile(file, backendRoot) {
  const failures = [];
  const fail = (line, reason) => failures.push({ file, line, reason });
  const idx = load(file);
  const routesDir = path.join(backendRoot, 'modules', 'staff', 'routes');
  const at = (node) => node?.loc?.start.line ?? 1;

  // The one reference into staff/routes/ is a default import of staffRoutes.mjs.
  const routeStrings = idx.nodes.filter((n) => {
    if (!isStringLiteral(n) || !/^\.\.?\//.test(n.value)) return false;
    const rel = path.relative(routesDir, path.resolve(path.dirname(file), n.value));
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  });
  const importNode = routeStrings.length === 1 ? idx.parents.get(routeStrings[0]) : null;
  const okImport =
    importNode?.type === 'ImportDeclaration' &&
    samePath(
      path.resolve(path.dirname(file), importNode.source.value),
      path.join(routesDir, 'staffRoutes.mjs')
    ) &&
    importNode.specifiers.length === 1 &&
    importNode.specifiers[0].type === 'ImportDefaultSpecifier';
  if (!okImport) {
    fail(
      at(routeStrings[1] ?? routeStrings[0]),
      'staff routes must be referenced once, as `import staffRoutes from ../modules/staff/routes/staffRoutes.mjs`'
    );
    return failures;
  }
  const routesName = importNode.specifiers[0].local.name;

  // staffRoutes is read exactly once: `<staffRouter>.use('/', staffRoutes)`.
  const routesRefs = references(idx, routesName, new Set());
  const mountStmt =
    routesRefs.length === 1 ? idx.parents.get(idx.parents.get(routesRefs[0])) : null;
  const mountsAtRoot = (args) =>
    args.length === 2 &&
    isStringLiteral(args[0]) &&
    args[0].value === '/' &&
    args[1] === routesRefs[0];
  const routerName = mountStmt?.expression?.callee?.object?.name;
  if (!routerName || !isUseStatement(mountStmt, routerName, mountsAtRoot)) {
    for (const r of routesRefs)
      fail(at(r), `${routesName} may only appear once, in <staffRouter>.use('/', ${routesName})`);
    if (routesRefs.length === 0) fail(1, `${routesName} is imported but never mounted`);
    return failures;
  }

  // The staff router: const X = express.Router(); X.use(auth); X.use(csrf); X.use('/', staffRoutes).
  const block = idx.parents.get(mountStmt);
  const body = block?.body ?? [];
  const i = body.indexOf(mountStmt);
  const [decl, useAuth, useCsrf] = [body[i - 3], body[i - 2], body[i - 1]];
  const declarator =
    decl?.type === 'VariableDeclaration' && decl.kind === 'const' && decl.declarations.length === 1
      ? decl.declarations[0]
      : null;
  const init = declarator?.init;
  const declOk =
    declarator?.id.type === 'Identifier' &&
    declarator.id.name === routerName &&
    init?.type === 'CallExpression' &&
    init.arguments.length === 0 &&
    init.callee.type === 'MemberExpression' &&
    !init.callee.computed &&
    init.callee.property.name === 'Router' &&
    init.callee.object.type === 'Identifier';
  const expressLocal = idx.ast.body
    .find(
      (s) =>
        s.type === 'ImportDeclaration' &&
        s.source.value === 'express' &&
        s.specifiers.some((x) => x.type === 'ImportDefaultSpecifier')
    )
    ?.specifiers.find((x) => x.type === 'ImportDefaultSpecifier').local.name;
  const auth = importedLocal(
    idx.ast,
    file,
    path.join(backendRoot, 'middleware', 'auth.mjs'),
    'authenticateToken'
  );
  const csrf = importedLocal(
    idx.ast,
    file,
    path.join(backendRoot, 'middleware', 'csrf.mjs'),
    'csrfProtection'
  );
  const usesOnly = (local) => (args) =>
    args.length === 1 && args[0].type === 'Identifier' && local && args[0].name === local.name;
  if (!declOk || init.callee.object.name !== expressLocal) {
    fail(
      at(mountStmt),
      `${routerName} must be declared as \`const ${routerName} = express.Router()\` directly before its three use() calls`
    );
  }
  if (!isUseStatement(useAuth, routerName, usesOnly(auth))) {
    fail(
      at(useAuth ?? mountStmt),
      `${routerName}.use(authenticateToken) from ../middleware/auth.mjs must come right after the declaration`
    );
  }
  if (!isUseStatement(useCsrf, routerName, usesOnly(csrf))) {
    fail(
      at(useCsrf ?? mountStmt),
      `${routerName}.use(csrfProtection) from ../middleware/csrf.mjs must come next`
    );
  }

  // Then the terminal: <staffRouter>.use(createNotFoundHandler({ spaHtml: null, logger })).
  const terminal = body[i + 1];
  const notFound = importedLocal(
    idx.ast,
    file,
    path.join(backendRoot, 'middleware', 'notFoundHandler.mjs'),
    'createNotFoundHandler'
  );
  const isTerminal = (args) => {
    const [call] = args;
    const [opts] = call?.arguments ?? [];
    const props = opts?.type === 'ObjectExpression' ? opts.properties : [];
    const prop = (key) =>
      props.find(
        (p) =>
          p.type === 'Property' && !p.computed && p.key.type === 'Identifier' && p.key.name === key
      );
    return (
      args.length === 1 &&
      call.type === 'CallExpression' &&
      call.callee.type === 'Identifier' &&
      notFound !== null &&
      call.callee.name === notFound.name &&
      call.arguments.length === 1 &&
      props.length === 2 &&
      prop('spaHtml')?.value.type === 'Literal' &&
      prop('spaHtml').value.value === null &&
      prop('logger')?.value.type === 'Identifier'
    );
  };
  if (!isUseStatement(terminal, routerName, isTerminal)) {
    fail(
      at(mountStmt),
      `${routerName} must end, right after the '/' mount, with ${routerName}.use(createNotFoundHandler({ spaHtml: null, logger })) from ../middleware/notFoundHandler.mjs`
    );
  }

  // staffRouter is otherwise read only in `return { ..., staffRouter }`.
  const pinned = new Set(
    [
      useAuth,
      useCsrf,
      mountStmt,
      isUseStatement(terminal, routerName, isTerminal) ? terminal : null,
    ].map((s) => s?.expression?.callee?.object)
  );
  for (const ref of references(idx, routerName, new Set([declarator?.id]))) {
    if (pinned.has(ref)) continue;
    const prop = idx.parents.get(ref);
    const obj = idx.parents.get(prop);
    const returned =
      prop.type === 'Property' &&
      prop.value === ref &&
      prop.key.type === 'Identifier' &&
      prop.key.name === 'staffRouter' &&
      obj?.type === 'ObjectExpression' &&
      idx.parents.get(obj)?.type === 'ReturnStatement';
    if (!returned)
      fail(
        at(ref),
        `${routerName} may only be configured by the four pinned use() calls and returned`
      );
  }

  checkPublicRouter(idx, fail, at);

  for (const call of pathCallsUnder(idx, ['/staff', STAFF_MOUNT])) {
    fail(
      at(call),
      `routes under /staff may only live in modules/staff/routes/ (this file mounts nothing there; array, regex and dynamic paths are refused)`
    );
  }
  return failures;
}

export function checkAppFile(file, backendRoot) {
  const failures = [];
  const fail = (line, reason) => failures.push({ file, line, reason });
  const idx = load(file);
  const buildRouters = importedLocal(
    idx.ast,
    file,
    path.join(backendRoot, 'app', 'routers.mjs'),
    'buildRouters'
  );

  // const { ..., staffRouter } = buildRouters();
  const bindings = idx.nodes.filter(
    (n) =>
      n.type === 'Property' &&
      !n.computed &&
      n.key.type === 'Identifier' &&
      n.key.name === 'staffRouter' &&
      n.value.type === 'Identifier' &&
      idx.parents.get(n)?.type === 'ObjectPattern'
  );
  const declarator = bindings.length === 1 ? idx.parents.get(idx.parents.get(bindings[0])) : null;
  const fromBuild =
    declarator?.type === 'VariableDeclarator' &&
    declarator.init?.type === 'CallExpression' &&
    declarator.init.callee.type === 'Identifier' &&
    buildRouters &&
    declarator.init.callee.name === buildRouters.name;
  if (!fromBuild) {
    fail(
      bindings[0]?.loc.start.line ?? 1,
      'staffRouter must be destructured once from buildRouters() (./app/routers.mjs)'
    );
    return failures;
  }
  const local = bindings[0].value;

  // Read exactly once: app.use('/api/v1/staff', staffRouter).
  const refs = references(idx, local.name, new Set([local]));
  const mountedOnce =
    refs.length === 1 &&
    isUseStatement(
      idx.parents.get(idx.parents.get(refs[0])),
      'app',
      (args) =>
        args.length === 2 &&
        isStringLiteral(args[0]) &&
        args[0].value === STAFF_MOUNT &&
        args[1] === refs[0]
    );
  if (!mountedOnce) {
    for (const r of refs)
      fail(
        r.loc.start.line,
        `${local.name} may only appear once, in app.use('${STAFF_MOUNT}', ${local.name})`
      );
    if (refs.length === 0)
      fail(local.loc.start.line, `${local.name} is never mounted at ${STAFF_MOUNT}`);
  }
  const mountCall = mountedOnce ? idx.parents.get(refs[0]) : null;
  for (const call of pathCallsUnder(idx, [STAFF_MOUNT])) {
    if (call !== mountCall)
      fail(
        call.loc.start.line,
        `only app.use('${STAFF_MOUNT}', staffRouter) may name ${STAFF_MOUNT}`
      );
  }
  if (mountCall) {
    const pub = idx.parents
      .get(bindings[0])
      .properties.find(
        (p) =>
          p.type === 'Property' &&
          !p.computed &&
          p.key.name === 'publicRouter' &&
          p.value.type === 'Identifier'
      );
    // publicRouter runs ahead of the staff Router, so it is named only in the
    // single app.use('/', publicRouter) (Equoria-fvdru).
    const pubRefs = pub ? references(idx, pub.value.name, new Set([pub.value])) : [];
    for (const r of pubRefs) {
      const atRoot = (args) =>
        args.length === 2 && isStringLiteral(args[0]) && args[0].value === '/' && args[1] === r;
      if (
        pubRefs.length !== 1 ||
        !isUseStatement(idx.parents.get(idx.parents.get(r)), 'app', atRoot)
      )
        fail(r.loc.start.line, `${r.name} may only appear once, in app.use('/', ${r.name})`);
    }
    checkCoveringBeforeMount(idx, file, backendRoot, mountCall, pub?.value ?? null, fail);
  }
  return failures;
}

/** Check routers.mjs and app.mjs under backendRoot. Returns [{file, line, reason}]. */
export function scanStaffMount(backendRoot = BACKEND_DIR) {
  const routers = path.join(backendRoot, 'app', 'routers.mjs');
  const app = path.join(backendRoot, 'app.mjs');
  const failures = [];
  for (const [file, check] of [
    [routers, checkRoutersFile],
    [app, checkAppFile],
  ]) {
    if (!fs.existsSync(file)) {
      failures.push({ file, line: 0, reason: 'file not found' });
      continue;
    }
    try {
      failures.push(...check(file, backendRoot));
    } catch (err) {
      failures.push({ file, line: err.lineNumber ?? 0, reason: `cannot check: ${err.message}` });
    }
  }
  return failures;
}

function main() {
  const failures = scanStaffMount();
  if (failures.length > 0) {
    console.error('\nStaff Router mount violations:');
    for (const f of failures) {
      console.error(`  ${path.relative(REPO_ROOT, f.file)}:${f.line}  ${f.reason}`);
    }
    console.error(
      '\nSee the pinned shape at the top of scripts/doctrine-checks/check-staff-routes-mount.mjs.'
    );
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
