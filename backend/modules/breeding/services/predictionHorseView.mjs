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
 * Competition data (competitionResults, disciplineScores) of a horse the
 * VIEWER does not own is withheld by `toPredictionView` — design §0 default
 * (q4uem.9 slice 4b) until the owner rules on the open question (keep private
 * / show publicly / show a summary). SHOW_OTHER_PLAYERS_COMPETITION_DATA is
 * the single point that flips it.
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

/**
 * Open owner question (q4uem.9 slice 4 report, option A is this default):
 * other players' competition records are withheld from breeding predictions.
 * Flip to `true` only on the owner's ruling.
 */
export const SHOW_OTHER_PLAYERS_COMPETITION_DATA = false;

function withoutCompetition(horse) {
  const view = { ...horse };
  if ('competitionResults' in horse) {
    view.competitionResults = [];
  }
  if ('disciplineScores' in horse) {
    view.disciplineScores = {};
  }
  return view;
}

/**
 * The view breeding predictions compute with, for one viewer: unrevealed
 * hidden traits removed for every horse (S-Q9) and, while the competition
 * default stands, competition records removed for every horse the viewer does
 * not own (the caller's own horses keep theirs). Empty values replace removed
 * ones (`[]` / `{}`) so response shapes stay stable for the frontend.
 *
 * FAILS CLOSED (review, slice 4 round 2): without a `viewerId` nobody counts as
 * the owner, so EVERY horse's competition records are removed. A caller that
 * needs the caller's own records must pass the viewer; forgetting it can lose
 * data, never leak it.
 *
 * @param {object | null | undefined} horse
 * @param {{ viewerId?: string }} [options]
 */
export function toPredictionView(horse, { viewerId } = {}) {
  const view = withoutUnrevealedTraits(horse);
  if (!view || SHOW_OTHER_PLAYERS_COMPETITION_DATA) {
    return view;
  }
  const scoped = row =>
    row && (viewerId === undefined || row.userId !== viewerId) ? withoutCompetition(row) : row;
  const result = scoped(view);
  if (view.sire && typeof view.sire === 'object') {
    result.sire = scoped(view.sire);
  }
  if (view.dam && typeof view.dam === 'object') {
    result.dam = scoped(view.dam);
  }
  return result;
}
