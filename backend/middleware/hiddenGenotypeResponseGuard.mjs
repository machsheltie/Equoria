/**
 * Response guard: no JSON response sends a colour genotype the viewer has not
 * bought (Equoria-2wdp8, Equoria-9kakx; owner rulings 2026-10-26 q72,
 * 2026-10-28 q164, 2026-10-29 q274 and q294).
 *
 * The genotype is what the vet's Genetic Testing sells, to the horse's owner.
 * GET /horses/:id/genetics withholds it until the test is bought, but routes
 * that send whole horse rows (the ownership middleware loads every column)
 * carried it anyway. This guard drops `colorGenotype` from every object in a
 * JSON body unless that row is marked `colorGeneticsTested: true` and the
 * viewer owns the horse (utils/publicGenotypeView.mjs), just before it is
 * serialised. The game admin (owner or admin role) is sent every genotype,
 * tested or not (q294). Ownership of a row without `userId` comes from
 * the horse requireOwnership verified for this request (req.horse).
 *
 * Mounted once in app.mjs, beside hiddenTraitResponseGuard, ahead of every router.
 */
import { withoutHiddenGenotype } from '../utils/publicGenotypeView.mjs';
import { satisfiesRole } from '../modules/staff/index.mjs';

function viewerOf(req) {
  const userId = req.user?.id;
  const ownedHorseId = req.horse?.id;
  return {
    userId: typeof userId === 'string' ? userId : null,
    isAdmin: satisfiesRole(req.user?.role, 'admin'),
    // req.horse is set only by requireOwnership, after it verified req.user owns it.
    ownedHorseId: req.user && Number.isInteger(ownedHorseId) ? ownedHorseId : null,
  };
}

export function hiddenGenotypeResponseGuard(req, res, next) {
  const json = res.json.bind(res);
  res.json = body => json(withoutHiddenGenotype(body, viewerOf(req)));
  next();
}

export default hiddenGenotypeResponseGuard;
