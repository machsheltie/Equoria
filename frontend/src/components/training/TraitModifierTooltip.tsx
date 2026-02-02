/**
 * TraitModifierTooltip Component
 *
 * A tooltip component that displays detailed information about trait modifiers
 * when hovering or focusing on trait badges.
 *
 * Features:
 * - Show/hide with 200ms delay to prevent accidental shows
 * - Keyboard accessible (focus/blur support, Escape key to close)
 * - Displays trait name, effect description, affected disciplines, and description
 * - Optional "Learn More" button with callback
 * - ARIA attributes for accessibility (role="tooltip", aria-describedby)
 * - Stays visible when hovering over tooltip itself
 *
 * Story: Training Trait Modifiers - Task 2
 */

import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { formatDisciplineName } from '../../lib/utils/training-utils';

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
 * Props for TraitModifierTooltip component
 */
export interface TraitModifierTooltipProps {
  /** The trait modifier to display */
  modifier: TraitModifier;
  /** Trigger element (e.g., badge) */
  children: React.ReactNode;
  /** Callback for "Learn More" link */
  onLearnMore?: () => void;
}

/**
 * Delay in milliseconds before showing tooltip (prevents accidental shows)
 */
const SHOW_DELAY_MS = 200;

/**
 * Format the effect description based on trait category and effect value
 *
 * @param modifier - The trait modifier
 * @returns Formatted effect description string
 */
function formatEffectDescription(modifier: TraitModifier): string {
  const { effect, category, affectedDisciplines } = modifier;

  if (category === 'neutral') {
    return 'No effect on training';
  }

  // Determine discipline type text
  const disciplineType = affectedDisciplines.includes('all') ? 'all' : 'affected';

  // Format the effect with sign
  const effectText = effect > 0 ? `+${effect}` : `${effect}`;

  return `${effectText} to ${disciplineType} disciplines`;
}

/**
 * Format the discipline list for display
 *
 * @param affectedDisciplines - Array of discipline IDs
 * @returns Formatted string of discipline names
 */
function formatDisciplineList(affectedDisciplines: string[]): string {
  // Check if affects all disciplines
  if (affectedDisciplines.includes('all')) {
    return 'All disciplines';
  }

  // Format each discipline name and join with commas
  return affectedDisciplines.map((id) => formatDisciplineName(id)).join(', ');
}

/**
 * TraitModifierTooltip Component
 *
 * Displays detailed information about a trait modifier in a tooltip
 * that appears on hover or focus of the trigger element.
 */
const TraitModifierTooltip = ({
  modifier,
  children,
  onLearnMore,
}: TraitModifierTooltipProps): JSX.Element => {
  // State for tooltip visibility
  const [isVisible, setIsVisible] = useState(false);

  // Refs for timeout management and elements
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringTooltipRef = useRef(false);
  const isHoveringTriggerRef = useRef(false);

  // Generate unique ID for tooltip
  const tooltipId = useId();
  const fullTooltipId = `tooltip-${tooltipId}`;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Show tooltip after delay
   */
  const showTooltip = useCallback(() => {
    // Cancel any pending hide
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
    }

    // Start show delay
    showTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, SHOW_DELAY_MS);
  }, []);

  /**
   * Hide tooltip immediately
   */
  const hideTooltip = useCallback(() => {
    // Cancel any pending show
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    // Only hide if not hovering trigger or tooltip
    if (!isHoveringTriggerRef.current && !isHoveringTooltipRef.current) {
      setIsVisible(false);
    }
  }, []);

  /**
   * Handle mouse enter on trigger
   */
  const handleTriggerMouseEnter = useCallback(() => {
    isHoveringTriggerRef.current = true;
    showTooltip();
  }, [showTooltip]);

  /**
   * Handle mouse leave on trigger
   */
  const handleTriggerMouseLeave = useCallback(() => {
    isHoveringTriggerRef.current = false;
    // Small delay to allow moving to tooltip
    setTimeout(() => {
      hideTooltip();
    }, 10);
  }, [hideTooltip]);

  /**
   * Handle mouse enter on tooltip
   */
  const handleTooltipMouseEnter = useCallback(() => {
    isHoveringTooltipRef.current = true;
  }, []);

  /**
   * Handle mouse leave on tooltip
   */
  const handleTooltipMouseLeave = useCallback(() => {
    isHoveringTooltipRef.current = false;
    hideTooltip();
  }, [hideTooltip]);

  /**
   * Handle focus on trigger
   */
  const handleFocus = useCallback(() => {
    showTooltip();
  }, [showTooltip]);

  /**
   * Handle blur on trigger
   */
  const handleBlur = useCallback(() => {
    // Cancel any pending show
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  /**
   * Handle Escape key press
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      // Cancel any pending show
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = null;
      }
      setIsVisible(false);
    }
  }, []);

  // Format content for display
  const effectDescription = formatEffectDescription(modifier);
  const disciplineList = formatDisciplineList(modifier.affectedDisciplines);

  return (
    <div className="relative inline-block">
      {/* Trigger element wrapper */}
      <div
        tabIndex={0}
        aria-describedby={isVisible ? fullTooltipId : undefined}
        onMouseEnter={handleTriggerMouseEnter}
        onMouseLeave={handleTriggerMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>

      {/* Tooltip content */}
      {isVisible && (
        <div
          id={fullTooltipId}
          role="tooltip"
          className="absolute z-50 w-64 p-3 mt-2 bg-white rounded-lg shadow-lg border border-gray-200"
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        >
          {/* Trait name heading */}
          <h4 className="font-semibold text-sm mb-2">{modifier.traitName}</h4>

          {/* Divider */}
          <hr className="border-gray-200 mb-2" />

          {/* Effect description */}
          <p className="text-xs text-gray-600 mb-2">
            <span className="font-medium">Effect:</span> {effectDescription}
          </p>

          {/* Affected disciplines */}
          <p className="text-xs text-gray-600 mb-2">
            <span className="font-medium">Disciplines:</span> {disciplineList}
          </p>

          {/* Full description */}
          <p className="text-xs text-gray-700 mb-3">{modifier.description}</p>

          {/* Learn More button (optional) */}
          {onLearnMore && (
            <button
              type="button"
              onClick={onLearnMore}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Learn More &rarr;
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TraitModifierTooltip;
