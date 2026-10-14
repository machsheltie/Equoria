// Shared AST utilities for check-staff-routes-mount.mjs (STAFF-CR-05). Not a
// check itself: run-all.sh only runs check-*.mjs.

import fs from 'node:fs';
import path from 'node:path';
import * as espree from 'espree';

export const parse = (src) =>
  espree.parse(src, { ecmaVersion: 'latest', sourceType: 'module', loc: true });

export const STAFF_MOUNT = '/api/v1/staff';
export const ROUTE_CALL_METHODS = new Set([
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

export const isStringLiteral = (n) => n?.type === 'Literal' && typeof n.value === 'string';
export const samePath = (a, b) => path.relative(a, b) === '';

/** Parse a file and index every node's parent. */
export function load(file) {
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
export function references({ nodes, parents }, name, bindingIds) {
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
export function importedLocal(ast, file, target, imported) {
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
export const isUseStatement = (stmt, obj, match) =>
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
export const staticPath = (n) =>
  isStringLiteral(n)
    ? n.value
    : n?.type === 'TemplateLiteral' && n.expressions.length === 0
      ? n.quasis[0].value.cooked
      : null;

/** A path argument the check cannot judge: array, regex or template with expressions. */
export const opaquePath = (n) =>
  n?.type === 'ArrayExpression' ||
  (n?.type === 'Literal' && n.regex !== undefined) ||
  (n?.type === 'TemplateLiteral' && n.expressions.length > 0);
