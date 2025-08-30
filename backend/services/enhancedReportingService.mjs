/**
 * Enhanced Reporting Service
 * 
 * Provides advanced reporting and analysis functions for epigenetic data.
 * Supports comprehensive trait analysis, multi-horse comparisons, trend analysis,
 * and export capabilities with various levels of detail.
 * 
 * Business Rules:
 * - Comprehensive trait history analysis with environmental context
 * - Multi-horse comparison and ranking capabilities
 * - Trend analysis and predictive insights
 * - Export functionality with multiple format options
 * - Stable-wide analysis and recommendations
 */

import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { generateEnvironmentalReport } from './environmentalTriggerSystem.mjs';

/**
 * Generate insights from trait history data
 */
export function generateTraitHistoryInsights(traitHistory, environmentalContext, traitInteractions) {
  const insights = [];
  
  if (traitHistory.length === 0) {
    insights.push('No trait history available for analysis');
    return insights;
  }

  // Analyze trait discovery patterns
  const sourceMethods = {};
  traitHistory.forEach(log => {
    sourceMethods[log.sourceType] = (sourceMethods[log.sourceType] || 0) + 1;
  });

  const primaryMethod = Object.entries(sourceMethods).reduce((a, b) =>
    sourceMethods[a[0]] > sourceMethods[b[0]] ? a : b
  )[0];

  insights.push(`Primary trait discovery source: ${primaryMethod}`);

  // Analyze environmental influences
  if (environmentalContext.environmentalTriggers.detectedTriggers.length > 0) {
    insights.push(`${environmentalContext.environmentalTriggers.detectedTriggers.length} environmental triggers detected`);
  }

  // Analyze trait interactions
  if (traitInteractions.synergies.synergyPairs.length > 0) {
    insights.push(`${traitInteractions.synergies.synergyPairs.length} trait synergies identified`);
  }

  if (traitInteractions.conflicts.conflictPairs.length > 0) {
    insights.push(`${traitInteractions.conflicts.conflictPairs.length} trait conflicts detected`);
  }

  // Overall harmony assessment
  if (traitInteractions.traitInteractions.overallHarmony > 0.7) {
    insights.push('Excellent trait harmony - traits work well together');
  } else if (traitInteractions.traitInteractions.overallHarmony < 0.4) {
    insights.push('Poor trait harmony - conflicting traits may cause issues');
  }

  return insights;
}

/**
 * Generate epigenetic recommendations
 */
export function generateEpigeneticRecommendations(horse, environmentalInfluences, traitAnalysis, developmentalProgress) {
  const recommendations = [];
  
  // Age-based recommendations
  const ageInDays = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
  
  if (ageInDays < 30) {
    recommendations.push('Critical early development period - focus on consistent, gentle care');
  } else if (ageInDays < 90) {
    recommendations.push('Important socialization period - provide varied but controlled experiences');
  }

  // Stress-based recommendations
  if (horse.stressLevel > 6) {
    recommendations.push('High stress detected - implement stress reduction protocols');
  }

  // Bonding recommendations
  if (horse.bondScore < 20) {
    recommendations.push('Low bonding score - increase positive interaction frequency');
  }

  // Environmental recommendations
  if (environmentalInfluences.environmentalTriggers.triggerStrength > 0.6) {
    recommendations.push('Strong environmental triggers detected - monitor environmental factors carefully');
  }

  // Trait interaction recommendations
  if (traitAnalysis.conflicts.totalConflictStrength > 0.5) {
    recommendations.push('Trait conflicts detected - consider targeted interventions to resolve conflicts');
  }

  // Developmental recommendations
  if (developmentalProgress.pendingMilestones.length > 0) {
    recommendations.push(`${developmentalProgress.pendingMilestones.length} developmental milestones pending - focus on milestone achievement`);
  }

  return recommendations.length > 0 ? recommendations : ['Continue current care approach - horse is developing well'];
}

/**
 * Build trait timeline from history and interactions
 */
export function buildTraitTimeline(traitHistory, interactions) {
  const timeline = [];
  
  // Add trait discoveries to timeline
  traitHistory.forEach(log => {
    timeline.push({
      date: log.timestamp,
      type: 'trait_discovery',
      event: `Discovered trait: ${log.traitName}`,
      method: log.sourceType,
      context: log.sourceId || 'unknown',
      data: log,
    });
  });

  // Add significant interactions to timeline
  interactions.forEach(interaction => {
    if (Math.abs(interaction.bondingChange) > 2 || Math.abs(interaction.stressChange) > 2) {
      timeline.push({
        date: interaction.createdAt,
        type: 'significant_interaction',
        event: `${interaction.interactionType}: ${interaction.taskType}`,
        groom: interaction.groom?.name,
        bondingChange: interaction.bondingChange,
        stressChange: interaction.stressChange,
        quality: interaction.quality,
        data: interaction,
      });
    }
  });

  // Sort timeline by date
  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return timeline;
}

/**
 * Identify critical periods in timeline
 */
export function identifyCriticalPeriods(timeline, milestones) {
  const criticalPeriods = [];
  
  // Group events by time periods
  const periods = {};
  timeline.forEach(event => {
    const date = new Date(event.date);
    const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
    
    if (!periods[weekKey]) {
      periods[weekKey] = [];
    }
    periods[weekKey].push(event);
  });

  // Identify periods with significant activity
  Object.entries(periods).forEach(([period, events]) => {
    if (events.length >= 3) {
      const traitDiscoveries = events.filter(e => e.type === 'trait_discovery').length;
      const significantInteractions = events.filter(e => e.type === 'significant_interaction').length;
      
      if (traitDiscoveries > 0 || significantInteractions > 1) {
        criticalPeriods.push({
          period,
          eventCount: events.length,
          traitDiscoveries,
          significantInteractions,
          significance: traitDiscoveries > 0 ? 'high' : 'moderate',
        });
      }
    }
  });

  return criticalPeriods;
}

/**
 * Map environmental events from interactions
 */
export function mapEnvironmentalEvents(interactions) {
  const environmentalEvents = [];
  
  interactions.forEach(interaction => {
    // Identify environmental factors from task types
    let environmentalFactor = null;
    
    switch (interaction.taskType) {
      case 'showground_exposure':
        environmentalFactor = 'Novel environment exposure';
        break;
      case 'desensitization':
        environmentalFactor = 'Sensory desensitization';
        break;
      case 'trust_building':
        environmentalFactor = 'Social bonding activity';
        break;
      default:
        if (interaction.stressChange > 2) {
          environmentalFactor = 'Stress-inducing activity';
        } else if (interaction.bondingChange > 2) {
          environmentalFactor = 'Bonding-enhancing activity';
        }
    }

    if (environmentalFactor) {
      environmentalEvents.push({
        date: interaction.createdAt,
        factor: environmentalFactor,
        taskType: interaction.taskType,
        impact: {
          bonding: interaction.bondingChange,
          stress: interaction.stressChange,
          quality: interaction.quality,
        },
      });
    }
  });

  return environmentalEvents;
}

/**
 * Generate stable overview
 */
export function generateStableOverview(horses) {
  const overview = {
    totalHorses: horses.length,
    ageDistribution: {},
    traitCounts: {},
    averageBondScore: 0,
    averageStressLevel: 0,
  };

  let totalBond = 0;
  let totalStress = 0;

  horses.forEach(horse => {
    const ageInDays = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
    const ageCategory = ageInDays < 30 ? 'newborn' : ageInDays < 90 ? 'young' : ageInDays < 365 ? 'juvenile' : 'mature';
    
    overview.ageDistribution[ageCategory] = (overview.ageDistribution[ageCategory] || 0) + 1;
    
    totalBond += horse.bondScore;
    totalStress += horse.stressLevel;
    
    horse.epigeneticFlags.forEach(trait => {
      overview.traitCounts[trait] = (overview.traitCounts[trait] || 0) + 1;
    });
  });

  overview.averageBondScore = totalBond / horses.length;
  overview.averageStressLevel = totalStress / horses.length;

  return overview;
}

/**
 * Analyze trait distribution across stable
 */
export function analyzeTraitDistribution(horses) {
  const distribution = {
    totalTraits: 0,
    uniqueTraits: new Set(),
    traitFrequency: {},
    commonTraits: [],
    rareTraits: [],
  };

  horses.forEach(horse => {
    horse.epigeneticFlags.forEach(trait => {
      distribution.totalTraits++;
      distribution.uniqueTraits.add(trait);
      distribution.traitFrequency[trait] = (distribution.traitFrequency[trait] || 0) + 1;
    });
  });

  // Identify common and rare traits
  const sortedTraits = Object.entries(distribution.traitFrequency)
    .sort(([,a], [,b]) => b - a);

  distribution.commonTraits = sortedTraits.slice(0, 3).map(([trait, count]) => ({ trait, count }));
  distribution.rareTraits = sortedTraits.slice(-3).map(([trait, count]) => ({ trait, count }));
  distribution.uniqueTraits = distribution.uniqueTraits.size;

  return distribution;
}

/**
 * Analyze developmental stages across stable
 */
export function analyzeDevelopmentalStages(horses) {
  const stages = {
    critical: 0,
    developing: 0,
    stable: 0,
    mature: 0,
  };

  horses.forEach(horse => {
    const ageInDays = Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));
    
    if (ageInDays < 14) stages.critical++;
    else if (ageInDays < 60) stages.developing++;
    else if (ageInDays < 365) stages.stable++;
    else stages.mature++;
  });

  return stages;
}

/**
 * Analyze stable environmental factors
 */
export async function analyzeStableEnvironmentalFactors(horses) {
  const factors = {
    overallTriggerStrength: 0,
    commonTriggers: [],
    environmentalRisks: [],
    recommendations: [],
  };

  if (horses.length === 0) return factors;

  // Analyze environmental factors for each horse
  let totalTriggerStrength = 0;
  const triggerCounts = {};

  for (const horse of horses) {
    try {
      const environmentalReport = await generateEnvironmentalReport(horse.id);
      totalTriggerStrength += environmentalReport.environmentalTriggers.triggerStrength;

      environmentalReport.environmentalTriggers.detectedTriggers.forEach(trigger => {
        triggerCounts[trigger.type] = (triggerCounts[trigger.type] || 0) + 1;
      });
    } catch (error) {
      logger.warn(`Failed to analyze environmental factors for horse ${horse.id}:`, error);
    }
  }

  factors.overallTriggerStrength = totalTriggerStrength / horses.length;

  // Identify common triggers
  factors.commonTriggers = Object.entries(triggerCounts)
    .filter(([, count]) => count > horses.length * 0.3)
    .map(([trigger, count]) => ({ trigger, count, percentage: (count / horses.length) * 100 }));

  return factors;
}

/**
 * Generate stable recommendations
 */
export function generateStableRecommendations(overview, traitDistribution, developmentalStages) {
  const recommendations = [];

  // Age-based recommendations
  if (developmentalStages.critical > 0) {
    recommendations.push(`${developmentalStages.critical} horses in critical development period - prioritize consistent care`);
  }

  // Stress recommendations
  if (overview.averageStressLevel > 6) {
    recommendations.push('High average stress levels - implement stable-wide stress reduction measures');
  }

  // Bonding recommendations
  if (overview.averageBondScore < 25) {
    recommendations.push('Low average bonding scores - increase positive interaction frequency across stable');
  }

  // Trait diversity recommendations
  if (traitDistribution.uniqueTraits < 5) {
    recommendations.push('Limited trait diversity - consider varied environmental enrichment');
  }

  return recommendations.length > 0 ? recommendations : ['Stable is well-managed - continue current practices'];
}

/**
 * Generate horse comparison analysis
 */
export async function generateHorseComparison(horses) {
  const comparison = {
    horses: horses.map(horse => ({
      id: horse.id,
      name: horse.name,
      age: Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24)),
      traitCount: horse.epigeneticFlags.length,
      bondScore: horse.bondScore,
      stressLevel: horse.stressLevel,
      traits: horse.epigeneticFlags,
    })),
    averages: {
      traitCount: 0,
      bondScore: 0,
      stressLevel: 0,
    },
  };

  // Calculate averages
  comparison.averages.traitCount = comparison.horses.reduce((sum, h) => sum + h.traitCount, 0) / horses.length;
  comparison.averages.bondScore = comparison.horses.reduce((sum, h) => sum + h.bondScore, 0) / horses.length;
  comparison.averages.stressLevel = comparison.horses.reduce((sum, h) => sum + h.stressLevel, 0) / horses.length;

  return comparison;
}

/**
 * Identify trait similarities between horses
 */
export function identifyTraitSimilarities(horses) {
  const similarities = [];

  for (let i = 0; i < horses.length; i++) {
    for (let j = i + 1; j < horses.length; j++) {
      const horse1 = horses[i];
      const horse2 = horses[j];

      const commonTraits = horse1.epigeneticFlags.filter(trait =>
        horse2.epigeneticFlags.includes(trait)
      );

      if (commonTraits.length > 0) {
        similarities.push({
          horse1: { id: horse1.id, name: horse1.name },
          horse2: { id: horse2.id, name: horse2.name },
          commonTraits,
          similarityScore: commonTraits.length / Math.max(horse1.epigeneticFlags.length, horse2.epigeneticFlags.length),
        });
      }
    }
  }

  return similarities.sort((a, b) => b.similarityScore - a.similarityScore);
}

/**
 * Identify trait differences between horses
 */
export function identifyTraitDifferences(horses) {
  const differences = [];

  for (let i = 0; i < horses.length; i++) {
    for (let j = i + 1; j < horses.length; j++) {
      const horse1 = horses[i];
      const horse2 = horses[j];

      const uniqueToHorse1 = horse1.epigeneticFlags.filter(trait =>
        !horse2.epigeneticFlags.includes(trait)
      );

      const uniqueToHorse2 = horse2.epigeneticFlags.filter(trait =>
        !horse1.epigeneticFlags.includes(trait)
      );

      if (uniqueToHorse1.length > 0 || uniqueToHorse2.length > 0) {
        differences.push({
          horse1: { id: horse1.id, name: horse1.name, uniqueTraits: uniqueToHorse1 },
          horse2: { id: horse2.id, name: horse2.name, uniqueTraits: uniqueToHorse2 },
          differenceScore: (uniqueToHorse1.length + uniqueToHorse2.length) / (horse1.epigeneticFlags.length + horse2.epigeneticFlags.length),
        });
      }
    }
  }

  return differences.sort((a, b) => b.differenceScore - a.differenceScore);
}

/**
 * Generate horse rankings
 */
export function generateHorseRankings(horses) {
  const rankings = {
    byTraitCount: [...horses].sort((a, b) => b.epigeneticFlags.length - a.epigeneticFlags.length),
    byBondScore: [...horses].sort((a, b) => b.bondScore - a.bondScore),
    byStressLevel: [...horses].sort((a, b) => a.stressLevel - b.stressLevel), // Lower stress is better
  };

  return {
    byTraitCount: rankings.byTraitCount.map((horse, index) => ({
      rank: index + 1,
      horse: { id: horse.id, name: horse.name },
      value: horse.epigeneticFlags.length,
    })),
    byBondScore: rankings.byBondScore.map((horse, index) => ({
      rank: index + 1,
      horse: { id: horse.id, name: horse.name },
      value: horse.bondScore,
    })),
    byStressLevel: rankings.byStressLevel.map((horse, index) => ({
      rank: index + 1,
      horse: { id: horse.id, name: horse.name },
      value: horse.stressLevel,
    })),
  };
}

/**
 * Generate comparison insights
 */
export function generateComparisonInsights(comparison, similarities, differences) {
  const insights = [];

  if (similarities.length > 0) {
    const topSimilarity = similarities[0];
    insights.push(`Highest similarity: ${topSimilarity.horse1.name} and ${topSimilarity.horse2.name} (${Math.round(topSimilarity.similarityScore * 100)}% similar)`);
  }

  if (differences.length > 0) {
    const topDifference = differences[0];
    insights.push(`Most different: ${topDifference.horse1.name} and ${topDifference.horse2.name}`);
  }

  const avgTraitCount = comparison.averages.traitCount;
  const avgBondScore = comparison.averages.bondScore;
  const avgStressLevel = comparison.averages.stressLevel;

  insights.push(`Average traits per horse: ${avgTraitCount.toFixed(1)}`);
  insights.push(`Average bond score: ${avgBondScore.toFixed(1)}`);
  insights.push(`Average stress level: ${avgStressLevel.toFixed(1)}`);

  return insights;
}

/**
 * Analyze trait trends over time
 */
export function analyzeTraitTrends(traitHistory, timeframe) {
  const trends = [];

  // Group by trait
  const traitGroups = {};
  traitHistory.forEach(log => {
    if (!traitGroups[log.traitName]) {
      traitGroups[log.traitName] = [];
    }
    traitGroups[log.traitName].push(log);
  });

  // Analyze each trait's trend
  Object.entries(traitGroups).forEach(([traitName, logs]) => {
    const trend = {
      trait: traitName,
      discoveryCount: logs.length,
      firstDiscovery: logs[0].timestamp,
      lastDiscovery: logs[logs.length - 1].timestamp,
      trendDirection: logs.length > 1 ? 'increasing' : 'stable',
      horsesAffected: new Set(logs.map(log => log.horseId)).size,
    };

    trends.push(trend);
  });

  return trends.sort((a, b) => b.discoveryCount - a.discoveryCount);
}

/**
 * Identify trait patterns
 */
export function identifyTraitPatterns(traitHistory) {
  const patterns = [];

  // Pattern: Traits discovered together
  const discoveryGroups = {};
  traitHistory.forEach(log => {
    const dateKey = log.timestamp.toDateString();
    if (!discoveryGroups[dateKey]) {
      discoveryGroups[dateKey] = [];
    }
    discoveryGroups[dateKey].push(log);
  });

  Object.entries(discoveryGroups).forEach(([date, logs]) => {
    if (logs.length > 1) {
      patterns.push({
        type: 'simultaneous_discovery',
        date,
        traits: logs.map(log => log.traitName),
        horseCount: new Set(logs.map(log => log.horseId)).size,
      });
    }
  });

  return patterns;
}

/**
 * Generate trend predictions
 */
export function generateTrendPredictions(trends, patterns) {
  const predictions = [];

  trends.forEach(trend => {
    if (trend.discoveryCount > 2) {
      predictions.push({
        trait: trend.trait,
        prediction: 'Likely to continue appearing in new horses',
        confidence: Math.min(0.9, trend.discoveryCount / 10),
        reasoning: `${trend.trait} has appeared in ${trend.horsesAffected} horses recently`,
      });
    }
  });

  return predictions;
}

/**
 * Generate summary report
 */
export async function generateSummaryReport(horse) {
  return {
    basicInfo: {
      id: horse.id,
      name: horse.name,
      age: Math.floor((Date.now() - horse.dateOfBirth.getTime()) / (1000 * 60 * 60 * 24)),
      traitCount: horse.epigeneticFlags.length,
      traits: horse.epigeneticFlags,
    },
    scores: {
      bondScore: horse.bondScore,
      stressLevel: horse.stressLevel,
    },
    summary: `${horse.name} has ${horse.epigeneticFlags.length} epigenetic traits and shows ${horse.bondScore > 30 ? 'excellent' : horse.bondScore > 20 ? 'good' : 'developing'} bonding.`,
  };
}

/**
 * Generate detailed report
 */
export async function generateDetailedReport(horse) {
  const summary = await generateSummaryReport(horse);

  return {
    ...summary,
    traitHistory: horse.traitHistoryLogs,
    developmentalAnalysis: {
      ageCategory: getAgeCategory(horse.dateOfBirth),
      developmentalStage: getDevelopmentalStage(horse.dateOfBirth),
    },
    recommendations: generateBasicRecommendations(horse),
  };
}

/**
 * Generate comprehensive report
 */
export async function generateComprehensiveReport(horse) {
  const detailed = await generateDetailedReport(horse);

  try {
    const environmentalReport = await generateEnvironmentalReport(horse.id);

    return {
      ...detailed,
      environmentalAnalysis: environmentalReport,
      comprehensiveInsights: [
        'Full environmental and trait interaction analysis included',
        'Predictive modeling and recommendations provided',
        'Complete developmental timeline available',
      ],
    };
  } catch (error) {
    logger.warn(`Could not generate comprehensive environmental analysis for horse ${horse.id}:`, error);
    return detailed;
  }
}

/**
 * Helper function to get age category
 */
function getAgeCategory(dateOfBirth) {
  const ageInDays = Math.floor((Date.now() - dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

  if (ageInDays < 30) return 'newborn';
  if (ageInDays < 90) return 'young';
  if (ageInDays < 365) return 'juvenile';
  return 'mature';
}

/**
 * Helper function to get developmental stage
 */
function getDevelopmentalStage(dateOfBirth) {
  const ageInDays = Math.floor((Date.now() - dateOfBirth.getTime()) / (1000 * 60 * 60 * 24));

  if (ageInDays < 14) return 'critical_period';
  if (ageInDays < 60) return 'active_development';
  if (ageInDays < 365) return 'stabilization';
  return 'mature_expression';
}

/**
 * Generate basic recommendations
 */
function generateBasicRecommendations(horse) {
  const recommendations = [];

  if (horse.stressLevel > 6) {
    recommendations.push('Reduce stress through calming activities');
  }

  if (horse.bondScore < 20) {
    recommendations.push('Increase bonding through positive interactions');
  }

  if (horse.epigeneticFlags.length < 3) {
    recommendations.push('Provide enrichment activities to encourage trait development');
  }

  return recommendations.length > 0 ? recommendations : ['Continue current care approach'];
}
