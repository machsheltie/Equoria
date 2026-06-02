/**
 * deriveBreedTendencies (Equoria-x83v4)
 *
 * Derives a breed's UI `statTendencies` (speed / stamina / agility / balance /
 * precision / boldness, each {min,max,avg} on a 0–100 scale) from the breed's
 * REAL imported genetic data — `breedGeneticProfile.rating_profiles`
 * (conformation + gaits, each region/gait carrying {mean, std_dev}).
 *
 * WHY this exists
 * ───────────────
 * The roster grew to 312 breeds after the Equoria-26qjf.3 import, but the
 * previous client only had a hand-authored ~13-breed static preset map. The
 * other ~300 breeds fell through to a uniform DEFAULT (40/55/70 for every
 * stat) — visually identical, conveying no real breed information. The import
 * already carries differentiating data per breed in `rating_profiles`; the
 * senior fix is to DERIVE the tendencies from that real data rather than
 * hand-extend a 312-entry map that would immediately drift from the DB.
 *
 * The 6 UI stats are NOT 1:1 columns in rating_profiles (which carries 8
 * conformation regions + 4–5 gaits). We map each UI stat to the conformation /
 * gait component(s) that are the closest physical proxy, documented inline.
 * This is an honest derivation from real per-breed data, not a fabricated
 * value: a Thoroughbred's high gallop rating really does produce a high derived
 * `speed`, and a draft breed's lower gallop really does produce a lower one.
 *
 * SCALE NOTE — why rating_profiles and not starter_stats
 * ──────────────────────────────────────────────────────
 * `starter_stats` ALSO lives in breedGeneticProfile and has the exact 6 stat
 * names. But its means are compressed to ~14–20 (the 12 stats are sampled under
 * a total-≤200 game cap, so each per-stat mean is small). Surfacing those
 * directly would render every breed's bars at ~15–20% — visually
 * undifferentiated, the same failure the DEFAULT had. `rating_profiles`
 * conformation/gaits are quality ratings on the full 0–100 scale (means ~60–90)
 * and spread breeds apart meaningfully, which is what the breed-picker UI and
 * the downstream `breedDisciplineStrength` ranker (which expects 0–100 avgs)
 * need. So rating_profiles is the correct source for a 0–100 tendency display.
 */

import type { BreedStatTendencies, StatTendency } from './useBreeds';

/** A single {mean, std_dev} cell from rating_profiles. */
interface MeanStdDev {
  mean: number;
  std_dev?: number;
}

interface ConformationProfile {
  head?: MeanStdDev | null;
  neck?: MeanStdDev | null;
  shoulders?: MeanStdDev | null;
  back?: MeanStdDev | null;
  hindquarters?: MeanStdDev | null;
  legs?: MeanStdDev | null;
  hooves?: MeanStdDev | null;
  topline?: MeanStdDev | null;
}

interface GaitsProfile {
  walk?: MeanStdDev | null;
  trot?: MeanStdDev | null;
  canter?: MeanStdDev | null;
  gallop?: MeanStdDev | null;
  gaiting?: MeanStdDev | null;
}

export interface RatingProfiles {
  conformation?: ConformationProfile | null;
  gaits?: GaitsProfile | null;
}

/** The genetic-profile JSONB column shape (only the parts we read). */
export interface BreedGeneticProfile {
  rating_profiles?: RatingProfiles | null;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Returns the numeric `mean` of a {mean, std_dev} cell, or undefined if the
 * cell is missing/null/non-numeric. Guards against the real null patterns the
 * import produces (e.g. `gaiting: null` on non-gaited breeds).
 */
function meanOf(cell: MeanStdDev | null | undefined): number | undefined {
  if (!cell || typeof cell.mean !== 'number' || Number.isNaN(cell.mean)) return undefined;
  return cell.mean;
}

function stdOf(cell: MeanStdDev | null | undefined): number {
  if (!cell || typeof cell.std_dev !== 'number' || Number.isNaN(cell.std_dev)) return 0;
  return Math.max(0, cell.std_dev);
}

/**
 * Average the means of one or more cells, ignoring missing ones. Returns
 * undefined if NONE of the cells carry a usable mean (so the caller can decide
 * whether the whole derivation is possible).
 */
function avgMeans(...cells: (MeanStdDev | null | undefined)[]): number | undefined {
  const present = cells.map(meanOf).filter((m): m is number => m !== undefined);
  if (present.length === 0) return undefined;
  return present.reduce((s, m) => s + m, 0) / present.length;
}

/** Average the std_devs of one or more cells (0 for missing). */
function avgStds(...cells: (MeanStdDev | null | undefined)[]): number {
  const stds = cells.map(stdOf);
  return stds.reduce((s, v) => s + v, 0) / Math.max(1, stds.length);
}

/**
 * Build a {min,max,avg} StatTendency from a derived mean + spread.
 * min/max use mean ± std_dev (the real per-region variation the breed data
 * carries), clamped to 0–100. avg = mean.
 */
function toTendency(mean: number, std: number): StatTendency {
  return {
    min: clamp(mean - std),
    max: clamp(mean + std),
    avg: clamp(mean),
  };
}

/**
 * Type guard: a usable rating_profiles object with at least one of
 * conformation/gaits present as an object (JSONB can be null / primitive /
 * array — the four-part guard mirrors the backend JSONB convention).
 */
function hasUsableProfile(gp: BreedGeneticProfile | null | undefined): gp is BreedGeneticProfile {
  if (gp === null || gp === undefined || typeof gp !== 'object' || Array.isArray(gp)) return false;
  const rp = gp.rating_profiles;
  if (rp === null || rp === undefined || typeof rp !== 'object' || Array.isArray(rp)) return false;
  const conf = rp.conformation;
  const gaits = rp.gaits;
  const confOk = conf !== null && conf !== undefined && typeof conf === 'object' && !Array.isArray(conf);
  const gaitsOk = gaits !== null && gaits !== undefined && typeof gaits === 'object' && !Array.isArray(gaits);
  return confOk || gaitsOk;
}

/**
 * Derive the 6 UI stat tendencies from a breed's rating_profiles.
 *
 * Returns `null` when no usable rating_profiles data is present — the caller
 * (useBreeds) then falls back to the hand-authored preset (for the original
 * ~13 breeds) or, last, the honest DEFAULT. Returning null rather than
 * fabricating a value keeps the "no real data" state truthful.
 *
 * Stat → real-data mapping (documented, each is the closest physical proxy):
 *   speed     ← gaits.gallop                       (top-end gait = raw speed)
 *   stamina   ← avg(gaits.trot, gaits.canter)      (sustained working gaits)
 *   agility   ← avg(conf.legs, conf.hooves)        (limb quality → maneuverability)
 *   balance   ← avg(conf.back, conf.topline)       (frame carriage / balance)
 *   precision ← avg(gaits.walk, conf.shoulders)    (controlled, deliberate movement)
 *   boldness  ← avg(conf.head, conf.neck)          (presence / front-end carriage)
 *
 * Each tendency's min/max comes from the proxy cell(s)' mean ± std_dev — i.e.
 * the same real spread the import recorded — so a tightly-selected region
 * yields a narrow band and a variable one a wider band.
 */
export function deriveBreedTendencies(
  geneticProfile: BreedGeneticProfile | null | undefined
): BreedStatTendencies | null {
  if (!hasUsableProfile(geneticProfile)) return null;

  const rp = geneticProfile.rating_profiles as RatingProfiles;
  const c = (rp.conformation ?? {}) as ConformationProfile;
  const g = (rp.gaits ?? {}) as GaitsProfile;

  const speedMean = avgMeans(g.gallop);
  const staminaMean = avgMeans(g.trot, g.canter);
  const agilityMean = avgMeans(c.legs, c.hooves);
  const balanceMean = avgMeans(c.back, c.topline);
  const precisionMean = avgMeans(g.walk, c.shoulders);
  const boldnessMean = avgMeans(c.head, c.neck);

  // If literally every proxy is missing the profile is unusable in practice —
  // treat it as "no data" and let the caller fall back honestly.
  const allMeans = [speedMean, staminaMean, agilityMean, balanceMean, precisionMean, boldnessMean];
  if (allMeans.every((m) => m === undefined)) return null;

  // For any individual stat whose specific proxy is absent, fall back to the
  // breed's OWN average of the proxies that ARE present (still real data for
  // this breed — never a global constant), so we don't inject a foreign 55.
  const presentMeans = allMeans.filter((m): m is number => m !== undefined);
  const breedAvg = presentMeans.reduce((s, m) => s + m, 0) / presentMeans.length;

  return {
    speed: toTendency(speedMean ?? breedAvg, avgStds(g.gallop)),
    stamina: toTendency(staminaMean ?? breedAvg, avgStds(g.trot, g.canter)),
    agility: toTendency(agilityMean ?? breedAvg, avgStds(c.legs, c.hooves)),
    balance: toTendency(balanceMean ?? breedAvg, avgStds(c.back, c.topline)),
    precision: toTendency(precisionMean ?? breedAvg, avgStds(g.walk, c.shoulders)),
    boldness: toTendency(boldnessMean ?? breedAvg, avgStds(c.head, c.neck)),
  };
}
