/**
 * PrizeNotificationModal Component
 *
 * A celebratory modal dialog for displaying prize notifications to users:
 * - Trophy/medal icons based on placement (1st: gold, 2nd: silver, 3rd: bronze)
 * - Congratulations heading with placement text
 * - Prize money with currency formatting
 * - XP gained with "+X XP" badge
 * - Competition context (name, discipline, date, horse name)
 * - Animated entrance (fade-in, scale-up)
 * - Auto-dismiss functionality with configurable delay
 *
 * Features:
 * - Uses BaseModal for portal, focus trap, scroll lock, escape key, backdrop click
 * - CinematicMoment overlay for 1st-place wins (Story 18-4)
 * - WCAG 2.1 AA compliance
 *
 * Story 5-3: Prize Notification System
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Trophy, Medal, Calendar, Award, Zap, DollarSign } from 'lucide-react';
import BaseModal from '@/components/common/BaseModal';
import CinematicMoment from '@/components/feedback/CinematicMoment';

/**
 * Prize data structure containing all information to display
 */
export interface PrizeData {
  /** Name of the horse that earned the prize */
  horseName: string;
  /** Name of the competition */
  competitionName: string;
  /** Competition discipline */
  discipline: string;
  /** Competition date */
  date: string;
  /** Placement achieved (1, 2, or 3) */
  placement: 1 | 2 | 3;
  /** Prize money won */
  prizeMoney: number;
  /** XP points gained */
  xpGained: number;
}

/**
 * PrizeNotificationModal component props
 */
export interface PrizeNotificationModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Prize data to display */
  prizeData: PrizeData;
  /** Whether to auto-dismiss the modal (default: true) */
  autoDismiss?: boolean;
  /** Auto-dismiss delay in milliseconds (default: 5000) */
  autoDismissDelay?: number;
}

/**
 * Format currency for display
 */
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format date for display
 */
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Get placement text based on rank
 */
const getPlacementText = (placement: 1 | 2 | 3): string => {
  switch (placement) {
    case 1:
      return '1st Place';
    case 2:
      return '2nd Place';
    case 3:
      return '3rd Place';
  }
};

/**
 * Get placement badge styling based on rank
 */
const getPlacementBadgeClasses = (placement: 1 | 2 | 3): string => {
  switch (placement) {
    case 1:
      return 'bg-yellow-400 text-yellow-900'; // Gold
    case 2:
      return 'bg-[rgba(148,163,184,0.3)] text-[rgb(220,235,255)]'; // Silver
    case 3:
      return 'bg-orange-600 text-orange-50'; // Bronze
  }
};

/**
 * Get gradient colors based on placement
 */
const getGradientClasses = (placement: 1 | 2 | 3): string => {
  switch (placement) {
    case 1:
      return 'from-yellow-400 via-amber-500 to-yellow-600'; // Gold gradient
    case 2:
      return 'from-[rgb(148,163,184)] via-[rgb(100,130,165)] to-[rgb(75,100,135)]'; // Silver gradient
    case 3:
      return 'from-orange-400 via-orange-500 to-orange-600'; // Bronze gradient
  }
};

/**
 * Placement icon component
 */
const PlacementIcon = memo(({ placement }: { placement: 1 | 2 | 3 }) => {
  if (placement === 1) {
    return (
      <Trophy
        className="h-10 w-10 text-yellow-500 drop-shadow-lg"
        aria-hidden="true"
        data-testid="trophy-icon"
      />
    );
  }
  return (
    <Medal
      className={`h-10 w-10 drop-shadow-lg ${
        placement === 2 ? 'text-[rgb(148,163,184)]' : 'text-orange-500'
      }`}
      aria-hidden="true"
      data-testid="medal-icon"
    />
  );
});

PlacementIcon.displayName = 'PlacementIcon';

/**
 * PrizeNotificationModal Component
 *
 * Displays a celebratory notification when a horse wins a prize.
 * Delegates portal, focus trap, scroll lock, and keyboard handling to BaseModal.
 */
const PrizeNotificationModal = memo(function PrizeNotificationModal({
  isOpen,
  onClose,
  prizeData,
  autoDismiss = true,
  autoDismissDelay = 5000,
}: PrizeNotificationModalProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Show cinematic moment for 1st-place wins (Story 18-4)
  const [showCinematic, setShowCinematic] = useState(false);

  useEffect(() => {
    if (isOpen && prizeData.placement === 1) {
      setShowCinematic(true);
    }
  }, [isOpen, prizeData.placement]);

  // Auto-dismiss timer — separate from BaseModal's focus/scroll management
  useEffect(() => {
    if (isOpen && autoDismiss) {
      timerRef.current = setTimeout(() => {
        onCloseRef.current();
      }, autoDismissDelay);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [isOpen, autoDismiss, autoDismissDelay]);

  // Handle cinematic dismiss
  const handleCinematicDismiss = useCallback(() => {
    setShowCinematic(false);
  }, []);

  const { horseName, competitionName, discipline, date, placement, prizeMoney, xpGained } =
    prizeData;

  return (
    <>
      {showCinematic && (
        <CinematicMoment
          variant="cup-win"
          title="Victory!"
          subtitle={prizeData.competitionName}
          onDismiss={handleCinematicDismiss}
        />
      )}
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title=""
        size="sm"
        showCloseButton={false}
        data-testid="prize-notification-modal"
      >
        <div className="animate-fade-in animate-scale-up -m-6 overflow-hidden rounded-lg">
          {/* Celebration Header with Gradient */}
          <div
            className={`bg-gradient-to-r ${getGradientClasses(placement)} p-6 text-center relative`}
            data-testid="celebration-header"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 text-white/80 hover:text-[var(--text-primary)] transition-colors p-1 rounded-full hover:bg-white/10"
              aria-label="Close prize notification"
              data-testid="close-button"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Placement Icon */}
            <div className="flex justify-center mb-3">
              <div className="bg-white/20 rounded-full p-4">
                <PlacementIcon placement={placement} />
              </div>
            </div>

            {/* Congratulations Heading */}
            <h2
              id="prize-modal-title"
              className="text-2xl font-bold text-[var(--text-primary)] mb-1"
              data-testid="congratulations-heading"
            >
              Congratulations! {getPlacementText(placement)}!
            </h2>

            {/* Horse Name */}
            <p className="text-white/90 font-medium" data-testid="horse-name">
              {horseName}
            </p>
          </div>

          {/* Modal Content */}
          <div className="p-6" data-testid="modal-content">
            {/* Placement Badge */}
            <div className="flex justify-center mb-6">
              <span
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${getPlacementBadgeClasses(placement)}`}
                data-testid="placement-badge"
              >
                <PlacementIcon placement={placement} />
                <span className="sr-only">Achieved </span>
                {getPlacementText(placement)}
              </span>
            </div>

            {/* Prize Breakdown */}
            <div className="space-y-4">
              {/* Prize Money */}
              <div className="flex items-center justify-between p-4 bg-[rgba(16,185,129,0.1)] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="bg-[rgba(16,185,129,0.2)] p-2 rounded-full">
                    <DollarSign className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-[rgb(220,235,255)]">Prize Money</span>
                </div>
                <span className="text-xl font-bold text-emerald-400" data-testid="prize-money">
                  {formatCurrency(prizeMoney)}
                </span>
              </div>

              {/* XP Gained */}
              <div className="flex items-center justify-between p-4 bg-[rgba(147,51,234,0.1)] rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="bg-[rgba(147,51,234,0.2)] p-2 rounded-full">
                    <Zap className="h-5 w-5 text-purple-400" aria-hidden="true" />
                  </div>
                  <span className="text-sm font-medium text-[rgb(220,235,255)]">
                    Experience Gained
                  </span>
                </div>
                <span className="text-xl font-bold text-purple-400" data-testid="xp-gained">
                  +{xpGained} XP
                </span>
              </div>
            </div>

            {/* Competition Context */}
            <div className="mt-6 pt-4 border-t border-[rgba(37,99,235,0.2)]">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-[rgb(148,163,184)]" aria-hidden="true" />
                <span
                  className="text-sm font-medium text-[rgb(148,163,184)]"
                  data-testid="competition-name"
                >
                  {competitionName}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[rgb(148,163,184)]">
                <span
                  className="bg-[rgba(37,99,235,0.1)] text-blue-400 px-2 py-1 rounded-full"
                  data-testid="competition-discipline"
                >
                  {discipline}
                </span>
                <span className="flex items-center gap-1" data-testid="competition-date">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {formatDate(date)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </BaseModal>
    </>
  );
});

export default PrizeNotificationModal;
