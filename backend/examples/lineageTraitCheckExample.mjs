/**
 * Lineage Trait Check Utility Examples
 * Demonstrates how to use the lineage discipline affinity checking utility
 */

import {
  checkLineageForDisciplineAffinity,
  checkLineageForDisciplineAffinityDetailed,
  checkSpecificDisciplineAffinity,
} from '../utils/lineageTraitCheck.mjs';

console.log('🐎 Lineage Trait Check Utility Examples\n');

// Example 1: Basic Affinity Check - Strong Racing Lineage
console.log('🏇 Example 1: Strong Racing Lineage (3+ ancestors)');

function basicAffinityExample() {
  const racingLineage = [
    { id: 1, name: 'Secretariat Jr', discipline: 'Racing' },
    { id: 2, name: 'Speed Demon', discipline: 'Racing' },
    { id: 3, name: 'Thunder Bolt', discipline: 'Racing' },
    { id: 4, name: 'Grace Walker', discipline: 'Dressage' },
    { id: 5, name: 'High Jumper', discipline: 'Show Jumping' },
  ];

  const result = checkLineageForDisciplineAffinity(racingLineage);

  console.log('Ancestors:', racingLineage.map(a => `${a.name} (${a.discipline})`).join(', '));
  console.log(`Result: ${JSON.stringify(result)}`);
  console.log(
    `Interpretation: ${result.affinity ? `Strong ${result.discipline} lineage detected!` : 'No strong discipline affinity'}\n`,
  );
}

// Example 2: No Affinity - Diverse Lineage
console.log('🎯 Example 2: Diverse Lineage (no affinity)');

function noAffinityExample() {
  const diverseLineage = [
    { id: 1, name: 'Versatile One', discipline: 'Racing' },
    { id: 2, name: 'Elegant Dancer', discipline: 'Dressage' },
    { id: 3, name: 'High Flyer', discipline: 'Show Jumping' },
    { id: 4, name: 'Cross Country', discipline: 'Eventing' },
    { id: 5, name: 'Speed Runner', discipline: 'Racing' },
  ];

  const result = checkLineageForDisciplineAffinity(diverseLineage);

  console.log('Ancestors:', diverseLineage.map(a => `${a.name} (${a.discipline})`).join(', '));
  console.log(`Result: ${JSON.stringify(result)}`);
  console.log(
    `Interpretation: ${result.affinity ? `Strong ${result.discipline} lineage detected!` : 'Diverse lineage - no single discipline dominance'}\n`,
  );
}

// Example 3: Competition History Analysis
console.log('📊 Example 3: Competition History Analysis');

function competitionHistoryExample() {
  const ancestorsWithHistory = [
    {
      id: 1,
      name: 'Champion Jumper',
      competitionHistory: [
        { discipline: 'Show Jumping', placement: '1st' },
        { discipline: 'Show Jumping', placement: '1st' },
        { discipline: 'Show Jumping', placement: '2nd' },
        { discipline: 'Dressage', placement: '3rd' },
      ],
    },
    {
      id: 2,
      name: 'Flying High',
      competitionHistory: [
        { discipline: 'Show Jumping', placement: '1st' },
        { discipline: 'Show Jumping', placement: '2nd' },
      ],
    },
    {
      id: 3,
      name: 'Leap Master',
      competitionHistory: [{ discipline: 'Show Jumping', placement: '1st' }],
    },
    {
      id: 4,
      name: 'Speed King',
      competitionHistory: [
        { discipline: 'Racing', placement: '1st' },
        { discipline: 'Racing', placement: '1st' },
      ],
    },
  ];

  const result = checkLineageForDisciplineAffinity(ancestorsWithHistory);

  console.log('Ancestors with competition history:');
  ancestorsWithHistory.forEach(ancestor => {
    const disciplines = ancestor.competitionHistory.map(c => c.discipline);
    const uniqueDisciplines = [...new Set(disciplines)];
    console.log(
      `- ${ancestor.name}: ${uniqueDisciplines.join(', ')} (${disciplines.length} competitions)`,
    );
  });

  console.log(`Result: ${JSON.stringify(result)}`);
  console.log(
    `Interpretation: ${result.affinity ? `Strong ${result.discipline} lineage from competition analysis!` : 'No clear discipline preference from competitions'}\n`,
  );
}

// Example 4: Discipline Scores Analysis
console.log('🏆 Example 4: Discipline Scores Analysis');

function disciplineScoresExample() {
  const ancestorsWithScores = [
    {
      id: 1,
      name: 'Dressage Master',
      disciplineScores: { Dressage: 95, 'Show Jumping': 70, Racing: 60 },
    },
    {
      id: 2,
      name: 'Elegant Performer',
      disciplineScores: { Dressage: 88, Racing: 65 },
    },
    {
      id: 3,
      name: 'Graceful Mover',
      disciplineScores: { Dressage: 92, 'Show Jumping': 75 },
    },
    {
      id: 4,
      name: 'Speed Demon',
      disciplineScores: { Racing: 90, Dressage: 70 },
    },
  ];

  const result = checkLineageForDisciplineAffinity(ancestorsWithScores);

  console.log('Ancestors with discipline scores:');
  ancestorsWithScores.forEach(ancestor => {
    const scores = Object.entries(ancestor.disciplineScores)
      .map(([discipline, score]) => `${discipline}: ${score}`)
      .join(', ');
    console.log(`- ${ancestor.name}: ${scores}`);
  });

  console.log(`Result: ${JSON.stringify(result)}`);
  console.log(
    `Interpretation: ${result.affinity ? `Strong ${result.discipline} lineage from score analysis!` : 'No clear discipline preference from scores'}\n`,
  );
}

// Example 5: Detailed Analysis
console.log('🔍 Example 5: Detailed Analysis');

function detailedAnalysisExample() {
  const mixedLineage = [
    { id: 1, name: 'Jumper A', discipline: 'Show Jumping' },
    { id: 2, name: 'Jumper B', discipline: 'Show Jumping' },
    { id: 3, name: 'Jumper C', discipline: 'Show Jumping' },
    { id: 4, name: 'Jumper D', discipline: 'Show Jumping' },
    { id: 5, name: 'Racer A', discipline: 'Racing' },
    { id: 6, name: 'Dancer A', discipline: 'Dressage' },
    { id: 7, name: 'Unknown' /* no discipline */ },
  ];

  const result = checkLineageForDisciplineAffinityDetailed(mixedLineage);

  console.log('Mixed lineage analysis:');
  console.log(`- Total ancestors analyzed: ${result.totalAnalyzed}`);
  console.log(`- Ancestors with known disciplines: ${result.totalWithDisciplines}`);
  console.log(`- Discipline breakdown: ${JSON.stringify(result.disciplineBreakdown)}`);
  console.log(`- Affinity strength: ${result.affinityStrength}%`);
  console.log(`- Dominant discipline count: ${result.dominantCount}`);
  console.log(
    `- Has affinity: ${result.affinity} ${result.affinity ? `(${result.discipline})` : ''}\n`,
  );
}

// Example 6: Specific Discipline Check
console.log('🎯 Example 6: Specific Discipline Check');

function specificDisciplineExample() {
  const lineage = [
    { id: 1, name: 'Racer 1', discipline: 'Racing' },
    { id: 2, name: 'Racer 2', discipline: 'Racing' },
    { id: 3, name: 'Jumper 1', discipline: 'Show Jumping' },
    { id: 4, name: 'Dancer 1', discipline: 'Dressage' },
  ];

  console.log('Checking for specific discipline affinities:');

  const racingCheck = checkSpecificDisciplineAffinity(lineage, 'Racing', 2);
  console.log(
    `Racing (need 2): ${racingCheck.hasAffinity} - ${racingCheck.count}/${racingCheck.required} (${racingCheck.percentage}%)`,
  );

  const jumpingCheck = checkSpecificDisciplineAffinity(lineage, 'Show Jumping', 2);
  console.log(
    `Show Jumping (need 2): ${jumpingCheck.hasAffinity} - ${jumpingCheck.count}/${jumpingCheck.required} (${jumpingCheck.percentage}%)`,
  );

  const dressageCheck = checkSpecificDisciplineAffinity(lineage, 'Dressage', 2);
  console.log(
    `Dressage (need 2): ${dressageCheck.hasAffinity} - ${dressageCheck.count}/${dressageCheck.required} (${dressageCheck.percentage}%)\n`,
  );
}

// Example 7: Edge Cases
console.log('⚠️ Example 7: Edge Cases');

function edgeCasesExample() {
  console.log('Testing edge cases:');

  // Empty array
  const emptyResult = checkLineageForDisciplineAffinity([]);
  console.log(`Empty array: ${JSON.stringify(emptyResult)}`);

  // Null input
  const nullResult = checkLineageForDisciplineAffinity(null);
  console.log(`Null input: ${JSON.stringify(nullResult)}`);

  // Ancestors without discipline info
  const noDisciplineResult = checkLineageForDisciplineAffinity([
    { id: 1, name: 'Unknown 1' },
    { id: 2, name: 'Unknown 2' },
    { id: 3, name: 'Unknown 3' },
  ]);
  console.log(`No discipline info: ${JSON.stringify(noDisciplineResult)}`);

  // Exactly 3 matching
  const exactlyThreeResult = checkLineageForDisciplineAffinity([
    { id: 1, discipline: 'Racing' },
    { id: 2, discipline: 'Racing' },
    { id: 3, discipline: 'Racing' },
  ]);
  console.log(`Exactly 3 matching: ${JSON.stringify(exactlyThreeResult)}\n`);
}

// Example 8: Real-world Breeding Scenario
console.log('🌟 Example 8: Real-world Breeding Scenario');

function breedingScenarioExample() {
  console.log('Breeding scenario: Analyzing lineage for foal trait application');

  const proposedMating = {
    sire: {
      name: 'Thunder Strike',
      lineage: [
        { id: 101, name: 'Lightning Fast', discipline: 'Racing' },
        { id: 102, name: 'Storm Chaser', discipline: 'Racing' },
        { id: 103, name: 'Wind Runner', discipline: 'Racing' },
      ],
    },
    dam: {
      name: 'Graceful Beauty',
      lineage: [
        { id: 201, name: 'Elegant Steps', discipline: 'Dressage' },
        { id: 202, name: 'Perfect Form', discipline: 'Dressage' },
        { id: 203, name: 'Artistic Mover', discipline: 'Dressage' },
      ],
    },
  };

  // Combine lineages for analysis
  const combinedLineage = [...proposedMating.sire.lineage, ...proposedMating.dam.lineage];

  console.log(`Sire (${proposedMating.sire.name}) lineage: Racing specialists`);
  console.log(`Dam (${proposedMating.dam.name}) lineage: Dressage specialists`);

  const result = checkLineageForDisciplineAffinityDetailed(combinedLineage);

  console.log('\nCombined lineage analysis:');
  console.log(`- Discipline breakdown: ${JSON.stringify(result.disciplineBreakdown)}`);
  console.log(
    `- Strongest affinity: ${result.affinity ? result.discipline : 'None'} (${result.affinityStrength}%)`,
  );

  // Check for specific discipline affinities
  const racingAffinity = checkSpecificDisciplineAffinity(combinedLineage, 'Racing');
  const dressageAffinity = checkSpecificDisciplineAffinity(combinedLineage, 'Dressage');

  console.log('\nSpecific affinities:');
  console.log(`- Racing: ${racingAffinity.hasAffinity} (${racingAffinity.count}/3)`);
  console.log(`- Dressage: ${dressageAffinity.hasAffinity} (${dressageAffinity.count}/3)`);

  console.log('\nBreeding recommendation:');
  if (racingAffinity.hasAffinity && dressageAffinity.hasAffinity) {
    console.log('🌟 Excellent cross-discipline lineage! Foal may inherit versatility traits.');
  } else if (racingAffinity.hasAffinity) {
    console.log('🏇 Strong racing lineage - foal likely to excel in speed disciplines.');
  } else if (dressageAffinity.hasAffinity) {
    console.log('💃 Strong dressage lineage - foal likely to excel in precision disciplines.');
  } else {
    console.log('🎯 Diverse lineage - foal may develop unique discipline preferences.');
  }
}

// Run all examples
async function runAllExamples() {
  try {
    basicAffinityExample();
    noAffinityExample();
    competitionHistoryExample();
    disciplineScoresExample();
    detailedAnalysisExample();
    specificDisciplineExample();
    edgeCasesExample();
    breedingScenarioExample();

    console.log('\n✅ All lineage trait check examples completed successfully!');
    console.log('\n📝 Key Usage Patterns:');
    console.log('- Use checkLineageForDisciplineAffinity() for simple yes/no affinity checks');
    console.log('- Use checkLineageForDisciplineAffinityDetailed() for comprehensive analysis');
    console.log('- Use checkSpecificDisciplineAffinity() to check for particular disciplines');
    console.log(
      '- Function handles multiple data sources: direct discipline, competition history, scores',
    );
    console.log('- Requires 3+ ancestors with same discipline for affinity = true');
  } catch (error) {
    console.error('Error running examples:', error.message);
  }
}

// Export for use in other files
export {
  basicAffinityExample,
  noAffinityExample,
  competitionHistoryExample,
  disciplineScoresExample,
  detailedAnalysisExample,
  specificDisciplineExample,
  edgeCasesExample,
  breedingScenarioExample,
  runAllExamples,
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
