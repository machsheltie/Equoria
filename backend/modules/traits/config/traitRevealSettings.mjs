/**
 * Trait reveal settings that WAIT ON THE OWNER (Equoria-2d55z).
 *
 * The owner ruled the shape of the trait reveal system on 2026-10-26 (q98, q87):
 * every trait starts hidden unless a parent had it active and revealed; rarer
 * positive traits need more days of grooming to reveal and turn on, rarer
 * negative traits more days of neglect; grooming can switch negatives off and
 * neglect can switch positives off; each day is a chance, never a guarantee.
 *
 * She has NOT yet ruled the numbers below, so every one of them is null. While
 * any value is null the nightly engine refuses to run
 * (modules/traits/services/traitRevealEngine.mjs → runNightlyTraitReveal returns
 * { skipped: 'settingsPendingOwner' }), and the nightly job is not registered in
 * services/jobs/index.mjs at all. Tests pass their own settings.
 *
 * The comment on each entry is the recommendation sent to the owner, not a
 * decision. When she answers, fill in her values here, then register the job.
 */

/** Rarity names the owner ruled (q98), as stored in this file. */
export const traitRarities = Object.freeze([
  'common',
  'uncommon',
  'rare',
  'ultraRare',
  'legendary',
]);

const pendingByRarity = () =>
  Object.freeze({ common: null, uncommon: null, rare: null, ultraRare: null, legendary: null });

export const traitRevealSettingsPendingOwner = Object.freeze({
  /**
   * Days of grooming (positive traits) or of neglect (negative traits) a horse
   * must have had before a hidden trait of that rarity gets its daily chance to
   * reveal and turn on. Recommended for both: common 3, uncommon 6, rare 12,
   * ultraRare 16, legendary 19 (of the 21-day window).
   */
  revealDays: Object.freeze({ positive: pendingByRarity(), negative: pendingByRarity() }),

  /**
   * Days of neglect (active positive traits) or of grooming (active negative
   * traits) before an active trait gets its daily chance to switch off.
   * Recommended: the same table as revealDays.
   */
  switchOffDays: Object.freeze({ positive: pendingByRarity(), negative: pendingByRarity() }),

  /**
   * Chance (0..1) rolled on each qualifying day once the day count is reached.
   * Recommended: common 0.4, uncommon 0.3, rare 0.25, ultraRare 0.2, legendary 0.15.
   */
  dailyChance: pendingByRarity(),

  /**
   * The last day of life the engine evaluates. Recommended 21 (ages 0-3, the
   * foal window). Infinity would mean "for life".
   */
  lastDayOfLife: null,

  /**
   * Rarity of each roster trait. The design bible states none of them.
   * A trait whose rarity is null is never evaluated.
   */
  traitRarity: Object.freeze({
    brave: null,
    fearful: null,
    confident: null,
    insecure: null,
    affectionate: null,
    skittish: null,
    resilient: null,
    fragile: null,
    highImmunity: null,
    lowImmunity: null,
    peopleTrusting: null,
    showCalm: null,
    crowdReady: null,
    bonded: null,
    eagerLearner: null,
    social: null,
    antisocial: null,
    presentationBoosted: null,
    legendaryBloodline: null,
    phoenixBorn: null,
  }),
});

export default traitRevealSettingsPendingOwner;
