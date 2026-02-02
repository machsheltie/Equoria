/**
 * Conformation Scoring Utilities
 *
 * Provides utility functions for horse conformation scoring system:
 * - Quality rating calculations (0-100 to Excellent/Good/Poor)
 * - Overall score calculations (average of 7 regions)
 * - Breed comparison analysis
 * - Score formatting and display helpers
 * - Region descriptions for tooltips
 *
 * Story 3-5: Conformation Scoring UI - Task 1
 */

export interface QualityRating {
  label: string;
  color: string;
  bgColor: string;
}

export interface BreedComparison {
  difference: number;
  label: string;
  icon: string;
}

export interface ConformationScores {
  head: number;
  neck: number;
  shoulder: number;
  back: number;
  hindquarters: number;
  legs: number;
  hooves: number;
}

/**
 * Calculate quality rating from numeric score (0-100)
 *
 * Score ranges:
 * - 90-100: Excellent (green)
 * - 80-89: Very Good (blue)
 * - 70-79: Good (amber)
 * - 60-69: Average (gray)
 * - 50-59: Below Average (orange)
 * - 0-49: Poor (red)
 */
export function getQualityRating(score: number): QualityRating {
  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore >= 90) {
    return {
      label: 'Excellent',
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50 border-emerald-200',
    };
  } else if (clampedScore >= 80) {
    return {
      label: 'Very Good',
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-200',
    };
  } else if (clampedScore >= 70) {
    return {
      label: 'Good',
      color: 'text-amber-700',
      bgColor: 'bg-amber-50 border-amber-200',
    };
  } else if (clampedScore >= 60) {
    return {
      label: 'Average',
      color: 'text-slate-700',
      bgColor: 'bg-slate-50 border-slate-200',
    };
  } else if (clampedScore >= 50) {
    return {
      label: 'Below Average',
      color: 'text-orange-700',
      bgColor: 'bg-orange-50 border-orange-200',
    };
  } else {
    return {
      label: 'Poor',
      color: 'text-rose-700',
      bgColor: 'bg-rose-50 border-rose-200',
    };
  }
}

/**
 * Calculate overall conformation score (average of 7 regions)
 * Excludes the 'overall' field itself
 */
export function calculateOverallScore(conformation: ConformationScores): number {
  const scores = [
    conformation.head,
    conformation.neck,
    conformation.shoulder,
    conformation.back,
    conformation.hindquarters,
    conformation.legs,
    conformation.hooves,
  ];

  // Filter out invalid scores (negative, NaN, null)
  const validScores = scores.filter((score) => typeof score === 'number' && score >= 0);

  if (validScores.length === 0) {
    return 0;
  }

  const sum = validScores.reduce((acc, score) => acc + score, 0);
  const average = sum / validScores.length;

  // Round to 1 decimal place
  return Math.round(average * 10) / 10;
}

/**
 * Compare horse score to breed average
 * Returns difference, label, and visual indicator
 */
export function getBreedComparison(horseScore: number, breedAverage: number): BreedComparison {
  const difference = horseScore - breedAverage;
  const absoluteDifference = Math.abs(difference);

  // Within 2 points is considered "average"
  if (absoluteDifference < 2) {
    return {
      difference: 0,
      label: 'Average',
      icon: '=',
    };
  }

  if (difference > 0) {
    return {
      difference: Math.round(difference * 10) / 10,
      label: 'Above Average',
      icon: '↑',
    };
  }

  return {
    difference: Math.round(difference * 10) / 10,
    label: 'Below Average',
    icon: '↓',
  };
}

/**
 * Format score for display (XX/100 or XX.X/100)
 */
export function formatScore(score: number): string {
  // Clamp to valid range
  const clampedScore = Math.max(0, Math.min(100, score));

  // If integer, show without decimal
  if (Number.isInteger(clampedScore)) {
    return `${clampedScore}/100`;
  }

  // Otherwise show 1 decimal place
  return `${clampedScore.toFixed(1)}/100`;
}

/**
 * Get detailed description for each conformation region
 * Used for tooltips and educational information
 */
export function getRegionDescription(region: string): string {
  const descriptions: Record<string, string> = {
    head: 'Facial structure, profile, eyes, ears, and overall head proportion to body',
    neck: 'Length, crest development, throatlatch refinement, and connection to shoulder',
    shoulder: 'Angle, slope, length, and connection to withers - affects movement quality',
    back: 'Topline strength, length, coupling, loin strength, and overall structural integrity',
    hindquarters: 'Hip angle, croup slope, muscle development, and power generation capacity',
    legs: 'Bone structure, joint angles, symmetry, straightness, and soundness indicators',
    hooves: 'Size, shape, balance, quality, wall thickness, and overall hoof health',
    overall: 'Combined overall conformation score calculated as average of all 7 body regions',
  };

  return descriptions[region.toLowerCase()] || 'Conformation assessment for this region';
}

/**
 * Get region display name (capitalize first letter)
 */
export function getRegionDisplayName(region: string): string {
  return region.charAt(0).toUpperCase() + region.slice(1).toLowerCase();
}

/**
 * Validate conformation scores object
 * Returns true if all required regions are present and valid
 */
export function isValidConformation(conformation: Partial<ConformationScores>): boolean {
  const requiredRegions = ['head', 'neck', 'shoulder', 'back', 'hindquarters', 'legs', 'hooves'];

  for (const region of requiredRegions) {
    const score = conformation[region as keyof ConformationScores];
    if (typeof score !== 'number' || score < 0 || score > 100) {
      return false;
    }
  }

  return true;
}

/**
 * Get color class for score value (for progress bars)
 */
export function getScoreColor(score: number): string {
  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore >= 90) return 'bg-emerald-500';
  if (clampedScore >= 80) return 'bg-blue-500';
  if (clampedScore >= 70) return 'bg-amber-500';
  if (clampedScore >= 60) return 'bg-slate-500';
  if (clampedScore >= 50) return 'bg-orange-500';
  return 'bg-rose-500';
}
