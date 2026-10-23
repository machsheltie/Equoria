/**
 * The view of a horse that breeding predictions may compute with
 * (Equoria-q4uem.9 slice 4; Equoria-3867b).
 *
 * Owner ruling S-Q9 (Stacey, 2026-10-16): a trait, once REVEALED, is public
 * forever, to everyone, on stallions and ancestors alike; an UNREVEALED hidden
 * trait stays hidden — for every horse, the caller's own included. In the data,
 * "revealed" means moved out of `epigeneticModifiers.hidden` into `.positive`
 * / `.negative`.
 *
 * The hidden list is emptied BEFORE any prediction service sees the horse, so
 * an unrevealed trait can be neither shown nor inferred from a score that
 * counted it. The legacy `hiddenTraits` / `traits.hidden` shapes some readers
 * still look for (they do not exist on the Horse model today — Equoria-3867b)
 * are emptied too, so fixing those readers later cannot reopen the leak.
 *
 * Competition records are NOT withheld. Owner ruling 2026-10-19 (Stacey,
 * decision 14): show records are always public, including other players'
 * horses in breeding predictions, so a stallion's or an ancestor's results
 * and discipline scores feed the predictions like the caller's own. (Until
 * then they were withheld behind a switch, q4uem.9 slice 4b.)
 */
import { asFlagArray, asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';

function withoutHidden(horse) {
  const modifiers = asFlagObject(horse.epigeneticModifiers);
  const view = {
    ...horse,
    epigeneticModifiers: {
      ...modifiers,
      positive: asFlagArray(modifiers.positive),
      negative: asFlagArray(modifiers.negative),
      hidden: [],
    },
  };
  if ('hiddenTraits' in horse) {
    view.hiddenTraits = [];
  }
  if (horse.traits && typeof horse.traits === 'object') {
    view.traits = { ...horse.traits, hidden: [] };
  }
  return view;
}

/**
 * A copy of `horse` (and of an included `sire` / `dam` row) with every
 * unrevealed hidden trait removed. Null-safe.
 *
 * @param {object | null | undefined} horse
 * @returns {object | null | undefined}
 */
export function withoutUnrevealedTraits(horse) {
  if (!horse || typeof horse !== 'object') {
    return horse;
  }
  const view = withoutHidden(horse);
  if (horse.sire && typeof horse.sire === 'object') {
    view.sire = withoutHidden(horse.sire);
  }
  if (horse.dam && typeof horse.dam === 'object') {
    view.dam = withoutHidden(horse.dam);
  }
  return view;
}
