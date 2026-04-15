/**
 * foalAgeUtils (BB-1, BB-2, BB-3)
 *
 * Utilities for the age-based foal development system.
 *
 * BB-1: Compute AgeStage from dateOfBirth
 * BB-2: Return age-appropriate activities per stage
 * BB-3: Detect and return milestone completions
 */

// ── BB-1: Age stage computation ────────────────────────────────────────────────

/**
 * Compute age stage from a horse's dateOfBirth.
 * @param {Date|string} dateOfBirth
 * @returns {'newborn'|'weanling'|'yearling'|'two_year_old'|null}
 *   null = horse is 3+ years old (graduated, development window closed)
 */
export function computeAgeStage(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }
  const birth = new Date(dateOfBirth);
  const nowMs = Date.now() - birth.getTime();
  const weeks = nowMs / (1000 * 60 * 60 * 24 * 7);

  if (weeks < 4) {
    return 'newborn';
  }
  if (weeks < 26) {
    return 'weanling';
  }
  if (weeks < 52) {
    return 'yearling';
  }
  if (weeks < 104) {
    return 'two_year_old';
  }
  return null; // graduated
}

/**
 * Compute age in weeks from dateOfBirth.
 */
export function computeAgeInWeeks(dateOfBirth) {
  if (!dateOfBirth) {
    return 0;
  }
  const nowMs = Date.now() - new Date(dateOfBirth).getTime();
  return Math.floor(nowMs / (1000 * 60 * 60 * 24 * 7));
}

// ── BB-2: Age-appropriate activity definitions ────────────────────────────────

const ACTIVITIES_BY_STAGE = {
  newborn: [
    {
      id: 'imprinting',
      label: 'Imprinting',
      description: 'Gentle first contact to build trust right after birth.',
      bondChange: +8,
      stressChange: -5,
      cooldownHours: 12,
    },
    {
      id: 'gentle_handling',
      label: 'Gentle Handling',
      description: 'Light touching and presence to accustom to humans.',
      bondChange: +5,
      stressChange: -3,
      cooldownHours: 8,
    },
  ],
  weanling: [
    {
      id: 'desensitization',
      label: 'Desensitization',
      description: 'Expose to sounds, objects, and movement to reduce fear.',
      bondChange: +6,
      stressChange: -6,
      cooldownHours: 24,
    },
    {
      id: 'social_exposure',
      label: 'Social Exposure',
      description: 'Time with other horses to develop social confidence.',
      bondChange: +4,
      stressChange: -4,
      cooldownHours: 16,
    },
    {
      id: 'halter_introduction',
      label: 'Halter Introduction',
      description: 'First experience wearing a halter.',
      bondChange: +3,
      stressChange: +2,
      cooldownHours: 48,
    },
  ],
  yearling: [
    {
      id: 'ground_work',
      label: 'Ground Work',
      description: 'Basic voice commands and leading exercises.',
      bondChange: +7,
      stressChange: -2,
      cooldownHours: 24,
    },
    {
      id: 'basic_obstacles',
      label: 'Basic Obstacles',
      description: 'Navigate simple poles and tarps to build confidence.',
      bondChange: +5,
      stressChange: 0,
      cooldownHours: 32,
    },
    {
      id: 'grooming_routine',
      label: 'Grooming Routine',
      description: 'Regular grooming to reinforce bonding.',
      bondChange: +4,
      stressChange: -5,
      cooldownHours: 12,
    },
  ],
  two_year_old: [
    {
      id: 'intro_to_tack',
      label: 'Intro to Tack',
      description: 'First exposure to saddle pad, girth, and bridle.',
      bondChange: +5,
      stressChange: +4,
      cooldownHours: 48,
    },
    {
      id: 'first_lead_walks',
      label: 'First Lead Walks',
      description: 'Short walks under saddle to introduce weight.',
      bondChange: +8,
      stressChange: +2,
      cooldownHours: 36,
    },
    {
      id: 'longe_work',
      label: 'Longe Work',
      description: 'Controlled movement in a circle to build balance.',
      bondChange: +6,
      stressChange: 0,
      cooldownHours: 24,
    },
  ],
};

/**
 * Get available activities for a given age stage.
 * @param {string} ageStage
 * @returns {Array}
 */
export function getActivitiesForStage(ageStage) {
  return ACTIVITIES_BY_STAGE[ageStage] ?? [];
}

// ── BB-3: Milestone detection ─────────────────────────────────────────────────

const BOND_MILESTONES = [25, 50, 75, 100];

/**
 * Check if any new bond milestones have been reached.
 * Updates the completedMilestones object in-place and returns updated object.
 *
 * @param {Object} completedMilestones - existing milestone record
 * @param {number} bondScore - current bond score
 * @param {Date} now
 * @returns {{ milestones: Object, newMilestones: string[] }}
 */
export function checkBondMilestones(completedMilestones, bondScore, now = new Date()) {
  const updated = { ...completedMilestones };
  const newMilestones = [];
  const ts = now.toISOString();

  for (const level of BOND_MILESTONES) {
    const key = `bond${level}`;
    if (bondScore >= level && !updated[key]) {
      updated[key] = ts;
      newMilestones.push(key);
    }
  }

  return { milestones: updated, newMilestones };
}

/**
 * Check if the foal has graduated (age ≥ 3 years / stage = null).
 */
export function hasGraduated(dateOfBirth) {
  return computeAgeStage(dateOfBirth) === null;
}
