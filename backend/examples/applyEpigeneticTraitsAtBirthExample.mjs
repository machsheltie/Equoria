/* eslint-disable no-console */
/**
 * Example usage of applyEpigeneticTraitsAtBirth function
 * Demonstrates various breeding scenarios and trait assignments
 */

import { applyEpigeneticTraitsAtBirth } from '../utils/applyEpigeneticTraitsAtBirth.mjs';

console.log('🧬 Epigenetic Traits at Birth Examples\n');

// Example 1: Optimal Breeding Conditions
console.log('📈 Example 1: Optimal Breeding Conditions');
console.log('Low stress mare (15) + Premium feed (85)');

const optimalMare = {
  id: 1,
  name: 'Premium Mare',
  stress_level: 15,
  health_status: 'Excellent',
};

const optimalResult = applyEpigeneticTraitsAtBirth({
  mare: optimalMare,
  lineage: [],
  feedQuality: 85,
  stressLevel: 15,
});

console.log('Result:', JSON.stringify(optimalResult, null, 2));
console.log('Expected: resilient and people_trusting traits\n');

// Example 2: Inbreeding Scenario
console.log('⚠️ Example 2: Inbreeding Scenario');
console.log('Common ancestors in lineage');

const inbreedingMare = {
  id: 2,
  name: 'Inbred Mare',
  stress_level: 50,
};

const inbredLineage = [
  { id: 100, name: 'Common Ancestor' },
  { id: 100, name: 'Common Ancestor' }, // Same ancestor appears multiple times
  { id: 100, name: 'Common Ancestor' },
  { id: 100, name: 'Common Ancestor' }, // High inbreeding
  { id: 101, name: 'Other Horse' },
];

const inbreedingResult = applyEpigeneticTraitsAtBirth({
  mare: inbreedingMare,
  lineage: inbredLineage,
  feedQuality: 50,
  stressLevel: 50,
});

console.log('Result:', JSON.stringify(inbreedingResult, null, 2));
console.log('Expected: fragile, reactive, and/or low_immunity traits\n');

// Example 3: Racing Lineage Specialization
console.log('🏇 Example 3: Racing Lineage Specialization');
console.log('3+ ancestors specialized in Racing');

const racingMare = {
  id: 3,
  name: 'Racing Mare',
  stress_level: 30,
};

const racingLineage = [
  { id: 201, name: 'Racing Champion 1', discipline: 'Racing' },
  { id: 202, name: 'Racing Champion 2', discipline: 'Racing' },
  { id: 203, name: 'Racing Champion 3', discipline: 'Racing' },
  { id: 204, name: 'Racing Champion 4', discipline: 'Racing' }, // 4 ancestors = legacy talent chance
  { id: 205, name: 'Dressage Horse', discipline: 'Dressage' },
];

const racingResult = applyEpigeneticTraitsAtBirth({
  mare: racingMare,
  lineage: racingLineage,
  feedQuality: 60,
  stressLevel: 30,
});

console.log('Result:', JSON.stringify(racingResult, null, 2));
console.log('Expected: discipline_affinity_racing and possibly legacy_talent\n');

// Example 4: Show Jumping Lineage with Discipline Scores
console.log('🦘 Example 4: Show Jumping Lineage (using disciplineScores)');
console.log('Ancestors with high jumping scores');

const jumpingMare = {
  id: 4,
  name: 'Jumping Mare',
  stress_level: 25,
};

const jumpingLineage = [
  {
    id: 301,
    name: 'Jumper 1',
    disciplineScores: { 'Show Jumping': 95, Dressage: 60 },
  },
  {
    id: 302,
    name: 'Jumper 2',
    disciplineScores: { 'Show Jumping': 88, Racing: 55 },
  },
  {
    id: 303,
    name: 'Jumper 3',
    disciplineScores: { 'Show Jumping': 92, 'Cross Country': 70 },
  },
  {
    id: 304,
    name: 'Mixed Horse',
    disciplineScores: { Dressage: 85, 'Show Jumping': 65 },
  },
];

const jumpingResult = applyEpigeneticTraitsAtBirth({
  mare: jumpingMare,
  lineage: jumpingLineage,
  feedQuality: 70,
  stressLevel: 25,
});

console.log('Result:', JSON.stringify(jumpingResult, null, 2));
console.log('Expected: discipline_affinity_show_jumping\n');

// Example 5: High Stress Scenario
console.log('😰 Example 5: High Stress Scenario');
console.log('Very stressed mare (85) with poor nutrition (25)');

const stressedMare = {
  id: 5,
  name: 'Stressed Mare',
  stress_level: 85,
};

const stressResult = applyEpigeneticTraitsAtBirth({
  mare: stressedMare,
  lineage: [],
  feedQuality: 25,
  stressLevel: 85,
});

console.log('Result:', JSON.stringify(stressResult, null, 2));
console.log('Expected: nervous and/or low_immunity traits\n');

// Example 6: Mixed Scenario
console.log('🔄 Example 6: Mixed Scenario');
console.log('Moderate conditions with some lineage specialization');

const mixedMare = {
  id: 6,
  name: 'Mixed Mare',
  stress_level: 40,
};

const mixedLineage = [
  { id: 401, name: 'Dressage Horse 1', discipline: 'Dressage' },
  { id: 402, name: 'Dressage Horse 2', discipline: 'Dressage' },
  { id: 403, name: 'Dressage Horse 3', discipline: 'Dressage' },
  { id: 404, name: 'Racing Horse', discipline: 'Racing' },
  { id: 405, name: 'Show Jumper', discipline: 'Show Jumping' },
];

const mixedResult = applyEpigeneticTraitsAtBirth({
  mare: mixedMare,
  lineage: mixedLineage,
  feedQuality: 65,
  stressLevel: 40,
});

console.log('Result:', JSON.stringify(mixedResult, null, 2));
console.log('Expected: discipline_affinity_dressage (3 dressage ancestors)\n');

// Example 7: No Specialization
console.log('🎲 Example 7: No Specialization');
console.log('Diverse lineage with no clear specialization');

const diverseMare = {
  id: 7,
  name: 'Diverse Mare',
  stress_level: 35,
};

const diverseLineage = [
  { id: 501, name: 'Racing Horse', discipline: 'Racing' },
  { id: 502, name: 'Dressage Horse', discipline: 'Dressage' },
  { id: 503, name: 'Show Jumper', discipline: 'Show Jumping' },
  { id: 504, name: 'Cross Country Horse', discipline: 'Cross Country' },
  { id: 505, name: 'Reining Horse', discipline: 'Reining' },
];

const diverseResult = applyEpigeneticTraitsAtBirth({
  mare: diverseMare,
  lineage: diverseLineage,
  feedQuality: 55,
  stressLevel: 35,
});

console.log('Result:', JSON.stringify(diverseResult, null, 2));
console.log('Expected: No discipline affinity traits (no specialization)\n');

// Example 8: Edge Cases
console.log('🔍 Example 8: Edge Cases');
console.log('Testing boundary conditions');

// Exactly 3 ancestors with same discipline
const edgeMare = {
  id: 8,
  name: 'Edge Case Mare',
  stress_level: 20,
};

const edgeLineage = [
  { id: 601, name: 'Endurance Horse 1', discipline: 'Endurance' },
  { id: 602, name: 'Endurance Horse 2', discipline: 'Endurance' },
  { id: 603, name: 'Endurance Horse 3', discipline: 'Endurance' }, // Exactly 3
  { id: 604, name: 'Other Horse', discipline: 'Racing' },
];

const edgeResult = applyEpigeneticTraitsAtBirth({
  mare: edgeMare,
  lineage: edgeLineage,
  feedQuality: 80, // Exactly at threshold
  stressLevel: 20, // Exactly at threshold
});

console.log('Result:', JSON.stringify(edgeResult, null, 2));
console.log('Expected: resilient, people_trusting, and discipline_affinity_endurance\n');

console.log('✅ All examples completed!');
console.log('\n📝 Key Usage Patterns:');
console.log('- Low stress (≤20) + Premium feed (≥80) → resilient, people_trusting');
console.log('- Inbreeding detected → fragile, reactive, low_immunity');
console.log('- 3+ ancestors same discipline → discipline_affinity_*');
console.log('- 4+ ancestors same discipline → legacy_talent chance');
console.log('- High stress (≥80) → nervous');
console.log('- Poor nutrition (≤30) → low_immunity');
console.log('- Function handles disciplineScores when discipline field missing');
console.log('- Duplicate traits are automatically removed');
