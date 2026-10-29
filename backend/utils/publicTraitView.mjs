/**
 * The public view of a horse's main traits (Equoria-6dace, Equoria-3867b).
 *
 * Owner ruling (Stacey, 2026-10-16): an UNREVEALED hidden trait stays hidden
 * from players, the horse's owner included; once revealed (moved out of
 * `epigeneticModifiers.hidden` into `.positive` / `.negative`)
 * it is public forever. A COUNT of hidden traits may be shown.
 * Owner ruling 2026-10-19, narrowed by the three staff levels of 2026-10-23
 * (Equoria-4tleh, Equoria-w4bvy): the game owner (the `traits.hidden.view`
 * capability, owner role only) sees hidden trait names; admins, moderators and
 * players never do. Callers pass `{ includeHidden: true }` only for that viewer.
 *
 * Game logic keeps reading the stored `epigeneticModifiers` unchanged. These
 * helpers decide only what may be SENT to a client:
 *   - publicTraitModifiers: `{ positive, negative, hiddenCount }`. Only those
 *     three keys, so a key added to the column later is not sent by accident.
 *     With `includeHidden` (the owner's view) a fourth, `hidden`, names them.
 *   - withPublicTraitModifiers: the same view applied to every
 *     `epigeneticModifiers` value anywhere in a response body (the response
 *     guard middleware runs it on every JSON response), with a sibling
 *     `traitLabels` ({ id: authored name } for each shown trait, Equoria-no441).
 *   - withoutHiddenTraitHistory: drops history rows (TraitHistoryLog) that
 *     name a trait still hidden on the horse. Checked at READ time against the
 *     horse's current hidden list, so rows written before this fix are covered
 *     and a row reappears by itself once its trait is revealed.
 *
 * Pure: no database access, inputs are never mutated.
 */
import { asFlagArray, asFlagObject } from './jsonbArrayGuard.mjs';
import { playerTraitLabels } from './epigeneticTraits.mjs';

/**
 * The trait keys currently hidden on a horse, as a Set.
 *
 * @param {unknown} modifiers - a horse's `epigeneticModifiers` value
 * @returns {Set<string>}
 */
export function hiddenTraitSet(modifiers) {
  return new Set(asFlagArray(asFlagObject(modifiers).hidden));
}

/**
 * The client-safe view of `epigeneticModifiers`. Idempotent: a view passed
 * back in keeps its `hiddenCount` (a controller may build the view and the
 * response guard then sees it again).
 *
 * `includeHidden` is the game owner's view only (`traits.hidden.view`): it
 * adds `hidden`, the still-hidden trait keys. Every other viewer gets the
 * three keys above and never `hidden`.
 *
 * @param {unknown} modifiers
 * @param {{ includeHidden?: boolean }} [options]
 * @returns {{ positive: string[], negative: string[], hiddenCount: number, hidden?: string[] }}
 */
export function publicTraitModifiers(modifiers, { includeHidden = false } = {}) {
  const source = asFlagObject(modifiers);
  let hiddenCount = 0;
  if (Array.isArray(source.hidden)) {
    hiddenCount = source.hidden.length;
  } else if (Number.isInteger(source.hiddenCount) && source.hiddenCount > 0) {
    hiddenCount = source.hiddenCount;
  }
  const view = {
    positive: [...asFlagArray(source.positive)],
    negative: [...asFlagArray(source.negative)],
    hiddenCount,
  };
  if (includeHidden === true) {
    view.hidden = [...asFlagArray(source.hidden)];
  }
  return view;
}

/**
 * The horse's dormant trait keys: revealed, switched off and still carried
 * (Equoria-nrto5). Revealed, so their names may be sent; owner ruling q213
 * (2026-10-28) shows them on the horse page, greyed out. A key that is also
 * still hidden is left out, so a malformed row can never name a hidden trait.
 *
 * @param {unknown} modifiers
 * @returns {string[]}
 */
export function dormantTraitKeys(modifiers) {
  const hidden = hiddenTraitSet(modifiers);
  return asFlagArray(asFlagObject(modifiers).dormant).filter(key => !hidden.has(key));
}

/**
 * The visible trait keys (positive then negative) of a horse.
 *
 * @param {unknown} modifiers
 * @returns {string[]}
 */
export function visibleTraitKeys(modifiers) {
  const view = publicTraitModifiers(modifiers);
  return [...view.positive, ...view.negative];
}

// A plain object from ANY realm: its prototype is null or some realm's
// Object.prototype (whose own prototype is null). Comparing with this realm's
// Object.prototype alone missed rows built in another realm (Prisma rows under
// Jest's VM), which then went out unscrubbed (fix round 1). Class instances
// (Date, Decimal, Buffer) still fail the check.
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || Object.getPrototypeOf(proto) === null;
}

const isContainer = value => Array.isArray(value) || isPlainObject(value);
const holdsModifiers = (node, key) =>
  key === 'epigeneticModifiers' &&
  !Array.isArray(node) &&
  node[key] &&
  typeof node[key] === 'object';

/**
 * The containers that must be copied: every object holding an
 * `epigeneticModifiers` value, and every container from which one can be
 * reached. Computed over the whole graph (reverse edges from each holder), so
 * a shared or cyclic reference is classified the same at every occurrence.
 */
function containersToCopy(root) {
  const parentsOf = new Map(); // child container -> Set of parent containers
  const holders = [];
  const visited = new Set();
  const stack = isContainer(root) ? [root] : [];
  while (stack.length > 0) {
    const node = stack.pop();
    if (visited.has(node)) {
      continue;
    }
    visited.add(node);
    for (const key of Object.keys(node)) {
      if (holdsModifiers(node, key)) {
        holders.push(node);
        continue; // the value is replaced whole; nothing inside it is sent
      }
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
 * `body` with every `epigeneticModifiers` object (at any depth, in objects and
 * arrays) replaced by its public view. Copy-on-write: only containers that
 * lead to such a value are copied, unchanged branches keep their identity and
 * the input is never mutated, so a cached object handed to res.json is not
 * altered for the next reader.
 *
 * A container that appears more than once (a parent row shared by siblings,
 * or a true cycle) maps to ONE copy, memoised per input object and registered
 * before its children are built, so every occurrence — and every path round a
 * cycle — reaches the scrubbed copy, never the raw row (fix round 1, C1).
 *
 * `includeHidden` (the game owner only) keeps each still-hidden list as
 * `hidden` and labels those traits too; see publicTraitModifiers.
 *
 * @template T
 * @param {T} body
 * @param {{ includeHidden?: boolean }} [options]
 * @returns {T}
 */
export function withPublicTraitModifiers(body, { includeHidden = false } = {}) {
  const viewOptions = { includeHidden: includeHidden === true };
  const toCopy = containersToCopy(body);
  const memo = new Map();
  const build = value => {
    if (!toCopy.has(value)) {
      return value; // primitives, Dates, Decimals and branches with no trait list
    }
    if (memo.has(value)) {
      return memo.get(value);
    }
    const out = Array.isArray(value) ? [] : {};
    memo.set(value, out);
    for (const key of Object.keys(value)) {
      out[key] = holdsModifiers(value, key)
        ? publicTraitModifiers(value[key], viewOptions)
        : build(value[key]);
    }
    if (!Array.isArray(value) && holdsModifiers(value, 'epigeneticModifiers')) {
      // Equoria-no441: each shown trait id travels with its authored name.
      // The owner's view labels the hidden traits as well, so she reads
      // authored names, never code names.
      const shown = viewOptions.includeHidden
        ? [
            ...visibleTraitKeys(value.epigeneticModifiers),
            ...hiddenTraitSet(value.epigeneticModifiers),
          ]
        : visibleTraitKeys(value.epigeneticModifiers);
      out.traitLabels = playerTraitLabels(shown);
    }
    return out;
  };
  return build(body);
}

/**
 * History rows minus those naming a trait still hidden on their horse.
 *
 * @param {Array<{ traitName?: string, horseId?: number }>} rows
 * @param {(row: object) => unknown} modifiersOf - the row's horse's
 *   `epigeneticModifiers` (e.g. `() => horse.epigeneticModifiers`)
 * @returns {Array<object>}
 */
export function withoutHiddenTraitHistory(rows, modifiersOf) {
  return asFlagArray(rows).filter(row => !hiddenTraitSet(modifiersOf(row)).has(row?.traitName));
}
