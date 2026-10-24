/**
 * Shared thresholds and pure helpers for the ultra-rare / exotic trigger
 * evaluators (split out of ultraRareTriggerEngine.mjs by Equoria-owj33 to bring that
 * file under the 600-line source threshold; no behaviour change).
 *
 * Everything here is data or a pure function over an already-loaded horse, with no
 * database access. The engine (ultraRareTriggerEngine.mjs) loads the horse and
 * decides which evaluator runs; the evaluators read these.
 */

// ─── Equoria-oey96.9: trigger thresholds mapped onto EXISTING relations ─────────
// The exotic + Born Leader/Stormtouched evaluators previously read relations that
// never exist (a per-day care-log relation, a groom-task-log relation, a
// same-parents siblings relation) and a nonexistent per-flag object property, so
// they could NEVER fire. They are rewritten here against the relations the engine
// actually loads (groomInteractions, milestoneTraitLogs, traitHistoryLogs,
// competitionResults, sire/dam) plus derived full-siblings. Three conditions with
// no honest per-event representation were reworked to SNAPSHOT form per the
// ratified DECISION 2026-07-06 (NO new schema): Soulbonded perfect-care →
// daysGroomedInARow; Fey-Kissed perfect-grooming → foal-stage groom-interaction
// quality; Dreamtwin raised-together → groom-interaction count parity.
export const msPerDay = 24 * 60 * 60 * 1000;
export const topBondThreshold = 85; // Born Leader — top-tier bond snapshot
export const topConformationThreshold = 80; // Born Leader — top-tier conformation snapshot
export const careGapDays = 7; // Stormtouched — missed-care-week gap (PRD-04 §3.3)
export const stressSpikeThreshold = 5; // Stormtouched — groomInteraction stressChange spike
export const failedMilestoneScore = 50; // Shadow-Follower — failed/missed milestone score
export const age2Days = 730; // late-bond boundary (after age 2)
// Ghostwalker — youth window: game age 3 = 21 game days (a game week is a game year),
// matching the stored ageInDays on bond logs (Equoria-fjgzp).
export const age3Days = 21;
export const earlyBondMax = 50; // Shadow-Follower — early bond must be below this
export const lateBondMin = 70; // Shadow-Follower — late bond must reach this
export const lowYouthBondMax = 30; // Ghostwalker — youth bond stays below this
export const soulbondedMinMilestones = 4; // Soulbonded — same groom for all 4 milestones
export const soulbondedMinBond = 90; // Soulbonded — >90 bond during each milestone
export const soulbondedMinCareStreak = 7; // Soulbonded — perfect-care snapshot proxy
export const feyFoalAgeDays = 365; // Fey-Kissed — foal-stage window
export const feyMinFoalGrooms = 10; // Fey-Kissed — min foal-stage groom interactions
export const feyMinQuality = 0.8; // Fey-Kissed — every foal groom must be high quality
export const twinSameDayMs = msPerDay; // Dreamtwin — twins born within one day
export const raisedTogetherTolerance = 10; // Dreamtwin — comparable interaction volume

/**
 * JSONB type guard (CONTRIBUTING.md rule 1): return the value only when it is a
 * plain object (not null / not an array), else null.
 */
export function asPlainObject(value) {
  return value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

/**
 * Collect bond-score-by-age points from the age-tagged log relations
 * (milestoneTraitLogs + traitHistoryLogs), used for early-vs-late bond analysis.
 * @returns {Array<{ bondScore: number, ageInDays: number }>}
 */
export function collectBondByAge(horse) {
  const points = [];
  for (const log of [...(horse.milestoneTraitLogs || []), ...(horse.traitHistoryLogs || [])]) {
    if (typeof log.bondScore === 'number' && typeof log.ageInDays === 'number') {
      points.push({ bondScore: log.bondScore, ageInDays: log.ageInDays });
    }
  }
  return points;
}

/** True if any String[] flag contains one of the given lowercase substrings. */
export function hasFlagMatching(flags, patterns) {
  if (!Array.isArray(flags)) {
    return false;
  }
  return flags.some(
    flag => typeof flag === 'string' && patterns.some(p => flag.toLowerCase().includes(p)),
  );
}

/** True if `text` is a string containing any of the lowercase needles. */
export function textIncludesAny(text, needles) {
  if (typeof text !== 'string') {
    return false;
  }
  const lower = text.toLowerCase();
  return needles.some(n => lower.includes(n));
}

/** Distinct non-null groomIds referenced by a list of groom interactions. */
export function uniqueGroomIds(interactions) {
  return [
    ...new Set(
      (interactions || []).map(i => i.groomId).filter(id => id !== null && id !== undefined),
    ),
  ];
}

/** True if any consecutive pair of interaction timestamps is >= minGapDays apart. */
export function hasCareGap(interactions, minGapDays) {
  const times = (interactions || [])
    .map(i => new Date(i.timestamp).getTime())
    .filter(t => !Number.isNaN(t))
    .sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) {
    if ((times[i] - times[i - 1]) / msPerDay >= minGapDays) {
      return true;
    }
  }
  return false;
}

/**
 * True when a parent horse carries at least one ultra-rare or exotic trait —
 * checked via its ultraRareTraits JSON snapshot OR its trait-history log names.
 * `registryKeys` is the Set of ultra-rare + exotic trait registry keys; the engine
 * builds it from ULTRA_RARE_TRAITS / EXOTIC_TRAITS and passes it in.
 */
export function parentHasUltraRareTrait(parent, registryKeys) {
  if (!parent) {
    return false;
  }
  const snapshot = asPlainObject(parent.ultraRareTraits);
  if (snapshot) {
    if (Array.isArray(snapshot.ultraRare) && snapshot.ultraRare.length > 0) {
      return true;
    }
    if (Array.isArray(snapshot.exotic) && snapshot.exotic.length > 0) {
      return true;
    }
  }
  return (parent.traitHistoryLogs || []).some(log => {
    const normalized = log.traitName?.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return Boolean(normalized) && registryKeys.has(normalized);
  });
}
