/**
 * Trait Integration Example
 * Demonstrates how traits affect training, competition, bonding, and temperament
 */

import { getCombinedTraitEffects } from '../utils/traitEffects.mjs';
import { calculateBondingChange } from '../utils/bondingModifiers.mjs';
import { calculateTemperamentDrift } from '../utils/temperamentDrift.mjs';

console.log('=== Trait Integration During Gameplay Examples ===\n');

// Example 1: Training with Stat Gain Modifiers
console.log('1. TRAINING SYSTEM INTEGRATION');
console.log('================================');

const eagerLearnerHorse = {
  id: 1,
  name: 'Quick Study',
  epigenetic_modifiers: {
    positive: ['eager_learner'],
    negative: [],
    hidden: [],
  },
};

console.log(`Training horse: ${eagerLearnerHorse.name} (ID: ${eagerLearnerHorse.id})`);
const eagerLearnerEffects = getCombinedTraitEffects(['eager_learner']);
console.log('Eager Learner Trait Effects:');
console.log(
  `- Training XP Modifier: +${(eagerLearnerEffects.trainingXpModifier * 100).toFixed(1)}%`,
);
console.log(
  `- Stat Gain Chance Modifier: +${(eagerLearnerEffects.statGainChanceModifier * 100).toFixed(1)}%`,
);
console.log(
  `- Base Stat Boost: +${eagerLearnerEffects.baseStatBoost} points when stat gain occurs`,
);

// Simulate training session
const baseXp = 5;
const modifiedXp = Math.round(baseXp * (1 + eagerLearnerEffects.trainingXpModifier));
const baseStatGainChance = 0.15; // 15%
const modifiedStatGainChance = baseStatGainChance + eagerLearnerEffects.statGainChanceModifier;

console.log('\nTraining Session Results:');
console.log(`- Base XP: ${baseXp} → Modified XP: ${modifiedXp} (+${modifiedXp - baseXp})`);
console.log(
  `- Base Stat Gain Chance: ${(baseStatGainChance * 100).toFixed(1)}% → Modified: ${(modifiedStatGainChance * 100).toFixed(1)}%`,
);
console.log(
  `- If stat gain occurs: +${1 + eagerLearnerEffects.baseStatBoost} points instead of +1\n`,
);

// Example 2: Bonding Modifiers
console.log('2. BONDING SYSTEM INTEGRATION');
console.log('=============================');

const socialHorse = {
  id: 2,
  name: 'Friendly Spirit',
  bond_score: 50,
  epigenetic_modifiers: {
    positive: ['social', 'calm'],
    negative: [],
    hidden: [],
  },
};

const antisocialHorse = {
  id: 3,
  name: 'Lone Wolf',
  bond_score: 50,
  epigenetic_modifiers: {
    positive: [],
    negative: ['antisocial', 'nervous'],
    hidden: [],
  },
};

// Grooming session comparison
const groomingDuration = 60; // minutes
const socialGrooming = calculateBondingChange(socialHorse, 'grooming', {
  duration: groomingDuration,
});
const antisocialGrooming = calculateBondingChange(antisocialHorse, 'grooming', {
  duration: groomingDuration,
});

console.log('Grooming Session (60 minutes):');
console.log(`Social Horse (${socialHorse.name}):`);
console.log(`- Original Change: ${socialGrooming.originalChange}`);
console.log(`- Modified Change: ${socialGrooming.modifiedChange}`);
console.log(`- Trait Modifier: ${(socialGrooming.traitModifier * 100).toFixed(1)}%`);
console.log(`- Applied Traits: ${socialGrooming.appliedTraits.join(', ')}`);

console.log(`\nAntisocial Horse (${antisocialHorse.name}):`);
console.log(`- Original Change: ${antisocialGrooming.originalChange}`);
console.log(`- Modified Change: ${antisocialGrooming.modifiedChange}`);
console.log(`- Trait Modifier: ${(antisocialGrooming.traitModifier * 100).toFixed(1)}%`);
console.log(`- Applied Traits: ${antisocialGrooming.appliedTraits.join(', ')}\n`);

// Example 3: Competition Stress Response
console.log('3. COMPETITION STRESS RESPONSE');
console.log('==============================');

const stressedHorse = {
  id: 4,
  name: 'Anxious Runner',
  stress_level: 70,
  epigenetic_modifiers: {
    positive: [],
    negative: ['nervous'],
    hidden: [],
  },
};

const resilientHorse = {
  id: 5,
  name: 'Cool Competitor',
  stress_level: 70,
  epigenetic_modifiers: {
    positive: ['resilient'],
    negative: [],
    hidden: [],
  },
};

// Simulate competition stress impact
const baseScore = 100;
const stressImpactPercent = stressedHorse.stress_level * 0.002; // 0.2% per stress point
const stressImpact = baseScore * stressImpactPercent;

const resilientEffects = getCombinedTraitEffects(['resilient']);
const resilientStressImpact = resilientEffects.competitionStressResistance
  ? stressImpact * (1 - resilientEffects.competitionStressResistance)
  : stressImpact;

console.log(`Stress Level: ${stressedHorse.stress_level}`);
console.log(`Base Competition Score: ${baseScore}`);
console.log(`\nNervous Horse (${stressedHorse.name}):`);
console.log(`- Stress Impact: -${stressImpact.toFixed(1)} points`);
console.log(`- Final Score: ${(baseScore - stressImpact).toFixed(1)}`);

console.log(`\nResilient Horse (${resilientHorse.name}):`);
console.log(
  `- Stress Resistance: ${resilientEffects.competitionStressResistance ? `${(resilientEffects.competitionStressResistance * 100).toFixed(1)}%` : 'None'}`,
);
console.log(`- Reduced Stress Impact: -${resilientStressImpact.toFixed(1)} points`);
console.log(`- Final Score: ${(baseScore - resilientStressImpact).toFixed(1)}\n`);

// Example 4: Temperament Drift Suppression
console.log('4. TEMPERAMENT DRIFT SUPPRESSION');
console.log('================================');

const unstableHorse = {
  id: 6,
  name: 'Moody Mare',
  temperament: 'Calm',
  stress_level: 80,
  epigenetic_modifiers: {
    positive: [],
    negative: ['nervous'],
    hidden: [],
  },
};

const stableHorse = {
  id: 7,
  name: 'Steady Eddie',
  temperament: 'Calm',
  stress_level: 80,
  epigenetic_modifiers: {
    positive: ['resilient'],
    negative: [],
    hidden: [],
  },
};

const unstableDrift = calculateTemperamentDrift(unstableHorse, {
  stressLevel: 80,
  recentCompetition: true,
  bondScore: 30,
});

const stableDrift = calculateTemperamentDrift(stableHorse, {
  stressLevel: 80,
  recentCompetition: true,
  bondScore: 30,
});

console.log('High Stress Scenario (Stress: 80, Recent Competition, Low Bond: 30)');
console.log(`\nNervous Horse (${unstableHorse.name}):`);
console.log(`- Drift Occurred: ${unstableDrift.driftOccurred}`);
console.log(`- Reason: ${unstableDrift.reason}`);
if (unstableDrift.driftProbability) {
  console.log(`- Drift Probability: ${(unstableDrift.driftProbability * 100).toFixed(1)}%`);
}

console.log(`\nResilient Horse (${stableHorse.name}):`);
console.log(`- Drift Occurred: ${stableDrift.driftOccurred}`);
console.log(`- Reason: ${stableDrift.reason}`);
if (stableDrift.suppressingTraits) {
  console.log(`- Suppressing Traits: ${stableDrift.suppressingTraits.join(', ')}`);
}

console.log('\n=== Summary ===');
console.log('Trait integration affects:');
console.log('✓ Training XP multipliers and stat gain chances');
console.log('✓ Bonding efficiency from various activities');
console.log('✓ Competition stress resistance');
console.log('✓ Temperament drift suppression');
console.log('✓ All systems work together for comprehensive gameplay impact');
