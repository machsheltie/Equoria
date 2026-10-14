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
// In both files, no other route-method or use() call may name a path under
// /api/v1/staff (app.mjs) or /staff (routers.mjs, where the auth router is
// mounted at /api/v1), compared case-insensitively as Express does. String
// and expression-free template paths are read; array, regex and other
// template paths cannot be judged and fail closed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';

const parse = (src) =>
  espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', loc: true });

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');

const STAFF_MOUNT = '/api/v1/staff';
const ROUTE_CALL_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'all',
  'head',
  'options',
  'use',
  'route',
  'search',
  'purge',
  'copy',
  'propfind',
  'trace',
  'lock',
  'unlock',
  'mkcol',
  'move',
]);

const isStringLiteral = (n) => n?.type === 'Literal' && typeof n.value === 'string';
const samePath = (a, b) => path.relative(a, b) === '';

/** Parse a file and index every node's parent. */
function load(file) {
  const ast = parse(fs.readFileSync(file, 'utf8'));
  const parents = new Map();
  const nodes = [];
  const walk = (node, parent) => {
    parents.set(node, parent);
    nodes.push(node);
    for (const key of espree.VisitorKeys[node.type] ?? []) {
      const child = node[key];
      if (Array.isArray(child)) child.forEach((c) => c && walk(c, node));
      else if (child && typeof child.type === 'string') walk(child, node);
    }
  };
  walk(ast, null);
  return { ast, parents, nodes };
}

/** Identifier nodes that READ the binding `name` (not keys, members or import/declaration sites). */
function references({ nodes, parents }, name, bindingIds) {
  return nodes.filter((n) => {
    if (n.type !== 'Identifier' || n.name !== name || bindingIds.has(n)) return false;
    const p = parents.get(n);
    if (p.type === 'MemberExpression' && p.property === n && !p.computed) return false;
    if (p.type === 'Property' && p.key === n && p.value !== n && !p.computed) return false;
    if (/^Import(?:Default|Namespace)?Specifier$/.test(p.type)) return false;
    if (p.type === 'ExportSpecifier' && p.exported === n && p.local !== n) return false;
    return true;
  });
}

/** Named or default import binding of `imported` from `target` (resolved), or null. */
function importedLocal(ast, file, target, imported) {
  for (const stmt of ast.body) {
    if (stmt.type !== 'ImportDeclaration' || !String(stmt.source.value).startsWith('.')) continue;
    if (!samePath(path.resolve(path.dirname(file), String(stmt.source.value)), target)) continue;
    for (const s of stmt.specifiers) {
      const name = s.type === 'ImportDefaultSpecifier' ? 'default' : s.imported?.name;
      if (name === imported) return s.local;
    }
  }
  return null;
}

/** `<obj>.use(args...)` as its own statement, with args matching `match`. */
const isUseStatement = (stmt, obj, match) =>
  stmt?.type === 'ExpressionStatement' &&
  stmt.expression.type === 'CallExpression' &&
  !stmt.expression.optional &&
  stmt.expression.callee.type === 'MemberExpression' &&
  !stmt.expression.callee.computed &&
  stmt.expression.callee.object.type === 'Identifier' &&
  stmt.expression.callee.object.name === obj &&
  stmt.expression.callee.property.name === 'use' &&
  match(stmt.expression.arguments);

/** Static string value of a path argument (string or expression-free template), else null. */
const staticPath = (n) =>
  isStringLiteral(n)
    ? n.value
    : n?.type === 'TemplateLiteral' && n.expressions.length === 0
      ? n.quasis[0].value.cooked
      : null;

/** A path argument the check cannot judge: array, regex or template with expressions. */
const opaquePath = (n) =>
  n?.type === 'ArrayExpression' ||
  (n?.type === 'Literal' && n.regex !== undefined) ||
  (n?.type === 'TemplateLiteral' && n.expressions.length > 0);

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
