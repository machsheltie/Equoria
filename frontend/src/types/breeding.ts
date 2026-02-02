/**
 * Breeding System Types
 *
 * Type definitions for the breeding prediction and selection system.
 * These types map to the backend breeding prediction service responses.
 */

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
