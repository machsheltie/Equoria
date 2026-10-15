#!/usr/bin/env node
// Doctrine: every staff route carries a capability guard (Equoria-puj1e.1,
// STAFF-CR-05).
//
// 1. Every file under backend/modules/staff/routes/ must be a .js/.mjs/.cjs
//    file that matches this allow-list grammar, statement by statement:
//
//      import express from 'express';            (and/or `import { Router } from 'express'`)
//      import { requireStaffCapability, ... } from '../middleware/requireStaffCapability.mjs';
//      import { fn } from '../controllers/<name>.mjs';     (named or default)
//      const <router> = express.Router(<optional literal options>);   (exactly one)
//      <router>.<get|post|put|patch|delete>('<path>', GUARD, ...handlers);
//      <router>.use(<capability guards only>);
//      export default <router>;                  (exactly one)
//
//    GUARD, the first argument after the path, is a direct call to a guard
//    imported from the middleware module (resolved by path):
//      requireStaffCapability('<literal>')
//      requireAnyStaffCapability(['<literal>', ...])
//      requireStaffRole  -- only for POST /checkin/request, POST /checkin/verify
//                           and GET /me (a staff member who is not yet checked
//                           in has no capabilities to check).
//    Each handler is an identifier, or an `a.b` chain, bound to a controller
//    import. Anything else - other statements, imports, methods, computed or
//    chained members, calls, inline functions, spreads, parse errors - fails.
//
// 2. No file under backend/ (tests and node_modules aside) may reference a file
//    in staff/routes/ except backend/app/routers.mjs, so nothing else can reach
//    the mounted Router and register on it. (The staff barrel does not export
//    it.) How routers.mjs and app.mjs mount it is pinned by
//    check-staff-routes-mount.mjs.
//
// 3. STAFF-CR-06, repo-wide: no file under backend/ (tests and node_modules
//    aside) may call requireStaffCapability / requireAnyStaffCapability naming
//    'time-back' or 'jobs.hold' - imported, aliased or reached as a member -
//    so neither capability can be mounted on an admin or any other route.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as espree from 'espree';
import { load, staticPath } from './staff-routes-ast.mjs';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..');
const BACKEND_DIR = path.join(REPO_ROOT, 'backend');
const STAFF_ROUTES_REL = path.join('modules', 'staff', 'routes');
const STAFF_ROUTES_DIR = path.join(BACKEND_DIR, STAFF_ROUTES_REL);
const ALLOWED_IMPORTERS_REL = [path.join('app', 'routers.mjs')];

const GUARD_NAMES = new Set([
  'requireStaffCapability',
  'requireAnyStaffCapability',
  'requireStaffRole',
]);
const ROUTE_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const SOURCE_FILE_RE = /\.(?:js|mjs|cjs)$/;
const SKIP_DIRS = new Set(['node_modules', '__tests__', 'tests', 'test', 'coverage']);
const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?js$/;
// requireStaffRole is enough for exactly these registrations.
const ROLE_ONLY_ALLOWED = new Set(['POST /checkin/request', 'POST /checkin/verify', 'GET /me']);

// Extra rules on the capabilities a guard names: each is
// (capabilities: string[], routeKey: string) => reason | null.
const FRESH_PROOF_CAPABILITIES = ['time-back', 'jobs.hold'];
const CAPABILITY_RULES = [
  // STAFF-CR-06: these capabilities need a purpose-bound, one-time fresh
  // check-in proof that the 30-day device cookie cannot stand in for. Refused
  // outright until requireFreshStaffProof exists; then relax this to "must be
  // preceded by requireFreshStaffProof".
  (capabilities) => {
    const hit = capabilities.find((c) => FRESH_PROOF_CAPABILITIES.includes(c));
    return hit
      ? `capability '${hit}' needs a fresh-proof guard (requireFreshStaffProof), which does not exist yet; ` +
          'a trusted 30-day device alone must not authorize it (see docs/features/admin-time-back.md, "Blocking dependency")'
      : null;
  },
];

const isStringLiteral = (n) => n?.type === 'Literal' && typeof n.value === 'string';
const samePath = (a, b) => path.relative(a, b) === '';
const parse = (src) =>
  espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', loc: true });

/** Apply CAPABILITY_RULES to a recognized guard; returns the first reason or null. */
function capabilityRuleViolation(guard, routeKey) {
  for (const rule of CAPABILITY_RULES) {
    const reason = rule(guard.capabilities, routeKey);
    if (reason) return reason;
  }
  return null;
}

/** A DIRECT guard argument -> { kind: 'capability' | 'role', capabilities } or null. */
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

/** `const r = express.Router()` / `Router()` with at most one literal-only options object. */
function routerDeclarationName(stmt, b) {
  if (stmt.kind !== 'const' || stmt.declarations.length !== 1) return null;
  const [{ id, init }] = stmt.declarations;
  if (id.type !== 'Identifier' || init?.type !== 'CallExpression' || init.optional) return null;
  const c = init.callee;
  const factory =
    (c.type === 'Identifier' && b.factoryNames.has(c.name)) ||
    (c.type === 'MemberExpression' &&
      !c.computed &&
      !c.optional &&
      c.object.type === 'Identifier' &&
      b.expressNames.has(c.object.name) &&
      c.property.name === 'Router');
  const literalOptions = (o) =>
    o.type === 'ObjectExpression' &&
    o.properties.every(
      (p) =>
        p.type === 'Property' &&
        p.kind === 'init' &&
        !p.computed &&
        !p.method &&
        !p.shorthand &&
        p.key.type === 'Identifier' &&
        p.value.type === 'Literal'
    );
  const argsOk =
    init.arguments.length === 0 ||
    (init.arguments.length === 1 && literalOptions(init.arguments[0]));
  return factory && argsOk ? id.name : null;
}

/** Record one import declaration's bindings, or return why it is not allowed. */
function admitImport(node, file, moduleDir, b) {
  if (node.specifiers.length === 0) return 'side-effect imports are not allowed';
  if (node.attributes?.length) return 'import attributes are not allowed';
  const source = String(node.source.value);
  const named = (s) =>
    s.type === 'ImportSpecifier' && s.imported.type === 'Identifier' ? s.imported.name : null;
  const staged = [];
  if (source === 'express') {
    for (const s of node.specifiers) {
      if (s.type === 'ImportDefaultSpecifier') staged.push(() => b.expressNames.add(s.local.name));
      else if (named(s) === 'Router') staged.push(() => b.factoryNames.add(s.local.name));
      else return "only `import express` or `import { Router }` from 'express' is allowed";
    }
  } else if (source.startsWith('./') || source.startsWith('../')) {
    const resolved = path.resolve(path.dirname(file), source);
    if (samePath(resolved, path.join(moduleDir, 'middleware', 'requireStaffCapability.mjs'))) {
      for (const s of node.specifiers) {
        const name = named(s);
        if (!GUARD_NAMES.has(name))
          return 'only the named guards may be imported from the middleware';
        staged.push(() => b.guards.set(s.local.name, name));
      }
    } else if (
      samePath(path.dirname(resolved), path.join(moduleDir, 'controllers')) &&
      resolved.endsWith('.mjs')
    ) {
      for (const s of node.specifiers) {
        const ok = s.type === 'ImportDefaultSpecifier' || (named(s) && named(s) !== 'default');
        if (!ok) return 'only named or default controller imports are allowed';
        staged.push(() => b.controllers.add(s.local.name));
      }
    } else {
      return `import from '${source}' is not allowed (express, the guard middleware and ../controllers/*.mjs only)`;
    }
  } else {
    return `import from '${source}' is not allowed (express, the guard middleware and ../controllers/*.mjs only)`;
  }
  staged.forEach((add) => add());
  return null;
}

const isHandler = (n, controllers) =>
  (n.type === 'Identifier' && controllers.has(n.name)) ||
  (n.type === 'MemberExpression' &&
    !n.computed &&
    !n.optional &&
    n.property.type === 'Identifier' &&
    isHandler(n.object, controllers));

/** Check `<router>.<method>(...)`; returns a failure reason or null. */
function registrationViolation(expr, b) {
  const callee = expr.type === 'CallExpression' && !expr.optional ? expr.callee : null;
  const method =
    callee?.type === 'MemberExpression' &&
    !callee.computed &&
    !callee.optional &&
    callee.object.type === 'Identifier' &&
    callee.object.name === b.routerId
      ? callee.property.name
      : null;
  if (!b.routerId || !(ROUTE_METHODS.has(method) || method === 'use')) {
    return 'only <router>.<get|post|put|patch|delete|use>(...) registrations on the declared Router are allowed';
  }
  const args = expr.arguments;
  if (args.some((a) => a.type === 'SpreadElement'))
    return `spread arguments in ${method}( are not allowed`;
  if (method === 'use') {
    const ok =
      args.length > 0 &&
      args.every((a) => {
        const g = recognizeGuard(a, b.guards);
        return g?.kind === 'capability' && !capabilityRuleViolation(g, 'USE');
      });
    return ok
      ? null
      : 'router.use( is allowed only with direct capability guards as every argument';
  }
  const [first] = args;
  const routeKey = `${method.toUpperCase()} ${isStringLiteral(first) ? first.value : '<non-literal path>'}`;
  if (!isStringLiteral(first)) return `${routeKey}: the path must be a string literal`;
  const guard = args.length >= 3 ? recognizeGuard(args[1], b.guards) : null;
  const guardOk = guard && (guard.kind === 'capability' || ROLE_ONLY_ALLOWED.has(routeKey));
  if (!guardOk) {
    const later = args.slice(2).some((a) => recognizeGuard(a, b.guards));
    return (
      `${routeKey} does not start with a direct requireStaffCapability/requireAnyStaffCapability guard` +
      (later ? ' (the guard must be the first argument after the path)' : '')
    );
  }
  const ruled = capabilityRuleViolation(guard, routeKey);
  if (ruled) return `${routeKey}: ${ruled}`;
  if (!args.slice(2).every((a) => isHandler(a, b.controllers))) {
    return `${routeKey}: every argument after the guard must be a controller import (no calls, inline functions or other values)`;
  }
  return null;
}

/**
 * Scan one source string against the grammar. `moduleDir` is the staff module
 * directory (the routes directory's parent); guard and controller imports are
 * resolved against `file` and must land under it.
 */
export function scanSource(src, file, { moduleDir = path.resolve(path.dirname(file), '..') } = {}) {
  let ast;
  try {
    ast = parse(src);
  } catch (err) {
    return [{ file, line: err.lineNumber ?? 0, reason: `parse error: ${err.message}` }];
  }
  const failures = [];
  const fail = (node, reason) => failures.push({ file, line: node.loc.start.line, reason });
  const b = {
    expressNames: new Set(),
    factoryNames: new Set(),
    guards: new Map(),
    controllers: new Set(),
    routerId: null,
  };
  // Imports are hoisted, so admit them first.
  for (const stmt of ast.body) {
    if (stmt.type !== 'ImportDeclaration') continue;
    const reason = admitImport(stmt, file, moduleDir, b);
    if (reason) fail(stmt, reason);
  }
  let routers = 0;
  let exports = 0;
  for (const stmt of ast.body) {
    if (stmt.type === 'ImportDeclaration') continue;
    if (stmt.type === 'VariableDeclaration' && routerDeclarationName(stmt, b)) {
      if (++routers > 1) fail(stmt, 'only one Router may be declared per staff routes file');
      else b.routerId = routerDeclarationName(stmt, b);
    } else if (stmt.type === 'ExpressionStatement') {
      const reason = registrationViolation(stmt.expression, b);
      if (reason) fail(stmt, reason);
    } else if (
      stmt.type === 'ExportDefaultDeclaration' &&
      stmt.declaration.type === 'Identifier' &&
      b.routerId &&
      stmt.declaration.name === b.routerId
    ) {
      exports++;
    } else {
      fail(
        stmt,
        `${stmt.type} is not allowed in a staff routes file (see the grammar in this check)`
      );
    }
  }
  if (routers === 0)
    failures.push({ file, line: 1, reason: 'no `const <router> = express.Router()` declared' });
  if (exports === 0) failures.push({ file, line: 1, reason: 'missing `export default <router>`' });
  return failures.sort((x, y) => x.line - y.line);
}

/** Scan every file under routesDir against the grammar. Returns [{file, line, reason}]. */
export function scanStaffRoutes(routesDir = STAFF_ROUTES_DIR) {
  if (!fs.existsSync(routesDir)) {
    return [{ file: routesDir, line: 0, reason: 'staff routes directory not found' }];
  }
  const moduleDir = path.dirname(routesDir);
  const failures = [];
  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (SOURCE_FILE_RE.test(entry.name)) {
        failures.push(...scanSource(fs.readFileSync(full, 'utf8'), full, { moduleDir }));
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

/** Walk an AST, calling visit(node) for every node. */
function walk(node, visit) {
  visit(node);
  for (const key of espree.VisitorKeys[node.type] ?? []) {
    const child = node[key];
    if (Array.isArray(child)) child.forEach((c) => c && walk(c, visit));
    else if (child && typeof child.type === 'string') walk(child, visit);
  }
}

/**
 * No backend source except app/routers.mjs may name a file in the
 * staff routes directory. Any relative string (import, export-from, dynamic
 * import, require, createRequire, new URL, ...) that resolves into that
 * directory counts. Tests and node_modules are skipped.
 */
export function scanRouteImporters(backendRoot = BACKEND_DIR) {
  const routesDir = path.join(backendRoot, STAFF_ROUTES_REL);
  const allowed = ALLOWED_IMPORTERS_REL.map((rel) => path.join(backendRoot, rel));
  const intoRoutes = (target) => {
    const rel = path.relative(routesDir, target);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  };
  const failures = [];
  const checkFile = (file) => {
    if (allowed.some((a) => samePath(a, file)) || intoRoutes(file)) return;
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes('routes')) return; // every path into staff/routes contains it
    let ast;
    try {
      ast = parse(src);
    } catch {
      try {
        ast = espree.parse(src, { ecmaVersion: 'latest', sourceType: 'script', loc: true });
      } catch (err) {
        failures.push({
          file,
          line: err.lineNumber ?? 0,
          reason: 'cannot parse; unable to prove it does not import staff routes',
        });
        return;
      }
    }
    walk(ast, (node) => {
      const value = isStringLiteral(node)
        ? node.value
        : node.type === 'TemplateLiteral' && node.expressions.length === 0
          ? node.quasis[0].value.cooked
          : null;
      if (value && /^\.\.?\//.test(value) && intoRoutes(path.resolve(path.dirname(file), value))) {
        failures.push({
          file,
          line: node.loc.start.line,
          reason: `references staff routes ('${value}'); only app/routers.mjs may`,
        });
      }
    });
  };
  const walkDir = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) walkDir(full);
      } else if (SOURCE_FILE_RE.test(entry.name) && !TEST_FILE_RE.test(entry.name)) {
        checkFile(full);
      }
    }
  };
  walkDir(backendRoot);
  return failures;
}

const CAPABILITY_GUARD_NAMES = new Set(['requireStaffCapability', 'requireAnyStaffCapability']);

/** Backend source files outside tests and node_modules. */
function backendSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) backendSourceFiles(full, out);
    } else if (SOURCE_FILE_RE.test(entry.name) && !TEST_FILE_RE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * STAFF-CR-06 everywhere: any capability-guard call under backend/ whose
 * literal capability (direct, or in the array) is a fresh-proof capability.
 * Returns [{file, line, reason}].
 */
export function scanFreshProofCapabilityUse(backendRoot = BACKEND_DIR) {
  const failures = [];
  for (const file of backendSourceFiles(backendRoot)) {
    const src = fs.readFileSync(file, 'utf8');
    // Every route to a guard - import, alias or member - spells its name.
    if (!src.includes('StaffCapability')) continue;
    let parsed;
    try {
      parsed = load(file);
    } catch (err) {
      failures.push({
        file,
        line: err.lineNumber ?? 0,
        reason: 'cannot parse; unable to prove it does not mount time-back or jobs.hold',
      });
      continue;
    }
    const locals = new Set(CAPABILITY_GUARD_NAMES);
    for (const n of parsed.nodes) {
      if (
        n.type === 'ImportSpecifier' &&
        CAPABILITY_GUARD_NAMES.has(n.imported.name ?? n.imported.value)
      ) {
        locals.add(n.local.name);
      }
    }
    for (const n of parsed.nodes) {
      if (n.type !== 'CallExpression') continue;
      const c = n.callee;
      const isGuard =
        (c.type === 'Identifier' && locals.has(c.name)) ||
        (c.type === 'MemberExpression' &&
          CAPABILITY_GUARD_NAMES.has(c.computed ? staticPath(c.property) : c.property.name));
      if (!isGuard) continue;
      const named = n.arguments.flatMap((a) =>
        a.type === 'ArrayExpression' ? a.elements.map((e) => staticPath(e)) : [staticPath(a)]
      );
      const hit = named.find((cap) => FRESH_PROOF_CAPABILITIES.includes(cap));
      if (hit) {
        failures.push({
          file,
          line: n.loc.start.line,
          reason:
            `capability '${hit}' must not be mounted on any route until requireFreshStaffProof exists ` +
            '(STAFF-CR-06; see docs/features/admin-time-back.md, "Blocking dependency")',
        });
      }
    }
  }
  return failures;
}

function main() {
  const failures = [
    ...scanStaffRoutes(),
    ...scanRouteImporters(),
    ...scanFreshProofCapabilityUse(),
  ];
  if (failures.length > 0) {
    console.error('\nStaff routes doctrine violations:');
    for (const f of failures) {
      console.error(`  ${path.relative(REPO_ROOT, f.file)}:${f.line}  ${f.reason}`);
    }
    console.error(
      '\nStaff route files must match the allow-list grammar at the top of ' +
        'scripts/doctrine-checks/check-staff-routes-guarded.mjs, and only ' +
        'backend/app/routers.mjs may import them.'
    );
    process.exit(1);
  }
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
