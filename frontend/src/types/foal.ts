/**
 * Foal Development Types
 *
 * Type definitions for foal development system including milestones,
 * enrichment activities, and development tracking.
 *
 * Story 6-2: Foal Milestone Timeline
 * Story 6-4: Milestone Evaluation Display
 */

import type { Horse } from './breeding';

/**
 * Milestone type identifiers
 * Represents the 5 critical development milestones in foal's first 30 days
 */
export type MilestoneType =
  | 'imprinting' // Day 1: Initial bonding
  | 'socialization' // Week 1 (Days 1-7): Social awareness
  | 'curiosity_play' // Week 2 (Days 8-14): Exploration behavior
  | 'trust_handling' // Week 3 (Days 15-21): Human interaction
  | 'confidence_reactivity'; // Week 4 (Days 22-30): Final temperament formation

/**
 * Milestone status
 */
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Milestone definition and status
 * Tracks individual milestone progress and evaluation
 */
export interface Milestone {
  type: MilestoneType;
  name: string;
  description: string;
  ageWindow: {
    min: number; // Minimum age in days
    max: number; // Maximum age in days
  };
  status: MilestoneStatus;
  evaluationDate?: string;
  score?: number; // Evaluation score (-10 to +10)
  traitsConfirmed?: string[]; // Traits confirmed during this milestone
  focus?: string; // Primary developmental focus
  traitCategories?: string[]; // Trait categories influenced
}

/**
 * Milestone evaluation result
 */
export interface MilestoneEvaluation {
  milestone: MilestoneType;
  milestoneName?: string; // Display name
  score: number; // -10 to +10
  traitsConfirmed: string[];
  evaluatedAt: string;
  bondModifier: number;
  taskConsistency: number;
  careQuality: number;
  scoreBreakdown?: {
    bondModifier: number;
    taskConsistency: number;
    careQuality: number;
  };
}

/**
 * Evaluation category based on score
 */
export type EvaluationCategory = 'Excellent' | 'Good' | 'Neutral' | 'Poor' | 'Bad';

/**
 * Milestone evaluation history response
 */
export interface MilestoneEvaluationHistory {
  evaluations: MilestoneEvaluation[];
  completedMilestones: MilestoneType[];
  currentMilestone: MilestoneType | null;
}

/**
 * Epigenetic trait definition
 */
export interface EpigeneticTrait {
  id: string;
  name: string;
  category: string;
  description: string;
  effects: TraitEffect[];
  isPositive?: boolean;
}

/**
 * Trait effect definition
 */
export interface TraitEffect {
  type: string;
  value: number;
  description: string;
}

/**
 * Foal entity with development tracking
 * Extends Horse with foal-specific development properties
 */
export interface Foal extends Horse {
  birthDate: string;
  ageInDays: number;
  currentMilestone: MilestoneType | null;
  completedMilestones: MilestoneType[];

  // Development metrics
  bondingLevel?: number; // 0-100

  // Parent references
  sireId: number;
  damId: number;

  // Development progress
  developmentProgress?: number; // 0-100 overall progress
}

/**
 * Foal development status response
 * Complete development data for timeline display
 */
export interface FoalDevelopmentStatus {
  foal: Foal;
  milestones: Milestone[];
  currentMilestone: MilestoneType | null;
  nextMilestone: MilestoneType | null;
  developmentProgress: number; // 0-100
  daysUntilNextMilestone: number;
}

/**
 * Milestone definition (static reference data)
 */
export interface MilestoneDefinition {
  type: MilestoneType;
  name: string;
  description: string;
  ageWindow: {
    min: number;
    max: number;
  };
  focus: string;
  traitCategories: string[];
  enrichmentRecommendations?: string[];
}

/**
 * Milestone data for timeline visualization
 * Processed data for Recharts display
 */
export interface MilestoneTimelineData {
  name: string;
  ageDay: number;
  progress: number; // 0-100
  status: 'completed' | 'current' | 'pending';
  completed: boolean;
  current: boolean;
  traits: string[];
  score?: number;
}

/**
 * Calculate milestone progress based on foal age
 */
export function calculateMilestoneProgress(milestone: Milestone, foalAge: number): number {
  if (milestone.status === 'completed') return 100;
  if (foalAge < milestone.ageWindow.min) return 0;

  const window = milestone.ageWindow.max - milestone.ageWindow.min;
  const elapsed = foalAge - milestone.ageWindow.min;
  return Math.min(100, Math.round((elapsed / window) * 100));
}

/**
 * Get milestone status based on foal age and evaluation
 */
export function getMilestoneStatus(milestone: Milestone, foalAge: number): MilestoneStatus {
  if (milestone.status === 'completed') return 'completed';

  if (foalAge >= milestone.ageWindow.min && foalAge <= milestone.ageWindow.max) {
    return 'in_progress';
  }

  if (foalAge < milestone.ageWindow.min) {
    return 'pending';
  }

  // Age past window but not completed
  return 'completed'; // Auto-complete if window passed
}

/**
 * Calculate days until next milestone
 */
export function getDaysUntilMilestone(milestone: Milestone, foalAge: number): number {
  if (foalAge >= milestone.ageWindow.min) return 0;
  return milestone.ageWindow.min - foalAge;
}

/**
 * Get current milestone based on foal age
 */
export function getCurrentMilestone(milestones: Milestone[], foalAge: number): Milestone | null {
  return milestones.find((m) => foalAge >= m.ageWindow.min && foalAge <= m.ageWindow.max) || null;
}

/**
 * Calculate overall development progress (0-100)
 */
export function calculateDevelopmentProgress(milestones: Milestone[], foalAge: number): number {
  if (milestones.length === 0) return 0;

  const completedCount = milestones.filter((m) => m.status === 'completed').length;
  const currentMilestone = getCurrentMilestone(milestones, foalAge);

  let progress = (completedCount / milestones.length) * 100;

  // Add partial progress for current milestone
  if (currentMilestone) {
    const milestoneProgress = calculateMilestoneProgress(currentMilestone, foalAge);
    progress += milestoneProgress / milestones.length;
  }

  return Math.min(100, Math.round(progress));
}

/**
 * ============================================================================
 * MILESTONE EVALUATION HELPERS (Story 6-4)
 * ============================================================================
 */

/**
 * Get evaluation category based on score
 */
export function getEvaluationCategory(score: number): EvaluationCategory {
  if (score >= 5) return 'Excellent';
  if (score >= 3) return 'Good';
  if (score >= 0) return 'Neutral';
  if (score >= -3) return 'Poor';
  return 'Bad';
}

/**
 * Get evaluation color based on score
 */
export function getEvaluationColor(score: number): string {
  if (score >= 3) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 0) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

/**
 * Get trait confirmation reason based on score
 */
export function getTraitConfirmationReason(score: number): string {
  if (score >= 3) return 'Score ≥3 confirms positive trait';
  if (score <= -3) return 'Score ≤-3 confirms negative trait';
  return 'Neutral score: trait randomized';
}

/**
 * Get score progress percentage for visual display
 */
export function getScoreProgressPercentage(score: number): number {
  // Scale -10 to +10 to 0-100%
  return Math.round(((score + 10) / 20) * 100);
}

/**
 * Get component score color (for breakdown display)
 */
export function getComponentScoreColor(value: number, max: number): string {
  const percentage = (value / max) * 100;
  if (percentage >= 80) return 'bg-green-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

/**
 * Format milestone name for display
 */
export function formatMilestoneName(milestoneType: MilestoneType): string {
  const names: Record<MilestoneType, string> = {
    imprinting: 'Imprinting',
    socialization: 'Socialization',
    curiosity_play: 'Curiosity & Play',
    trust_handling: 'Trust & Handling',
    confidence_reactivity: 'Confidence & Reactivity',
  };
  return names[milestoneType] || milestoneType;
}

/**
 * Get milestone description for evaluation context
 */
export function getMilestoneDescription(milestoneType: MilestoneType): string {
  const descriptions: Record<MilestoneType, string> = {
    imprinting: 'The critical first day of bonding and trust formation',
    socialization: 'Social awareness and interaction with handlers',
    curiosity_play: 'Exploration behavior and playful learning',
    trust_handling: 'Human interaction and handling trust',
    confidence_reactivity: 'Final temperament formation and confidence development',
  };
  return descriptions[milestoneType] || '';
}

/**
 * Get evaluation explanation based on score and milestone
 */
export function getEvaluationExplanation(
  score: number,
  milestone: MilestoneType,
  _traits: string[]
): string {
  const category = getEvaluationCategory(score);
  const milestoneName = formatMilestoneName(milestone);

  const explanations: Record<EvaluationCategory, string> = {
    Excellent: `Your excellent care during the ${milestoneName} window has resulted in outstanding development. Your foal has formed strong foundations that will benefit them throughout their life.`,
    Good: `Your consistent care during the ${milestoneName} window has resulted in positive development. Your foal is progressing well and showing promising traits.`,
    Neutral: `Your care during the ${milestoneName} window has resulted in average development. There's room for improvement in future milestones to maximize your foal's potential.`,
    Poor: `Your care during the ${milestoneName} window was inconsistent. Focus on providing more regular attention and enrichment activities in future milestones.`,
    Bad: `Your care during the ${milestoneName} window was insufficient. Your foal has developed negative traits that may be challenging to overcome. Increased attention is critical for future milestones.`,
  };

  return explanations[category];
}

/**
 * Get guidance for future care based on evaluation
 */
export function getFutureCareGuidance(score: number): string {
  if (score >= 3) {
    return 'Continue providing consistent, high-quality care to maximize future milestone evaluations!';
  } else if (score >= 0) {
    return 'Focus on daily enrichment activities and maintain consistent care routines to improve future evaluations.';
  } else {
    return 'Increase your care consistency and perform more enrichment activities daily. Your foal needs extra attention to recover from this setback.';
  }
}
