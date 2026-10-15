/**
 * Developmental Window Coordination — pure multi-window planning helpers
 *
 * Pure (no-DB) helpers that support multi-window coordination, conflict
 * resolution, compensatory-mechanism generation, and intervention /
 * development recommendation text. Consumed by developmentalWindows.mjs.
 *
 * Extracted (Equoria-urqic.5) from developmentalWindowSystem.mjs to keep the
 * window-identification module under the size cap. These functions are
 * implementation details of the window system and are not part of its public
 * export surface.
 */

import { DEVELOPMENTAL_WINDOWS } from './developmentalWindowDefinitions.mjs';

/**
 * Get related traits for a given trait
 */
export function getRelatedTraits(traitName) {
  const traitRelations = {
    confident: ['brave', 'secure', 'assertive'],
    brave: ['confident', 'bold', 'fearless'],
    social: ['outgoing', 'friendly', 'cooperative'],
    curious: ['exploratory', 'inquisitive', 'intelligent'],
    fearful: ['anxious', 'timid', 'insecure'],
    calm: ['peaceful', 'stable', 'patient'],
    intelligent: ['smart', 'clever', 'adaptable'],
  };

  return traitRelations[traitName] || [];
}

/**
 * Generate development recommendations
 */
export function generateDevelopmentRecommendations(traitName, windowName, opportunity) {
  const recommendations = [];
  const window = DEVELOPMENTAL_WINDOWS[windowName];

  if (opportunity > 0.7) {
    recommendations.push(
      `Excellent opportunity to develop ${traitName} - implement intensive ${window.interventions[0]}`,
    );
    recommendations.push(`Focus on ${window.interventions.join(', ')} during this critical period`);
  } else if (opportunity > 0.5) {
    recommendations.push(
      `Good opportunity for ${traitName} development - use ${window.interventions[0]}`,
    );
    recommendations.push('Monitor progress and adjust approach based on response');
  } else if (opportunity > 0.3) {
    recommendations.push(`Limited opportunity for ${traitName} - gentle approach recommended`);
    recommendations.push('Consider alternative developmental strategies');
  } else {
    recommendations.push(`Low opportunity for ${traitName} development in this window`);
    recommendations.push('Focus on other traits or wait for more suitable developmental period');
  }

  // Add trait-specific recommendations
  if (traitName === 'confident') {
    recommendations.push('Provide success experiences and positive reinforcement');
  } else if (traitName === 'curious') {
    recommendations.push('Offer safe exploration opportunities and novel experiences');
  } else if (traitName === 'social') {
    recommendations.push('Facilitate positive interactions with multiple handlers');
  }

  return recommendations;
}

/**
 * Generate compensatory mechanisms for closed windows
 */
export function generateCompensatoryMechanisms(windowName, _window) {
  const mechanisms = [];

  switch (windowName) {
    case 'imprinting':
      mechanisms.push('Extended bonding sessions with consistent handler');
      mechanisms.push('Trust-building exercises with positive reinforcement');
      mechanisms.push('Gradual relationship development over extended period');
      break;
    case 'early_socialization':
      mechanisms.push('Structured socialization program with multiple handlers');
      mechanisms.push('Gradual environmental exposure with support');
      mechanisms.push('Confidence-building activities in controlled settings');
      break;
    case 'fear_period_1':
    case 'fear_period_2':
      mechanisms.push('Systematic desensitization program');
      mechanisms.push('Counter-conditioning with positive associations');
      mechanisms.push('Stress reduction and calming protocols');
      break;
    case 'curiosity_development':
      mechanisms.push('Enrichment activities to stimulate exploration');
      mechanisms.push('Learning games and problem-solving exercises');
      mechanisms.push('Novel experiences in safe environments');
      break;
    case 'social_hierarchy':
      mechanisms.push('Structured social interactions with clear boundaries');
      mechanisms.push('Leadership training and confidence building');
      mechanisms.push('Group dynamics education through controlled exposure');
      break;
    case 'independence_development':
      mechanisms.push('Gradual independence training with support');
      mechanisms.push('Self-confidence building through achievable challenges');
      mechanisms.push('Autonomy development in safe environments');
      break;
    default:
      mechanisms.push('General developmental support and enrichment');
  }

  return mechanisms;
}

/**
 * Analyze window interactions
 */
export function analyzeWindowInteractions(activeWindows) {
  const interactions = [];

  for (let i = 0; i < activeWindows.length; i++) {
    for (let j = i + 1; j < activeWindows.length; j++) {
      const window1 = activeWindows[i];
      const window2 = activeWindows[j];

      // Check for trait conflicts
      const conflictingTraits = window1.targetTraits.filter(
        trait => window2.riskTraits.includes(trait) || window1.riskTraits.includes(trait),
      );

      // Check for synergistic traits
      const synergisticTraits = window1.targetTraits.filter(trait =>
        window2.targetTraits.includes(trait),
      );

      interactions.push({
        window1: window1.name,
        window2: window2.name,
        conflictingTraits,
        synergisticTraits,
        interactionType:
          conflictingTraits.length > 0
            ? 'conflicting'
            : synergisticTraits.length > 0
              ? 'synergistic'
              : 'neutral',
      });
    }
  }

  return interactions;
}

/**
 * Create priority matrix for active windows
 */
export function createPriorityMatrix(activeWindows) {
  const matrix = {};

  activeWindows.forEach(window => {
    let priority = window.sensitivity; // Base priority on sensitivity

    // Adjust for urgency
    if (window.urgency === 'critical') {
      priority += 0.3;
    } else if (window.urgency === 'high') {
      priority += 0.2;
    } else if (window.urgency === 'moderate') {
      priority += 0.1;
    }

    // Adjust for days remaining
    if (window.daysRemaining <= 1) {
      priority += 0.2;
    } else if (window.daysRemaining <= 3) {
      priority += 0.1;
    }

    matrix[window.name] = Math.min(1.0, priority);
  });

  return matrix;
}

/**
 * Generate coordinated development plan
 */
export function generateCoordinatedPlan(activeWindows, interactions, priorityMatrix) {
  const phases = [];

  // Sort windows by priority
  const sortedWindows = activeWindows.sort(
    (a, b) => priorityMatrix[b.name] - priorityMatrix[a.name],
  );

  // Create phases based on compatibility and priority
  let currentPhase = {
    name: 'Phase 1',
    windows: [],
    duration: 0,
    focus: 'primary_development',
  };

  sortedWindows.forEach(window => {
    const hasConflicts = interactions.some(
      interaction =>
        (interaction.window1 === window.name || interaction.window2 === window.name) &&
        interaction.interactionType === 'conflicting' &&
        currentPhase.windows.some(
          w => w.name === interaction.window1 || w.name === interaction.window2,
        ),
    );

    if (!hasConflicts && currentPhase.windows.length < 2) {
      currentPhase.windows.push(window);
      currentPhase.duration = Math.max(currentPhase.duration, window.daysRemaining);
    } else {
      if (currentPhase.windows.length > 0) {
        phases.push(currentPhase);
      }
      currentPhase = {
        name: `Phase ${phases.length + 2}`,
        windows: [window],
        duration: window.daysRemaining,
        focus: 'secondary_development',
      };
    }
  });

  if (currentPhase.windows.length > 0) {
    phases.push(currentPhase);
  }

  return { phases };
}

/**
 * Resolve window conflicts
 */
export function resolveWindowConflicts(activeWindows, interactions) {
  const identifiedConflicts = interactions.filter(i => i.interactionType === 'conflicting');
  const resolutionStrategies = [];

  identifiedConflicts.forEach(conflict => {
    resolutionStrategies.push({
      conflict: `${conflict.window1} vs ${conflict.window2}`,
      strategy: 'Sequential development - prioritize based on urgency and sensitivity',
      implementation: 'Focus on higher priority window first, then address secondary window',
      conflictingTraits: conflict.conflictingTraits,
    });
  });

  return {
    identifiedConflicts,
    resolutionStrategies,
  };
}

/**
 * Generate intervention recommendations
 */
export function generateInterventionRecommendations(
  sensitivityProfile,
  riskFactors,
  protectiveFactors,
  currentAge,
) {
  const recommendations = [];

  if (sensitivityProfile.currentSensitivity > 0.8) {
    recommendations.push(
      'Immediate intervention required - horse is in critical developmental period',
    );
    recommendations.push('Implement gentle, consistent care protocols');
    recommendations.push('Monitor stress levels closely and adjust approach as needed');
  }

  riskFactors.forEach(risk => {
    if (risk.includes('stress')) {
      recommendations.push('Implement stress reduction protocols immediately');
      recommendations.push('Create calm, predictable environment');
    } else if (risk.includes('bonding')) {
      recommendations.push('Focus on relationship building with primary caregiver');
      recommendations.push('Increase positive interaction frequency');
    } else if (risk.includes('fear')) {
      recommendations.push('Avoid potentially traumatic experiences');
      recommendations.push('Use counter-conditioning techniques');
    }
  });

  if (protectiveFactors.length > 0) {
    recommendations.push('Continue current positive practices that support development');
  }

  if (currentAge < 14) {
    recommendations.push('Critical early development period - maximize positive experiences');
  } else if (currentAge < 60) {
    recommendations.push(
      'Important socialization period - provide varied but controlled experiences',
    );
  }

  return recommendations;
}
