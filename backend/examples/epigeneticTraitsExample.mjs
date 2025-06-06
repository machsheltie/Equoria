import {
  calculateEpigeneticTraits,
  getTraitDefinition,
  getTraitsByType,
  checkTraitConflict,
} from '../utils/epigeneticTraits.mjs';

/**
 * Epigenetic Traits Calculation Examples
 * Demonstrates various breeding scenarios and how environmental factors affect offspring traits
 */

console.log('🧬 Epigenetic Traits Calculation Examples\n');

// Example 1: Optimal Breeding Conditions
console.log('📈 Example 1: Optimal Breeding Conditions');
console.log('High bonding, low stress, excellent parent traits');

const optimalBreeding = {
  damTraits: ['resilient', 'intelligent', 'athletic'],
  sireTraits: ['bold', 'calm', 'trainability_boost'],
  damBondScore: 95,
  damStressLevel: 5,
};

const optimalResult = calculateEpigeneticTraits(optimalBreeding);
console.log('Input:', optimalBreeding);
console.log('Result:', optimalResult);
console.log(
  'Total traits:',
  optimalResult.positive.length + optimalResult.negative.length + optimalResult.hidden.length,
);
console.log('');

// Example 2: Poor Breeding Conditions
console.log('📉 Example 2: Poor Breeding Conditions');
console.log('Low bonding, high stress, challenging parent traits');

const poorBreeding = {
  damTraits: ['nervous', 'fragile'],
  sireTraits: ['aggressive', 'stubborn'],
  damBondScore: 15,
  damStressLevel: 90,
};

const poorResult = calculateEpigeneticTraits(poorBreeding);
console.log('Input:', poorBreeding);
console.log('Result:', poorResult);
console.log(
  'Total traits:',
  poorResult.positive.length + poorResult.negative.length + poorResult.hidden.length,
);
console.log('');

// Example 3: Mixed Parent Traits
console.log('⚖️ Example 3: Mixed Parent Traits');
console.log('Parents with both positive and negative traits, moderate conditions');

const mixedBreeding = {
  damTraits: ['resilient', 'nervous'], // Mixed traits
  sireTraits: ['bold', 'lazy'], // Mixed traits
  damBondScore: 70,
  damStressLevel: 30,
};

const mixedResult = calculateEpigeneticTraits(mixedBreeding);
console.log('Input:', mixedBreeding);
console.log('Result:', mixedResult);
console.log(
  'Total traits:',
  mixedResult.positive.length + mixedResult.negative.length + mixedResult.hidden.length,
);
console.log('');

// Example 4: First-Time Parents (No Traits)
console.log('🆕 Example 4: First-Time Parents');
console.log('Parents with no discovered traits, environmental factors only');

const newParents = {
  damTraits: [],
  sireTraits: [],
  damBondScore: 80,
  damStressLevel: 20,
};

const newResult = calculateEpigeneticTraits(newParents);
console.log('Input:', newParents);
console.log('Result:', newResult);
console.log(
  'Total traits:',
  newResult.positive.length + newResult.negative.length + newResult.hidden.length,
);
console.log('');

// Example 5: Deterministic Results (with seed)
console.log('🎯 Example 5: Deterministic Results');
console.log('Using seed for consistent results in testing');

const seededBreeding = {
  damTraits: ['resilient'],
  sireTraits: ['bold'],
  damBondScore: 80,
  damStressLevel: 20,
  seed: 12345,
};

const seededResult1 = calculateEpigeneticTraits(seededBreeding);
const seededResult2 = calculateEpigeneticTraits(seededBreeding);

console.log('Input:', seededBreeding);
console.log('Result 1:', seededResult1);
console.log('Result 2:', seededResult2);
console.log('Results identical:', JSON.stringify(seededResult1) === JSON.stringify(seededResult2));
console.log('');

// Example 6: Rare Trait Breeding
console.log('✨ Example 6: Rare Trait Breeding');
console.log('Attempting to breed for rare traits with excellent conditions');

const rareBreeding = {
  damTraits: ['intelligent', 'trainability_boost'],
  sireTraits: ['athletic', 'calm'],
  damBondScore: 100,
  damStressLevel: 0,
};

// Run multiple times to show probability
console.log('Running 5 breeding attempts:');
for (let i = 1; i <= 5; i++) {
  const result = calculateEpigeneticTraits(rareBreeding);
  console.log(`Attempt ${i}:`, result);

  // Check for rare traits
  const allTraits = [...result.positive, ...result.negative, ...result.hidden];
  const rareTraits = allTraits.filter(trait => {
    const def = getTraitDefinition(trait);
    return def && (def.rarity === 'rare' || def.rarity === 'legendary');
  });

  if (rareTraits.length > 0) {
    console.log(`  🌟 Rare traits found: ${rareTraits.join(', ')}`);
  }
}
console.log('');

// Example 7: Trait Analysis
console.log('🔍 Example 7: Trait Analysis');
console.log('Analyzing trait definitions and conflicts');

console.log('All positive traits:', getTraitsByType('positive'));
console.log('All negative traits:', getTraitsByType('negative'));
console.log('');

// Check trait conflicts
const conflictPairs = [
  ['calm', 'nervous'],
  ['resilient', 'fragile'],
  ['bold', 'nervous'],
  ['intelligent', 'lazy'],
];

console.log('Trait conflict analysis:');
conflictPairs.forEach(([trait1, trait2]) => {
  const conflicts = checkTraitConflict(trait1, trait2);
  console.log(`${trait1} vs ${trait2}: ${conflicts ? 'CONFLICT' : 'Compatible'}`);
});
console.log('');

// Example 8: Breeding Strategy Simulation
console.log('🎮 Example 8: Breeding Strategy Simulation');
console.log('Comparing different breeding strategies');

const strategies = [
  {
    name: 'High Bond Strategy',
    params: {
      damTraits: ['resilient'],
      sireTraits: ['bold'],
      damBondScore: 95,
      damStressLevel: 50,
    },
  },
  {
    name: 'Low Stress Strategy',
    params: { damTraits: ['resilient'], sireTraits: ['bold'], damBondScore: 50, damStressLevel: 5 },
  },
  {
    name: 'Balanced Strategy',
    params: {
      damTraits: ['resilient'],
      sireTraits: ['bold'],
      damBondScore: 75,
      damStressLevel: 25,
    },
  },
];

strategies.forEach(strategy => {
  console.log(`\n${strategy.name}:`);

  // Run 10 simulations for each strategy
  let totalPositive = 0;
  let totalNegative = 0;
  let totalHidden = 0;

  for (let i = 0; i < 10; i++) {
    const result = calculateEpigeneticTraits(strategy.params);
    totalPositive += result.positive.length;
    totalNegative += result.negative.length;
    totalHidden += result.hidden.length;
  }

  console.log(`  Average positive traits: ${(totalPositive / 10).toFixed(1)}`);
  console.log(`  Average negative traits: ${(totalNegative / 10).toFixed(1)}`);
  console.log(`  Average hidden traits: ${(totalHidden / 10).toFixed(1)}`);
  console.log(
    `  Total average traits: ${((totalPositive + totalNegative + totalHidden) / 10).toFixed(1)}`,
  );
});

// Example 9: Real-World Integration
console.log('\n🌍 Example 9: Real-World Integration');
console.log('How to integrate with game breeding system');

function simulateBreeding(dam, sire, foalDevelopmentData) {
  console.log(
    `\nBreeding ${dam.name} (${dam.traits.join(', ')}) with ${sire.name} (${sire.traits.join(', ')})`,
  );

  const breedingParams = {
    damTraits: dam.traits,
    sireTraits: sire.traits,
    damBondScore: foalDevelopmentData.bondingLevel,
    damStressLevel: foalDevelopmentData.stressLevel,
  };

  const offspring = calculateEpigeneticTraits(breedingParams);

  console.log('Foal development conditions:');
  console.log(`  Bonding Level: ${foalDevelopmentData.bondingLevel}/100`);
  console.log(`  Stress Level: ${foalDevelopmentData.stressLevel}/100`);
  console.log('');
  console.log('Offspring traits:');
  console.log(`  Positive: ${offspring.positive.join(', ') || 'None'}`);
  console.log(`  Negative: ${offspring.negative.join(', ') || 'None'}`);
  console.log(`  Hidden: ${offspring.hidden.join(', ') || 'None'}`);

  return offspring;
}

// Sample horses
const dam = {
  name: 'Starlight',
  traits: ['resilient', 'intelligent'],
};

const sire = {
  name: 'Thunder',
  traits: ['bold', 'athletic'],
};

// Sample foal development data (from foal development system)
const foalDevelopment = {
  bondingLevel: 85,
  stressLevel: 15,
};

const foalTraits = simulateBreeding(dam, sire, foalDevelopment);

console.log('\n✅ Integration complete! Foal traits calculated and ready for database storage.');
console.log(`Final foal traits: ${JSON.stringify(foalTraits, null, 2)}`);

// Example 10: Error Handling
console.log('\n❌ Example 10: Error Handling');
console.log('Demonstrating proper error handling');

const invalidInputs = [
  { description: 'Missing parameters', input: {} },
  {
    description: 'Invalid trait arrays',
    input: { damTraits: 'not-array', sireTraits: [], damBondScore: 50, damStressLevel: 50 },
  },
  {
    description: 'Out of range values',
    input: { damTraits: [], sireTraits: [], damBondScore: 150, damStressLevel: 50 },
  },
];

invalidInputs.forEach(({ description, input }) => {
  try {
    calculateEpigeneticTraits(input);
    console.log(`${description}: No error (unexpected)`);
  } catch (error) {
    console.log(`${description}: ${error.message} ✓`);
  }
});

console.log('\n🎉 All examples completed successfully!');
console.log('\nKey takeaways:');
console.log('• High bonding scores increase positive trait probability');
console.log('• High stress levels increase negative trait probability');
console.log('• Environmental factors can generate new traits');
console.log('• Rare traits are usually hidden initially');
console.log('• Conflicting traits are automatically resolved');
console.log('• Deterministic results available with seeds for testing');
