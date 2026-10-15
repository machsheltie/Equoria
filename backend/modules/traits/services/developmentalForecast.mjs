/**
 * Developmental Forecast — long-term developmental outcome prediction
 *
 * Generates a forward-looking developmental forecast: trajectory, trait
 * development predictions, milestone projections, risk assessment, and
 * forecast recommendations over a horizon of days.
 *
 * Extracted (Equoria-urqic.5) from developmentalWindowSystem.mjs. Shared
 * window + milestone definitions live in developmentalWindowDefinitions.mjs.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { getHorseAgeDays } from '../../../utils/horseAge.mjs';
import { asFlagArray } from '../../../utils/jsonbArrayGuard.mjs';
import {
  DEVELOPMENTAL_WINDOWS,
  DEVELOPMENTAL_MILESTONES,
} from './developmentalWindowDefinitions.mjs';

/**
 * Generate comprehensive developmental forecast
 * @param {number} horseId - ID of the horse
 * @param {number} forecastDays - Number of days to forecast
 * @returns {Object} Developmental forecast
 */
export async function generateDevelopmentalForecast(horseId, forecastDays) {
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { dateOfBirth: true, epigeneticFlags: true, stressLevel: true, bondScore: true },
  });

  const currentAge = getHorseAgeDays(horse.dateOfBirth);
  const forecastEndAge = currentAge + forecastDays;

  // Identify upcoming windows
  const upcomingWindows = Object.values(DEVELOPMENTAL_WINDOWS)
    .filter(window => window.startDay <= forecastEndAge && window.endDay >= currentAge)
    .map(window => ({
      ...window,
      daysUntilStart: Math.max(0, window.startDay - currentAge),
      daysUntilEnd: Math.max(0, window.endDay - currentAge),
      isActive: currentAge >= window.startDay && currentAge <= window.endDay,
    }));

  // Generate developmental trajectory
  const developmentalTrajectory = generateTrajectory(currentAge, forecastDays, upcomingWindows);

  // Predict trait development
  const traitDevelopmentPredictions = await generateTraitPredictions(
    horseId,
    upcomingWindows,
    horse,
  );

  // Project milestones
  const milestoneProjections = projectMilestones(currentAge, forecastDays, upcomingWindows);

  // Assess risks
  const riskAssessment = assessDevelopmentalRisks(horse, upcomingWindows, forecastDays);

  // Generate recommendations
  const recommendations = generateForecastRecommendations(
    upcomingWindows,
    riskAssessment,
    traitDevelopmentPredictions,
  );

  return {
    horseId,
    forecastPeriod: forecastDays,
    upcomingWindows,
    developmentalTrajectory,
    traitDevelopmentPredictions,
    milestoneProjections,
    riskAssessment,
    recommendations,
    analysisTimestamp: new Date(),
  };
}

/**
 * Generate developmental trajectory
 */
function generateTrajectory(currentAge, forecastDays, upcomingWindows) {
  const trajectory = [];

  for (let day = 0; day <= forecastDays; day += 7) {
    // Weekly points
    const projectedAge = currentAge + day;
    const activeWindows = upcomingWindows.filter(
      window => projectedAge >= window.startDay && projectedAge <= window.endDay,
    );

    trajectory.push({
      day,
      projectedAge,
      activeWindows: activeWindows.map(w => w.name),
      developmentalIntensity: activeWindows.reduce((sum, w) => sum + w.sensitivity, 0),
      criticalityLevel:
        activeWindows.length > 0 ? Math.max(...activeWindows.map(w => w.sensitivity)) : 0,
    });
  }

  return trajectory;
}

/**
 * Generate trait predictions
 */
async function generateTraitPredictions(horseId, upcomingWindows, horse) {
  const predictions = [];
  const commonTraits = ['confident', 'brave', 'curious', 'social', 'calm', 'fearful'];

  for (const trait of commonTraits) {
    const currentProbability = asFlagArray(horse.epigeneticFlags).includes(trait) ? 0.8 : 0.2;
    let projectedProbability = currentProbability;
    let developmentWindow = null;

    // Find best development window for this trait
    for (const window of upcomingWindows) {
      if (window.targetTraits.includes(trait)) {
        projectedProbability = Math.min(0.9, currentProbability + window.sensitivity * 0.3);
        developmentWindow = window.name;
        break;
      } else if (window.riskTraits.includes(trait)) {
        projectedProbability = Math.max(0.1, currentProbability - window.sensitivity * 0.2);
        developmentWindow = window.name;
        break;
      }
    }

    predictions.push({
      trait,
      currentProbability,
      projectedProbability,
      developmentWindow,
      confidence: developmentWindow ? 0.7 : 0.4,
    });
  }

  return predictions;
}

/**
 * Project milestones
 */
function projectMilestones(currentAge, forecastDays, _upcomingWindows) {
  const projections = [];

  Object.entries(DEVELOPMENTAL_MILESTONES).forEach(([name, milestone]) => {
    const window = DEVELOPMENTAL_WINDOWS[milestone.window];
    const projectedAge = currentAge + forecastDays;

    if (projectedAge >= window.startDay && currentAge <= window.endDay) {
      projections.push({
        milestone: name,
        window: milestone.window,
        projectedAchievement: projectedAge >= window.peakDay ? 'likely' : 'possible',
        timeframe: Math.max(0, window.endDay - currentAge),
      });
    }
  });

  return projections;
}

/**
 * Assess developmental risks
 */
function assessDevelopmentalRisks(horse, upcomingWindows, _forecastDays) {
  const risks = [];

  if (horse.stressLevel > 6) {
    risks.push({
      risk: 'High stress during critical periods',
      severity: 'high',
      impact: 'May impair positive trait development',
    });
  }

  if (horse.bondScore < 15) {
    risks.push({
      risk: 'Poor bonding relationship',
      severity: 'moderate',
      impact: 'May affect trust and social development',
    });
  }

  const criticalWindows = upcomingWindows.filter(w => w.sensitivity > 0.8);
  if (criticalWindows.length > 1) {
    risks.push({
      risk: 'Multiple critical periods overlap',
      severity: 'moderate',
      impact: 'May require careful coordination of interventions',
    });
  }

  return {
    risks,
    overallRiskLevel: risks.length > 2 ? 'high' : risks.length > 0 ? 'moderate' : 'low',
  };
}

/**
 * Generate forecast recommendations
 */
function generateForecastRecommendations(upcomingWindows, riskAssessment, traitPredictions) {
  const recommendations = [];

  // Window-based recommendations
  upcomingWindows.forEach(window => {
    if (window.sensitivity > 0.8) {
      recommendations.push({
        category: 'critical_window',
        action: `Prepare for ${window.name} - implement ${window.interventions[0]}`,
        timeframe: window.daysUntilStart > 0 ? `${window.daysUntilStart} days` : 'immediate',
        priority: 'high',
      });
    }
  });

  // Risk-based recommendations
  riskAssessment.risks.forEach(risk => {
    recommendations.push({
      category: 'risk_mitigation',
      action: `Address ${risk.risk.toLowerCase()}`,
      timeframe: 'immediate',
      priority: risk.severity,
    });
  });

  // Trait-based recommendations
  const highPotentialTraits = traitPredictions.filter(
    p => p.projectedProbability > p.currentProbability + 0.2,
  );

  highPotentialTraits.forEach(trait => {
    recommendations.push({
      category: 'trait_development',
      action: `Focus on developing ${trait.trait} during ${trait.developmentWindow}`,
      timeframe: '1-2 weeks',
      priority: 'moderate',
    });
  });

  return recommendations;
}
