/**
 * Breeding System Types
 *
 * Type definitions for the breeding prediction and selection system.
 * These types map to the backend breeding prediction service responses.
 */

/**
 * Horse entity for breeding system
 * Comprehensive type covering all properties needed for breeding selection and display
 */
export interface Horse {
  id: number;
  name: string;
  age: number; // Age in years
  sex: 'Male' | 'Female';
  breedId?: number;
  breedName?: string;
  healthStatus: string;
  level?: number;
  dateOfBirth: string;
  imageUrl?: string;

  // Stats
  stats?: {
    speed: number;
    stamina: number;
    agility: number;
    strength: number;
    intelligence: number;
    health: number;
  };

  // Breeding-specific properties
  breedingCooldownEndsAt?: string | null;
  lastBredAt?: string | null;
  canBreed?: boolean;

  // Training and discipline
  disciplineScores?: Record<string, number>;
  bestDisciplines?: string[];

  // Traits and genetics
  traits?: string[] | Array<{ name: string }>;
  temperament?: string;

  // Parent information
  parentIds?: {
    sireId?: number;
    damId?: number;
  };

  // Additional optional fields
  description?: string;
  userId?: string;
}

/**
 * Trait category types for inheritance prediction
 */
export type TraitCategory =
  | 'empathy'
  | 'boldness'
  | 'intelligence'
  | 'physical'
  | 'temperament'
  | 'social';

/**
 * Trait probabil inheritance data
 */
export interface TraitProbability {
  traitName: string;
  probability: number;
  hasStacking: boolean;
  stackingBonus: number;
  isRare: boolean;
  isNegative: boolean;
  isEpigenetic: boolean;
  parentSources: {
    stallion: boolean;
    mare: boolean;
  };
}

/**
 * Breeding data for a single horse
 * Response from GET /api/horses/:id/breeding-data
 */
export interface HorseBreedingData {
  horseId: number;
  horseName: string;
  sex: 'Male' | 'Female';
  traitSummary: {
    totalTraits: number;
    epigeneticTraits: number;
    rareTraits: number;
    negativeTraits: number;
    traitsByCategory: Record<TraitCategory, number>;
    traitsBySource: {
      milestone: number;
      groom: number;
      breeding: number;
      environmental: number;
    };
    averageBondScore: number;
    averageInfluenceScore: number;
  };
  flagInheritanceScore: {
    horseId: number;
    flags: Record<TraitCategory, number>;
    totalFlags: number;
    dominantCategories: TraitCategory[];
  };
  epigeneticFlags: {
    positive: string[];
    negative: string[];
    hidden: string[];
    totalFlags: number;
  };
  temperamentInfluence: {
    temperament: string;
    traitAffinities: Record<string, 'high' | 'medium' | 'low'>;
    breedingCompatibility: {
      bestMatches: string[];
      worstMatches: string[];
    };
  };
  hasInsufficientData: boolean;
  breedingQuality: 'exceptional' | 'excellent' | 'good' | 'fair' | 'poor';
  generatedAt: Date;
}

/**
 * Inbreeding analysis result
 * Response from POST /api/genetics/inbreeding-analysis
 */
export interface InbreedingAnalysis {
  stallionId: number;
  mareId: number;
  inbreedingCoefficient: number;
  commonAncestors: Array<{
    ancestorId: number;
    ancestorName: string;
    generationsFromStallion: number;
    generationsFromMare: number;
  }>;
  riskLevel: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  warnings: string[];
  recommendations: string[];
}

/**
 * Offspring trait predictions
 * Response from POST /api/breeding/genetic-probability
 */
export interface OffspringPredictions {
  stallionId: number;
  mareId: number;
  categoryProbabilities: Record<TraitCategory, number>;
  estimatedTraitCount: {
    min: number;
    max: number;
    expected: number;
  };
  confidenceLevel: 'low' | 'medium' | 'high';
  isEstimate: boolean;
  parentTraitData: {
    totalParentTraits: number;
    epigeneticTraits: number;
    rareTraits: number;
  };
  traitProbabilities: TraitProbability[];
}

/**
 * Breeding compatibility analysis
 * Response from GET /api/breeding/lineage-analysis/:stallionId/:mareId
 */
export interface BreedingCompatibility {
  stallionId: number;
  mareId: number;
  temperamentCompatibility: number;
  geneticDiversity: number;
  overallScore: number;
  strengths: string[];
  concerns: string[];
}

/**
 * Complete breeding pair analysis
 * Combined data for the Breeding Pair Selector component
 */
export interface BreedingPairAnalysis {
  stallion: HorseBreedingData;
  mare: HorseBreedingData;
  predictions: OffspringPredictions;
  inbreeding: InbreedingAnalysis;
  compatibility: BreedingCompatibility;
  isLoading: boolean;
  error: string | null;
}

/**
 * Story 6-1: Breeding Pair Selection Types
 */

/**
 * Compatibility analysis for breeding pair
 * Displays 4 key compatibility metrics plus recommendations
 */
export interface CompatibilityAnalysis {
  overall: number; // 0-100 overall compatibility score
  temperamentMatch: number; // 0-100 temperament compatibility
  traitSynergy: number; // 0-100 trait synergy score
  geneticDiversity: number; // 0-100 genetic diversity score
  recommendations: string[]; // List of breeding recommendations
}

/**
 * Breeding pair data structure
 * Combines both horses with their compatibility analysis
 */
export interface BreedingPair {
  sire: Horse; // Male horse (stallion)
  dam: Horse; // Female horse (mare)
  compatibility: CompatibilityAnalysis;
  studFee?: number; // Optional stud fee in game currency
  canBreed: boolean; // Whether this pair can currently breed
  cooldownDays?: number; // Days remaining on breeding cooldown (if applicable)
}

/**
 * Breeding initiation request
 * Sent to POST /api/horses/foals
 */
export interface BreedingRequest {
  sireId: number;
  damId: number;
  userId: string;
  studFee?: number;
}

/**
 * Breeding initiation response
 * Response from POST /api/horses/foals
 */
export interface BreedingResponse {
  foal: Foal;
  message: string;
}

/**
 * Foal basic interface for breeding response
 * Minimal foal data returned after breeding
 */
export interface Foal {
  id: number;
  name: string;
  sireId: number;
  damId: number;
  dateOfBirth: string;
  ageInDays: number;
  sex: 'Male' | 'Female';
  userId: string;
}

/**
 * ============================================================================
 * BREEDING PREDICTIONS (Story 6-5)
 * ============================================================================
 */

/**
 * Individual trait prediction for offspring
 */
export interface TraitPrediction {
  traitId: string;
  traitName: string;
  probability: number; // 0-100
  source: 'sire' | 'dam' | 'both' | 'random';
  isPositive: boolean;
  category?: string;
  description?: string;
}

/**
 * Ultra-rare trait potential
 */
export interface UltraRareTraitPotential {
  traitId: string;
  traitName: string;
  tier: 'ultra-rare' | 'exotic';
  baseProbability: number; // 0-100
  requirements: string[];
  isAchievable: boolean;
  groomInfluence?: {
    groomType: string;
    bonusPercentage: number;
  };
  description: string;
}

/**
 * Breeding insights and recommendations
 */
export interface BreedingInsights {
  strengths: string[];
  recommendations: string[];
  considerations: string[];
  warnings?: string[];
  optimalCareStrategies: string[];
  lineageQualityScore: number; // 0-100
}

/**
 * Complete breeding predictions response
 */
export interface BreedingPredictions {
  sire: Horse;
  dam: Horse;
  traitPredictions: TraitPrediction[];
  ultraRareTraits: UltraRareTraitPotential[];
  insights: BreedingInsights;
  predictionConfidence: number; // 0-100
}

/**
 * ============================================================================
 * CLIENT-SIDE PREDICTION HELPERS
 * ============================================================================
 */

/**
 * Calculate trait inheritance probability based on parent traits
 */
export function calculateTraitProbability(
  traitName: string,
  sireTraits: string[],
  damTraits: string[]
): number {
  const inSire = sireTraits.includes(traitName);
  const inDam = damTraits.includes(traitName);

  if (inSire && inDam) return 95; // Both parents: 95%
  if (inSire || inDam) return 70; // One parent: 70%
  return 10; // Neither parent: 10% random chance
}

/**
 * Determine trait source
 */
export function getTraitSource(
  traitName: string,
  sireTraits: string[],
  damTraits: string[]
): 'sire' | 'dam' | 'both' | 'random' {
  const inSire = sireTraits.includes(traitName);
  const inDam = damTraits.includes(traitName);

  if (inSire && inDam) return 'both';
  if (inSire) return 'sire';
  if (inDam) return 'dam';
  return 'random';
}

/**
 * Calculate lineage quality score
 */
export function calculateLineageQuality(
  sire: Horse,
  dam: Horse
): number {
  let score = 50; // Base score

  // Factor in stats (if available)
  if (sire.stats && dam.stats) {
    const sireAvg =
      Object.values(sire.stats).reduce((a, b) => a + b, 0) / Object.keys(sire.stats).length;
    const damAvg =
      Object.values(dam.stats).reduce((a, b) => a + b, 0) / Object.keys(dam.stats).length;
    score += Math.round((sireAvg + damAvg) / 4); // Up to +50 from stats
  }

  // Factor in level
  if (sire.level) score += Math.min(10, sire.level);
  if (dam.level) score += Math.min(10, dam.level);

  // Factor in traits (quality indicator)
  const sireTraitCount = Array.isArray(sire.traits) ? sire.traits.length : 0;
  const damTraitCount = Array.isArray(dam.traits) ? dam.traits.length : 0;
  score += Math.min(15, sireTraitCount + damTraitCount);

  return Math.min(100, Math.max(0, score));
}

/**
 * Get prediction confidence level
 */
export function getPredictionConfidence(
  sireTraitCount: number,
  damTraitCount: number
): { level: 'low' | 'medium' | 'high'; percentage: number } {
  const totalTraits = sireTraitCount + damTraitCount;

  if (totalTraits >= 8) return { level: 'high', percentage: 85 };
  if (totalTraits >= 4) return { level: 'medium', percentage: 65 };
  return { level: 'low', percentage: 40 };
}

/**
 * Format probability for display
 */
export function formatProbability(probability: number): string {
  return `${Math.round(probability)}%`;
}

/**
 * Get probability color class
 */
export function getProbabilityColor(probability: number): string {
  if (probability >= 80) return 'text-green-600 bg-green-50 border-green-200';
  if (probability >= 60) return 'text-blue-600 bg-blue-50 border-blue-200';
  if (probability >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-amber-600 bg-amber-50 border-amber-200';
}
