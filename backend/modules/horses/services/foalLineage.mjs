/**
 * The ancestry a foal's birth-time trait roll reads (extracted from
 * foalingService.mjs, Equoria-cmw85.13).
 *
 * Reads the sire/dam ancestry through the shared batched pedigree walker: ONE
 * `findMany` per generation (three at most), instead of one `findUnique` per
 * ancestor, on every foal birth inside the sequential foaling job.
 */

import logger from '../../../utils/logger.mjs';
import { fetchPedigreeGraph, walkPedigreesInGraph } from '../../../utils/pedigreeWalker.mjs';

/**
 * Walk the sire/dam ancestry up to `generations` generations and return a
 * flattened array of ancestor records, sire then dam first, then each
 * generation in breadth-first order, each horse once (cycle-guarded). The
 * shape matches the legacy controller output so trait roll logic keeps its
 * existing behavior.
 *
 * @param {number} sireId
 * @param {number} damId
 * @param {number} generations
 * @returns {Promise<Array<{id:number,name:string,discipline:string|null,disciplineScores:unknown,generation:number,trait:unknown,temperament:unknown}>>}
 */
export async function gatherLineage(sireId, damId, generations) {
  try {
    const graph = await fetchPedigreeGraph([sireId, damId], generations, {
      disciplineScores: true,
      trait: true,
      temperament: true,
    });

    return walkPedigreesInGraph(graph, [sireId, damId], generations).map(({ id, generation }) => {
      const horse = graph.get(id);

      let primaryDiscipline = null;
      if (horse.disciplineScores && typeof horse.disciplineScores === 'object') {
        let maxScore = 0;
        Object.entries(horse.disciplineScores).forEach(([discipline, score]) => {
          if (typeof score === 'number' && score > maxScore) {
            maxScore = score;
            primaryDiscipline = discipline;
          }
        });
      }

      return {
        id: horse.id,
        name: horse.name,
        discipline: primaryDiscipline,
        disciplineScores: horse.disciplineScores,
        generation,
        trait: horse.trait,
        temperament: horse.temperament,
      };
    });
  } catch (error) {
    logger.error(`[foalLineage.gatherLineage] Error: ${error.message}`);
    return [];
  }
}
