/**
 * The public view of a horse's colour genotype (Equoria-2wdp8).
 *
 * Owner ruling 2026-10-26 (q72): colour genetics stay hidden until the owner
 * pays the vet for Genetic Testing. Owner ruling 2026-10-28 (q164): the data
 * the game sends a player hides anything that could be used to find loopholes.
 *
 * Many routes send whole horse rows (the ownership middleware loads every
 * column; nested sire/dam rows travel with them), and every one of them carries
 * `colorGenotype`. `withoutUntestedGenotype` drops that key from every object
 * in a response body that is not itself marked `colorGeneticsTested: true`, so
 * a row whose test flag was not selected is held back too (fails closed).
 *
 * Copy-on-write like publicTraitView.mjs: only containers that lead to a
 * dropped genotype are copied, a shared or cyclic container maps to one copy,
 * and the input is never mutated (a cached row handed to res.json stays whole
 * for game logic).
 *
 * Pure: no database access.
 */

// A plain object from any realm (Prisma rows under Jest's VM have another
// realm's Object.prototype); class instances (Date, Decimal) are left alone.
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || Object.getPrototypeOf(proto) === null;
}

const isContainer = value => Array.isArray(value) || isPlainObject(value);

const holdsUntestedGenotype = node =>
  !Array.isArray(node) && Object.hasOwn(node, 'colorGenotype') && node.colorGeneticsTested !== true;

/** Every container holding an untested genotype, and every container above one. */
function containersToCopy(root) {
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
    if (holdsUntestedGenotype(node)) {
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
 * `body` with `colorGenotype` removed from every object (at any depth) not
 * marked `colorGeneticsTested: true`.
 *
 * @template T
 * @param {T} body
 * @returns {T}
 */
export function withoutUntestedGenotype(body) {
  const toCopy = containersToCopy(body);
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
    const drop = holdsUntestedGenotype(value);
    for (const key of Object.keys(value)) {
      if (drop && key === 'colorGenotype') {
        continue;
      }
      out[key] = build(value[key]);
    }
    return out;
  };
  return build(body);
}
