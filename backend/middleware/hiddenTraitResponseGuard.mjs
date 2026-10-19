/**
 * Response guard: no JSON response sends a horse's unrevealed hidden traits
 * (Equoria-6dace; owner ruling 2026-10-16 — hidden from everyone, the owner
 * included).
 *
 * Many routes send whole horse rows (ownership middleware loads every column,
 * services return Prisma rows, nested sire/dam rows), and every one of them
 * carries `epigeneticModifiers.hidden`. Rather than strip that key at each of
 * those exits — a list that grows with every new route — this guard rewrites
 * every `epigeneticModifiers` value in a JSON body to its public view
 * (`{ positive, negative, hiddenCount }`, utils/publicTraitView.mjs) just
 * before it is serialised. Routes that rename the hidden list into another
 * shape (trait buckets, reveal results, history rows) are fixed at their own
 * exit; this guard covers the column wherever it travels under its own name.
 *
 * Mounted once in app.mjs, ahead of every router.
 */
import { withPublicTraitModifiers } from '../utils/publicTraitView.mjs';

export function hiddenTraitResponseGuard(req, res, next) {
  const json = res.json.bind(res);
  res.json = body => json(withPublicTraitModifiers(body));
  next();
}

export default hiddenTraitResponseGuard;
