/**
 * Advanced Lineage Analysis Service
 * 
 * Provides sophisticated lineage analysis with tree structures, genetic diversity metrics,
 * and performance analysis capabilities for breeding decision support.
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * Generate hierarchical lineage tree structure
 * @param {number} stallionId - ID of the stallion
 * @param {number} mareId - ID of the mare
 * @param {number} maxGenerations - Maximum generations to trace
 * @returns {Object} Tree structure with nodes and relationships
 */
export async function generateLineageTree(stallionId, mareId, maxGenerations = 3) {
  try {
    logger.info(`[advancedLineageAnalysisService.generateLineageTree] Generating tree for stallion ${stallionId} and mare ${mareId}, ${maxGenerations} generations`);

    // Get the parent horses
    const [stallion, mare] = await Promise.all([
      prisma.horse.findUnique({
        where: { id: stallionId },
        include: {
          sire: true,
          dam: true,
          competitionResults: true
        }
      }),
      prisma.horse.findUnique({
        where: { id: mareId },
        include: {
          sire: true,
          dam: true,
          competitionResults: true
        }
      })
    ]);

    if (!stallion || !mare) {
      logger.warn(`[advancedLineageAnalysisService.generateLineageTree] Missing parent horses`);
      return {
        root: { stallion: null, mare: null },
        generations: [],
        totalHorses: 0,
        maxDepth: 0
      };
    }

    // Build tree structure recursively
    const tree = {
      root: {
        stallion: await buildHorseNode(stallion, 0, maxGenerations),
        mare: await buildHorseNode(mare, 0, maxGenerations)
      },
      generations: [],
      totalHorses: 0,
      maxDepth: maxGenerations
    };

    // Organize by generations
    tree.generations = await organizeByGenerations(stallionId, mareId, maxGenerations);
    tree.totalHorses = tree.generations.reduce((total, gen) => total + gen.horses.length, 0);

    logger.info(`[advancedLineageAnalysisService.generateLineageTree] Generated tree with ${tree.totalHorses} horses across ${tree.generations.length} generations`);
    return tree;

  } catch (error) {
    logger.error(`[advancedLineageAnalysisService.generateLineageTree] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Build individual horse node with parent relationships
 * @param {Object} horse - Horse data from database
 * @param {number} currentDepth - Current generation depth
 * @param {number} maxDepth - Maximum depth to traverse
 * @returns {Object} Horse node with parent relationships
 */
async function buildHorseNode(horse, currentDepth, maxDepth) {
  if (!horse || currentDepth >= maxDepth) {
    return null;
  }

  const node = {
    id: horse.id,
    name: horse.name,
    generation: currentDepth,
    stats: {
      speed: horse.speed || 50,
      stamina: horse.stamina || 50,
      agility: horse.agility || 50,
      intelligence: horse.intelligence || 50
    },
    traits: {
      positive: horse.positiveTraits || [],
      negative: horse.negativeTraits || [],
      hidden: horse.hiddenTraits || []
    },
    disciplineScores: horse.disciplineScores || {},
    competitionResults: horse.competitionResults || [],
    sire: null,
    dam: null
  };

  // Recursively build parent nodes
  if (horse.sire && currentDepth + 1 < maxDepth) {
    const sireData = await prisma.horse.findUnique({
      where: { id: horse.sire.id },
      include: { sire: true, dam: true, competitionResults: true }
    });
    node.sire = await buildHorseNode(sireData, currentDepth + 1, maxDepth);
  }

  if (horse.dam && currentDepth + 1 < maxDepth) {
    const damData = await prisma.horse.findUnique({
      where: { id: horse.dam.id },
      include: { sire: true, dam: true, competitionResults: true }
    });
    node.dam = await buildHorseNode(damData, currentDepth + 1, maxDepth);
  }

  return node;
}

/**
 * Organize lineage data by generations
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @param {number} maxGenerations - Maximum generations
 * @returns {Array} Array of generation objects
 */
async function organizeByGenerations(stallionId, mareId, maxGenerations) {
  const generations = [];
  const processed = new Set();
  let currentGeneration = [stallionId, mareId];

  for (let gen = 0; gen < maxGenerations && currentGeneration.length > 0; gen++) {
    const horses = [];
    const nextGeneration = [];

    for (const horseId of currentGeneration) {
      if (processed.has(horseId)) continue;
      processed.add(horseId);

      const horse = await prisma.horse.findUnique({
        where: { id: horseId },
        include: {
          competitionResults: true
        }
      });

      if (horse) {
        horses.push({
          id: horse.id,
          name: horse.name,
          sireId: horse.sireId,
          damId: horse.damId,
          stats: {
            speed: horse.speed || 50,
            stamina: horse.stamina || 50,
            agility: horse.agility || 50,
            intelligence: horse.intelligence || 50
          },
          traits: {
            positive: horse.positiveTraits || [],
            negative: horse.negativeTraits || [],
            hidden: horse.hiddenTraits || []
          },
          disciplineScores: horse.disciplineScores || {},
          competitionResults: horse.competitionResults || []
        });

        // Add parents to next generation
        if (horse.sireId) nextGeneration.push(horse.sireId);
        if (horse.damId) nextGeneration.push(horse.damId);
      }
    }

    if (horses.length > 0) {
      generations.push({
        generation: gen,
        horses
      });
    }

    currentGeneration = [...new Set(nextGeneration)]; // Remove duplicates
  }

  return generations;
}

/**
 * Calculate comprehensive genetic diversity metrics
 * @param {Array} lineageData - Array of generation objects
 * @returns {Object} Genetic diversity metrics
 */
export async function calculateGeneticDiversityMetrics(lineageData) {
  try {
    logger.info(`[advancedLineageAnalysisService.calculateGeneticDiversityMetrics] Calculating diversity for ${lineageData.length} generations`);

    const allHorses = lineageData.flatMap(gen => gen.horses);
    const allTraits = [];
    const allStats = { speed: [], stamina: [], agility: [], intelligence: [] };

    // Collect all traits and stats
    allHorses.forEach(horse => {
      const traits = horse.traits || { positive: [], negative: [], hidden: [] };
      allTraits.push(...traits.positive, ...traits.negative, ...traits.hidden);
      
      const stats = horse.stats || {};
      if (stats.speed) allStats.speed.push(stats.speed);
      if (stats.stamina) allStats.stamina.push(stats.stamina);
      if (stats.agility) allStats.agility.push(stats.agility);
      if (stats.intelligence) allStats.intelligence.push(stats.intelligence);
    });

    // Calculate trait diversity
    const uniqueTraits = [...new Set(allTraits)];
    const traitFrequency = {};
    allTraits.forEach(trait => {
      traitFrequency[trait] = (traitFrequency[trait] || 0) + 1;
    });

    // Calculate Shannon diversity index for traits
    const totalTraits = allTraits.length;
    let shannonIndex = 0;
    if (totalTraits > 0) {
      Object.values(traitFrequency).forEach(count => {
        const proportion = count / totalTraits;
        shannonIndex -= proportion * Math.log2(proportion);
      });
    }

    // Calculate stat variance
    const statVariance = {};
    Object.keys(allStats).forEach(stat => {
      const values = allStats[stat];
      if (values.length > 0) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        statVariance[stat] = {
          mean: Math.round(mean),
          variance: Math.round(variance * 100) / 100,
          standardDeviation: Math.round(Math.sqrt(variance) * 100) / 100
        };
      }
    });

    // Calculate overall diversity score (0-100)
    const traitDiversityScore = Math.min(100, (uniqueTraits.length / Math.max(1, allHorses.length)) * 100);
    const statDiversityScore = Object.values(statVariance).reduce((sum, stat) => sum + stat.standardDeviation, 0) / 4;
    const overallDiversity = Math.round((traitDiversityScore + Math.min(100, statDiversityScore)) / 2);

    return {
      overallDiversity,
      traitDiversity: {
        uniqueTraits: uniqueTraits.length,
        traitFrequency,
        diversityIndex: Math.round(shannonIndex * 100) / 100
      },
      statVariance,
      inbreedingRisk: await calculateInbreedingRisk(lineageData),
      geneticBottlenecks: await identifyGeneticBottlenecks(lineageData)
    };

  } catch (error) {
    logger.error(`[advancedLineageAnalysisService.calculateGeneticDiversityMetrics] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate inbreeding risk from lineage data
 * @param {Array} lineageData - Lineage generation data
 * @returns {Object} Inbreeding risk assessment
 */
async function calculateInbreedingRisk(lineageData) {
  const allHorses = lineageData.flatMap(gen => gen.horses);
  const horseIds = new Set();
  const duplicates = [];

  allHorses.forEach(horse => {
    if (horseIds.has(horse.id)) {
      duplicates.push(horse.id);
    } else {
      horseIds.add(horse.id);
    }
  });

  const riskLevel = duplicates.length > 0 ? 'high' : 
                   allHorses.length < 8 ? 'medium' : 'low';

  return {
    level: riskLevel,
    duplicateAncestors: duplicates.length,
    totalAncestors: horseIds.size,
    coefficient: duplicates.length / Math.max(1, allHorses.length)
  };
}

/**
 * Identify genetic bottlenecks in lineage
 * @param {Array} lineageData - Lineage generation data
 * @returns {Array} Array of identified bottlenecks
 */
export async function identifyGeneticBottlenecks(lineageData) {
  const bottlenecks = [];

  lineageData.forEach((generation, index) => {
    const horses = generation.horses;
    const traitCounts = {};
    
    // Count trait occurrences in this generation
    horses.forEach(horse => {
      const traits = horse.traits || { positive: [], negative: [], hidden: [] };
      [...traits.positive, ...traits.negative, ...traits.hidden].forEach(trait => {
        traitCounts[trait] = (traitCounts[trait] || 0) + 1;
      });
    });

    // Identify traits that appear in >75% of horses (potential bottleneck)
    const totalHorses = horses.length;
    Object.entries(traitCounts).forEach(([trait, count]) => {
      const frequency = count / totalHorses;
      if (frequency > 0.75 && totalHorses > 1) {
        bottlenecks.push({
          generation: index,
          trait,
          frequency: Math.round(frequency * 100),
          severity: frequency > 0.9 ? 'high' : 'medium',
          affectedTraits: [trait],
          recommendation: `Consider introducing genetic diversity to reduce ${trait} dominance`
        });
      }
    });
  });

  return bottlenecks;
}

/**
 * Calculate inbreeding coefficient for specific breeding pair
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @returns {number} Inbreeding coefficient (0-1)
 */
export async function calculateInbreedingCoefficient(stallionId, mareId) {
  try {
    logger.info(`[advancedLineageAnalysisService.calculateInbreedingCoefficient] Calculating for stallion ${stallionId} and mare ${mareId}`);

    // Get lineage for both horses
    const lineageData = await organizeByGenerations(stallionId, mareId, 4);
    const allAncestors = lineageData.flatMap(gen => gen.horses);

    // Find common ancestors
    const stallionAncestors = new Set();
    const mareAncestors = new Set();
    const commonAncestors = [];

    // Separate ancestors by parent line
    allAncestors.forEach(horse => {
      // This is a simplified approach - in reality, we'd need to trace specific lineage paths
      if (horse.id === stallionId || isAncestorOf(horse.id, stallionId, allAncestors)) {
        stallionAncestors.add(horse.id);
      }
      if (horse.id === mareId || isAncestorOf(horse.id, mareId, allAncestors)) {
        mareAncestors.add(horse.id);
      }
    });

    // Find intersection
    stallionAncestors.forEach(id => {
      if (mareAncestors.has(id) && id !== stallionId && id !== mareId) {
        commonAncestors.push(id);
      }
    });

    // Calculate coefficient based on common ancestors
    const coefficient = commonAncestors.length / Math.max(1, allAncestors.length);

    logger.info(`[advancedLineageAnalysisService.calculateInbreedingCoefficient] Found ${commonAncestors.length} common ancestors, coefficient: ${coefficient}`);
    return Math.min(1, coefficient);

  } catch (error) {
    logger.error(`[advancedLineageAnalysisService.calculateInbreedingCoefficient] Error: ${error.message}`);
    return 0;
  }
}

/**
 * Helper function to check if horse is ancestor of another
 * @param {number} ancestorId - Potential ancestor ID
 * @param {number} descendantId - Descendant ID
 * @param {Array} allHorses - All horses in lineage
 * @returns {boolean} True if ancestor relationship exists
 */
function isAncestorOf(ancestorId, descendantId, allHorses) {
  const descendant = allHorses.find(h => h.id === descendantId);
  if (!descendant) return false;

  if (descendant.sireId === ancestorId || descendant.damId === ancestorId) {
    return true;
  }

  // Check recursively through parents
  if (descendant.sireId && isAncestorOf(ancestorId, descendant.sireId, allHorses)) {
    return true;
  }
  if (descendant.damId && isAncestorOf(ancestorId, descendant.damId, allHorses)) {
    return true;
  }

  return false;
}

/**
 * Analyze lineage performance trends across generations
 * @param {Array} lineageData - Lineage generation data
 * @returns {Object} Performance analysis results
 */
export async function analyzeLineagePerformance(lineageData) {
  try {
    logger.info(`[advancedLineageAnalysisService.analyzeLineagePerformance] Analyzing performance for ${lineageData.length} generations`);

    const generationalTrends = [];
    const allDisciplines = new Set();
    const performanceData = [];

    // Analyze each generation
    lineageData.forEach((generation, index) => {
      const horses = generation.horses;
      const stats = { speed: [], stamina: [], agility: [], intelligence: [] };
      const disciplineScores = {};
      const topPerformers = [];

      horses.forEach(horse => {
        // Collect stats
        if (horse.stats) {
          Object.keys(stats).forEach(stat => {
            if (horse.stats[stat]) stats[stat].push(horse.stats[stat]);
          });
        }

        // Collect discipline scores
        if (horse.disciplineScores) {
          Object.entries(horse.disciplineScores).forEach(([discipline, score]) => {
            allDisciplines.add(discipline);
            if (!disciplineScores[discipline]) disciplineScores[discipline] = [];
            disciplineScores[discipline].push(score);
          });
        }

        // Calculate performance score for this horse
        const avgStats = horse.stats ?
          Object.values(horse.stats).reduce((sum, val) => sum + val, 0) / Object.keys(horse.stats).length : 50;
        const avgDiscipline = horse.disciplineScores ?
          Object.values(horse.disciplineScores).reduce((sum, val) => sum + val, 0) / Object.keys(horse.disciplineScores).length : 50;

        const performanceScore = (avgStats + avgDiscipline) / 2;

        performanceData.push({
          id: horse.id,
          name: horse.name,
          generation: index,
          performanceScore,
          specialties: Object.entries(horse.disciplineScores || {})
            .filter(([_, score]) => score > 80)
            .map(([discipline, _]) => discipline)
        });

        if (performanceScore > 75) {
          topPerformers.push({
            id: horse.id,
            name: horse.name,
            performanceScore: Math.round(performanceScore),
            specialties: Object.entries(horse.disciplineScores || {})
              .filter(([_, score]) => score > 80)
              .map(([discipline, _]) => discipline)
          });
        }
      });

      // Calculate averages for this generation
      const averageStats = {};
      Object.keys(stats).forEach(stat => {
        if (stats[stat].length > 0) {
          averageStats[stat] = Math.round(stats[stat].reduce((sum, val) => sum + val, 0) / stats[stat].length);
        }
      });

      const averageDisciplines = {};
      Object.keys(disciplineScores).forEach(discipline => {
        const scores = disciplineScores[discipline];
        if (scores.length > 0) {
          averageDisciplines[discipline] = Math.round(scores.reduce((sum, val) => sum + val, 0) / scores.length);
        }
      });

      generationalTrends.push({
        generation: index,
        horseCount: horses.length,
        averageStats,
        averageDisciplines,
        topPerformers: topPerformers.slice(0, 3) // Top 3 performers
      });
    });

    // Identify discipline strengths and weaknesses
    const disciplineStrengths = analyzeDisciplineStrengths(lineageData, allDisciplines);

    // Identify improvement areas
    const improvementAreas = identifyImprovementAreas(generationalTrends);

    return {
      generationalTrends,
      disciplineStrengths,
      performanceMetrics: {
        topPerformers: performanceData
          .sort((a, b) => b.performanceScore - a.performanceScore)
          .slice(0, 10),
        averagePerformance: Math.round(
          performanceData.reduce((sum, horse) => sum + horse.performanceScore, 0) /
          Math.max(1, performanceData.length)
        )
      },
      improvementAreas
    };

  } catch (error) {
    logger.error(`[advancedLineageAnalysisService.analyzeLineagePerformance] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Analyze discipline strengths across lineage
 * @param {Array} lineageData - Lineage generation data
 * @param {Set} allDisciplines - Set of all disciplines found
 * @returns {Object} Discipline strength analysis
 */
function analyzeDisciplineStrengths(lineageData, allDisciplines) {
  const disciplineAverages = {};

  // Calculate average scores for each discipline
  allDisciplines.forEach(discipline => {
    const scores = [];
    lineageData.forEach(generation => {
      generation.horses.forEach(horse => {
        if (horse.disciplineScores && horse.disciplineScores[discipline]) {
          scores.push(horse.disciplineScores[discipline]);
        }
      });
    });

    if (scores.length > 0) {
      disciplineAverages[discipline] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
  });

  // Sort disciplines by average score
  const sortedDisciplines = Object.entries(disciplineAverages)
    .sort(([,a], [,b]) => b - a);

  return {
    strongest: sortedDisciplines.slice(0, 3).map(([discipline, avg]) => ({
      discipline,
      averageScore: Math.round(avg)
    })),
    weakest: sortedDisciplines.slice(-3).map(([discipline, avg]) => ({
      discipline,
      averageScore: Math.round(avg)
    })),
    balanced: sortedDisciplines.filter(([,avg]) => avg >= 70 && avg <= 85).map(([discipline, avg]) => ({
      discipline,
      averageScore: Math.round(avg)
    }))
  };
}

/**
 * Identify areas for improvement based on generational trends
 * @param {Array} generationalTrends - Trends across generations
 * @returns {Array} Array of improvement areas
 */
function identifyImprovementAreas(generationalTrends) {
  const improvements = [];

  if (generationalTrends.length < 2) return improvements;

  // Compare recent vs older generations
  const recent = generationalTrends[0];
  const older = generationalTrends[generationalTrends.length - 1];

  // Check stat trends
  Object.keys(recent.averageStats || {}).forEach(stat => {
    const recentAvg = recent.averageStats[stat];
    const olderAvg = older.averageStats[stat];

    if (olderAvg && recentAvg < olderAvg - 5) {
      improvements.push({
        area: `${stat} decline`,
        description: `${stat} has decreased from ${olderAvg} to ${recentAvg} across generations`,
        priority: 'medium',
        suggestion: `Focus on breeding for improved ${stat} characteristics`
      });
    }
  });

  // Check for low diversity
  if (recent.horseCount < 4) {
    improvements.push({
      area: 'genetic diversity',
      description: 'Limited number of horses in recent generation may reduce genetic diversity',
      priority: 'high',
      suggestion: 'Introduce new bloodlines to increase genetic diversity'
    });
  }

  return improvements;
}

/**
 * Create visualization-ready data structure
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @param {number} maxGenerations - Maximum generations
 * @returns {Object} Visualization data structure
 */
export async function createVisualizationData(stallionId, mareId, maxGenerations = 3) {
  try {
    logger.info(`[advancedLineageAnalysisService.createVisualizationData] Creating visualization for stallion ${stallionId} and mare ${mareId}`);

    const tree = await generateLineageTree(stallionId, mareId, maxGenerations);
    const nodes = [];
    const edges = [];

    // Convert tree to nodes and edges
    function processNode(horse, generation, parentId = null, relationship = null) {
      if (!horse) return;

      const nodeId = `horse_${horse.id}`;

      // Add node
      nodes.push({
        id: nodeId,
        name: horse.name,
        generation,
        position: {
          x: generation * 200,
          y: nodes.filter(n => n.generation === generation).length * 100
        },
        stats: horse.stats,
        traits: horse.traits,
        disciplineScores: horse.disciplineScores || {},
        type: 'horse'
      });

      // Add edge to parent
      if (parentId && relationship) {
        edges.push({
          from: nodeId,
          to: parentId,
          relationship,
          type: 'lineage'
        });
      }

      // Process children
      if (horse.sire) {
        processNode(horse.sire, generation + 1, nodeId, 'sire');
      }
      if (horse.dam) {
        processNode(horse.dam, generation + 1, nodeId, 'dam');
      }
    }

    // Process both parent trees
    if (tree.root.stallion) {
      processNode(tree.root.stallion, 0);
    }
    if (tree.root.mare) {
      processNode(tree.root.mare, 0);
    }

    return {
      nodes,
      edges,
      layout: {
        type: 'hierarchical',
        dimensions: {
          width: maxGenerations * 200,
          height: Math.max(nodes.length * 50, 400)
        }
      },
      metadata: {
        totalHorses: nodes.length,
        maxGenerations,
        createdAt: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.error(`[advancedLineageAnalysisService.createVisualizationData] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Generate comprehensive breeding recommendations
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @returns {Object} Breeding recommendations and analysis
 */
export async function generateBreedingRecommendations(stallionId, mareId) {
  try {
    logger.info(`[advancedLineageAnalysisService.generateBreedingRecommendations] Generating recommendations for stallion ${stallionId} and mare ${mareId}`);

    // Get detailed horse data
    const [stallion, mare] = await Promise.all([
      prisma.horse.findUnique({
        where: { id: stallionId },
        include: { competitionResults: true }
      }),
      prisma.horse.findUnique({
        where: { id: mareId },
        include: { competitionResults: true }
      })
    ]);

    if (!stallion || !mare) {
      throw new Error('One or both horses not found');
    }

    // Get lineage data
    const lineageData = await organizeByGenerations(stallionId, mareId, 3);

    // Calculate various metrics
    const diversityMetrics = await calculateGeneticDiversityMetrics(lineageData);
    const inbreedingCoeff = await calculateInbreedingCoefficient(stallionId, mareId);
    const performanceAnalysis = await analyzeLineagePerformance(lineageData);

    // Calculate compatibility score
    const compatibility = calculateBreedingCompatibility(stallion, mare, diversityMetrics, inbreedingCoeff);

    // Identify strengths
    const strengths = identifyBreedingStrengths(stallion, mare, performanceAnalysis);

    // Identify risks
    const risks = identifyBreedingRisks(stallion, mare, diversityMetrics, inbreedingCoeff);

    // Generate actionable suggestions
    const suggestions = generateBreedingSuggestions(stallion, mare, risks, strengths);

    // Predict expected outcomes
    const expectedOutcomes = predictBreedingOutcomes(stallion, mare, performanceAnalysis);

    return {
      compatibility,
      strengths,
      risks,
      suggestions,
      expectedOutcomes
    };

  } catch (error) {
    logger.error(`[advancedLineageAnalysisService.generateBreedingRecommendations] Error: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate breeding compatibility score
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Object} diversityMetrics - Genetic diversity metrics
 * @param {number} inbreedingCoeff - Inbreeding coefficient
 * @returns {Object} Compatibility assessment
 */
function calculateBreedingCompatibility(stallion, mare, diversityMetrics, inbreedingCoeff) {
  const factors = [];
  let totalScore = 0;

  // Genetic diversity factor (40% weight)
  const diversityScore = diversityMetrics.overallDiversity;
  const diversityFactor = diversityScore * 0.4;
  totalScore += diversityFactor;
  factors.push({
    name: 'Genetic Diversity',
    score: diversityScore,
    weight: 40,
    description: `Overall genetic diversity: ${diversityScore}%`
  });

  // Inbreeding risk factor (30% weight)
  const inbreedingScore = Math.max(0, 100 - (inbreedingCoeff * 100));
  const inbreedingFactor = inbreedingScore * 0.3;
  totalScore += inbreedingFactor;
  factors.push({
    name: 'Inbreeding Risk',
    score: inbreedingScore,
    weight: 30,
    description: `Low inbreeding risk: ${Math.round(inbreedingScore)}%`
  });

  // Complementary traits factor (20% weight)
  const traitCompatibility = calculateTraitCompatibility(stallion, mare);
  const traitFactor = traitCompatibility * 0.2;
  totalScore += traitFactor;
  factors.push({
    name: 'Trait Compatibility',
    score: traitCompatibility,
    weight: 20,
    description: `Complementary traits: ${Math.round(traitCompatibility)}%`
  });

  // Performance potential factor (10% weight)
  const performancePotential = calculatePerformancePotential(stallion, mare);
  const performanceFactor = performancePotential * 0.1;
  totalScore += performanceFactor;
  factors.push({
    name: 'Performance Potential',
    score: performancePotential,
    weight: 10,
    description: `Expected performance: ${Math.round(performancePotential)}%`
  });

  return {
    score: Math.round(totalScore),
    factors
  };
}

/**
 * Calculate trait compatibility between horses
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @returns {number} Compatibility score (0-100)
 */
function calculateTraitCompatibility(stallion, mare) {
  const stallionTraits = [
    ...(stallion.positiveTraits || []),
    ...(stallion.negativeTraits || []),
    ...(stallion.hiddenTraits || [])
  ];
  const mareTraits = [
    ...(mare.positiveTraits || []),
    ...(mare.negativeTraits || []),
    ...(mare.hiddenTraits || [])
  ];

  const sharedTraits = stallionTraits.filter(trait => mareTraits.includes(trait));
  const totalUniqueTraits = new Set([...stallionTraits, ...mareTraits]).size;

  // Moderate overlap is good (complementary), too much overlap reduces diversity
  const overlapRatio = sharedTraits.length / Math.max(1, totalUniqueTraits);

  if (overlapRatio < 0.2) return 60; // Too different
  if (overlapRatio > 0.8) return 40; // Too similar
  return 85; // Good balance
}

/**
 * Calculate performance potential
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @returns {number} Performance potential score (0-100)
 */
function calculatePerformancePotential(stallion, mare) {
  const stallionAvg = calculateAverageStats(stallion);
  const mareAvg = calculateAverageStats(mare);

  return Math.min(100, (stallionAvg + mareAvg) / 2);
}

/**
 * Calculate average stats for a horse
 * @param {Object} horse - Horse data
 * @returns {number} Average stat value
 */
function calculateAverageStats(horse) {
  const stats = [
    horse.speed || 50,
    horse.stamina || 50,
    horse.agility || 50,
    horse.intelligence || 50
  ];
  return stats.reduce((sum, stat) => sum + stat, 0) / stats.length;
}

/**
 * Identify breeding strengths
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Object} performanceAnalysis - Performance analysis
 * @returns {Array} Array of strengths
 */
function identifyBreedingStrengths(stallion, mare, performanceAnalysis) {
  const strengths = [];

  // Check for complementary stats
  const stallionStats = {
    speed: stallion.speed || 50,
    stamina: stallion.stamina || 50,
    agility: stallion.agility || 50,
    intelligence: stallion.intelligence || 50
  };
  const mareStats = {
    speed: mare.speed || 50,
    stamina: mare.stamina || 50,
    agility: mare.agility || 50,
    intelligence: mare.intelligence || 50
  };

  Object.keys(stallionStats).forEach(stat => {
    if (stallionStats[stat] > 80 || mareStats[stat] > 80) {
      strengths.push({
        type: 'stat',
        description: `Strong ${stat} genetics from ${stallionStats[stat] > mareStats[stat] ? 'stallion' : 'mare'}`,
        value: Math.max(stallionStats[stat], mareStats[stat])
      });
    }
  });

  // Check for discipline strengths
  if (performanceAnalysis.disciplineStrengths.strongest.length > 0) {
    strengths.push({
      type: 'discipline',
      description: `Strong lineage in ${performanceAnalysis.disciplineStrengths.strongest[0].discipline}`,
      value: performanceAnalysis.disciplineStrengths.strongest[0].averageScore
    });
  }

  return strengths;
}

/**
 * Identify breeding risks
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Object} diversityMetrics - Diversity metrics
 * @param {number} inbreedingCoeff - Inbreeding coefficient
 * @returns {Array} Array of risks
 */
function identifyBreedingRisks(stallion, mare, diversityMetrics, inbreedingCoeff) {
  const risks = [];

  // Inbreeding risk
  if (inbreedingCoeff > 0.1) {
    risks.push({
      type: 'inbreeding',
      severity: inbreedingCoeff > 0.25 ? 'high' : 'medium',
      description: `Elevated inbreeding risk (${Math.round(inbreedingCoeff * 100)}%)`,
      mitigation: 'Consider alternative breeding partners with more distant lineage'
    });
  }

  // Low genetic diversity
  if (diversityMetrics.overallDiversity < 40) {
    risks.push({
      type: 'diversity',
      severity: 'medium',
      description: 'Limited genetic diversity in combined lineage',
      mitigation: 'Introduce new bloodlines to increase genetic variation'
    });
  }

  // Genetic bottlenecks
  if (diversityMetrics.geneticBottlenecks.length > 0) {
    risks.push({
      type: 'bottleneck',
      severity: 'medium',
      description: `${diversityMetrics.geneticBottlenecks.length} genetic bottlenecks identified`,
      mitigation: 'Monitor offspring for trait concentration and diversify future breeding'
    });
  }

  return risks;
}

/**
 * Generate breeding suggestions
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Array} risks - Identified risks
 * @param {Array} strengths - Identified strengths
 * @returns {Array} Array of suggestions
 */
function generateBreedingSuggestions(stallion, mare, risks, strengths) {
  const suggestions = [];

  // Risk-based suggestions
  risks.forEach(risk => {
    suggestions.push({
      type: 'risk_mitigation',
      description: risk.mitigation,
      priority: risk.severity === 'high' ? 'high' : 'medium'
    });
  });

  // Strength-based suggestions
  if (strengths.length > 0) {
    suggestions.push({
      type: 'strength_optimization',
      description: 'Focus on developing identified genetic strengths in offspring',
      priority: 'medium'
    });
  }

  // General suggestions
  suggestions.push({
    type: 'monitoring',
    description: 'Monitor offspring development closely during first 6 months',
    priority: 'low'
  });

  return suggestions;
}

/**
 * Predict breeding outcomes
 * @param {Object} stallion - Stallion data
 * @param {Object} mare - Mare data
 * @param {Object} performanceAnalysis - Performance analysis
 * @returns {Object} Expected outcomes
 */
function predictBreedingOutcomes(stallion, mare, performanceAnalysis) {
  const stallionAvg = calculateAverageStats(stallion);
  const mareAvg = calculateAverageStats(mare);

  return {
    expectedStats: {
      speed: Math.round((stallion.speed || 50 + mare.speed || 50) / 2),
      stamina: Math.round((stallion.stamina || 50 + mare.stamina || 50) / 2),
      agility: Math.round((stallion.agility || 50 + mare.agility || 50) / 2),
      intelligence: Math.round((stallion.intelligence || 50 + mare.intelligence || 50) / 2)
    },
    expectedPerformance: Math.round((stallionAvg + mareAvg) / 2),
    likelyDisciplines: performanceAnalysis.disciplineStrengths.strongest.slice(0, 2).map(d => d.discipline),
    confidenceLevel: 75
  };
}
