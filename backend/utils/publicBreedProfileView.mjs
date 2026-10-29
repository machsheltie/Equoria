/**
 * The public view of a breed's genetic profile (Equoria-9kakx).
 *
 * Owner ruling 2026-10-29 (q274): "the player gets to see the listed color name
 * and markings and temperament but none of the odds or genetics behind it ...
 * They get no color shade markings or temperament odds."
 * Owner ruling 2026-10-29 (q292): the breed stat bars come out of the new-player
 * breed picker. They were the only player-side reader of the profile's last
 * remaining key (`ratingProfiles`, the breed's conformation and gait ranges).
 *
 * `breeds.breedGeneticProfile` holds the breed's odds and ranges: alleleWeights,
 * allowedAlleles, disallowedCombinations, shadeBias, markingBias,
 * advancedMarkingsBias, booleanModifiersPrevalence, temperamentWeights,
 * starterStats and ratingProfiles. A player needs none of it, so
 * `withoutBreedOdds` removes the `breedGeneticProfile` key from every object
 * anywhere in a response body (whole breed rows joined onto horses, foals,
 * results, training).
 *
 * Copy-on-write (utils/copyOnWriteRewrite.mjs): the input is never mutated.
 * Pure: no database access.
 */
import { rewriteMatching } from './copyOnWriteRewrite.mjs';

const holdsProfile = node => Object.hasOwn(node, 'breedGeneticProfile');

function withoutProfileKey(node) {
  const { breedGeneticProfile: _dropped, ...rest } = node;
  return rest;
}

/**
 * `body` with `breedGeneticProfile` removed from every object (at any depth).
 *
 * @template T
 * @param {T} body
 * @returns {T}
 */
export function withoutBreedOdds(body) {
  return rewriteMatching(body, holdsProfile, withoutProfileKey);
}
