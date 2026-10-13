#!/usr/bin/env node
// Doctrine: every staff route carries a capability guard (Equoria-puj1e.1,
// STAFF-CR-05).
//
// Parses every .js/.mjs/.cjs file under backend/modules/staff/routes/ with
// espree (any other file there fails). A Router is ONLY a binding created as
//
//   const <name> = express.Router();   // express = default import of 'express'
//   const <name> = Router();           // Router = named import from 'express'
//
// and each registration on it must be a plain statement of the shape
//
//   <name>.<get|post|put|patch|delete|all|head|options>('<path>', GUARD, ...mw, handler)
//
// where GUARD, the first argument after the path, is a direct call to a guard
// imported from backend/modules/staff/middleware/requireStaffCapability.mjs:
//   requireStaffCapability('<literal>')
//   requireAnyStaffCapability(['<literal>', ...])
//   requireStaffRole  -- only for POST /checkin/request, POST /checkin/verify
//                        and GET /me (a staff member who is not yet checked in
//                        has no capabilities to check).
// `<name>.use(...)` is allowed only when every argument is a capability guard.
//
// Everything else fails closed: a guard that is not first, after the handler
// or wrapped in another call; computed methods; spread arguments; route();
// chained registration; a route-method call on anything that is not a
// recognized Router (an express() app, an imported router, an aliased factory);
// any other use of `express`, `.Router` or the Router factory; a Router passed,
// aliased or exported other than `export default <name>`; a guard name
// redefined locally or imported from elsewhere; and files that do not parse.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const STAFF_ROUTES_DIR = path.join(REPO_ROOT, 'backend', 'modules', 'staff', 'routes');

const GUARD_NAMES = new Set([
  'requireStaffCapability',
  'requireAnyStaffCapability',
  'requireStaffRole',
]);
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'head', 'options']);
const ROUTE_METHODS = new Set([...HTTP_METHODS, 'use', 'route']);
const SOURCE_FILE_RE = /\.(?:js|mjs|cjs)$/;
// requireStaffRole is enough for exactly these registrations.
const ROLE_ONLY_ALLOWED = new Set(['POST /checkin/request', 'POST /checkin/verify', 'GET /me']);

// Extra rules on the capabilities a guard names: each is
// (capabilities: string[], routeKey: string) => reason | null.
// Empty today; this is where a forbidden-capability rule plugs in.
const CAPABILITY_RULES = [];

/** The guard module a routes directory must import from: <routesDir>/../middleware/. */
export const guardModuleFor = (routesDir) =>
  path.resolve(routesDir, '..', 'middleware', 'requireStaffCapability.mjs');

const isStringLiteral = (n) => n?.type === 'Literal' && typeof n.value === 'string';

/** Static member name (`a.b` or `a['b']`), or null when it cannot be known. */
const memberName = (m) =>
  !m.computed ? m.property.name : isStringLiteral(m.property) ? m.property.value : null;

/** Walk the AST depth-first, calling visit(node, parent) for every node. */
function walk(node, visit, parent = null) {
  visit(node, parent);
  for (const key of espree.VisitorKeys[node.type] ?? []) {
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) if (c) walk(c, visit, node);
    } else if (child && typeof child.type === 'string') {
      walk(child, visit, node);
    }
  }
}

/** Names bound by a declaration pattern (identifier, destructuring, defaults, rest). */
function patternNames(p, out = []) {
  if (!p) return out;
  if (p.type === 'Identifier') out.push(p);
  else if (p.type === 'ObjectPattern') {
    p.properties.forEach((q) => patternNames(q.type === 'RestElement' ? q : q.value, out));
  } else if (p.type === 'ArrayPattern') p.elements.forEach((e) => patternNames(e, out));
  else if (p.type === 'RestElement') patternNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
  return out;
}

/** True when `id` is a property name / object key rather than a variable reference. */
function isNonReference(id, parent) {
  if (parent.type === 'MemberExpression' && parent.property === id && !parent.computed) return true;
  if (
    (parent.type === 'Property' ||
      parent.type === 'PropertyDefinition' ||
      parent.type === 'MethodDefinition') &&
    parent.key === id &&
    !parent.computed &&
    !parent.shorthand
  ) {
    return true;
  }
  if (/^Import(?:Default|Namespace)?Specifier$/.test(parent.type)) return true;
  // `export { a as b }`: `a` is a reference, `b` is only a name.
  return parent.type === 'ExportSpecifier' && parent.exported === id && parent.local !== id;
}

/**
 * Collect the file's imports: the local names of the `express` default import,
 * of `Router` named-imported from 'express', and of the real guards. Imports of
 * a guard name from anywhere else, and local redeclarations, are failures.
 */
function collectImports(ast, file, guardModule, fail) {
  const expressNames = new Set();
  const factoryNames = new Set();
  const guards = new Map();
  const declared = [];
  walk(ast, (node) => {
    if (node.type === 'ImportDeclaration') {
      const source = String(node.source.value);
      const resolved = source.startsWith('.') ? path.resolve(path.dirname(file), source) : null;
      const fromGuardModule = resolved !== null && path.relative(resolved, guardModule) === '';
      for (const s of node.specifiers) {
        const imported =
          s.type === 'ImportSpecifier' ? (s.imported.name ?? s.imported.value) : null;
        if (source === 'express' && s.type === 'ImportDefaultSpecifier')
          expressNames.add(s.local.name);
        else if (source === 'express' && imported === 'Router') factoryNames.add(s.local.name);
        else if (fromGuardModule && GUARD_NAMES.has(imported)) guards.set(s.local.name, imported);
        else if (GUARD_NAMES.has(s.local.name) || GUARD_NAMES.has(imported)) {
          fail(
            s,
            `guard ${imported ?? s.local.name} must be imported from the staff middleware module`
          );
        }
      }
    } else if (node.type === 'VariableDeclarator') {
      declared.push(...patternNames(node.id));
    } else if (/Function|Class/.test(node.type)) {
      if (node.id) declared.push(node.id);
      (node.params ?? []).forEach((p) => declared.push(...patternNames(p)));
    } else if (node.type === 'CatchClause') {
      declared.push(...patternNames(node.param));
    }
  });
  for (const id of declared) {
    if (guards.has(id.name) || GUARD_NAMES.has(id.name)) {
      guards.delete(id.name);
      fail(id, `guard name ${id.name} is redefined locally`);
    }
  }
  return { expressNames, factoryNames, guards };
}

/**
 * Find Routers: `const <name> = express.Router()` / `const <name> = Router()`.
 * Every other reference to `express`, the Router factory or a `.Router` member
 * is a failure.
 */
function collectRouters(ast, parents, { expressNames, factoryNames }, fail) {
  const routerNames = new Set();
  const creationSite = (call) => {
    const decl = parents.get(call);
    const ok =
      decl?.type === 'VariableDeclarator' &&
      decl.init === call &&
      decl.id.type === 'Identifier' &&
      parents.get(decl)?.kind === 'const' &&
      parents.get(parents.get(decl))?.type !== 'ExportNamedDeclaration';
    return ok ? decl.id.name : null;
  };
  const accept = (call, at) => {
    const name = creationSite(call);
    if (name) routerNames.add(name);
    else
      fail(
        at,
        'Router must be created as `const <name> = express.Router()` and not exported by name'
      );
  };
  walk(ast, (node, parent) => {
    if (node.type === 'MemberExpression' && memberName(node) === 'Router') {
      const direct =
        !node.computed &&
        node.object.type === 'Identifier' &&
        expressNames.has(node.object.name) &&
        parent?.type === 'CallExpression' &&
        parent.callee === node;
      if (direct) accept(parent, node);
      else fail(node, '`.Router` may only be called directly as express.Router()');
      return;
    }
    if (node.type !== 'Identifier' || !parent || isNonReference(node, parent)) return;
    if (expressNames.has(node.name)) {
      const routerMember =
        parent.type === 'MemberExpression' &&
        parent.object === node &&
        memberName(parent) === 'Router';
      if (!routerMember)
        fail(node, `\`${node.name}\` may only be used as ${node.name}.Router() (no express() app)`);
    } else if (factoryNames.has(node.name)) {
      if (parent.type === 'CallExpression' && parent.callee === node) accept(parent, node);
      else fail(node, `Router factory \`${node.name}\` may only be called directly`);
    }
  });
  return routerNames;
}

/**
 * Recognize a DIRECT guard argument. Returns { kind: 'capability' | 'role',
 * capabilities } or null. The guard must be the argument itself, never nested.
 */
function recognizeGuard(arg, guards) {
  if (arg.type === 'Identifier' && guards.get(arg.name) === 'requireStaffRole') {
    return { kind: 'role', capabilities: [] };
  }
  if (arg.type !== 'CallExpression' || arg.callee.type !== 'Identifier' || arg.optional)
    return null;
  const guard = guards.get(arg.callee.name);
  if (arg.arguments.length !== 1) return null;
  const [only] = arg.arguments;
  if (guard === 'requireStaffCapability' && isStringLiteral(only)) {
    return { kind: 'capability', capabilities: [only.value] };
  }
  if (
    guard === 'requireAnyStaffCapability' &&
    only.type === 'ArrayExpression' &&
    only.elements.length > 0 &&
    only.elements.every(isStringLiteral)
  ) {
    return { kind: 'capability', capabilities: only.elements.map((e) => e.value) };
  }
  return null;
}

/** Apply CAPABILITY_RULES to a recognized guard; returns the first reason or null. */
function capabilityRuleViolation(guard, routeKey) {
  for (const rule of CAPABILITY_RULES) {
    const reason = rule(guard.capabilities, routeKey);
    if (reason) return reason;
  }
  return null;
}

function checkMethodRegistration(call, method, guards, fail) {
  const args = call.arguments;
  const [first] = args;
  const routeKey = `${method.toUpperCase()} ${isStringLiteral(first) ? first.value : '<non-literal path>'}`;
  if (!isStringLiteral(first)) return fail(call, `${routeKey}: the path must be a string literal`);
  if (args.length < 3) {
    return fail(
      call,
      `${routeKey} needs a guard as the first argument after the path, then a handler`
    );
  }
  const guard = recognizeGuard(args[1], guards);
  if (guard) {
    const reason = capabilityRuleViolation(guard, routeKey);
    if (reason) return fail(call, `${routeKey}: ${reason}`);
    if (guard.kind === 'capability') return undefined;
    if (ROLE_ONLY_ALLOWED.has(routeKey)) return undefined;
  }
  const later = args.slice(2).some((a) => recognizeGuard(a, guards));
  return fail(
    call,
    `${routeKey} does not start with a direct requireStaffCapability/requireAnyStaffCapability guard` +
      (later ? ' (the guard must be the first argument after the path)' : '')
  );
}

function checkUse(call, guards, fail) {
  const ok =
    call.arguments.length > 0 &&
    call.arguments.every((a) => {
      const g = recognizeGuard(a, guards);
      return g?.kind === 'capability' && !capabilityRuleViolation(g, 'USE');
    });
  if (!ok)
    fail(call, 'router.use( is allowed only with direct capability guards as every argument');
}

/** Judge one reference to a Router binding by where it sits. */
function checkRouterReference(id, parent, ctx) {
  const { guards, fail, parents } = ctx;
  const grandparent = parents.get(parent);
  if (parent.type === 'VariableDeclarator' && parent.id === id) return; // its declaration
  if (parent.type === 'ExportDefaultDeclaration') return;
  const isCallee =
    parent.type === 'MemberExpression' &&
    parent.object === id &&
    grandparent?.type === 'CallExpression' &&
    grandparent.callee === parent;
  if (!isCallee) {
    return fail(id, `Router "${id.name}" is passed, aliased or exported in an unsupported way`);
  }
  const call = grandparent;
  if (parent.computed) return fail(call, `computed method on Router "${id.name}" is unsupported`);
  const method = parent.property.name;
  if (call.arguments.some((a) => a.type === 'SpreadElement')) {
    return fail(call, `spread arguments in ${id.name}.${method}( are unsupported`);
  }
  if (method === 'route') return fail(call, `${id.name}.route( is unsupported in staff routes`);
  if (parents.get(call)?.type !== 'ExpressionStatement') {
    return fail(
      call,
      `${id.name}.${method}( must be its own statement (no chaining or reuse of its result)`
    );
  }
  if (method === 'use') return checkUse(call, guards, fail);
  if (HTTP_METHODS.has(method)) return checkMethodRegistration(call, method, guards, fail);
  return fail(call, `${id.name}.${method}( is unsupported in staff routes`);
}

/** A route-method call whose object is not a recognized Router fails closed. */
function checkForeignRouteCall(node, routerNames, parents, fail) {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return;
  const method = memberName(node.callee);
  if (!ROUTE_METHODS.has(method)) return;
  const obj = node.callee.object;
  if (obj.type === 'Identifier' && routerNames.has(obj.name)) return; // checked as a Router
  // A chained call on a Router call is already reported at the inner call.
  if (obj.type === 'CallExpression' && obj.callee.type === 'MemberExpression') {
    const inner = obj.callee.object;
    if (inner.type === 'Identifier' && routerNames.has(inner.name)) return;
  }
  const label = obj.type === 'Identifier' ? obj.name : '<expression>';
  fail(
    node,
    `${label}.${method}( is not on a Router created here by const <name> = express.Router()`
  );
}

/**
 * Scan one source string. `file` must be the file's real path: guard imports
 * are resolved against its directory and must land on `guardModule`.
 */
export function scanSource(src, file, { guardModule = guardModuleFor(path.dirname(file)) } = {}) {
  const failures = [];
  let ast;
  try {
    ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', loc: true });
  } catch (err) {
    return [{ file, line: err.lineNumber ?? 0, reason: `parse error: ${err.message}` }];
  }
  // One finding per node and per line+reason.
  const seen = new Set();
  const fail = (node, reason) => {
    const key = `${node.loc.start.line}|${reason}`;
    if (seen.has(node) || seen.has(key)) return;
    seen.add(node).add(key);
    failures.push({ file, line: node.loc.start.line, reason });
  };
  const parents = new Map();
  walk(ast, (node, parent) => parents.set(node, parent));
  const imports = collectImports(ast, file, guardModule, fail);
  const routerNames = collectRouters(ast, parents, imports, fail);
  const ctx = { guards: imports.guards, fail, parents };

  walk(ast, (node, parent) => {
    checkForeignRouteCall(node, routerNames, parents, fail);
    if (node.type !== 'Identifier' || !routerNames.has(node.name) || !parent) return;
    if (isNonReference(node, parent)) return;
    checkRouterReference(node, parent, ctx);
  });
  return failures.sort((a, b) => a.line - b.line);
}

/** Scan every file under routesDir. Returns [{file, line, reason}]. */
export function scanStaffRoutes(routesDir = STAFF_ROUTES_DIR) {
  if (!fs.existsSync(routesDir)) {
    return [{ file: routesDir, line: 0, reason: 'staff routes directory not found' }];
  }
  const guardModule = guardModuleFor(routesDir);
  const failures = [];
  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (SOURCE_FILE_RE.test(entry.name)) {
        failures.push(...scanSource(fs.readFileSync(full, 'utf8'), full, { guardModule }));
      } else {
        failures.push({
          file: full,
          line: 0,
          reason: 'only .js/.mjs/.cjs route files may live here',
        });
      }
    }
  };
  walkDir(routesDir);
  return failures;
}

function main() {
  const failures = scanStaffRoutes();
  if (failures.length > 0) {
    console.error('\nStaff routes without a capability guard:');
    for (const f of failures) {
      console.error(`  ${path.relative(REPO_ROOT, f.file)}:${f.line}  ${f.reason}`);
    }
    console.error(
      "\nEvery staff route must pass a direct requireStaffCapability('<cap>') or " +
        "requireAnyStaffCapability(['<cap>', ...]) as the first argument after its path. " +
        'requireStaffRole alone is allowed only for POST /checkin/request, ' +
        'POST /checkin/verify and GET /me.'
    );
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
