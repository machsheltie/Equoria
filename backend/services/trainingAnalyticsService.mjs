/**
 * Training Analytics Service
 *
 * Provides simple training history tracking without optimization.
 * Focuses on training session logs, stat progression, facility impact,
 * and discipline training balance for individual horses.
 */

import prisma from '../db/index.mjs';

/**
 * Training Analytics Service
 * Handles training history tracking and basic analytics
 */
export const trainingAnalyticsService = {
  /**
   * Get comprehensive training history for a horse
   * @param {number} horseId - Horse ID to analyze
   * @returns {Object} Complete training history and analytics
   */
  async getTrainingHistory(horseId) {
    // Verify horse exists
    const horse = await prisma.horse.findUnique({
      where: { id: horseId },
    });

    if (!horse) {
      throw new Error('Horse not found');
    }

    // Get all training history for the horse
    const trainingHistory = await prisma.trainingLog.findMany({
      where: { horseId },
      orderBy: { trainedAt: 'desc' },
    });

    // If no training history, return empty analytics
    if (trainingHistory.length === 0) {
      return {
        trainingHistory: [],
        disciplineBalance: {},
        trainingFrequency: {
          totalSessions: 0,
          sessionsPerDiscipline: {},
          recentActivity: [],
        },
      };
    }

    // Calculate analytics
    const disciplineBalance = this.calculateDisciplineBalance(trainingHistory);
    const trainingFrequency = this.calculateTrainingFrequency(trainingHistory);

    return {
      trainingHistory,
      disciplineBalance,
      trainingFrequency,
    };
  },

  /**
   * Calculate training frequency and recent activity
   * @param {Array} trainingHistory - Training history
   * @returns {Object} Training frequency analysis
   */
  calculateTrainingFrequency(trainingHistory) {
    const totalSessions = trainingHistory.length;
    const sessionsPerDiscipline = {};

    // Count sessions per discipline
    trainingHistory.forEach(session => {
      const { discipline } = session;
      if (!sessionsPerDiscipline[discipline]) {
        sessionsPerDiscipline[discipline] = 0;
      }
      sessionsPerDiscipline[discipline]++;
    });

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivity = trainingHistory
      .filter(session => new Date(session.trainedAt) >= thirtyDaysAgo)
      .map(session => ({
        date: session.trainedAt,
        discipline: session.discipline,
      }));

    return {
      totalSessions,
      sessionsPerDiscipline,
      recentActivity,
    };
  },

  /**
   * Calculate discipline training balance
   * @param {Array} trainingHistory - Training history
   * @returns {Object} Training distribution by discipline
   */
  calculateDisciplineBalance(trainingHistory) {
    const disciplineStats = {};

    trainingHistory.forEach(session => {
      const { discipline } = session;

      if (!disciplineStats[discipline]) {
        disciplineStats[discipline] = {
          sessionCount: 0,
          lastTrainingDate: null,
          firstTrainingDate: null,
        };
      }

      disciplineStats[discipline].sessionCount++;

      // Track first and last training dates for this discipline
      const sessionDate = new Date(session.trainedAt);
      if (!disciplineStats[discipline].lastTrainingDate || sessionDate > disciplineStats[discipline].lastTrainingDate) {
        disciplineStats[discipline].lastTrainingDate = sessionDate;
      }
      if (!disciplineStats[discipline].firstTrainingDate || sessionDate < disciplineStats[discipline].firstTrainingDate) {
        disciplineStats[discipline].firstTrainingDate = sessionDate;
      }
    });

    // Calculate training percentage for each discipline
    const totalSessions = trainingHistory.length;
    Object.keys(disciplineStats).forEach(discipline => {
      const stats = disciplineStats[discipline];
      stats.percentage = Math.round((stats.sessionCount / totalSessions) * 100);
    });

    return disciplineStats;
  },
};
