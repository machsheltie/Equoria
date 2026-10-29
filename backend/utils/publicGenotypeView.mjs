/**
 * The public view of a horse's colour genotype (Equoria-2wdp8, Equoria-9kakx).
 *
 * Owner ruling 2026-10-26 (q72): colour genetics stay hidden until the owner
 * pays the vet for Genetic Testing. Owner ruling 2026-10-28 (q164): the data
 * the game sends a player hides anything that could be used to find loopholes.
 * Owner ruling 2026-10-29 (q274): a player pays the vet to get THEIR horse's
 * colour genetics profile, and that is the only way colour genetics are revealed.
 *
 * Many routes send whole horse rows (the ownership middleware loads every
 * column; nested sire/dam rows travel with them), and every one of them carries
 * `colorGenotype`.
 *   - `withoutUntestedGenotype` drops that key from every object in a response
 *     body that is not itself marked `colorGeneticsTested: true`, so a row whose
 *     test flag was not selected is held back too (fails closed).
 *   - `withoutHiddenGenotype` (what the response guard runs) also drops a tested
 *     genotype unless the viewer owns that horse or is the game admin (owner or
 *     admin role; never a moderator). Ownership is read from the row's `userId`,
 *     or, for a row without one, from the horse the request's ownership check
 *     verified (`horseId`/`id` equal to it). Anything else is held back.
 *
 * Copy-on-write (utils/copyOnWriteRewrite.mjs): the input is never mutated.
 * Pure: no database access.
 */
import { rewriteMatching } from './copyOnWriteRewrite.mjs';

const holdsGenotype = node => Object.hasOwn(node, 'colorGenotype');

function withoutGenotypeKey(node) {
  const { colorGenotype: _dropped, ...rest } = node;
  return rest;
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
  return rewriteMatching(
    body,
    node => holdsGenotype(node) && node.colorGeneticsTested !== true,
    withoutGenotypeKey,
  );
}

/**
 * Whether `viewer` may see this row's (tested) genotype.
 *
 * @param {object} node
 * @param {{ userId?: string|null, isAdmin?: boolean, ownedHorseId?: number|null }} viewer
 */
function viewerMaySee(node, viewer) {
  if (viewer.isAdmin === true) {
    return true;
  }
  if (Object.hasOwn(node, 'userId')) {
    return (
      typeof viewer.userId === 'string' && viewer.userId !== '' && node.userId === viewer.userId
    );
  }
  const owned = viewer.ownedHorseId;
  return Number.isInteger(owned) && (node.horseId === owned || node.id === owned);
}

/**
 * `body` with `colorGenotype` removed from every object (at any depth) unless it
 * is marked `colorGeneticsTested: true` AND the viewer owns the horse or is the
 * game admin.
 *
 * @template T
 * @param {T} body
 * @param {{ userId?: string|null, isAdmin?: boolean, ownedHorseId?: number|null }} [viewer]
 * @returns {T}
 */
export function withoutHiddenGenotype(body, viewer = {}) {
  return rewriteMatching(
    body,
    node =>
      holdsGenotype(node) && (node.colorGeneticsTested !== true || !viewerMaySee(node, viewer)),
    withoutGenotypeKey,
  );
}
