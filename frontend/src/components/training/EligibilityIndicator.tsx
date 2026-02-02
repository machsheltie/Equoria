/**
 * EligibilityIndicator Component
 *
 * Displays training eligibility status for a horse with:
 * - Visual color-coded badge based on eligibility state
 * - Icon representation for each state (CheckCircle, Clock, X, AlertCircle)
 * - Conditional date/countdown display for cooldowns
 * - Two variants: compact (inline) and full (card)
 * - Accessible with ARIA labels and semantic HTML
 *
 * Story 4-2: Training Eligibility Display - Task 1
 */

import { CheckCircle, Clock, X, AlertCircle } from 'lucide-react';
import { canTrain, formatCooldownDate } from '../../lib/utils/training-utils';
import type { Horse } from '../../lib/utils/training-utils';

/**
 * Props for EligibilityIndicator component
 */
export interface EligibilityIndicatorProps {
  /**
   * The horse to check eligibility for
   */
  horse: Horse;

  /**
   * Display variant: 'compact' for inline, 'full' for card display
   * @default 'full'
   */
  variant?: 'compact' | 'full';

  /**
   * Whether to show the status icon
   * @default true
   */
  showIcon?: boolean;

  /**
   * Whether to show the cooldown date/countdown
   * @default true
   */
  showDate?: boolean;

  /**
   * Optional CSS class for the container
   */
  className?: string;
}

/**
 * Eligibility status type for internal use
 */
type EligibilityStatus = 'ready' | 'cooldown' | 'too-young' | 'too-old';

/**
 * Configuration for each eligibility status
 */
interface StatusConfig {
  text: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  Icon: typeof CheckCircle;
}

/**
 * Status configuration mapping
 */
const statusConfigs: Record<EligibilityStatus, StatusConfig> = {
  ready: {
    text: 'Ready to Train',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-500',
    textColor: 'text-green-800',
    iconColor: 'text-green-600',
    Icon: CheckCircle,
  },
  cooldown: {
    text: 'On Cooldown',
    bgColor: 'bg-amber-100',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-800',
    iconColor: 'text-amber-600',
    Icon: Clock,
  },
  'too-young': {
    text: 'Too Young',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-400',
    textColor: 'text-gray-700',
    iconColor: 'text-gray-500',
    Icon: X,
  },
  'too-old': {
    text: 'Too Old',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-500',
    textColor: 'text-red-800',
    iconColor: 'text-red-600',
    Icon: AlertCircle,
  },
};

/**
 * Determines the eligibility status of a horse
 */
function getEligibilityStatus(horse: Horse): EligibilityStatus {
  // Check age first - too young (under 3)
  if (horse.age < 3) {
    return 'too-young';
  }

  // Check age - too old (over 20)
  if (horse.age > 20) {
    return 'too-old';
  }

  // Use canTrain utility for cooldown check
  const eligibility = canTrain(horse);

  if (eligibility.eligible) {
    return 'ready';
  }

  // If not eligible due to cooldown, check if reason mentions cooldown
  if (eligibility.reason?.toLowerCase().includes('cooldown')) {
    return 'cooldown';
  }

  // Default to ready if no specific reason (shouldn't happen with valid data)
  return 'ready';
}

/**
 * EligibilityIndicator Component
 *
 * Displays the training eligibility status for a horse with appropriate
 * visual styling, icons, and optional cooldown date display.
 */
const EligibilityIndicator = ({
  horse,
  variant = 'full',
  showIcon = true,
  showDate = true,
  className = '',
}: EligibilityIndicatorProps): JSX.Element => {
  // Determine eligibility status
  const status = getEligibilityStatus(horse);
  const config = statusConfigs[status];
  const { Icon } = config;

  // Determine if we should show cooldown date
  const hasCooldown = status === 'cooldown' && horse.trainingCooldown;
  const shouldShowDate = showDate && hasCooldown;

  // Format cooldown date if applicable
  const cooldownDateText = shouldShowDate ? formatCooldownDate(horse.trainingCooldown!) : null;

  // Variant-specific classes
  const isCompact = variant === 'compact';
  const paddingClass = isCompact ? 'px-2 py-1' : 'px-3 py-2';
  const textSizeClass = isCompact ? 'text-xs' : 'text-sm';
  const iconSizeClass = isCompact ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div
      data-testid="eligibility-indicator"
      role="status"
      aria-label={`Training eligibility: ${config.text}`}
      className={`
        flex items-center gap-2 rounded-lg border-2
        ${paddingClass}
        ${config.bgColor}
        ${config.borderColor}
        ${className}
      `.trim()}
    >
      {/* Status Icon */}
      {showIcon && (
        <Icon
          data-testid="status-icon"
          aria-hidden="true"
          className={`${iconSizeClass} ${config.iconColor}`}
        />
      )}

      {/* Status Content */}
      <div>
        {/* Status Text */}
        <div
          data-testid="status-text"
          className={`font-medium ${textSizeClass} ${config.textColor}`}
        >
          {config.text}
        </div>

        {/* Cooldown Date (only for cooldown status) */}
        {shouldShowDate && cooldownDateText && (
          <div
            data-testid="cooldown-date"
            className={`${isCompact ? 'text-[10px]' : 'text-xs'} text-gray-600`}
          >
            {cooldownDateText}
          </div>
        )}
      </div>
    </div>
  );
};

export default EligibilityIndicator;
