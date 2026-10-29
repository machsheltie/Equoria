/**
 * Copy-on-write rewrite of the objects in a response body (shared by the
 * response guards' public views: publicGenotypeView.mjs, publicBreedProfileView.mjs).
 *
 * `rewriteMatching(body, matches, rewrite)` returns `body` with every plain
 * object for which `matches(node)` is true replaced by `rewrite(node)`, at any
 * depth. Only containers that lead to a rewritten object are copied, a shared or
 * cyclic container maps to one copy, and the input is never mutated (a cached
 * row handed to res.json stays whole for game logic).
 *
 * Pure: no database access.
 */

// A plain object from any realm (Prisma rows under Jest's VM have another
// realm's Object.prototype); class instances (Date, Decimal) are left alone.
export function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || Object.getPrototypeOf(proto) === null;
}

const isContainer = value => Array.isArray(value) || isPlainObject(value);

/** Every matching object, and every container above one. */
function containersToCopy(root, matches) {
  const parentsOf = new Map();
  const holders = [];
  const visited = new Set();
  const stack = isContainer(root) ? [root] : [];
  while (stack.length > 0) {
    const node = stack.pop();
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    if (!Array.isArray(node) && matches(node)) {
      holders.push(node);
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (isContainer(child)) {
        if (!parentsOf.has(child)) {
          parentsOf.set(child, new Set());
        }
        parentsOf.get(child).add(node);
        stack.push(child);
      }
    }
  }
  const copy = new Set();
  const pending = [...holders];
  while (pending.length > 0) {
    const node = pending.pop();
    if (copy.has(node)) {
      continue;
    }
    copy.add(node);
    pending.push(...(parentsOf.get(node) ?? []));
  }
  return copy;
}

/**
 * @template T
 * @param {T} body
 * @param {(node: object) => boolean} matches - called for plain objects only
 * @param {(node: object) => object} rewrite - the replacement's own keys; its
 *   values are still walked, so a matching object nested in them is rewritten too
 * @returns {T}
 */
export function rewriteMatching(body, matches, rewrite) {
  const toCopy = containersToCopy(body, matches);
  const memo = new Map();
  const build = value => {
    if (!toCopy.has(value)) {
      return value;
    }
    if (memo.has(value)) {
      return memo.get(value);
    }
    const out = Array.isArray(value) ? [] : {};
    memo.set(value, out);
    const source = !Array.isArray(value) && matches(value) ? rewrite(value) : value;
    for (const key of Object.keys(source)) {
      out[key] = build(source[key]);
    }
    return out;
  };
  return build(body);
}
