#!/usr/bin/env node
// Doctrine: every staff route carries a capability guard (Equoria-puj1e.1,
// STAFF-CR-05).
//
// Parses every .mjs file under backend/modules/staff/routes/ with espree and
// inspects every Express Router created there (`express.Router()` or
// `Router()`, whatever the variable is called; `router` is always treated as
// one). Each registration must be a plain statement of the shape
//
//   <router>.<get|post|put|patch|delete|all|head|options>('<path>', ...mw, handler)
//
// with a recognized guard as a DIRECT argument before the terminal handler:
//   requireStaffCapability('<literal>')
//   requireAnyStaffCapability(['<literal>', ...])
//   requireStaffRole  -- only for POST /checkin/request, POST /checkin/verify
//                        and GET /me (a staff member who is not yet checked in
//                        has no capabilities to check).
// `<router>.use(...)` is allowed only when every argument is a capability guard.
//
// Everything else fails closed: a guard after the handler or wrapped in another
// call, computed methods, spread arguments, router.route, chained registration,
// a Router passed / aliased / exported other than `export default <name>`, a
// Router created anywhere but `const <name> = ...Router()`, a guard name
// redefined locally, and files that do not parse.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const STAFF_ROUTES_DIR = path.join(REPO_ROOT, 'backend', 'modules', 'staff', 'routes');

const GUARD_MODULE_SUFFIX = '/middleware/requireStaffCapability.mjs';
const GUARD_NAMES = new Set([
  'requireStaffCapability',
  'requireAnyStaffCapability',
  'requireStaffRole',
]);
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'head', 'options']);
// requireStaffRole is enough for exactly these registrations.
const ROLE_ONLY_ALLOWED = new Set(['POST /checkin/request', 'POST /checkin/verify', 'GET /me']);

// Extra rules on the capabilities a guard names: each is
// (capabilities: string[], routeKey: string) => reason | null.
// Empty today; this is where a forbidden-capability rule plugs in.
const CAPABILITY_RULES = [];

const isStringLiteral = (n) => n?.type === 'Literal' && typeof n.value === 'string';

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
  else if (p.type === 'ObjectPattern')
    p.properties.forEach((q) => patternNames(q.type === 'RestElement' ? q : q.value, out));
  else if (p.type === 'ArrayPattern') p.elements.forEach((e) => patternNames(e, out));
  else if (p.type === 'RestElement') patternNames(p.argument, out);
  else if (p.type === 'AssignmentPattern') patternNames(p.left, out);
  return out;
}

const isRouterFactoryCall = (n) =>
  (n?.type === 'CallExpression' || n?.type === 'NewExpression') &&
  ((n.callee.type === 'Identifier' && n.callee.name === 'Router') ||
    (n.callee.type === 'MemberExpression' &&
      !n.callee.computed &&
      n.callee.property.name === 'Router'));

/**
 * Collect file-level facts: which local names are Routers, which local names
 * are the real guards, and failures for bindings that break either.
 */
function collectBindings(ast, fail) {
  const routerNames = new Set(['router']);
  const guards = new Map([...GUARD_NAMES].map((g) => [g, g]));
  const redefined = new Set();
  const markBinding = (id, allowed) => {
    if (!allowed && guards.has(id.name)) redefined.add(id);
  };

  walk(ast, (node, parent) => {
    if (node.type === 'ImportDeclaration') {
      const fromGuardModule = String(node.source.value).endsWith(GUARD_MODULE_SUFFIX);
      for (const s of node.specifiers) {
        const imported = s.type === 'ImportSpecifier' ? s.imported.name : null;
        if (fromGuardModule && GUARD_NAMES.has(imported)) guards.set(s.local.name, imported);
        else markBinding(s.local, false);
      }
    } else if (node.type === 'VariableDeclarator') {
      patternNames(node.id).forEach((id) => markBinding(id, false));
      if (node.id.type === 'Identifier' && isRouterFactoryCall(node.init)) {
        if (parent?.kind !== 'const') {
          fail(node, `Router "${node.id.name}" must be declared with const`);
        }
        routerNames.add(node.id.name);
      }
    } else if (/Function|Class/.test(node.type)) {
      if (node.id) markBinding(node.id, false);
      (node.params ?? []).forEach((p) => patternNames(p).forEach((id) => markBinding(id, false)));
    } else if (node.type === 'CatchClause') {
      patternNames(node.param).forEach((id) => markBinding(id, false));
    }
    if (isRouterFactoryCall(node)) {
      const declared =
        parent?.type === 'VariableDeclarator' &&
        parent.init === node &&
        parent.id.type === 'Identifier';
      if (!declared)
        fail(node, 'Router created in an unsupported way; use const <name> = express.Router()');
    }
  });

  for (const id of redefined) {
    guards.delete(id.name);
    fail(
      id,
      `guard name ${id.name} is redefined or imported from somewhere other than ${GUARD_MODULE_SUFFIX}`
    );
  }
  // A Router declared inside an export statement is exported by name.
  walk(ast, (node) => {
    if (node.type === 'ExportNamedDeclaration' && node.declaration) {
      for (const d of node.declaration.declarations ?? []) {
        if (isRouterFactoryCall(d.init))
          fail(d, 'Router exported other than by export default <name>');
      }
    }
  });
  return { routerNames, guards };
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
  if (args.length < 2) return fail(call, `${routeKey} has no handler`);
  const handler = args[args.length - 1];
  const middleware = args.slice(1, -1);
  const found = middleware.map((a) => recognizeGuard(a, guards)).filter(Boolean);
  for (const g of found) {
    const reason = capabilityRuleViolation(g, routeKey);
    if (reason) return fail(call, `${routeKey}: ${reason}`);
  }
  if (found.some((g) => g.kind === 'capability')) return undefined;
  if (found.some((g) => g.kind === 'role') && ROLE_ONLY_ALLOWED.has(routeKey)) return undefined;
  const detail = recognizeGuard(handler, guards)
    ? ' (a guard after the terminal handler does not count)'
    : '';
  return fail(
    call,
    `${routeKey} has no direct requireStaffCapability/requireAnyStaffCapability guard before its handler${detail}`
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
function checkRouterReference(id, parent, grandparent, ctx) {
  const { guards, fail } = ctx;
  if (parent.type === 'VariableDeclarator' && parent.id === id) return; // its declaration
  if (parent.type === 'ExportDefaultDeclaration') return;
  const isCallee =
    parent.type === 'MemberExpression' &&
    parent.object === id &&
    grandparent?.type === 'CallExpression' &&
    grandparent.callee === parent;
  if (!isCallee)
    return fail(id, `Router "${id.name}" is passed, aliased or exported in an unsupported way`);
  const call = grandparent;
  if (parent.computed) return fail(call, `computed method on Router "${id.name}" is unsupported`);
  const method = parent.property.name;
  if (call.arguments.some((a) => a.type === 'SpreadElement')) {
    return fail(call, `spread arguments in ${id.name}.${method}( are unsupported`);
  }
  if (method === 'route') return fail(call, `${id.name}.route( is unsupported in staff routes`);
  if (!ctx.isStatement(call)) {
    return fail(
      call,
      `${id.name}.${method}( must be its own statement (no chaining or reuse of its result)`
    );
  }
  if (method === 'use') return checkUse(call, guards, fail);
  if (HTTP_METHODS.has(method)) return checkMethodRegistration(call, method, guards, fail);
  return fail(call, `${id.name}.${method}( is unsupported in staff routes`);
}

export function scanSource(src, file) {
  const failures = [];
  let ast;
  try {
    ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', loc: true });
  } catch (err) {
    return [{ file, line: err.lineNumber ?? 0, reason: `parse error: ${err.message}` }];
  }
  // One finding per node and per line+reason (a shorthand or export specifier
  // can surface the same reference twice).
  const seen = new Set();
  const fail = (node, reason) => {
    const key = `${node.loc.start.line}|${reason}`;
    if (seen.has(node) || seen.has(key)) return;
    seen.add(node).add(key);
    failures.push({ file, line: node.loc.start.line, reason });
  };
  const { routerNames, guards } = collectBindings(ast, fail);

  const parents = new Map();
  walk(ast, (node, parent) => parents.set(node, parent));
  const isStatement = (call) => parents.get(call)?.type === 'ExpressionStatement';
  const ctx = { guards, fail, isStatement };

  walk(ast, (node, parent) => {
    if (node.type !== 'Identifier' || !routerNames.has(node.name) || !parent) return;
    // Property names and object keys are not references to the binding.
    if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return;
    if (
      (parent.type === 'Property' || parent.type === 'PropertyDefinition') &&
      parent.key === node &&
      !parent.computed &&
      !parent.shorthand
    )
      return;
    if (parent.type === 'ImportSpecifier' || parent.type === 'ImportDefaultSpecifier') return;
    checkRouterReference(node, parent, parents.get(parent), ctx);
  });
  return failures.sort((a, b) => a.line - b.line);
}

/** Scan every .mjs file under routesDir. Returns [{file, line, reason}]. */
export function scanStaffRoutes(routesDir = STAFF_ROUTES_DIR) {
  if (!fs.existsSync(routesDir)) {
    return [{ file: routesDir, line: 0, reason: 'staff routes directory not found' }];
  }
  const failures = [];
  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (/\.mjs$/.test(entry.name)) {
        failures.push(...scanSource(fs.readFileSync(full, 'utf8'), full));
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
        "requireAnyStaffCapability(['<cap>', ...]) argument before its handler. " +
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
