/**
 * Conformation Scoring Utilities
 *
 * Provides utility functions for horse conformation scoring system:
 * - Quality rating calculations (0-100 to the six quality words)
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
  /** Solid fill for the score bar, in the same hue as the word. */
  fillColor: string;
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

export interface ConformationQualityBand extends QualityRating {
  /** Lowest score (inclusive) that earns this word. */
  min: number;
}

/**
 * The conformation quality words and their score bands — the one source of
 * truth for every place that turns a conformation score into a word.
 *
 * Owner ruling q251 (Equoria-y8vg9, 2026-10-28): six words —
 * Excellent 90+, Very Good 80+, Good 70+, Average 60+, Fair 50+, Poor below 50.
 * Owner request 2026-10-29 (Equoria-oxbda): the words read as a colour
 * hierarchy — Poor red, Fair orange, Average yellow, Good green, Very Good
 * blue, Excellent purple — through the Celestial Night
 * `--conformation-rating-*` tokens. Ordered highest band first.
 */
export const conformationQualityBands: readonly ConformationQualityBand[] = Object.freeze([
  {
    min: 90,
    label: 'Excellent',
    color: 'text-[var(--conformation-rating-excellent)]',
    bgColor:
      'bg-[var(--conformation-rating-excellent-bg)] border-[var(--conformation-rating-excellent-border)]',
    fillColor: 'bg-[var(--conformation-rating-excellent)]',
  },
  {
    min: 80,
    label: 'Very Good',
    color: 'text-[var(--conformation-rating-very-good)]',
    bgColor:
      'bg-[var(--conformation-rating-very-good-bg)] border-[var(--conformation-rating-very-good-border)]',
    fillColor: 'bg-[var(--conformation-rating-very-good)]',
  },
  {
    min: 70,
    label: 'Good',
    color: 'text-[var(--conformation-rating-good)]',
    bgColor:
      'bg-[var(--conformation-rating-good-bg)] border-[var(--conformation-rating-good-border)]',
    fillColor: 'bg-[var(--conformation-rating-good)]',
  },
  {
    min: 60,
    label: 'Average',
    color: 'text-[var(--conformation-rating-average)]',
    bgColor:
      'bg-[var(--conformation-rating-average-bg)] border-[var(--conformation-rating-average-border)]',
    fillColor: 'bg-[var(--conformation-rating-average)]',
  },
  {
    min: 50,
    label: 'Fair',
    color: 'text-[var(--conformation-rating-fair)]',
    bgColor:
      'bg-[var(--conformation-rating-fair-bg)] border-[var(--conformation-rating-fair-border)]',
    fillColor: 'bg-[var(--conformation-rating-fair)]',
  },
  {
    min: 0,
    label: 'Poor',
    color: 'text-[var(--conformation-rating-poor)]',
    bgColor:
      'bg-[var(--conformation-rating-poor-bg)] border-[var(--conformation-rating-poor-border)]',
    fillColor: 'bg-[var(--conformation-rating-poor)]',
  },
]);

/**
 * Calculate quality rating from numeric score (0-100), using
 * `conformationQualityBands`.
 */
export function getQualityRating(score: number): QualityRating {
  // Clamp score to valid range
  const clampedScore = Math.max(0, Math.min(100, score));
  const band =
    conformationQualityBands.find((b) => clampedScore >= b.min) ??
    conformationQualityBands[conformationQualityBands.length - 1];
  return {
    label: band.label,
    color: band.color,
    bgColor: band.bgColor,
    fillColor: band.fillColor,
  };
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
