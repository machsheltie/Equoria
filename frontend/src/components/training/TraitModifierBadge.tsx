/**
 * TraitModifierBadge Component
 *
 * A badge component that displays trait modifiers with visual indicators
 * for positive/negative/neutral effects on horse training.
 *
 * Features:
 * - Color-coded badges based on trait category (positive, negative, neutral)
 * - Icons from lucide-react (Plus, Minus, Info)
 * - Three size variants (sm, md, lg)
 * - Accessible with ARIA labels and role="status"
 * - Data-testid for testing purposes
 * - Future tooltip integration via showTooltip prop
 *
 * Story: Training Trait Modifiers - Task 1
 */

import { Plus, Minus, Info } from 'lucide-react';

/**
 * Interface representing a trait modifier with its effect on training
 */
export interface TraitModifier {
  /** Unique identifier for the trait, e.g., "athletic" */
  traitId: string;
  /** Display name for the trait, e.g., "Athletic" */
  traitName: string;
  /** Numeric effect value: positive (+3), negative (-2), or neutral (0) */
  effect: number;
  /** Description of what the trait does */
  description: string;
  /** List of disciplines affected by this trait */
  affectedDisciplines: string[];
  /** Category determining visual styling */
  category: 'positive' | 'negative' | 'neutral';
}

/**
 * Props for TraitModifierBadge component
 */
export interface TraitModifierBadgeProps {
  /** The trait modifier to display */
  modifier: TraitModifier;
  /** Whether to show tooltip on hover (reserved for future implementation) */
  showTooltip?: boolean;
  /** Size variant of the badge */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes to apply */
  className?: string;
}

/**
 * Configuration for badge styling based on category
 */
interface CategoryConfig {
  bgColor: string;
  borderColor: string;
  textColor: string;
  Icon: typeof Plus;
}

/**
 * Style configurations for each trait category
 */
const categoryConfigs: Record<TraitModifier['category'], CategoryConfig> = {
  positive: {
    bgColor: 'bg-green-100',
    borderColor: 'border-green-500',
    textColor: 'text-green-700',
    Icon: Plus,
  },
  negative: {
    bgColor: 'bg-red-100',
    borderColor: 'border-red-500',
    textColor: 'text-red-700',
    Icon: Minus,
  },
  neutral: {
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    textColor: 'text-gray-600',
    Icon: Info,
  },
};

/**
 * Size configuration for badge dimensions
 */
interface SizeConfig {
  padding: string;
  textSize: string;
  iconSize: string;
}

/**
 * Size configurations for sm, md, lg variants
 */
const sizeConfigs: Record<NonNullable<TraitModifierBadgeProps['size']>, SizeConfig> = {
  sm: {
    padding: 'px-1.5 py-0.5',
    textSize: 'text-xs',
    iconSize: 'w-2.5 h-2.5',
  },
  md: {
    padding: 'px-2 py-1',
    textSize: 'text-xs',
    iconSize: 'w-3 h-3',
  },
  lg: {
    padding: 'px-3 py-1.5',
    textSize: 'text-sm',
    iconSize: 'w-4 h-4',
  },
};

/**
 * Generates the ARIA label based on trait category and effect
 */
function getAriaLabel(modifier: TraitModifier): string {
  const { traitName, effect, category } = modifier;

  if (category === 'positive') {
    return `${traitName} trait: +${effect} bonus`;
  }

  if (category === 'negative') {
    return `${traitName} trait: ${effect} penalty`;
  }

  return `${traitName} trait: no effect`;
}

/**
 * Formats the display text for the badge
 * Shows "TraitName +N" for positive, "TraitName -N" for negative, "TraitName" for neutral
 */
function formatDisplayText(modifier: TraitModifier): string {
  const { traitName, effect, category } = modifier;

  if (category === 'neutral') {
    return traitName;
  }

  // For positive effects, add '+' prefix; negative effects already have '-'
  const formattedEffect = effect > 0 ? `+${effect}` : `${effect}`;
  return `${traitName} ${formattedEffect}`;
}

/**
 * TraitModifierBadge Component
 *
 * Displays a trait modifier as a styled badge with appropriate visual
 * indicators based on whether the trait has a positive, negative, or
 * neutral effect on horse training.
 */
const TraitModifierBadge = ({
  modifier,
  showTooltip: _showTooltip = true,
  size = 'md',
  className = '',
}: TraitModifierBadgeProps): JSX.Element => {
  // Note: _showTooltip is reserved for future tooltip integration
  // Get configuration based on category and size
  const categoryConfig = categoryConfigs[modifier.category];
  const sizeConfig = sizeConfigs[size];
  const { Icon } = categoryConfig;

  // Generate accessibility label
  const ariaLabel = getAriaLabel(modifier);

  // Format display text
  const displayText = formatDisplayText(modifier);

  return (
    <div
      data-testid={`trait-badge-${modifier.traitId}`}
      role="status"
      aria-label={ariaLabel}
      className={`
        inline-flex items-center gap-1 rounded-full border
        ${sizeConfig.padding}
        ${sizeConfig.textSize}
        ${categoryConfig.bgColor}
        ${categoryConfig.borderColor}
        ${categoryConfig.textColor}
        ${className}
      `
        .trim()
        .replace(/\s+/g, ' ')}
    >
      {/* Icon indicator for trait category */}
      <Icon data-testid="trait-icon" aria-hidden="true" className={sizeConfig.iconSize} />

      {/* Trait name and effect display */}
      <span data-testid="trait-text" className="font-medium">
        {displayText}
      </span>
    </div>
  );
};

export default TraitModifierBadge;
