/**
 * Trait Timeline Service
 * 
 * Service for generating trait timeline cards that show trait and flag acquisition
 * by age, milestone evaluation results, and groom involvement. This service creates
 * comprehensive growth summaries for horse development analysis.
 * 
 * Features:
 * - Trait timeline data aggregation from trait history and milestone logs
 * - Timeline formatting with age-based organization
 * - Trait source event tracking (milestone, groom, breeding, environmental)
 * - Bond/stress context inclusion with care pattern analysis
 * - Age-based filtering (only traits before age 4)
 * - Trait type distinctions (epigenetic, inherited, rare, negative)
 * - Bond and stress trend analysis
 * 
 * Business Rules:
 * - Only traits gained before age 4 (1460 days) are included in timeline
 * - Timeline organized by age ranges: first week, month, 3 months, years 1-3
 * - Includes detailed context for each trait acquisition event
 * - Categorizes traits by rarity, type, and source
 */

import prisma from '../db/index.mjs';
import logger from '../utils/logger.mjs';

// Constants for timeline organization
const AGE_CUTOFF_DAYS = 1460; // 4 years in days
const AGE_RANGES = {
  firstWeek: { min: 0, max: 7 },
  firstMonth: { min: 8, max: 30 },
  firstThreeMonths: { min: 31, max: 90 },
  firstYear: { min: 91, max: 365 },
  secondYear: { min: 366, max: 730 },
  thirdYear: { min: 731, max: 1095 },
  fourthYear: { min: 1096, max: 1460 },
};

// Trait categorization
const RARE_TRAITS = [
  'sensitive', 'noble', 'legacy_talent', 'exceptional', 'prodigy',
  'natural_leader', 'empathic', 'intuitive', 'charismatic', 'legendary'
];

const NEGATIVE_TRAITS = [
  'stubborn', 'anxious', 'aggressive', 'fearful', 'lazy', 'unpredictable',
  'difficult', 'nervous', 'spooky', 'resistant'
];

/**
 * Generate comprehensive trait timeline for a horse
 * @param {number} horseId - ID of the horse
 * @returns {Object} Complete trait timeline with events, organization, and analysis
 */
export async function generateTraitTimeline(horseId) {
  try {
    logger.info(`[traitTimelineService.generateTraitTimeline] Generating trait timeline for horse ${horseId}`);

    // Get trait history for traits gained before age 4
    const traitHistory = await prisma.traitHistoryLog.findMany({
      where: {
        horseId,
        ageInDays: {
          lt: AGE_CUTOFF_DAYS,
        },
      },
      include: {
        groom: {
          select: { id: true, name: true, speciality: true, groomPersonality: true },
        },
      },
      orderBy: { ageInDays: 'asc' },
    });

    // Get excluded traits (after age 4)
    const excludedTraits = await prisma.traitHistoryLog.findMany({
      where: {
        horseId,
        ageInDays: {
          gte: AGE_CUTOFF_DAYS,
        },
      },
      select: { traitName: true, ageInDays: true, sourceType: true },
      orderBy: { ageInDays: 'asc' },
    });

    // Get milestone evaluation data
    const milestoneData = await prisma.milestoneTraitLog.findMany({
      where: { horseId },
      orderBy: { ageInDays: 'asc' },
    });

    // Create milestone lookup for context
    const milestoneMap = new Map();
    milestoneData.forEach(milestone => {
      const key = `${milestone.finalTrait}_${milestone.ageInDays}`;
      milestoneMap.set(key, milestone);
    });

    // Process timeline events
    const timelineEvents = traitHistory.map(trait => {
      const milestoneKey = `${trait.traitName}_${trait.ageInDays}`;
      const milestoneContext = milestoneMap.get(milestoneKey);

      return {
        traitName: trait.traitName,
        sourceType: trait.sourceType,
        isEpigenetic: trait.isEpigenetic,
        ageInDays: trait.ageInDays,
        ageDescription: formatAgeDescription(trait.ageInDays),
        isRare: RARE_TRAITS.includes(trait.traitName),
        isNegative: NEGATIVE_TRAITS.includes(trait.traitName),
        influenceScore: trait.influenceScore,
        bondScore: trait.bondScore,
        stressLevel: trait.stressLevel,
        timestamp: trait.timestamp,
        groomContext: trait.groom ? {
          groomId: trait.groom.id,
          groomName: trait.groom.name,
          speciality: trait.groom.speciality,
          personality: trait.groom.groomPersonality,
          bondScore: trait.bondScore,
          stressLevel: trait.stressLevel,
        } : null,
        milestoneContext: milestoneContext ? {
          milestoneType: milestoneContext.milestoneType,
          score: milestoneContext.score,
          taskConsistency: milestoneContext.taskConsistency,
          taskDiversity: milestoneContext.taskDiversity,
          bondScore: milestoneContext.bondScore,
        } : null,
      };
    });

    // Organize events by age ranges
    const ageRanges = organizeByAgeRanges(timelineEvents);

    // Calculate summary statistics
    const summary = calculateTimelineSummary(timelineEvents, excludedTraits);

    // Categorize traits
    const categorization = categorizeTraits(timelineEvents);

    // Analyze bond and stress trends
    const bondStressTrend = analyzeBondStressTrend(timelineEvents);

    const result = {
      horseId,
      timelineEvents,
      ageRanges,
      summary,
      categorization,
      bondStressTrend,
      excludedTraits: excludedTraits.map(trait => ({
        name: trait.traitName,
        ageInDays: trait.ageInDays,
        sourceType: trait.sourceType,
        reason: 'Too old (after age 4)',
      })),
      isEmpty: timelineEvents.length === 0,
      generatedAt: new Date(),
    };

    logger.info(`[traitTimelineService.generateTraitTimeline] Generated timeline with ${timelineEvents.length} events for horse ${horseId}`);

    return result;
  } catch (error) {
    logger.error(`[traitTimelineService.generateTraitTimeline] Error generating timeline for horse ${horseId}: ${error.message}`);
    throw error;
  }
}

/**
 * Format age in days to human-readable description
 * @param {number} ageInDays - Age in days
 * @returns {string} Human-readable age description
 */
function formatAgeDescription(ageInDays) {
  if (ageInDays <= 7) return `Day ${ageInDays}`;
  if (ageInDays <= 30) return `${Math.floor(ageInDays / 7)} weeks`;
  if (ageInDays <= 90) return `${Math.floor(ageInDays / 30)} months`;
  if (ageInDays <= 365) return `${Math.floor(ageInDays / 30)} months`;
  return `${Math.floor(ageInDays / 365)} years`;
}

/**
 * Organize timeline events by age ranges
 * @param {Array} timelineEvents - Array of timeline events
 * @returns {Object} Events organized by age ranges
 */
function organizeByAgeRanges(timelineEvents) {
  const organized = {};
  
  Object.keys(AGE_RANGES).forEach(rangeName => {
    organized[rangeName] = [];
  });

  timelineEvents.forEach(event => {
    Object.entries(AGE_RANGES).forEach(([rangeName, range]) => {
      if (event.ageInDays >= range.min && event.ageInDays <= range.max) {
        organized[rangeName].push(event);
      }
    });
  });

  return organized;
}

/**
 * Calculate timeline summary statistics
 * @param {Array} timelineEvents - Array of timeline events
 * @param {Array} excludedTraits - Array of excluded traits
 * @returns {Object} Summary statistics
 */
function calculateTimelineSummary(timelineEvents, excludedTraits) {
  const sourceTypes = new Set(timelineEvents.map(e => e.sourceType));
  const rareTraits = timelineEvents.filter(e => e.isRare).length;
  const negativeTraits = timelineEvents.filter(e => e.isNegative).length;
  const epigeneticTraits = timelineEvents.filter(e => e.isEpigenetic).length;

  return {
    totalTraits: timelineEvents.length,
    traitsExcluded: excludedTraits.length,
    epigeneticTraits,
    rareTraits,
    negativeTraits,
    sourceTypes: Array.from(sourceTypes),
    sourceTypeCount: sourceTypes.size,
    averageInfluenceScore: timelineEvents.length > 0
      ? timelineEvents.reduce((sum, e) => sum + (e.influenceScore || 0), 0) / timelineEvents.length
      : 0,
    averageBondScore: timelineEvents.length > 0
      ? timelineEvents.reduce((sum, e) => sum + (e.bondScore || 50), 0) / timelineEvents.length
      : 50,
    averageStressLevel: timelineEvents.length > 0
      ? timelineEvents.reduce((sum, e) => sum + (e.stressLevel || 50), 0) / timelineEvents.length
      : 50,
  };
}

/**
 * Categorize traits by type and characteristics
 * @param {Array} timelineEvents - Array of timeline events
 * @returns {Object} Categorized traits
 */
function categorizeTraits(timelineEvents) {
  return {
    rare: timelineEvents.filter(e => e.isRare),
    negative: timelineEvents.filter(e => e.isNegative),
    positive: timelineEvents.filter(e => !e.isNegative),
    epigenetic: timelineEvents.filter(e => e.isEpigenetic),
    inherited: timelineEvents.filter(e => !e.isEpigenetic),
    bySource: {
      milestone: timelineEvents.filter(e => e.sourceType === 'milestone'),
      groom: timelineEvents.filter(e => e.sourceType === 'groom'),
      breeding: timelineEvents.filter(e => e.sourceType === 'breeding'),
      environmental: timelineEvents.filter(e => e.sourceType === 'environmental'),
    },
  };
}

/**
 * Analyze bond and stress trends over time
 * @param {Array} timelineEvents - Array of timeline events
 * @returns {Object} Bond and stress trend analysis
 */
function analyzeBondStressTrend(timelineEvents) {
  if (timelineEvents.length === 0) {
    return {
      bondTrend: 'no_data',
      stressTrend: 'no_data',
      dataPoints: [],
    };
  }

  const dataPoints = timelineEvents
    .filter(e => e.bondScore !== null && e.stressLevel !== null)
    .map(e => ({
      ageInDays: e.ageInDays,
      bondScore: e.bondScore,
      stressLevel: e.stressLevel,
    }));

  if (dataPoints.length < 2) {
    return {
      bondTrend: 'insufficient_data',
      stressTrend: 'insufficient_data',
      dataPoints,
    };
  }

  const firstBond = dataPoints[0].bondScore;
  const lastBond = dataPoints[dataPoints.length - 1].bondScore;
  const firstStress = dataPoints[0].stressLevel;
  const lastStress = dataPoints[dataPoints.length - 1].stressLevel;

  const bondTrend = lastBond > firstBond + 5 ? 'improving' 
    : lastBond < firstBond - 5 ? 'declining' 
    : 'stable';

  const stressTrend = lastStress < firstStress - 5 ? 'decreasing'
    : lastStress > firstStress + 5 ? 'increasing'
    : 'stable';

  return {
    bondTrend,
    stressTrend,
    dataPoints,
    bondChange: lastBond - firstBond,
    stressChange: lastStress - firstStress,
  };
}

/**
 * Get trait timeline summary for quick overview
 * @param {number} horseId - ID of the horse
 * @returns {Object} Quick timeline summary
 */
export async function getTraitTimelineSummary(horseId) {
  try {
    logger.info(`[traitTimelineService.getTraitTimelineSummary] Getting timeline summary for horse ${horseId}`);

    const timeline = await generateTraitTimeline(horseId);

    const summary = {
      horseId,
      hasTraits: !timeline.isEmpty,
      totalTraits: timeline.summary.totalTraits,
      rareTraits: timeline.summary.rareTraits,
      negativeTraits: timeline.summary.negativeTraits,
      sourceTypes: timeline.summary.sourceTypes,
      bondTrend: timeline.bondStressTrend.bondTrend,
      stressTrend: timeline.bondStressTrend.stressTrend,
      developmentQuality: calculateDevelopmentQuality(timeline),
    };

    logger.info(`[traitTimelineService.getTraitTimelineSummary] Generated summary for horse ${horseId}`);

    return summary;
  } catch (error) {
    logger.error(`[traitTimelineService.getTraitTimelineSummary] Error generating summary for horse ${horseId}: ${error.message}`);
    throw error;
  }
}

/**
 * Calculate overall development quality score
 * @param {Object} timeline - Complete timeline object
 * @returns {string} Development quality assessment
 */
function calculateDevelopmentQuality(timeline) {
  if (timeline.isEmpty) return 'no_development';

  const { summary, bondStressTrend } = timeline;
  let score = 0;

  // Trait quantity (max 3 points)
  if (summary.totalTraits >= 5) score += 3;
  else if (summary.totalTraits >= 3) score += 2;
  else if (summary.totalTraits >= 1) score += 1;

  // Trait diversity (max 2 points)
  if (summary.sourceTypeCount >= 3) score += 2;
  else if (summary.sourceTypeCount >= 2) score += 1;

  // Rare traits (max 2 points)
  if (summary.rareTraits >= 2) score += 2;
  else if (summary.rareTraits >= 1) score += 1;

  // Bond trend (max 2 points)
  if (bondStressTrend.bondTrend === 'improving') score += 2;
  else if (bondStressTrend.bondTrend === 'stable') score += 1;

  // Stress trend (max 1 point)
  if (bondStressTrend.stressTrend === 'decreasing') score += 1;

  // Negative trait penalty
  if (summary.negativeTraits > 0) score -= summary.negativeTraits;

  // Determine quality level
  if (score >= 8) return 'exceptional';
  if (score >= 6) return 'excellent';
  if (score >= 4) return 'good';
  if (score >= 2) return 'fair';
  return 'poor';
}
