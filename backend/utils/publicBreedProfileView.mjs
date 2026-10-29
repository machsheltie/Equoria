/**
 * The public view of a breed's genetic profile (Equoria-9kakx).
 *
 * Owner ruling 2026-10-29 (q274): "the player gets to see the listed color name
 * and markings and temperament but none of the odds or genetics behind it ...
 * They get no color shade markings or temperament odds."
 *
 * `breeds.breedGeneticProfile` holds exactly those odds: alleleWeights,
 * allowedAlleles, disallowedCombinations, shadeBias, markingBias,
 * advancedMarkingsBias, booleanModifiersPrevalence and temperamentWeights. It
 * travelled to players on GET /breeds/:id (public, before login) and inside
 * every whole breed row joined onto a horse (`include: { breed: true }`: the
 * horse page, foal development, horse updates, training, results).
 *
 * `withoutBreedOdds` keeps only the keys named in `publicProfileKeys` (an
 * allow-list, so a key added to the profile later is not sent by accident) in
 * every `breedGeneticProfile` value anywhere in a response body. A value that is
 * neither an object nor null is replaced by null. `ratingProfiles` stays: it is
 * the breed's conformation and gait ranges, which the breed picker shows as stat
 * tendencies, not colour, marking, shade or temperament odds.
 *
 * Copy-on-write (utils/copyOnWriteRewrite.mjs): the input is never mutated.
 * Pure: no database access.
 */
import { isPlainObject, rewriteMatching } from './copyOnWriteRewrite.mjs';

export const publicProfileKeys = Object.freeze(['ratingProfiles']);

/**
 * The client-safe view of one breedGeneticProfile value.
 *
 * @param {unknown} profile
 * @returns {object|null}
 */
export function publicBreedProfile(profile) {
  if (!isPlainObject(profile)) {
    return null;
  }
  const out = {};
  for (const key of publicProfileKeys) {
    if (Object.hasOwn(profile, key)) {
      out[key] = profile[key];
    }
  }
  return out;
}

function needsTrim(node) {
  if (!Object.hasOwn(node, 'breedGeneticProfile')) {
    return false;
  }
  const profile = node.breedGeneticProfile;
  if (profile === null) {
    return false;
  }
  if (!isPlainObject(profile)) {
    return true;
  }
  return Object.keys(profile).some(key => !publicProfileKeys.includes(key));
}

/**
 * `body` with every `breedGeneticProfile` (at any depth) cut down to its public keys.
 *
 * @template T
 * @param {T} body
 * @returns {T}
 */
export function withoutBreedOdds(body) {
  return rewriteMatching(body, needsTrim, node => ({
    ...node,
    breedGeneticProfile: publicBreedProfile(node.breedGeneticProfile),
  }));
}
