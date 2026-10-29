/**
 * Response guard: no JSON response sends a breed's colour, shade, marking or
 * temperament odds (Equoria-9kakx; owner ruling 2026-10-29 q274).
 *
 * Whole breed rows travel in many responses (GET /breeds/:id, and every horse
 * read that joins `breed: true`). This guard cuts every `breedGeneticProfile`
 * in a JSON body down to its public keys (utils/publicBreedProfileView.mjs)
 * just before it is serialised. The game admin (owner or admin role) is sent
 * the whole profile; moderators and players never are.
 *
 * Mounted once in app.mjs, beside the hidden-trait and genotype guards, ahead
 * of every router; it reads req.user when the route answers, after auth ran.
 */
import { withoutBreedOdds } from '../utils/publicBreedProfileView.mjs';
import { satisfiesRole } from '../modules/staff/index.mjs';

export function hiddenBreedOddsResponseGuard(req, res, next) {
  const json = res.json.bind(res);
  res.json = body =>
    satisfiesRole(req.user?.role, 'admin') ? json(body) : json(withoutBreedOdds(body));
  next();
}

export default hiddenBreedOddsResponseGuard;
