/**
 * Trait Type Definitions
 *
 * Comprehensive type system for the epigenetic trait system including
 * trait tiers, epigenetic flags, discovery mechanics, competition impact,
 * and trait history tracking.
 *
 * Story 6-6: Epigenetic Trait System
 */

/**
 * Trait Tier Classification
 * - common: Base traits most horses have
 * - uncommon: Less frequent traits with moderate benefits
 * - rare: Significant traits requiring specific breeding/care
 * - ultra-rare: Exceptional traits with major competition impact
 * - exotic: Legendary traits with game-changing effects
 */
export type TraitTier = 'common' | 'uncommon' | 'rare' | 'ultra-rare' | 'exotic';

/**
 * Epigenetic Flag Types
 * Indicates how a trait was acquired/expressed
 */
export type EpigeneticFlag =
  | 'stress-induced' // Developed through stress events during development
  | 'care-influenced' // Influenced by quality of care and enrichment
  | 'milestone-triggered' // Unlocked by completing specific milestones
  | 'genetic-only'; // Purely inherited from parents

/**
 * Trait Discovery Status
 */
export type DiscoveryStatus = 'discovered' | 'partially_discovered' | 'hidden';

/**
 * Discipline Types for Competition Impact
 */
export type Discipline =
  | 'dressage'
  | 'show_jumping'
  | 'cross_country'
  | 'endurance'
  | 'racing'
  | 'western';

/**
 * Complete Epigenetic Trait
 */
export interface EpigeneticTrait {
  id: string;
  name: string;
  tier: TraitTier;
  category: string; // e.g., 'Behavioral', 'Physical', 'Mental'
  description: string;
  discoveryStatus: DiscoveryStatus;
  epigeneticFlags: EpigeneticFlag[];
  competitionImpact: CompetitionImpact;
  discoveredAt?: Date;
  discoverySource?: string; // What triggered discovery (e.g., 'milestone_socialization', 'enrichment_trust')
  isPositive: boolean; // Whether trait provides benefits or penalties
}

/**
 * Competition Impact Analysis
 * Shows how a trait affects performance in different disciplines
 */
export interface CompetitionImpact {
  dressage: number; // -10 to +10 score modifier
  show_jumping: number;
  cross_country: number;
  endurance: number;
  racing: number;
  western: number;
  synergyBonuses?: SynergyBonus[]; // Additional bonuses when combined with other traits
}

/**
 * Synergy Bonus
 * Additional benefit when trait is combined with specific other traits
 */
export interface SynergyBonus {
  requiredTraitIds: string[]; // Other traits required for synergy
  bonusDisciplines: Discipline[]; // Disciplines that receive bonus
  bonusAmount: number; // Additional score modifier
  description: string;
}

/**
 * Trait Discovery Status Tracking
 */
export interface TraitDiscoveryStatus {
  horseId: number;
  totalTraits: number;
  discoveredTraits: number;
  partiallyDiscoveredTraits: number;
  hiddenTraits: number;
  nextDiscoveryHint?: string; // Hint for discovering next hidden trait
  discoveryProgress: number; // 0-100 percentage
}

/**
 * Trait History Event
 * Records when and how traits were discovered
 */
export interface TraitHistoryEvent {
  id: string;
  traitId: string;
  traitName: string;
  tier: TraitTier;
  timestamp: Date;
  eventType: 'discovery' | 'activation' | 'modification';
  trigger: string; // What caused the event
  description: string;
}

/**
 * Trait History Timeline
 */
export interface TraitHistory {
  horseId: number;
  events: TraitHistoryEvent[];
}

/**
 * Get tier styling classes
 */
export function getTierStyle(tier: TraitTier): {
  borderColor: string;
  bgColor: string;
  textColor: string;
  badgeColor: string;
} {
  switch (tier) {
    case 'exotic':
      return {
        borderColor: 'border-purple-400',
        bgColor: 'bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50',
        textColor: 'text-purple-700',
        badgeColor: 'bg-purple-600 text-white',
      };
    case 'ultra-rare':
      return {
        borderColor: 'border-amber-400',
        bgColor: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50',
        textColor: 'text-amber-700',
        badgeColor: 'bg-amber-600 text-white',
      };
    case 'rare':
      return {
        borderColor: 'border-blue-300',
        bgColor: 'bg-gradient-to-br from-blue-50 to-cyan-50',
        textColor: 'text-blue-700',
        badgeColor: 'bg-blue-600 text-white',
      };
    case 'uncommon':
      return {
        borderColor: 'border-green-300',
        bgColor: 'bg-gradient-to-br from-green-50 to-emerald-50',
        textColor: 'text-green-700',
        badgeColor: 'bg-green-600 text-white',
      };
    case 'common':
      return {
        borderColor: 'border-slate-300',
        bgColor: 'bg-gradient-to-br from-slate-50 to-gray-50',
        textColor: 'text-slate-700',
        badgeColor: 'bg-slate-600 text-white',
      };
  }
}

/**
 * Get epigenetic flag styling and label
 */
export function getEpigeneticFlagDisplay(flag: EpigeneticFlag): {
  label: string;
  color: string;
  icon: string;
  tooltip: string;
} {
  switch (flag) {
    case 'stress-induced':
      return {
        label: 'Stress-Induced',
        color: 'text-amber-600 bg-amber-50 border-amber-200',
        icon: '⚡',
        tooltip: 'Developed through overcoming stress events during development',
      };
    case 'care-influenced':
      return {
        label: 'Care-Influenced',
        color: 'text-blue-600 bg-blue-50 border-blue-200',
        icon: '❤️',
        tooltip: 'Influenced by exceptional care quality and enrichment activities',
      };
    case 'milestone-triggered':
      return {
        label: 'Milestone-Triggered',
        color: 'text-purple-600 bg-purple-50 border-purple-200',
        icon: '🎯',
        tooltip: 'Unlocked by completing specific developmental milestones',
      };
    case 'genetic-only':
      return {
        label: 'Genetic',
        color: 'text-green-600 bg-green-50 border-green-200',
        icon: '🧬',
        tooltip: 'Purely inherited from parent genetics',
      };
  }
}

/**
 * Get discovery status display
 */
export function getDiscoveryStatusDisplay(status: DiscoveryStatus): {
  label: string;
  color: string;
  icon: string;
} {
  switch (status) {
    case 'discovered':
      return {
        label: 'Discovered',
        color: 'text-green-600',
        icon: '✓',
      };
    case 'partially_discovered':
      return {
        label: 'Partially Discovered',
        color: 'text-yellow-600',
        icon: '◐',
      };
    case 'hidden':
      return {
        label: 'Hidden',
        color: 'text-slate-400',
        icon: '?',
      };
  }
}

/**
 * Calculate total competition impact across all disciplines
 */
export function calculateTotalImpact(impact: CompetitionImpact): number {
  return (
    impact.dressage +
    impact.show_jumping +
    impact.cross_country +
    impact.endurance +
    impact.racing +
    impact.western
  );
}

/**
 * Get best disciplines for a trait (top 3 positive impacts)
 */
export function getBestDisciplines(impact: CompetitionImpact): Array<{ discipline: string; modifier: number }> {
  const disciplines: Array<{ discipline: string; modifier: number }> = [
    { discipline: 'Dressage', modifier: impact.dressage },
    { discipline: 'Show Jumping', modifier: impact.show_jumping },
    { discipline: 'Cross Country', modifier: impact.cross_country },
    { discipline: 'Endurance', modifier: impact.endurance },
    { discipline: 'Racing', modifier: impact.racing },
    { discipline: 'Western', modifier: impact.western },
  ];

  return disciplines.filter((d) => d.modifier > 0).sort((a, b) => b.modifier - a.modifier).slice(0, 3);
}

/**
 * Get impact color based on modifier value
 */
export function getImpactColor(modifier: number): string {
  if (modifier >= 5) return 'text-green-600';
  if (modifier >= 2) return 'text-green-500';
  if (modifier > 0) return 'text-blue-500';
  if (modifier === 0) return 'text-slate-400';
  if (modifier >= -2) return 'text-amber-500';
  if (modifier >= -5) return 'text-orange-500';
  return 'text-red-600';
}

/**
 * Format impact modifier for display
 */
export function formatImpactModifier(modifier: number): string {
  if (modifier > 0) return `+${modifier}`;
  if (modifier === 0) return '0';
  return `${modifier}`;
}

/**
 * Calculate discovery progress percentage
 */
export function calculateDiscoveryProgress(status: TraitDiscoveryStatus): number {
  if (status.totalTraits === 0) return 0;
  const discovered = status.discoveredTraits;
  const partial = status.partiallyDiscoveredTraits * 0.5; // Partial counts as 50%
  return Math.round(((discovered + partial) / status.totalTraits) * 100);
}

/**
 * Get tier display name with icon
 */
export function getTierDisplayName(tier: TraitTier): string {
  switch (tier) {
    case 'exotic':
      return '👑 Exotic';
    case 'ultra-rare':
      return '✨ Ultra-Rare';
    case 'rare':
      return '💎 Rare';
    case 'uncommon':
      return '🔹 Uncommon';
    case 'common':
      return '⚪ Common';
  }
}

/**
 * Sort traits by tier (exotic first, common last)
 */
export function sortTraitsByTier(traits: EpigeneticTrait[]): EpigeneticTrait[] {
  const tierOrder: TraitTier[] = ['exotic', 'ultra-rare', 'rare', 'uncommon', 'common'];
  return [...traits].sort((a, b) => {
    const aIndex = tierOrder.indexOf(a.tier);
    const bIndex = tierOrder.indexOf(b.tier);
    return aIndex - bIndex;
  });
}

/**
 * Group traits by tier
 */
export function groupTraitsByTier(traits: EpigeneticTrait[]): Map<TraitTier, EpigeneticTrait[]> {
  const grouped = new Map<TraitTier, EpigeneticTrait[]>();
  const tiers: TraitTier[] = ['exotic', 'ultra-rare', 'rare', 'uncommon', 'common'];

  tiers.forEach((tier) => {
    const tierTraits = traits.filter((t) => t.tier === tier);
    if (tierTraits.length > 0) {
      grouped.set(tier, tierTraits);
    }
  });

  return grouped;
}

/**
 * Check if trait provides synergy bonus with given trait IDs
 */
export function checkSynergy(
  trait: EpigeneticTrait,
  otherTraitIds: string[]
): SynergyBonus | null {
  if (!trait.competitionImpact.synergyBonuses) return null;

  for (const synergy of trait.competitionImpact.synergyBonuses) {
    const hasAllRequired = synergy.requiredTraitIds.every((id) => otherTraitIds.includes(id));
    if (hasAllRequired) {
      return synergy;
    }
  }

  return null;
}

/**
 * Calculate total competition impact including synergies
 */
export function calculateTotalImpactWithSynergies(
  trait: EpigeneticTrait,
  otherTraits: EpigeneticTrait[]
): CompetitionImpact {
  const baseImpact = { ...trait.competitionImpact };
  const otherTraitIds = otherTraits.map((t) => t.id);
  const synergy = checkSynergy(trait, otherTraitIds);

  if (synergy) {
    synergy.bonusDisciplines.forEach((discipline) => {
      baseImpact[discipline] += synergy.bonusAmount;
    });
  }

  return baseImpact;
}
