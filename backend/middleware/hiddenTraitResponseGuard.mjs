/**
 * Response guard: no JSON response sends a horse's unrevealed hidden traits to
 * anyone but the game owner (Equoria-6dace, Equoria-w4bvy).
 *
 * Owner rulings: 2026-10-16, hidden from players, the horse's owner included;
 * 2026-10-19, only Stacey sees hidden traits, moderators never; 2026-10-23
 * (Equoria-4tleh), that view is the `traits.hidden.view` capability, held by
 * the owner role alone (admins, moderators and players never).
 *
 * Many routes send whole horse rows (ownership middleware loads every column,
 * services return Prisma rows, nested sire/dam rows), and every one of them
 * carries `epigeneticModifiers.hidden`. Rather than strip that key at each of
 * those exits — a list that grows with every new route — this guard rewrites
 * every `epigeneticModifiers` value in a JSON body to its public view
 * (`{ positive, negative, hiddenCount }`, utils/publicTraitView.mjs) just
 * before it is serialised. For the game owner the view also keeps `hidden`
 * (the still-hidden keys, labelled in `traitLabels`), and the response is
 * marked `Cache-Control: private, no-store` so no browser, proxy or CDN keeps
 * a copy another viewer could be served. Routes that rename the hidden list
 * into another shape (trait buckets, the visitor read) are handled at their
 * own exit; this guard covers the column wherever it travels under its own name.
 *
 * The role is read from req.user (the signed access token), as the genotype and
 * breed-odds guards do. Mounted once in app.mjs, ahead of every router.
 */
import { withPublicTraitModifiers } from '../utils/publicTraitView.mjs';
import { can } from '../modules/staff/index.mjs';

export function hiddenTraitResponseGuard(req, res, next) {
  const json = res.json.bind(res);
  res.json = body => {
    const includeHidden = can(req.user, 'traits.hidden.view');
    if (includeHidden && !res.headersSent) {
      res.set('Cache-Control', 'private, no-store');
    }
    return json(withPublicTraitModifiers(body, { includeHidden }));
  };
  next();
}

export default hiddenTraitResponseGuard;
