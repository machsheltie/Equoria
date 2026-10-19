/**
 * The public view of a horse's main traits (Equoria-6dace, Equoria-3867b).
 *
 * Owner ruling (Stacey, 2026-10-16): an UNREVEALED hidden trait stays hidden
 * from everyone, the horse's owner included; once revealed (moved out of
 * `epigeneticModifiers.hidden` into `.positive` / `.negative` by revealTraits)
 * it is public forever. A COUNT of hidden traits may be shown.
 *
 * Game logic keeps reading the stored `epigeneticModifiers` unchanged. These
 * helpers decide only what may be SENT to a client:
 *   - publicTraitModifiers: `{ positive, negative, hiddenCount }`. Only those
 *     three keys, so a key added to the column later is not sent by accident.
 *   - withPublicTraitModifiers: the same view applied to every
 *     `epigeneticModifiers` value anywhere in a response body (the response
 *     guard middleware runs it on every JSON response).
 *   - withoutHiddenTraitHistory: drops history rows (TraitHistoryLog) that
 *     name a trait still hidden on the horse. Checked at READ time against the
 *     horse's current hidden list, so rows written before this fix are covered
 *     and a row reappears by itself once its trait is revealed.
 *
 * Pure: no database access, inputs are never mutated.
 */
import { asFlagArray, asFlagObject } from './jsonbArrayGuard.mjs';

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
 * @param {unknown} modifiers
 * @returns {{ positive: string[], negative: string[], hiddenCount: number }}
 */
export function publicTraitModifiers(modifiers) {
  const source = asFlagObject(modifiers);
  let hiddenCount = 0;
  if (Array.isArray(source.hidden)) {
    hiddenCount = source.hidden.length;
  } else if (Number.isInteger(source.hiddenCount) && source.hiddenCount > 0) {
    hiddenCount = source.hiddenCount;
  }
  return {
    positive: [...asFlagArray(source.positive)],
    negative: [...asFlagArray(source.negative)],
    hiddenCount,
  };
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

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function scrub(value, seen) {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return value;
    }
    seen.add(value);
    let copy = null;
    value.forEach((item, i) => {
      const next = scrub(item, seen);
      if (next !== item) {
        copy ??= [...value];
        copy[i] = next;
      }
    });
    return copy ?? value;
  }
  if (!isPlainObject(value)) {
    // Dates, Decimals, Buffers and primitives carry no trait list.
    return value;
  }
  if (seen.has(value)) {
    return value;
  }
  seen.add(value);
  let copy = null;
  for (const key of Object.keys(value)) {
    const item = value[key];
    const next =
      key === 'epigeneticModifiers' && item && typeof item === 'object'
        ? publicTraitModifiers(item)
        : scrub(item, seen);
    if (next !== item) {
      copy ??= { ...value };
      copy[key] = next;
    }
  }
  return copy ?? value;
}

/**
 * `body` with every `epigeneticModifiers` object (at any depth, in objects and
 * arrays) replaced by its public view. Copy-on-write: unchanged branches keep
 * their identity and the input is never mutated, so a cached object handed to
 * res.json is not altered for the next reader.
 *
 * @template T
 * @param {T} body
 * @returns {T}
 */
export function withPublicTraitModifiers(body) {
  return scrub(body, new WeakSet());
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
