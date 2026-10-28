/**
 * Response guard: no JSON response sends an untested horse's colour genotype
 * (Equoria-2wdp8; owner rulings 2026-10-26 q72 and 2026-10-28 q164).
 *
 * The genotype is what the vet's Genetic Testing sells. GET /horses/:id/genetics
 * withholds it until the test is bought, but routes that send whole horse rows
 * (the ownership middleware loads every column) carried it anyway. This guard
 * drops `colorGenotype` from every object in a JSON body that is not marked
 * `colorGeneticsTested: true` (utils/publicGenotypeView.mjs), just before it
 * is serialised.
 *
 * Mounted once in app.mjs, beside hiddenTraitResponseGuard, ahead of every router.
 */
import { withoutUntestedGenotype } from '../utils/publicGenotypeView.mjs';

export function hiddenGenotypeResponseGuard(req, res, next) {
  const json = res.json.bind(res);
  res.json = body => json(withoutUntestedGenotype(body));
  next();
}

export default hiddenGenotypeResponseGuard;
