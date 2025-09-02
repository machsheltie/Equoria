/**
 * Performance Analytics Service
 * 
 * Provides personal performance tracking and analytics for individual horses.
 * Focuses on win rates, discipline strengths, historical performance tracking,
 * and performance improvement analysis without competitor comparisons.
 */

import prisma from '../db/index.mjs';

/**
 * Performance Analytics Service
 * Handles all personal performance analytics calculations and data aggregation
 */
export const performanceAnalyticsService = {
  /**
   * Get comprehensive performance analytics for a horse
   * @param {number} horseId - Horse ID to analyze
   * @returns {Object} Complete performance analytics data
   */
  async getPerformanceAnalytics(horseId) {
    // Verify horse exists
    const horse = await prisma.horse.findUnique({
      where: { id: horseId }
    });

    if (!horse) {
      throw new Error('Horse not found');
    }

    // Get all competition results for the horse
    const competitionResults = await prisma.competitionResult.findMany({
      where: { horseId },
      orderBy: { runDate: 'desc' }
    });

    // If no competition history, return empty analytics
    if (competitionResults.length === 0) {
      return {
        overallWinRate: 0,
        disciplineWinRates: {},
        placementTrends: [],
        consistencyScore: 0,
        competitionHistory: [],
        earningsByDiscipline: {},
        performanceImprovement: {
          recentAverage: 0,
          historicalAverage: 0,
          improvementTrend: 'stable'
        },
        strongestDisciplines: [],
        weakestDisciplines: []
      };
    }

    // Calculate analytics
    const overallWinRate = this.calculateOverallWinRate(competitionResults);
    const disciplineWinRates = this.calculateDisciplineWinRates(competitionResults);
    const placementTrends = this.calculatePlacementTrends(competitionResults);
    const consistencyScore = this.calculateConsistencyScore(competitionResults);
    const earningsByDiscipline = this.calculateEarningsByDiscipline(competitionResults);
    const performanceImprovement = this.calculatePerformanceImprovement(competitionResults);
    const disciplineStrengths = this.analyzeDisciplineStrengths(competitionResults);

    return {
      overallWinRate,
      disciplineWinRates,
      placementTrends,
      consistencyScore,
      competitionHistory: competitionResults,
      earningsByDiscipline,
      performanceImprovement,
      strongestDisciplines: disciplineStrengths.strongest,
      weakestDisciplines: disciplineStrengths.weakest
    };
  },

  /**
   * Calculate overall win rate (1st place finishes)
   * @param {Array} results - Competition results
   * @returns {number} Win rate percentage
   */
  calculateOverallWinRate(results) {
    if (results.length === 0) return 0;

    const wins = results.filter(result => parseInt(result.placement) === 1).length;
    return Math.round((wins / results.length) * 100);
  },

  /**
   * Calculate win rates by discipline
   * @param {Array} results - Competition results
   * @returns {Object} Win rates by discipline
   */
  calculateDisciplineWinRates(results) {
    const disciplineStats = {};
    
    results.forEach(result => {
      if (!disciplineStats[result.discipline]) {
        disciplineStats[result.discipline] = { total: 0, wins: 0 };
      }
      disciplineStats[result.discipline].total++;
      if (parseInt(result.placement) === 1) {
        disciplineStats[result.discipline].wins++;
      }
    });

    const winRates = {};
    Object.keys(disciplineStats).forEach(discipline => {
      const stats = disciplineStats[discipline];
      winRates[discipline] = Math.round((stats.wins / stats.total) * 100);
    });

    return winRates;
  },

  /**
   * Calculate placement trends over time
   * @param {Array} results - Competition results (ordered by date desc)
   * @returns {Array} Placement trend data
   */
  calculatePlacementTrends(results) {
    return results.map(result => ({
      date: result.runDate,
      placement: parseInt(result.placement),
      discipline: result.discipline,
      prizeWon: result.prizeWon
    }));
  },

  /**
   * Calculate performance consistency score
   * @param {Array} results - Competition results
   * @returns {number} Consistency score (0-100)
   */
  calculateConsistencyScore(results) {
    if (results.length === 0) return 0;
    
    const placements = results.map(result => parseInt(result.placement));
    const average = placements.reduce((sum, placement) => sum + placement, 0) / placements.length;
    
    // Calculate variance
    const variance = placements.reduce((sum, placement) => {
      return sum + Math.pow(placement - average, 2);
    }, 0) / placements.length;
    
    // Convert to consistency score (lower variance = higher consistency)
    // Normalize to 0-100 scale where 100 is perfect consistency
    const standardDeviation = Math.sqrt(variance);
    const maxPossibleStdDev = 5; // Assuming placements 1-10, max std dev would be around 5
    const consistencyScore = Math.max(0, 100 - (standardDeviation / maxPossibleStdDev) * 100);
    
    return Math.round(consistencyScore);
  },

  /**
   * Calculate total earnings by discipline
   * @param {Array} results - Competition results
   * @returns {Object} Earnings by discipline
   */
  calculateEarningsByDiscipline(results) {
    const earnings = {};
    
    results.forEach(result => {
      if (!earnings[result.discipline]) {
        earnings[result.discipline] = 0;
      }
      earnings[result.discipline] += result.prizeWon || 0;
    });

    return earnings;
  },

  /**
   * Calculate performance improvement over time
   * @param {Array} results - Competition results (ordered by date desc)
   * @returns {Object} Performance improvement analysis
   */
  calculatePerformanceImprovement(results) {
    if (results.length < 4) {
      return {
        recentAverage: 0,
        historicalAverage: 0,
        improvementTrend: 'insufficient_data'
      };
    }

    // Split results into recent (last 25%) and historical (first 75%)
    const splitPoint = Math.floor(results.length * 0.25);
    const recentResults = results.slice(0, splitPoint);
    const historicalResults = results.slice(splitPoint);

    const recentAverage = recentResults.reduce((sum, result) => sum + parseInt(result.placement), 0) / recentResults.length;
    const historicalAverage = historicalResults.reduce((sum, result) => sum + parseInt(result.placement), 0) / historicalResults.length;

    let improvementTrend = 'stable';
    const difference = historicalAverage - recentAverage; // Lower placement = better performance
    
    if (difference > 0.5) {
      improvementTrend = 'improving';
    } else if (difference < -0.5) {
      improvementTrend = 'declining';
    }

    return {
      recentAverage: Math.round(recentAverage * 10) / 10,
      historicalAverage: Math.round(historicalAverage * 10) / 10,
      improvementTrend
    };
  },

  /**
   * Analyze discipline strengths and weaknesses
   * @param {Array} results - Competition results
   * @returns {Object} Strongest and weakest disciplines
   */
  analyzeDisciplineStrengths(results) {
    const disciplineStats = {};
    
    results.forEach(result => {
      if (!disciplineStats[result.discipline]) {
        disciplineStats[result.discipline] = { 
          total: 0, 
          wins: 0, 
          totalPlacement: 0,
          name: result.discipline 
        };
      }
      disciplineStats[result.discipline].total++;
      disciplineStats[result.discipline].totalPlacement += parseInt(result.placement);
      if (parseInt(result.placement) === 1) {
        disciplineStats[result.discipline].wins++;
      }
    });

    // Calculate averages and sort
    const disciplines = Object.values(disciplineStats).map(stats => ({
      name: stats.name,
      winRate: Math.round((stats.wins / stats.total) * 100),
      averagePlacement: Math.round((stats.totalPlacement / stats.total) * 10) / 10,
      totalCompetitions: stats.total
    }));

    // Sort by win rate (descending) then by average placement (ascending)
    disciplines.sort((a, b) => {
      if (b.winRate !== a.winRate) {
        return b.winRate - a.winRate;
      }
      return a.averagePlacement - b.averagePlacement;
    });

    return {
      strongest: disciplines.slice(0, Math.min(3, disciplines.length)),
      weakest: disciplines.slice(-Math.min(3, disciplines.length)).reverse()
    };
  }
};
