/**
 * TraitModifierList Component
 *
 * A list component that displays grouped trait modifiers with net effect calculation.
 * Traits are organized into three sections based on their category:
 * - Positive Traits: traits that boost training gain
 * - Negative Traits: traits that reduce training gain
 * - Other Traits: neutral traits with no effect
 *
 * Features:
 * - Grouped display by trait category
 * - Net effect calculation with breakdown
 * - Base gain display
 * - Empty state handling
 * - Integration with TraitModifierBadge and TraitModifierTooltip
 *
 * Story: Training Trait Modifiers - Task 3
 */

import TraitModifierBadge, { type TraitModifier } from './TraitModifierBadge';
import TraitModifierTooltip from './TraitModifierTooltip';

/**
 * Props for TraitModifierList component
 */
export interface TraitModifierListProps {
  /** Array of trait modifiers to display */
  modifiers: TraitModifier[];
  /** Base training gain before trait modifications */
  baseGain: number;
  /** Whether to show the net effect calculation section (default: true) */
  showNetEffect?: boolean;
  /** Callback for "Learn More" link in tooltips */
  onLearnMore?: () => void;
  /** Additional CSS classes to apply to the container */
  className?: string;
}

/**
 * TraitModifierList Component
 *
 * Displays trait modifiers grouped by category with net effect calculation.
 */
const TraitModifierList = ({
  modifiers,
  baseGain,
  showNetEffect = true,
  onLearnMore,
  className = '',
}: TraitModifierListProps): JSX.Element => {
  // Group modifiers by category
  const positiveModifiers = modifiers.filter((m) => m.category === 'positive');
  const negativeModifiers = modifiers.filter((m) => m.category === 'negative');
  const neutralModifiers = modifiers.filter((m) => m.category === 'neutral');

  // Calculate sums for net effect
  const positiveSum = positiveModifiers.reduce((sum, m) => sum + m.effect, 0);
  const negativeSum = Math.abs(negativeModifiers.reduce((sum, m) => sum + m.effect, 0));
  const netEffect = baseGain + positiveSum - negativeSum;

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      {/* Base Gain */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">Base Gain:</span>
        <span className="font-bold text-blue-600">+{baseGain}</span>
      </div>

      {/* Positive Traits Section */}
      {positiveModifiers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Positive Traits:</h4>
          <div className="flex flex-wrap gap-2">
            {positiveModifiers.map((modifier) => (
              <TraitModifierTooltip
                key={modifier.traitId}
                modifier={modifier}
                onLearnMore={onLearnMore}
              >
                <TraitModifierBadge modifier={modifier} />
              </TraitModifierTooltip>
            ))}
          </div>
        </div>
      )}

      {/* Negative Traits Section */}
      {negativeModifiers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Negative Traits:</h4>
          <div className="flex flex-wrap gap-2">
            {negativeModifiers.map((modifier) => (
              <TraitModifierTooltip
                key={modifier.traitId}
                modifier={modifier}
                onLearnMore={onLearnMore}
              >
                <TraitModifierBadge modifier={modifier} />
              </TraitModifierTooltip>
            ))}
          </div>
        </div>
      )}

      {/* Neutral Traits Section (Other Traits) */}
      {neutralModifiers.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Other Traits:</h4>
          <div className="flex flex-wrap gap-2">
            {neutralModifiers.map((modifier) => (
              <TraitModifierTooltip
                key={modifier.traitId}
                modifier={modifier}
                onLearnMore={onLearnMore}
              >
                <TraitModifierBadge modifier={modifier} />
              </TraitModifierTooltip>
            ))}
          </div>
        </div>
      )}

      {/* Net Effect (if showNetEffect is true) */}
      {showNetEffect && (
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">Net Effect:</span>
            <span className="font-bold text-lg text-purple-600">
              +{netEffect} ({baseGain} + {positiveSum} - {negativeSum})
            </span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {modifiers.length === 0 && (
        <p className="text-sm text-gray-500 italic">No trait modifiers for this discipline</p>
      )}
    </div>
  );
};

export default TraitModifierList;
